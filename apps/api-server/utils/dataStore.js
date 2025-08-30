/*
 * dataStore.js
 *
 * A simple abstraction for reading and writing JSON files used
 * as persistent storage in this prototype.  Each collection is
 * stored as an array in its own file under the `data/` directory.
 *
 * In production you should replace this module with a proper
 * database driver (e.g. Prisma with PostgreSQL).  This module
 * illustrates how to encapsulate data access behind a simple API.
 */

const fs = require('fs');
const path = require('path');

// Base directory for data files
const DATA_DIR = path.join(__dirname, '..', 'data');

// Load a collection from its JSON file.  If the file does not
// exist, create it with an empty array.
function loadCollection(name) {
  const file = path.join(DATA_DIR, `${name}.json`);
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]', 'utf8');
  }
  const contents = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(contents);
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
    return [];
  }
}

// Save a collection back to its JSON file.
function saveCollection(name, data) {
  const file = path.join(DATA_DIR, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

module.exports = {
  loadCollection,
  saveCollection,
};