// tests/support/audit.js
const fs = require('node:fs');
const path = require('node:path');

const ENABLED = String(process.env.LOG_UI ?? '1') === '1';
const ATTACH_JSON = String(process.env.AUDIT_ATTACH_JSON ?? '0') === '1';

// Full-run buffer and per-step buffer
let _events = [];
let _stepEvents = [];

// Canonical counters (UPPERCASE)
const _counters = { PRIMARY: 0, HEALED: 0, HEALER: 0, FALLBACK: 0, FAIL: 0 };

// ── lifecycle ───────────────────────────────────────────────────────────────
function resetAll() {
  _events = [];
  _stepEvents = [];
  for (const k of Object.keys(_counters)) _counters[k] = 0;
}

// ── internals ───────────────────────────────────────────────────────────────
function mask(key, value) {
  if (value == null) return value;
  const v = String(value);
  if (/(password|pass|secret|token)/i.test(key)) return '***';
  if (/(email)/i.test(key)) return v.replace(/(.{2}).+(@.*)/, '$1***$2');
  return v;
}

function _pushEvent(e) {
  _events.push(e);
  _stepEvents.push(e);
}

function event(type, payload = {}) {
  if (!ENABLED) return;
  const e = { ts: new Date().toISOString(), type, ...payload };
  _pushEvent(e);
}

// ── counters for BasePage.byKey (resolve events) ────────────────────────────
function record(key, { usedIndex, total, usedSelector, mode }) {
  const M = String(mode || '').toUpperCase();
  if (_counters[M] !== undefined) _counters[M] += 1;
  // Do not persist raw selectors in the audit stream
  event('resolve', { key, usedIndex, total, mode: M });
}

// ── per-step flush (attach & clear only step buffer) ────────────────────────
async function attachFlush(attach) {
  if (!ENABLED || typeof attach !== 'function') return;
  const header =
    `Audit counters so far → PRIMARY=${_counters.PRIMARY} | HEALED=${_counters.HEALED} | ` +
    `HEALER=${_counters.HEALER} | FALLBACK=${_counters.FALLBACK} | FAIL=${_counters.FAIL}`;
  try {
    await attach(
      `${header}\nUI Audit (${_stepEvents.length} events)\n` +
      (ATTACH_JSON ? JSON.stringify(_stepEvents, null, 2) : buildStepTableSummary(_stepEvents))
    );
  } catch {}
  _stepEvents = [];
}

// ── snapshots & compat counts ───────────────────────────────────────────────
function _compatCounts() {
  // Lowercase keys for legacy/reader UIs; also handy aggregates.
  const primary  = _counters.PRIMARY;
  const healed   = _counters.HEALED;
  const healer   = _counters.HEALER;
  const fallback = _counters.FALLBACK;
  const failed   = _counters.FAIL;
  const ok       = primary + healed + healer + fallback;
  const totalResolves = ok + failed;
  return { primary, healed, healer, fallback, failed, ok, totalResolves };
}

function snapshot() {
  return {
    counters: { ..._counters },          // canonical (UPPERCASE)
    counts: _compatCounts(),             // compat (lowercase)
    totalEvents: _events.length,
    generatedAt: new Date().toISOString(),
  };
}

async function persist(filePath = path.join('reports', 'audit-summary.json')) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ ...snapshot(), events: _events }, null, 2));
  } catch {}
}

// ── writers (JSON + Markdown) ───────────────────────────────────────────────
async function writeAuditSummary(outDir = path.join('reports', 'audit')) {
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const jsonPath = path.join(outDir, 'audit-summary.json');
    const mdPath   = path.join(outDir, 'audit-summary.md');

    fs.writeFileSync(jsonPath, JSON.stringify({ ...snapshot(), events: _events }, null, 2));
    fs.writeFileSync(mdPath, buildPlainTableSummary());
  } catch (e) {
    console.error('writeAuditSummary failed:', e.message);
  }
}

function buildPlainTableSummary() {
  const lc = _compatCounts();
  const countersBlock =
    `Primary: ${lc.primary}\n` +
    `Healed: ${lc.healed}\n` +
    `Failed: ${lc.failed}\n`;

  const header =
    'Element Key          | Result    | Used | Total | Notes\n' +
    '---------------------+-----------+------+-------+----------------------------';

  const rows = _events
    .filter(e => e.type === 'resolve')
    .map(e => {
      const key = (e.key || '').padEnd(20).slice(0, 20);
      const res = (e.mode || '').padEnd(9).slice(0, 9);
      const used = String(e.usedIndex ?? '-').padEnd(4);
      const tot  = String(e.total ?? '-').padEnd(5);
      const note = '';
      return `${key} | ${res} | ${used} | ${tot} | ${note}`;
    });

  if (!rows.length) {
    return countersBlock + '\n' + header + '\n(no audit events captured)';
  }
  return countersBlock + '\n' + header + '\n' + rows.join('\n');
}

// ── structured stream (used by UI layer) ────────────────────────────────────
function recordLocate({ key, candidates, usedSelector, url }) {
  // Redact raw selectors; keep counts for stability view
  const candidateCount = Array.isArray(candidates) ? candidates.length : 0;
  const resolved = !!usedSelector;
  event('locate', { key, url, candidateCount, resolved });
}

function buildStepTableSummary(events) {
  try {
    const header =
      'Element Key          | Result    | Used | Total | Notes\n' +
      '---------------------+-----------+------+-------+----------------------------';
    const rows = (events || [])
      .filter(e => e.type === 'resolve')
      .map(e => {
        const key = (e.key || '').padEnd(20).slice(0, 20);
        const res = (String(e.mode || '')).padEnd(9).slice(0, 9);
        const used = String(e.usedIndex ?? '-').padEnd(4);
        const tot  = String(e.total ?? '-').padEnd(5);
        const note = '';
        return `${key} | ${res} | ${used} | ${tot} | ${note}`;
      });
    const MAX = 50;
    const out = rows.length > MAX ? rows.slice(0, MAX).concat([`... (${rows.length - MAX} more)`]) : rows;
    return header + '\n' + (out.length ? out.join('\n') : '(no resolve events)');
  } catch (e) {
    return `UI Audit (brief) unavailable: ${e?.message || e}`;
  }
}
function recordFill({ key, usedSelector, value, url, snippet }) {
  event('fill', { key, url, value: mask(key, value), snippet });
}
function recordClick({ key, usedSelector, url, snippet }) {
  event('click', { key, url, snippet });
}
function recordSelect({ key, usedSelector, label, url, snippet }) {
  event('select', { key, url, label, snippet });
}
function recordCheck({ key, usedSelector, checked, url, snippet }) {
  event('check', { key, url, checked, snippet });
}
function recordModal({ action, key, ok, details, url }) {
  event('modal', { action, key, ok, details, url });
}
function recordTabs({ names, url }) {
  event('tabs', { names, url });
}

module.exports = {
  ENABLED,
  // counters + lifecycle
  record,
  resetAll,
  attachFlush,
  snapshot,
  persist,
  writeAuditSummary,
  buildPlainTableSummary,
  buildStepTableSummary,
  // structured stream
  recordLocate,
  recordFill,
  recordClick,
  recordSelect,
  recordCheck,
  recordModal,
  recordTabs,
  // aliases
  reset: resetAll,
  resetAudit: resetAll,
  _counters,
};
