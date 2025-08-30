import React, { useState, useEffect } from 'react';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [cases, setCases] = useState([]);
  const [caseId, setCaseId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) {
      fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setInvoices)
        .catch(console.error);
      fetch('/api/cases', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setCases)
        .catch(console.error);
    }
  }, [token]);

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

  const handleSubmitInvoice = (e) => {
    e.preventDefault();
    if (!caseId || !amount) return;
    fetch('/api/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ caseId: parseInt(caseId, 10), amount: parseFloat(amount), description }),
    })
      .then(res => res.json())
      .then(data => {
        setInvoices(prev => [...prev, data]);
        setCaseId('');
        setAmount('');
        setDescription('');
      })
      .catch(console.error);
  };

  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Vendor Login</h2>
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
      <h2>Your Invoices</h2>
      {invoices.length === 0 ? <p>No invoices submitted.</p> : (
        <ul>
          {invoices.map(inv => (
            <li key={inv.id}>
              {(() => {
                const caseObj = cases.find(c => c.id === inv.caseId);
                const caseLabel = caseObj ? caseObj.title : `Case #${inv.caseId}`;
                return `${caseLabel} – $${inv.amount} – ${inv.status}`;
              })()}
            </li>
          ))}
        </ul>
      )}
      <h2>Submit New Invoice</h2>
      <form onSubmit={handleSubmitInvoice} style={{ maxWidth: '400px' }}>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>Case:</label>
          <select value={caseId} onChange={e => setCaseId(e.target.value)} style={{ width: '100%' }}>
            <option value="">Select Case</option>
            {cases.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>Amount:</label>
          <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: '100%' }} />
        </div>
        <div style={{ marginBottom: '0.5rem' }}>
          <label>Description:</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} style={{ width: '100%' }} />
        </div>
        <button type="submit">Submit Invoice</button>
      </form>
    </div>
  );
}

export default App;