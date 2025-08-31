// src/utils/data.js
// Dynamic data accessor for Excel-backed rows and DataBag instances

const { normalizeKey, normRowMap } = require('./dataHelpers');
const { DataBag } = require('../data/domain/DataBag');

// Common header aliases (normalized to lowercase, spaces/underscores removed)
const ALIASES = {
  applicantid: ['id'],
  title: ['honorific'],
  firstname: ['first_name', 'fname', 'givenname', 'given_name'],
  lastname: ['last_name', 'lname', 'surname', 'familyname', 'family_name'],
  email: ['emailaddress', 'e_mail'],
  dateofbirth: ['dob', 'birthdate', 'date_of_birth'],
  caslstatus: ['casl', 'casl_status'],
  homephone: ['home_phone', 'homeph', 'phonehome', 'home'],
  cellphone: ['cell_phone', 'mobile', 'mobilephone', 'cell', 'phonecell'],
  contactpref: ['contact_preference', 'preference', 'pref'],
};

function toMap(rowOrBag) {
  if (!rowOrBag) return {};
  if (typeof rowOrBag.toObject === 'function') return normRowMap(rowOrBag.toObject());
  if (rowOrBag instanceof DataBag) return normRowMap(rowOrBag.toObject());
  if (typeof rowOrBag === 'object') return normRowMap(rowOrBag);
  return {};
}

/**
 * Get a trimmed string value from a row or DataBag by column name.
 * - Case/space/underscore-insensitive matching
 * - Searches provided aliases and built-in ALIASES
 * - Returns undefined for missing/blank
 */
function get(rowOrBag, columnName, { aliases = [] } = {}) {
  if (!columnName) return undefined;
  const map = toMap(rowOrBag);

  // Build candidate keys: exact, caller aliases, and global aliases
  const base = normalizeKey(columnName);
  const candidates = [
    base,
    ...aliases.map(normalizeKey),
    ...((ALIASES[base] || []).map(normalizeKey)),
  ];

  for (const key of candidates) {
    if (key in map) {
      const raw = map[key];
      if (raw == null) return undefined;
      const s = String(raw).trim();
      if (s !== '') return s;
    }
  }
  return undefined;
}

function bag(row) { return new DataBag(row); }

/** Get a DataBag for an applicant by ApplicantID from ApplicantsCatalog. */
async function fromApplicantId(world, applicantId, { sheet = 'ApplicantsCatalog' } = {}) {
  const id = String(applicantId || '').trim();
  if (!id) return null;
  const row = await world.excel.getRow(sheet, { ApplicantID: id });
  if (!row) return null;
  return new DataBag(row);
}

/** Get a DataBag for scenario applicant by reference column (e.g., 'PrimaryApplicantID'). */
async function fromScenarioApplicant(world, scenarioRow, refCol = 'PrimaryApplicantID', { sheet = 'ApplicantsCatalog' } = {}) {
  const id = get(scenarioRow, refCol, { aliases: [] });
  return fromApplicantId(world, id, { sheet });
}

module.exports = {
  get,
  bag,
  fromApplicantId,
  fromScenarioApplicant,
  ALIASES,
  normalizeKey,
};

