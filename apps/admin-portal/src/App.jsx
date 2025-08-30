import React, { useState, useEffect } from 'react';

function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cases, setCases] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [vendorInvoices, setVendorInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [error, setError] = useState('');

  // Additional admin data: time entries, expenses and billing summaries
  const [timeEntries, setTimeEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [billingSummaries, setBillingSummaries] = useState({});

  const approveVendorInvoice = (id) => {
    fetch(`/api/vendor_invoices/${id}/approve`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(updated => {
        // update local state
        setVendorInvoices(prev => prev.map(inv => (inv.id === id ? updated : inv)));
      })
      .catch(err => console.error(err));
  };

  const rejectVendorInvoice = (id) => {
    fetch(`/api/vendor_invoices/${id}/reject`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(updated => {
        setVendorInvoices(prev => prev.map(inv => (inv.id === id ? updated : inv)));
      })
      .catch(err => console.error(err));
  };

  // Load billing summary for a specific case and cache in state
  const handleLoadBillingSummary = (caseId) => {
    if (!token) return;
    fetch(`/api/cases/${caseId}/billing_summary`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.json())
      .then(data => {
        setBillingSummaries(prev => ({ ...prev, [caseId]: data }));
      })
      .catch(err => console.error(err));
  };

  // Fetch cases when logged in
  useEffect(() => {
    if (token) {
      fetch('/api/cases', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          setCases(data);
        })
        .catch(err => console.error(err));

      // Fetch tasks
      fetch('/api/tasks', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTasks)
        .catch(err => console.error(err));
      // Fetch vendor invoices (admin sees all)
      fetch('/api/invoices', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          // Filter vendor invoices from combined invoices list
          const vendorInvs = data.filter(inv => inv.vendorId);
          setVendorInvoices(vendorInvs);
        })
        .catch(err => console.error(err));
      // Fetch payments
      fetch('/api/payments', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setPayments)
        .catch(err => console.error(err));

      // Fetch time entries
      fetch('/api/time_entries', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTimeEntries)
        .catch(err => console.error(err));

      // Fetch expenses
      fetch('/api/expenses', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setExpenses)
        .catch(err => console.error(err));
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

  if (!token) {
    return (
      <div style={{ maxWidth: '400px', margin: '2rem auto', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Admin Login</h2>
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
      {cases.length === 0 && <p>No cases available.</p>}
      <ul>
        {cases.map(c => (
          <li key={c.id} style={{ marginBottom: '0.5rem' }}>
            <strong>{c.title}</strong> – {c.status}
            <div style={{ marginTop: '0.25rem' }}>
              <button onClick={() => handleLoadBillingSummary(c.id)}>Billing Summary</button>
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

      <h2>Tasks</h2>
      {tasks.length === 0 ? <p>No tasks.</p> : (
        <ul>
          {tasks.map(t => (
            <li key={t.id}>Case #{t.caseId} – {t.description} (assigned to {t.assignedToId}) – {t.status}</li>
          ))}
        </ul>
      )}

      <h2>Vendor Invoices</h2>
      {vendorInvoices.length === 0 ? <p>No vendor invoices.</p> : (
        <ul>
          {vendorInvoices.map(inv => (
            <li key={inv.id}>
              Case #{inv.caseId} – ${inv.amount} – {inv.status}
              {inv.status === 'pending' && (
                <span style={{ marginLeft: '1rem' }}>
                  <button onClick={() => approveVendorInvoice(inv.id)}>Approve</button>{' '}
                  <button onClick={() => rejectVendorInvoice(inv.id)}>Reject</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <h2>Payments</h2>
      {payments.length === 0 ? <p>No payments.</p> : (
        <ul>
          {payments.map(p => (
            <li key={p.id}>Invoice #{p.invoiceId} – ${p.amount} – {new Date(p.paidAt).toLocaleDateString()}</li>
          ))}
        </ul>
      )}

      <h2>Time Entries</h2>
      {timeEntries.length === 0 ? <p>No time entries.</p> : (
        <ul>
          {timeEntries.map(te => (
            <li key={te.id}>
              Case #{te.caseId} – {te.hours}h @ ${parseFloat(te.rate).toFixed(2)} by {te.user?.name || te.userId}
              {te.description && <span> – {te.description}</span>}
            </li>
          ))}
        </ul>
      )}

      <h2>Expenses</h2>
      {expenses.length === 0 ? <p>No expenses.</p> : (
        <ul>
          {expenses.map(exp => (
            <li key={exp.id}>
              Case #{exp.caseId} – ${parseFloat(exp.amount).toFixed(2)}
              {exp.vendor && <span> – Vendor: {exp.vendor}</span>}
              {exp.category && <span> – Category: {exp.category}</span>}
              {exp.description && <span> – {exp.description}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default App;