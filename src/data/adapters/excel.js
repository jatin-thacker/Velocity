// src/data/adapters/excel.js
const path = require('node:path');
const xlsx = require('xlsx');

let _wb = null;
let _file = null;

/**
 * Single source of truth for the default workbook path.
 * Can be overridden at runtime with the DATA_FILE env var.
 * Points to ../TestData.xlsx relative to this adapter by default.
 */
const DEFAULT_DATA_FILE =
  process.env.DATA_FILE || path.resolve(__dirname, '../TestData.xlsx');
module.exports.DEFAULT_DATA_FILE = DEFAULT_DATA_FILE;

/**
 * Load (or reuse) the workbook.
 * @param {string} [filePath] – defaults to DEFAULT_DATA_FILE
 */
function loadWorkbook(filePath = DEFAULT_DATA_FILE) {
  if (_wb && _file === filePath) return _wb;
  if (!filePath) {
    throw new Error('Excel adapter: filePath is required (got undefined)');
  }
  _wb = xlsx.readFile(filePath, { cellDates: true });
  _file = filePath;
  return _wb;
}

/**
 * Convert a sheet to an array of row objects.
 * @param {string} sheetName
 */
function sheetToObjects(sheetName) {
  const wb = _wb || loadWorkbook();
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Sheet not found: ${sheetName}`);
  // defval keeps blanks as ''; raw:false prefers formatted text over rich objects
  return require('xlsx').utils.sheet_to_json(ws, { defval: '', raw: false });
}

/**
 * Find exactly one row by key column/value.
 * @param {string} sheetName
 * @param {string} keyColumn
 * @param {string} keyValue
 * @param {{caseInsensitive?: boolean, treatBlankAsMissing?: boolean}} [opts]
 */
function findRowByKey(sheetName, keyColumn, keyValue, opts = {}) {
  const rows = sheetToObjects(sheetName);
  const ci = opts.caseInsensitive ?? true;
  const norm = (v) => {
    if (v == null) return '';
    const s = String(v).trim();
    return ci ? s.toLowerCase() : s;
  };
  const needle = norm(keyValue);
  const hay = rows.filter((r) => {
    const v = r[keyColumn];
    if (opts.treatBlankAsMissing && (v == null || String(v).trim() === '')) {
      return false;
    }
    return norm(v) === needle;
  });
  if (hay.length === 0) return null;
  if (hay.length > 1) {
    throw new Error(
      `findRowByKey(${sheetName}, ${keyColumn}=${keyValue}) returned ${hay.length} rows`
    );
  }
  return hay[0];
}

// add below findRowByKey(...)
function findRowByAnyKey(sheetName, where, opts = {}) {
  if (!where || typeof where !== 'object') {
    throw new Error(`findRowByAnyKey requires an object predicate, got: ${where}`);
  }
  // Try each provided key in order; return the first matching row
  const keys = Object.keys(where).filter(k => {
    const v = where[k];
    return v != null && String(v).trim() !== '';
  });

  for (const key of keys) {
    const row = findRowByKey(sheetName, key, where[key], opts);
    if (row) return row;
  }
  return null; // no key matched
}


module.exports.loadWorkbook = loadWorkbook;
module.exports.sheetToObjects = sheetToObjects;
module.exports.findRowByKey = findRowByKey;
module.exports.findRowByAnyKey = findRowByAnyKey; // <-- add this
module.exports.DEFAULT_DATA_FILE = DEFAULT_DATA_FILE;
