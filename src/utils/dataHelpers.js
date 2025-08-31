// src/utils/dataHelpers.js
function normalizeKey(k) {
  return String(k || '').trim().toLowerCase().replace(/[\s_-]+/g, '');
}
function normRowMap(row) {
  const map = {};
  for (const [k, v] of Object.entries(row || {})) map[normalizeKey(k)] = v;
  return map;
}
function pick(row, candidates) {
  const map = normRowMap(row);
  for (const name of candidates) {
    const val = map[normalizeKey(name)];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      if (typeof val === 'object' && val && typeof val.text === 'string') return val.text.trim();
      return String(val).trim();
    }
  }
  return '';
}
module.exports = { pick, normalizeKey, normRowMap };
