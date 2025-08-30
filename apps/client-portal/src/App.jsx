import React, { useState, useEffect } from 'react';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cases, setCases] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [appointmentCaseId, setAppointmentCaseId] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentMessage, setAppointmentMessage] = useState('');

  // Messaging state
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  // Billing summary state (per case)
  const [billingSummaries, setBillingSummaries] = useState({});

  useEffect(() => {
    if (token) {
      fetch('/api/cases', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setCases)
        .catch(console.error);
      fetch('/api/appointments', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setAppointments)
        .catch(console.error);
      fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setInvoices)
        .catch(console.error);
    }
  }, [token]);

  // Fetch messages when selected case changes
  useEffect(() => {
    if (token && selectedCaseId) {
      fetch(`/api/messages?caseId=${selectedCaseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(setMessages)
        .catch(console.error);
    }
  }, [token, selectedCaseId]);

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          setError(data.error);
        } else {
          setToken(data.token);
          setUser(data.user);
        }
      })
      .catch(err => {
        console.error(err);
        setError('Login failed');
      });
  };

  const handleCreateAppointment = (e) => {
    e.preventDefault();
    if (!appointmentCaseId || !appointmentDate) {
      return;
    }
    fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ caseId: parseInt(appointmentCaseId, 10), requestedDate: appointmentDate, message: appointmentMessage }),
    })
      .then(res => res.json())
      .then(data => {
        setAppointments(prev => [...prev, data]);
        // reset form
        setAppointmentCaseId('');
        setAppointmentDate('');
        setAppointmentMessage('');
      })
      .catch(err => console.error(err));
  };

  // Fetch billing summary for a case and store it in state
  const handleLoadBillingSummary = (caseId) => {
    if (!token) return;
    fetch(`/api/cases/${caseId}/billing_summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        setBillingSummaries(prev => ({ ...prev, [caseId]: data }));
      })
      .catch(console.error);
  };

  // Send a new message
  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage || !selectedCaseId) return;
    // Determine receiver: pick first assigned attorney/staff from case
    const selectedCase = cases.find(c => c.id === selectedCaseId);
    let receiverId = null;
    if (selectedCase && selectedCase.assignedToIds && selectedCase.assignedToIds.length > 0) {
      receiverId = selectedCase.assignedToIds[0];
    }
    if (!receiverId) {
      console.warn('No receiver available for this case');
      return;
    }
    fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ caseId: selectedCaseId, receiverId, text: newMessage }),
    })
      .then(res => res.json())
      .then(data => {
        setMessages(prev => [...prev, data]);
        setNewMessage('');
      })
      .catch(console.error);
  };

  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Client Login</h2>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Email:</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            <label>Password:</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%' }} />
          </div>
          <button type="submit">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Welcome, {user?.name}</h1>
      <h2>Your Cases</h2>
      {cases.length === 0 ? <p>No cases assigned.</p> : (
        <ul>
          {cases.map(c => (
            <li key={c.id} style={{ marginBottom: '0.5rem' }}>
              <strong>{c.title}</strong> – {c.status}
              <div style={{ marginTop: '0.25rem' }}>
                <button onClick={() => handleLoadBillingSummary(c.id)}>Billing Summary</button>{' '}
                <button onClick={() => setSelectedCaseId(c.id)}>Messages</button>
              </div>
              {billingSummaries[c.id] && (
                <div style={{ marginTop: '0.25rem', paddingLeft: '1rem', borderLeft: '2px solid #ccc' }}>
                  <p>Fees: ${billingSummaries[c.id].totalFees.toFixed(2)}</p>
                  <p>Expenses: ${billingSummaries[c.id].totalExpenses.toFixed(2)}</p>
                  <p>Total Billed: ${billingSummaries[c.id].totalBilled.toFixed(2)}</p>
                  <p>Paid: ${billingSummaries[c.id].totalPaid.toFixed(2)}</p>
                  <p><strong>Balance Due: ${billingSummaries[c.id].balanceDue.toFixed(2)}</strong></p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <h2>Invoices</h2>
      {invoices.length === 0 ? <p>No invoices.</p> : (
        <ul>
          {invoices.map(inv => (
            <li key={inv.id}>Case #{inv.caseId} – ${inv.amount} – {inv.status}</li>
          ))}
        </ul>
      )}
      <h2>Appointment Requests</h2>
      {appointments.length === 0 ? <p>No appointments.</p> : (
        <ul>
          {appointments.map(a => (
            <li key={a.id}>{new Date(a.requestedDate).toLocaleString()} – Case #{a.caseId}</li>
          ))}
        </ul>
      )}
      <h3>Request New Appointment</h3>
      <form onSubmit={handleCreateAppointment} style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>Case:</label>
          <select value={appointmentCaseId} onChange={e => setAppointmentCaseId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select Case</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>Date/Time:</label>
          <input type="datetime-local" value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>Message:</label>
          <textarea value={appointmentMessage} onChange={e => setAppointmentMessage(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button type="submit">Request Appointment</button>
      </form>

      {/* Messaging Section */}
      {selectedCaseId && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Messages for Case #{selectedCaseId}</h2>
          {messages.length === 0 ? <p>No messages yet.</p> : (
            <ul style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ccc', padding: '0.5rem' }}>
              {messages.map(m => (
                <li key={m.id} style={{ marginBottom: '0.5rem' }}>
                  <strong>{m.sender?.name || m.senderId}:</strong> {m.text} <em>({new Date(m.createdAt).toLocaleString()})</em>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleSendMessage} style={{ marginTop: '0.5rem' }}>
            <textarea
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              style={{ width: '100%', height: '80px' }}
            />
            <button type="submit" disabled={!newMessage}>Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;