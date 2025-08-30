/*
 * utils.js
 *
 * Helper functions used throughout the API server.  These include
 * generating unique IDs and random tokens.  Using simple helpers
 * encapsulates common behaviour so that it can be easily swapped
 * out for more robust solutions later (e.g. UUID libraries).
 */

// Generate a pseudo‑random string for tokens.  In a real
// implementation you should use a cryptographically secure
// random number generator (e.g. Node's `crypto.randomBytes`).
function generateToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

// Simple incrementing ID generator.  When a new record is created
// the server will assign it the next available integer ID within
// the respective collection.  This function is intended for
// illustrative purposes; production systems should use UUIDs or
// database‑generated primary keys.
function nextId(collection) {
  if (!Array.isArray(collection) || collection.length === 0) {
    return 1;
  }
  return Math.max(...collection.map(item => item.id || 0)) + 1;
}

module.exports = {
  generateToken,
  nextId,
};