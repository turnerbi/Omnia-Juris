/*
 * auth.js
 *
 * Implements a simple authentication layer.  Users log in with
 * their email and password and receive a random token that must
 * accompany subsequent requests via the `Authorization` header.
 * Tokens are stored in memory; when the server restarts all
 * sessions are invalidated.
 */

const { loadCollection } = require('./dataStore');
const { generateToken } = require('./utils');

// In‑memory token store: { token: userId }
const sessions = {};

// Authenticate a user by email and password.  Returns an object
// containing the generated token and user record on success,
// otherwise null.
function loginUser(email, password) {
  const users = loadCollection('users');
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return null;
  }
  // Generate a new token and store it in memory
  const token = generateToken(40);
  sessions[token] = user.id;
  return { token, user };
}

// Remove a token from the session store
function logoutUser(token) {
  delete sessions[token];
}

// Retrieve the current user from a bearer token.  Returns the
// user record or null if the token is invalid.
function getUserByToken(token) {
  const userId = sessions[token];
  if (!userId) {
    return null;
  }
  const users = loadCollection('users');
  return users.find(u => u.id === userId) || null;
}

// Middleware: parse the Authorization header and attach the
// authenticated user to req.user if valid.  Otherwise respond
// with 401.
function authenticate(req, res) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Missing Authorization header' }));
    return false;
  }
  const token = authHeader.slice('Bearer '.length);
  const user = getUserByToken(token);
  if (!user) {
    res.statusCode = 401;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid token' }));
    return false;
  }
  // Attach the user to the request for downstream handlers
  req.user = user;
  return true;
}

// Middleware: verify that the authenticated user has one of
// the required roles.  Accepts an array of role strings.  If
// the user’s role is not allowed the request is rejected.
function authorizeRoles(allowedRoles) {
  return (req, res) => {
    if (!req.user) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Not authenticated' }));
      return false;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Forbidden: insufficient privileges' }));
      return false;
    }
    return true;
  };
}

module.exports = {
  loginUser,
  logoutUser,
  getUserByToken,
  authenticate,
  authorizeRoles,
};