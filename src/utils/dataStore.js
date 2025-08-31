// helpers/dataStore.js
const path = require('path');
const {
  loadWorkbook,
  sheetToObjects,
  findRowByKey,
  findRowByAnyKey,
} = require('../data/adapters/excel');

// ─────────────────────────────────────────────────────────────────────────────
// Context & state
// ─────────────────────────────────────────────────────────────────────────────
let ctx = {
  dataFile: path.resolve('data', 'TestData.xlsx'),
  scenarioSheet: 'Data',
  scenarioKey: 'ScenarioID',
  userKeyAliases: ['LoginID', 'UserID', 'Username', 'USER_EMAIL', 'Email'],
};

let scenarioRow = null;
let envSheetName = null;
let envUserRow = null;

// ─────────────────────────────────────────────────────────────────────────────
// Core context helpers
// ─────────────────────────────────────────────────────────────────────────────
function setContext(opts = {}) {
  ctx = { ...ctx, ...opts };
  loadWorkbook(ctx.dataFile);
  return ctx;
}

function readScenario(sheetName, scenarioId, keyCol = ctx.scenarioKey) {
  scenarioRow = findRowByKey(sheetName || ctx.scenarioSheet, keyCol, scenarioId, {
    caseInsensitive: false,
    treatBlankAsMissing: true,
  });
  return scenarioRow;
}

function useEnvSheet(sheetName) {
  // validate sheet exists
  sheetToObjects(sheetName);
  envSheetName = sheetName;
  return envSheetName;
}

function selectEnvUser(loginId, sheetName = envSheetName, keyAliases = ctx.userKeyAliases) {
  if (!sheetName) {
    throw new Error(
      'No env sheet specified. Call useEnvSheet("<SheetName>") or pass sheetName to selectEnvUser.'
    );
  }
  envUserRow = findRowByAnyKey(sheetName, keyAliases, loginId, {
    caseInsensitive: false,
    treatBlankAsMissing: true,
  });
  envSheetName = sheetName;
  return envUserRow;
}

function getScenarioRow() {
  return scenarioRow || {};
}
function getEnvUserRow() {
  return envUserRow || {};
}
function getEnvSheetName() {
  return envSheetName || '';
}

// Case-insensitive picker for values (useful fallback)
function pick(obj, ...aliases) {
  if (!obj) return '';
  for (const key of Object.keys(obj)) {
    for (const a of aliases) {
      if (String(key).toLowerCase() === String(a).toLowerCase()) return obj[key];
    }
  }
  return '';
}

// Strict env headers for login steps (shared with env_data.steps.js)
// (REQUIRED_ENV_HEADERS, assertEnvHeaders defined elsewhere in this module)

// ─────────────────────────────────────────────────────────────────────────────
// Value helpers
// ─────────────────────────────────────────────────────────────────────────────
function safeVal(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();

  if (typeof v === 'object') {
    const candidates = [
      v.text,
      v.hyperlink,
      v.url,
      v.href,
      v.target,
      v.Target,
      v.Hyperlink,
      v.l && v.l.Target,
    ].filter(Boolean);

    for (const c of candidates) {
      if (typeof c === 'string' && c.trim()) return c.trim();
    }
    for (const val of Object.values(v)) {
      if (typeof val === 'string' && /^https?:\/\//i.test(val)) return val.trim();
    }
    return String(v).trim();
  }

  return String(v).trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment user (STRICT headers + ID)
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_ENV_HEADERS = ['LoginID', 'BASE_URL', 'USER_EMAIL', 'USER_PASSWORD', 'Role'];

function assertEnvHeaders(row) {
  const present = Object.keys(row || {});
  const missing = REQUIRED_ENV_HEADERS.filter((h) => !(h in row));
  if (missing.length) {
    const msg =
      `Environment row is missing required headers (strict): ${missing.join(', ')}\n` +
      `Present headers: ${present.join(', ')}`;
    throw new Error(msg);
  }
}

/** Find the env user row strictly by LoginID (exact match). */
function findEnvUserRowStrict(world, sheetName, loginId) {
  const row = world.excel.getRow(sheetName, { LoginID: loginId });
  if (!row) {
    const first = world.excel.getRows(sheetName)[0] || {};
    const headers = Object.keys(first).join(', ');
    throw new Error(
      `User '${loginId}' not found in '${sheetName}' (strict). Headers: ${headers}`
    );
  }
  return row;
}

/** Extract config strictly from env user row. */
function getEnvConfigFromUserRow() {
  const r = getEnvUserRow();
  return {
    baseUrl: r['BASE_URL'] || undefined,
    userEmail: r['USER_EMAIL'] || undefined,
    userPassword: r['USER_PASSWORD'] || undefined,
    envSheet: getEnvSheetName(),
  };
}

// Optional convenience: pull a value by precedence
function getValue(
  columnName,
  { precedence = ['scenario', 'envUser'], treatBlankAsMissing = true } = {}
) {
  const norm = (v) => (v == null ? '' : String(v));
  const missing = (v) => v == null || (treatBlankAsMissing && norm(v).trim() === '');
  for (const src of precedence) {
    let v;
    if (src === 'scenario') v = getScenarioRow()[columnName];
    else if (src === 'envUser') v = getEnvUserRow()[columnName];
    if (!missing(v)) return v;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// ApplicantsCatalog (STRICT headers + ID, values left to steps/faker)
// ─────────────────────────────────────────────────────────────────────────────
const REQUIRED_APPLICANT_HEADERS = [
  'ApplicantID',
  'FirstName',
  'LastName',
  'Email',
  'DOB',
];

function getApplicantByIdStrict(applicantId, sheetName = 'ApplicantsCatalog') {
  const rows = sheetToObjects(sheetName);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`Sheet '${sheetName}' is empty or missing`);
  }

  const headers = Object.keys(rows[0] || {});
  const missingHeaders = REQUIRED_APPLICANT_HEADERS.filter((h) => !headers.includes(h));
  if (missingHeaders.length > 0) {
    throw new Error(
      `Sheet '${sheetName}' is missing required headers: ${missingHeaders.join(
        ', '
      )}. Headers present: ${headers.join(', ')}`
    );
  }

  const row = rows.find((r) => r.ApplicantID === applicantId);
  if (!row) {
    throw new Error(`Applicant '${applicantId}' not found in sheet '${sheetName}'`);
  }

  // Do NOT enforce blanks here – let steps decide faker fallback
  return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  // context
  setContext,
  readScenario,
  useEnvSheet,
  selectEnvUser,
  getScenarioRow,
  getEnvUserRow,
  getEnvSheetName,
  getValue,
  safeVal,
  pick,

  // env strict
  findEnvUserRowStrict,
  getEnvConfigFromUserRow,
  REQUIRED_ENV_HEADERS,
  assertEnvHeaders,

  // applicants strict
  getApplicantByIdStrict,
  REQUIRED_APPLICANT_HEADERS,
};
