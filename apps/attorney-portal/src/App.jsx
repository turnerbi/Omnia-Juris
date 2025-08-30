import React, { useState, useEffect } from 'react';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cases, setCases] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newTimeCaseId, setNewTimeCaseId] = useState('');
  const [newTimeHours, setNewTimeHours] = useState('');
  const [newTimeRate, setNewTimeRate] = useState('');
  const [newTimeDesc, setNewTimeDesc] = useState('');
  const [newTaskCaseId, setNewTaskCaseId] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [error, setError] = useState('');

  // Fetch cases and appointments when token changes
  useEffect(() => {
    if (token) {
      fetch('/api/cases', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(setCases)
        .catch(console.error);
      fetch('/api/appointments', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(res => res.json())
        .then(setAppointments)
        .catch(console.error);
      // Fetch tasks
      fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTasks)
        .catch(console.error);
      // Fetch time entries
      fetch('/api/time_entries', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTimeEntries)
        .catch(console.error);
    }
  }, [token]);

  // Fetch messages when selected case changes
  useEffect(() => {
    if (token && selectedCaseId) {
      fetch(`/api/messages?caseId=${selectedCaseId}`, { headers: { Authorization: `Bearer ${token}` } })
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

  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Attorney/Staff Login</h2>
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
      <h2>Your Assigned Cases</h2>
      {cases.length === 0 ? <p>No assigned cases.</p> : (
        <ul>
          {cases.map(c => (
            <li key={c.id}>{c.title} – {c.status}</li>
          ))}
        </ul>
      )}
      <h2>Upcoming Appointments</h2>
      {appointments.length === 0 ? <p>No upcoming appointments.</p> : (
        <ul>
          {appointments.map(a => (
            <li key={a.id}>{new Date(a.requestedDate).toLocaleString()} – Case #{a.caseId}</li>
          ))}
        </ul>
      )}

      <h2>Your Tasks</h2>
      {tasks.length === 0 ? <p>No tasks.</p> : (
        <ul>
          {tasks.map(t => (
            <li key={t.id}>Case #{t.caseId} – {t.description} – {t.status}</li>
          ))}
        </ul>
      )}

      <h3>Create Task</h3>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!newTaskCaseId || !newTaskDesc) return;
        fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ caseId: parseInt(newTaskCaseId, 10), description: newTaskDesc, dueDate: newTaskDueDate }),
        })
          .then(res => res.json())
          .then(task => {
            setTasks(prev => [...prev, task]);
            setNewTaskCaseId('');
            setNewTaskDesc('');
            setNewTaskDueDate('');
          })
          .catch(console.error);
      }} style={{ maxWidth: '400px' }}>
        <div>
          <label>Case:</label>
          <select value={newTaskCaseId} onChange={e => setNewTaskCaseId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select Case</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label>Description:</label>
          <input value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label>Due Date:</label>
          <input type="date" value={newTaskDueDate} onChange={e => setNewTaskDueDate(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button type="submit">Create Task</button>
      </form>

      <h2>Your Time Entries</h2>
      {timeEntries.length === 0 ? <p>No time entries.</p> : (
        <ul>
          {timeEntries.map(te => (
            <li key={te.id}>Case #{te.caseId} – {te.hours} h × ${te.rate} – ${te.hours * te.rate}</li>
          ))}
        </ul>
      )}

      <h3>Log Time Entry</h3>
      <form onSubmit={(e) => {
        e.preventDefault();
        if (!newTimeCaseId || !newTimeHours || !newTimeRate) return;
        fetch('/api/time_entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ caseId: parseInt(newTimeCaseId, 10), hours: parseFloat(newTimeHours), rate: parseFloat(newTimeRate), description: newTimeDesc }),
        })
          .then(res => res.json())
          .then(entry => {
            setTimeEntries(prev => [...prev, entry]);
            setNewTimeCaseId('');
            setNewTimeHours('');
            setNewTimeRate('');
            setNewTimeDesc('');
          })
          .catch(console.error);
      }} style={{ maxWidth: '400px' }}>
        <div>
          <label>Case:</label>
          <select value={newTimeCaseId} onChange={e => setNewTimeCaseId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select Case</option>
            {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </div>
        <div>
          <label>Hours:</label>
          <input type="number" step="0.1" value={newTimeHours} onChange={e => setNewTimeHours(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label>Rate:</label>
          <input type="number" step="0.01" value={newTimeRate} onChange={e => setNewTimeRate(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div>
          <label>Description:</label>
          <input value={newTimeDesc} onChange={e => setNewTimeDesc(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button type="submit">Log Time</button>
      </form>

      <h2>Messages</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label>Select Case:</label>
        <select value={selectedCaseId} onChange={e => setSelectedCaseId(e.target.value)} style={{ width: '100%' }}>
          <option value="">-- choose a case --</option>
          {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      </div>
      {selectedCaseId && (
        <div>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #ccc', padding: '0.5rem' }}>
            {messages.map(m => (
              <div key={m.id} style={{ marginBottom: '0.5rem' }}>
                <strong>{m.sender.name}:</strong> {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!newMessage) return;
            // For messaging we need to choose receiver; choose client if user is attorney or staff, or choose first assignee if user is client.
            const selectedCase = cases.find(c => c.id === parseInt(selectedCaseId, 10));
            let receiverId = null;
            if (!selectedCase) return;
            if (user.role === 'attorney' || user.role === 'staff') {
              receiverId = selectedCase.clientUserId;
            } else if (user.role === 'client') {
              // send to first assignee
              receiverId = selectedCase.assignedToIds[0];
            }
            if (!receiverId) return;
            fetch('/api/messages', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ caseId: parseInt(selectedCaseId, 10), receiverId, text: newMessage }),
            })
              .then(res => res.json())
              .then(msg => {
                setMessages(prev => [...prev, msg]);
                setNewMessage('');
              })
              .catch(console.error);
          }} style={{ display: 'flex', marginTop: '0.5rem' }}>
            <input value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ flex: 1 }} placeholder="Type your message" />
            <button type="submit">Send</button>
          </form>
        </div>
      )}
    </div>
  );
}

export default App;