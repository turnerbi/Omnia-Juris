/*
 * Express API server for Omnia Juris
 *
 * This server implements a multi‑tenant backend for legal case
 * management.  It uses Prisma to connect to a PostgreSQL database
 * and JSON Web Tokens (JWT) for authentication.  Roles and tenant
 * scopes are enforced through middleware.  Endpoints include
 * registration, login, case management, appointment requests,
 * invoice submission and retrieval.  Note that this file
 * references external dependencies such as express and prisma,
 * which must be installed via npm before running (see package.json).
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.use(cors());
app.use(express.json());

// Generate a JWT for a user
function generateToken(user) {
  // Only include safe fields in the token payload
  const payload = { id: user.id, tenantId: user.tenantId, role: user.role };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
}

// Middleware to authenticate and attach user to request
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    // Load the user from database to ensure they still exist
    const user = await prisma.user.findUnique({ where: { id: payload.id } });
    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware factory to restrict routes to specific roles
function authorizeRoles(roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient privileges' });
    }
    next();
  };
}

// Create tenant and user on signup
app.post('/api/signup', async (req, res) => {
  const { tenantName, name, email, password, role } = req.body;
  if (!tenantName || !name || !email || !password || !role) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Find or create tenant
    let tenant = await prisma.tenant.findFirst({ where: { name: tenantName } });
    if (!tenant) {
      tenant = await prisma.tenant.create({ data: { name: tenantName } });
    }
    // Ensure email is unique
    const existing = await prisma.user.findFirst({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        name,
        email,
        passwordHash,
        role,
      },
    });
    return res.status(201).json({ message: 'User created', userId: user.id });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// User login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }
  try {
    const user = await prisma.user.findFirst({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user);
    return res.json({ token, user: { id: user.id, name: user.name, role: user.role, tenantId: user.tenantId } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Fetch cases based on role
app.get('/api/cases', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let cases;
    if (role === 'admin') {
      cases = await prisma.case.findMany({ where: { tenantId } });
    } else if (role === 'attorney' || role === 'staff') {
      // Cases assigned to this user
      cases = await prisma.case.findMany({ where: { tenantId, assignedToIds: { has: id } } });
    } else if (role === 'client') {
      cases = await prisma.case.findMany({ where: { tenantId, clientUserId: id } });
    } else if (role === 'vendor') {
      // Cases with vendor invoices by this vendor
      const vendorInvoices = await prisma.vendorInvoice.findMany({ where: { vendorId: id } });
      const caseIds = vendorInvoices.map(inv => inv.caseId);
      cases = await prisma.case.findMany({ where: { id: { in: caseIds } } });
    } else {
      cases = [];
    }
    return res.json(cases);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create case
app.post('/api/cases', authenticate, authorizeRoles(['admin', 'attorney', 'staff']), async (req, res) => {
  const { title, type, clientUserId, assignedToIds = [], status = 'open' } = req.body;
  if (!title || !type || !clientUserId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Verify client exists in tenant
    const client = await prisma.user.findFirst({ where: { id: clientUserId, tenantId: req.user.tenantId, role: 'client' } });
    if (!client) {
      return res.status(400).json({ error: 'Invalid client' });
    }
    // Ensure assignedToIds belong to attorneys or staff in same tenant
    const validAssignees = await prisma.user.findMany({
      where: {
        id: { in: assignedToIds },
        tenantId: req.user.tenantId,
        role: { in: ['attorney', 'staff'] },
      },
      select: { id: true },
    });
    const validIds = validAssignees.map(u => u.id);
    const newCase = await prisma.case.create({
      data: {
        title,
        type,
        status,
        tenantId: req.user.tenantId,
        clientUserId,
        assignedToIds: validIds,
      },
    });
    return res.status(201).json(newCase);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get appointments
app.get('/api/appointments', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let appointments;
    if (role === 'admin') {
      appointments = await prisma.appointment.findMany({ where: { tenantId } });
    } else if (role === 'attorney' || role === 'staff') {
      // Appointments for cases assigned to this user
      appointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          case: { assignedToIds: { has: id } },
        },
      });
    } else if (role === 'client') {
      appointments = await prisma.appointment.findMany({
        where: {
          tenantId,
          case: { clientUserId: id },
        },
      });
    } else {
      appointments = [];
    }
    return res.json(appointments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create appointment
app.post('/api/appointments', authenticate, authorizeRoles(['client', 'attorney', 'staff']), async (req, res) => {
  const { caseId, requestedDate, message = '' } = req.body;
  if (!caseId || !requestedDate) {
    return res.status(400).json({ error: 'Missing caseId or requestedDate' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Role-specific checks
    if (req.user.role === 'client' && caseRecord.clientUserId !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: cannot request appointment for this case' });
    }
    if ((req.user.role === 'attorney' || req.user.role === 'staff') && !caseRecord.assignedToIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: not assigned to this case' });
    }
    const appointment = await prisma.appointment.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        requestedDate: new Date(requestedDate),
        message,
        createdById: req.user.id,
        status: 'pending',
      },
    });
    return res.status(201).json(appointment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Get invoices (including vendor invoices)
app.get('/api/invoices', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let invoices = [];
    if (role === 'admin') {
      invoices = await prisma.invoice.findMany({ where: { tenantId } });
      const vendorInvoices = await prisma.vendorInvoice.findMany({ where: { tenantId } });
      return res.json([...invoices, ...vendorInvoices]);
    }
    if (role === 'attorney' || role === 'staff') {
      // Invoices on cases assigned to this user
      invoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          case: { assignedToIds: { has: id } },
        },
      });
      const vendorInvoices = await prisma.vendorInvoice.findMany({
        where: {
          tenantId,
          case: { assignedToIds: { has: id } },
        },
      });
      return res.json([...invoices, ...vendorInvoices]);
    }
    if (role === 'client') {
      invoices = await prisma.invoice.findMany({
        where: {
          tenantId,
          case: { clientUserId: id },
        },
      });
      const vendorInvoices = await prisma.vendorInvoice.findMany({
        where: {
          tenantId,
          case: { clientUserId: id },
        },
      });
      return res.json([...invoices, ...vendorInvoices]);
    }
    if (role === 'vendor') {
      const vendorInvoices = await prisma.vendorInvoice.findMany({ where: { vendorId: id } });
      return res.json(vendorInvoices);
    }
    return res.json([]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Vendor submits invoice
app.post('/api/invoices', authenticate, authorizeRoles(['vendor']), async (req, res) => {
  const { caseId, amount, description = '' } = req.body;
  if (!caseId || !amount) {
    return res.status(400).json({ error: 'Missing caseId or amount' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    const invoice = await prisma.vendorInvoice.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        vendorId: req.user.id,
        amount,
        description,
        status: 'pending',
        submittedAt: new Date(),
      },
    });
    return res.status(201).json(invoice);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// TODO: Add routes for tasks, time entries, expenses, payments, vendor invoice approval, and messaging

// -----------------------------------------------------------------------------
// Tasks
// Get tasks accessible to user
app.get('/api/tasks', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let tasks;
    if (role === 'admin') {
      tasks = await prisma.task.findMany({ where: { tenantId } });
    } else if (role === 'attorney' || role === 'staff') {
      tasks = await prisma.task.findMany({ where: { tenantId, assignedToId: id } });
    } else if (role === 'client') {
      // Clients cannot view tasks
      tasks = [];
    } else {
      tasks = [];
    }
    return res.json(tasks);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create a task
app.post('/api/tasks', authenticate, authorizeRoles(['admin', 'attorney', 'staff']), async (req, res) => {
  const { caseId, description, assignedToId, dueDate, status = 'open' } = req.body;
  if (!caseId || !description || !assignedToId) {
    return res.status(400).json({ error: 'Missing caseId, description or assignedToId' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Ensure assignee belongs to tenant
    const assignee = await prisma.user.findFirst({ where: { id: assignedToId, tenantId: req.user.tenantId, role: { in: ['attorney', 'staff'] } } });
    if (!assignee) {
      return res.status(400).json({ error: 'Invalid assignee' });
    }
    const task = await prisma.task.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        description,
        assignedToId,
        dueDate: dueDate ? new Date(dueDate) : null,
        status,
      },
    });
    return res.status(201).json(task);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Update a task (status or description or dueDate)
app.put('/api/tasks/:id', authenticate, async (req, res) => {
  const taskId = parseInt(req.params.id, 10);
  const { description, dueDate, status, assignedToId } = req.body;
  try {
    const task = await prisma.task.findFirst({ where: { id: taskId, tenantId: req.user.tenantId } });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    // Only admin, assignee or attorney assigned to case can update
    if (
      req.user.role !== 'admin' &&
      req.user.id !== task.assignedToId
    ) {
      return res.status(403).json({ error: 'Forbidden: cannot update this task' });
    }
    // Optionally change assignee if provided (admin only)
    let updateData = {};
    if (description !== undefined) updateData.description = description;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (status !== undefined) updateData.status = status;
    if (assignedToId !== undefined) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can reassign tasks' });
      }
      const newAssignee = await prisma.user.findFirst({ where: { id: assignedToId, tenantId: req.user.tenantId, role: { in: ['attorney', 'staff'] } } });
      if (!newAssignee) {
        return res.status(400).json({ error: 'Invalid new assignee' });
      }
      updateData.assignedToId = assignedToId;
    }
    const updated = await prisma.task.update({ where: { id: taskId }, data: updateData });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Time Entries
// List time entries accessible to user
app.get('/api/time_entries', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let entries;
    if (role === 'admin') {
      entries = await prisma.timeEntry.findMany({ where: { tenantId }, include: { case: true } });
    } else if (role === 'attorney' || role === 'staff') {
      entries = await prisma.timeEntry.findMany({ where: { tenantId, userId: id }, include: { case: true } });
    } else if (role === 'client') {
      // Time entries for client cases
      entries = await prisma.timeEntry.findMany({ where: { tenantId, case: { clientUserId: id } }, include: { case: true, user: true } });
    } else {
      entries = [];
    }
    return res.json(entries);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create a time entry
app.post('/api/time_entries', authenticate, authorizeRoles(['attorney', 'staff']), async (req, res) => {
  const { caseId, hours, rate, description = '' } = req.body;
  if (!caseId || !hours || !rate) {
    return res.status(400).json({ error: 'Missing caseId, hours or rate' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Ensure the user is assigned to the case
    if (!caseRecord.assignedToIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: not assigned to case' });
    }
    const entry = await prisma.timeEntry.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        userId: req.user.id,
        hours: parseFloat(hours),
        rate: parseFloat(rate),
        description,
      },
    });
    return res.status(201).json(entry);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Expenses
// List expenses accessible to user
app.get('/api/expenses', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let expenses;
    if (role === 'admin') {
      expenses = await prisma.expense.findMany({ where: { tenantId }, include: { case: true } });
    } else if (role === 'attorney' || role === 'staff') {
      // Expenses on cases assigned to user
      expenses = await prisma.expense.findMany({ where: { tenantId, case: { assignedToIds: { has: id } } }, include: { case: true } });
    } else if (role === 'client') {
      expenses = await prisma.expense.findMany({ where: { tenantId, case: { clientUserId: id } }, include: { case: true } });
    } else {
      expenses = [];
    }
    return res.json(expenses);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create an expense
app.post('/api/expenses', authenticate, authorizeRoles(['admin', 'attorney', 'staff']), async (req, res) => {
  const { caseId, amount, vendor = '', category = '', description = '' } = req.body;
  if (!caseId || !amount) {
    return res.status(400).json({ error: 'Missing caseId or amount' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Admin can create any expense; attorney/staff must be assigned to case
    if (req.user.role !== 'admin' && !caseRecord.assignedToIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: not assigned to case' });
    }
    const exp = await prisma.expense.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        amount: parseFloat(amount),
        vendor,
        category,
        description,
      },
    });
    return res.status(201).json(exp);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Payments
// List payments
app.get('/api/payments', authenticate, async (req, res) => {
  try {
    const { role, id, tenantId } = req.user;
    let payments;
    if (role === 'admin') {
      payments = await prisma.payment.findMany({ where: { tenantId }, include: { invoice: true } });
    } else if (role === 'attorney' || role === 'staff') {
      payments = await prisma.payment.findMany({ where: { tenantId, invoice: { case: { assignedToIds: { has: id } } } }, include: { invoice: true } });
    } else if (role === 'client') {
      payments = await prisma.payment.findMany({ where: { tenantId, invoice: { case: { clientUserId: id } } }, include: { invoice: true } });
    } else {
      payments = [];
    }
    return res.json(payments);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Create payment (admin/staff)
app.post('/api/payments', authenticate, authorizeRoles(['admin', 'staff']), async (req, res) => {
  const { invoiceId, amount } = req.body;
  if (!invoiceId || !amount) {
    return res.status(400).json({ error: 'Missing invoiceId or amount' });
  }
  try {
    const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId, tenantId: req.user.tenantId } });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const payment = await prisma.payment.create({
      data: {
        tenantId: req.user.tenantId,
        invoiceId,
        amount: parseFloat(amount),
      },
    });
    return res.status(201).json(payment);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Vendor Invoice Approval (admin)
app.put('/api/vendor_invoices/:id/approve', authenticate, authorizeRoles(['admin']), async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);
  try {
    const invoice = await prisma.vendorInvoice.findFirst({ where: { id: invoiceId, tenantId: req.user.tenantId } });
    if (!invoice) {
      return res.status(404).json({ error: 'Vendor invoice not found' });
    }
    const updated = await prisma.vendorInvoice.update({ where: { id: invoiceId }, data: { status: 'approved' } });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/vendor_invoices/:id/reject', authenticate, authorizeRoles(['admin']), async (req, res) => {
  const invoiceId = parseInt(req.params.id, 10);
  try {
    const invoice = await prisma.vendorInvoice.findFirst({ where: { id: invoiceId, tenantId: req.user.tenantId } });
    if (!invoice) {
      return res.status(404).json({ error: 'Vendor invoice not found' });
    }
    const updated = await prisma.vendorInvoice.update({ where: { id: invoiceId }, data: { status: 'rejected' } });
    return res.json(updated);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Messaging
// Get messages for a case
app.get('/api/messages', authenticate, async (req, res) => {
  const caseId = parseInt(req.query.caseId, 10);
  if (!caseId) {
    return res.status(400).json({ error: 'Missing caseId parameter' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Only participants (client, assignee) and admin can view messages
    if (
      req.user.role !== 'admin' &&
      req.user.id !== caseRecord.clientUserId &&
      !caseRecord.assignedToIds.includes(req.user.id)
    ) {
      return res.status(403).json({ error: 'Forbidden: not part of case' });
    }
    const messages = await prisma.message.findMany({
      where: { tenantId: req.user.tenantId, caseId },
      orderBy: { createdAt: 'asc' },
      include: { sender: true, receiver: true },
    });
    return res.json(messages);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Post a new message
app.post('/api/messages', authenticate, async (req, res) => {
  const { caseId, receiverId, text } = req.body;
  if (!caseId || !receiverId || !text) {
    return res.status(400).json({ error: 'Missing caseId, receiverId or text' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Both sender and receiver must belong to the case's tenant
    const receiver = await prisma.user.findFirst({ where: { id: receiverId, tenantId: req.user.tenantId } });
    if (!receiver) {
      return res.status(400).json({ error: 'Invalid receiver' });
    }
    // Sender must be part of case
    if (
      req.user.role !== 'admin' &&
      req.user.id !== caseRecord.clientUserId &&
      !caseRecord.assignedToIds.includes(req.user.id)
    ) {
      return res.status(403).json({ error: 'Forbidden: sender not part of case' });
    }
    const message = await prisma.message.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        senderId: req.user.id,
        receiverId,
        text,
      },
    });
    return res.status(201).json(message);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Billing summary for a case
// Returns the sum of time entry fees and expenses and payments for a case
app.get('/api/cases/:id/billing_summary', authenticate, async (req, res) => {
  const caseId = parseInt(req.params.id, 10);
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Only participants and admin can view billing summary
    if (
      req.user.role !== 'admin' &&
      req.user.id !== caseRecord.clientUserId &&
      !caseRecord.assignedToIds.includes(req.user.id)
    ) {
      return res.status(403).json({ error: 'Forbidden: not part of case' });
    }
    // Sum time entries
    const timeEntries = await prisma.timeEntry.findMany({ where: { caseId, tenantId: req.user.tenantId } });
    const totalFees = timeEntries.reduce((sum, te) => sum + (te.hours * parseFloat(te.rate)), 0);
    // Sum expenses
    const expenses = await prisma.expense.findMany({ where: { caseId, tenantId: req.user.tenantId } });
    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    // Sum payments for invoices of this case
    const invoices = await prisma.invoice.findMany({ where: { caseId, tenantId: req.user.tenantId } });
    const invoiceIds = invoices.map(inv => inv.id);
    const payments = await prisma.payment.findMany({ where: { invoiceId: { in: invoiceIds }, tenantId: req.user.tenantId } });
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const totalBilled = totalFees + totalExpenses;
    const balanceDue = totalBilled - totalPaid;
    return res.json({ totalFees, totalExpenses, totalBilled, totalPaid, balanceDue });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Document upload (base64) – stores files locally in uploads/ directory
app.post('/api/documents', authenticate, async (req, res) => {
  const { caseId, fileName, content } = req.body;
  if (!caseId || !fileName || !content) {
    return res.status(400).json({ error: 'Missing caseId, fileName or content' });
  }
  try {
    const caseRecord = await prisma.case.findFirst({ where: { id: caseId, tenantId: req.user.tenantId } });
    if (!caseRecord) {
      return res.status(404).json({ error: 'Case not found' });
    }
    // Ensure user has rights to upload (admin, attorney/staff assigned, client for their own case)
    const userAllowed =
      req.user.role === 'admin' ||
      (req.user.role === 'client' && caseRecord.clientUserId === req.user.id) ||
      ((req.user.role === 'attorney' || req.user.role === 'staff') && caseRecord.assignedToIds.includes(req.user.id));
    if (!userAllowed) {
      return res.status(403).json({ error: 'Forbidden: cannot upload to this case' });
    }
    // Decode base64 content
    const buffer = Buffer.from(content, 'base64');
    // Determine directory
    const uploadDir = require('path').join(__dirname, '..', 'uploads', String(req.user.tenantId), String(caseId));
    require('fs').mkdirSync(uploadDir, { recursive: true });
    const filePath = require('path').join(uploadDir, fileName);
    require('fs').writeFileSync(filePath, buffer);
    const doc = await prisma.document.create({
      data: {
        tenantId: req.user.tenantId,
        caseId,
        uploadedById: req.user.id,
        fileName,
        filePath,
      },
    });
    return res.status(201).json(doc);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Omnia Juris Express API listening on port ${PORT}`);
});