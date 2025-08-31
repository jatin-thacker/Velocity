// src/tasks/borrowers.js

// ---- Small utilities ----
function digits(s) { return (s ?? '').toString().replace(/\D/g, ''); }
function splitPhone(s) {
  const d = digits(s);
  return { area: d.slice(0, 3), top: d.slice(3, 6), bottom: d.slice(6, 10) };
}
function toMMMddYYYY(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  const m = d.toLocaleString('en-US', { month: 'short' });
  const dd = String(d.getDate()).padStart(2, '0');
  return `${m}-${dd}-${d.getFullYear()}`;
}

// ---- Borrowers panel helpers ----
async function ensureAddButtonVisible(ui) {
  try { if (await ui.isVisible?.('Borrowers.addBorrower')) return true; } catch {}
  try { await ui.click('Borrowers.header'); } catch {}
  try { return !!(await ui.isVisible?.('Borrowers.addBorrower')); } catch { return false; }
}

// Fill the New Contact modal from a DataBag + CASL flag
async function addBorrowerFromBag(ui, bag, casl, { faker } = {}) {
  await ensureAddButtonVisible(ui);
  try { await ui.click('Borrowers.addBorrower'); }
  catch (_) { try { await ui.click('Borrowers.header'); await ui.click('Borrowers.addBorrower'); } catch {} }

  const first = bag.get('FirstName') || faker?.getFirstName?.();
  const last = bag.get('LastName') || faker?.getLastName?.();
  await ui.fill('Borrowers.modal.firstName', first || '');
  await ui.fill('Borrowers.modal.lastName', last || '');

  const dobIso = bag.get('DOB');
  if (dobIso) await ui.fill('Borrowers.modal.dob', toMMMddYYYY(dobIso));
  const email = bag.get('Email');
  if (email) await ui.fill('Borrowers.modal.email', email);
  try { await ui.check('Borrowers.modal.casl', !!casl); } catch {}

  const hp = bag.get('HomePhone');
  if (hp) { const p = splitPhone(hp); await ui.fill('Borrowers.modal.home.area', p.area); await ui.fill('Borrowers.modal.home.top', p.top); await ui.fill('Borrowers.modal.home.bottom', p.bottom); }
  const cp = bag.get('CellPhone');
  if (cp) { const p = splitPhone(cp); await ui.fill('Borrowers.modal.cell.area', p.area); await ui.fill('Borrowers.modal.cell.top', p.top); await ui.fill('Borrowers.modal.cell.bottom', p.bottom); }

  const pref = bag.get('ContactPref');
  if (pref) { try { await ui.selectByLabel('Borrowers.modal.contactPref', pref); } catch {} }

  await ui.click('Borrowers.modal.ok');
  return { ok: true };
}

// ---- Profile fill ----
function normalizeDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso);
  const m = d.toLocaleString('en-US', { month: 'short' });
  const dd = String(d.getDate()).padStart(2, '0');
  return `${m}-${dd}-${d.getFullYear()}`;
}

async function fillBorrowerProfileFromApplicant(ui, applicant, { faker } = {}) {
  ui.within('Borrowers.tab.activePane');
  const lang = applicant?.get('CorrespondenceLanguage') || applicant?.get('Language');
  if (lang) { try { await ui.selectIfEmpty('Borrowers.profile.language', lang); } catch {} }
  const marital = applicant?.get('MaritalStatus');
  if (marital) { try { await ui.selectIfEmpty('Borrowers.profile.maritalStatus', marital); } catch {} }
  const residency = applicant?.get('ResidentType') || applicant?.get('Residency');
  if (residency) { try { await ui.selectIfEmpty('Borrowers.profile.residency', residency); } catch {} }
  const pref = applicant?.get('ContactPreference') || applicant?.get('ContactPref');
  if (pref) { try { await ui.selectIfEmpty('Borrowers.profile.contactPref', pref); } catch {} }

  const dob = applicant?.get('DateOfBirth') || applicant?.get('DOB');
  if (dob) { try { await ui.fillIfEmpty('Borrowers.profile.dob', normalizeDate(dob)); } catch {} }
  const middle = applicant?.get('MiddleName') || applicant?.get('Initial');
  if (middle) await ui.fillIfEmpty('Borrowers.profile.initial', middle);
  const sin = applicant?.get('SIN');
  if (sin) await ui.fillIfEmpty('Borrowers.profile.sin', sin);
  const home = applicant?.get('HomePhone');
  if (home) await ui.fillIfEmpty('Borrowers.profile.homePhone', home);
  const cell = applicant?.get('CellPhone');
  if (cell) await ui.fillIfEmpty('Borrowers.profile.cellPhone', cell);
  const work = applicant?.get('BusinessPhone') || applicant?.get('WorkPhone');
  if (work) await ui.fillIfEmpty('Borrowers.profile.workPhone', work);
  const fax = applicant?.get('FaxNumber') || applicant?.get('Fax');
  if (fax) await ui.fillIfEmpty('Borrowers.profile.fax', fax);
}

// ---- Address search + fallback ----
function pickAddressQuery(applicant, { faker } = {}) {
  const sheetAddr = applicant?.get?.('Address');
  if (sheetAddr) return { query: String(sheetAddr).trim(), source: 'sheet' };
  const province = applicant?.get?.('Province') || applicant?.get?.('ProvinceCode');
  const addr = faker?.getAddress?.(province);
  const q = [addr?.street_no, addr?.str_name, addr?.str_type, addr?.str_dir].filter(Boolean).join(' ').trim();
  return { query: q || addr?.street || addr?.city || 'Main', source: 'faker', meta: addr };
}

function rankAddressRows(rowsText = [], preferTokens = []) {
  const tokens = (preferTokens || []).map(s => String(s || '').trim().toLowerCase()).filter(Boolean);
  const postalRx = /[A-Z]\d[A-Z]\s?\d[A-Z]\d/;
  const provinceRx = /\bON\b|ontario/i;
  let bestIdx = 0, bestScore = -Infinity;
  for (let i = 0; i < rowsText.length; i++) {
    const raw = String(rowsText[i] || '');
    const t = raw.toLowerCase();
    let score = 0;
    for (const tok of tokens) if (tok && t.includes(tok)) score += 10;
    if (postalRx.test(raw)) score += 3;
    if (provinceRx.test(raw)) score += 2;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

async function fillCurrentAddress(ui, query, { delay = 120, maxWaitMs = 8000, preferContains = [] } = {}) {
  const container = ui.page.locator('.tab-pane.active .address-search .ui-select-container').first();
  const toggle = container.locator('.ui-select-toggle');
  const searchInput = container.locator('input.ui-select-search');
  const rows = ui.page.locator('.tab-pane.active .address-search ul.ui-select-choices .ui-select-choices-row');

  try {
    const want = (preferContains || []).filter(Boolean).map(s => String(s).toLowerCase());
    if (want.length) {
      const currentText = ((await container.innerText()) || '').toLowerCase();
      if (want.every(w => currentText.includes(w))) { await ui.attach?.('Address: existing selection; skipping'); return true; }
    }
  } catch {}

  await ui.attach?.('Address: opening dropdown');
  const openDeadline = Date.now() + 2000;
  while (Date.now() < openDeadline) {
    try { await toggle.click(); } catch {}
    try { const hasOpen = await container.evaluate(el => el.classList.contains('open')); if (hasOpen) { await searchInput.waitFor({ state: 'visible', timeout: 800 }); break; } } catch {}
    await ui.page.waitForTimeout(100);
  }

  await ui.attach?.('Address: typing progressively');
  const text = String(query || '');
  const deadline = Date.now() + maxWaitMs;
  let i = 0;
  while (i < text.length && Date.now() < deadline) {
    try { const isOpen = await container.evaluate(el => el.classList.contains('open')).catch(() => false); if (!isOpen) { try { await toggle.click(); } catch {} try { await searchInput.waitFor({ state: 'visible', timeout: 800 }); } catch {} } } catch {}
    const currentInput = container.locator('input.ui-select-search');
    try { await currentInput.type(text[i], { delay }); } catch {}
    i += 1;
    await ui.page.waitForTimeout(Math.max(60, Math.floor(delay / 2)));
    try { if ((await rows.count()) > 0) break; } catch {}
  }

  let count = 0; try { count = await rows.count(); } catch { count = 0; }
  if (count === 0) { await ui.attach?.('Address: no suggestions — switching to manual'); try { await ui.click('Borrowers.address.typeManually'); } catch {} return false; }

  let texts = []; try { texts = await rows.allTextContents(); } catch {}
  const idx = rankAddressRows(texts, preferContains || []);
  await rows.nth(idx).click();
  await ui.attach?.(`Address: selected row #${idx + 1}`);
  return true;
}

async function fillCurrentAddressFromApplicant(ui, applicant, { faker } = {}) {
  const { query } = pickAddressQuery(applicant, { faker });
  const city = applicant?.get?.('City');
  const province = applicant?.get?.('Province') || applicant?.get?.('ProvinceCode');
  const postal = applicant?.get?.('Postal') || applicant?.get?.('PostalCode');
  const ok = await fillCurrentAddress(ui, query, { preferContains: [city, province, postal].filter(Boolean) });
  if (ok) return true;
  try { await fillManualAddressFromApplicant(ui, applicant, { faker }); return true; } catch { return false; }
}

// ---- Manual address fallback ----
const PROVINCES = { AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick', NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories', NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec', SK: 'Saskatchewan', YT: 'Yukon' };
const STREET_TYPES = new Set(['Street','St','Road','Rd','Avenue','Ave','Boulevard','Blvd','Drive','Dr','Court','Ct','Crescent','Circle','Cir','Lane','Ln','Way','Place','Pl','Trail','Trl','Terrace','Ter','Parkway','Pkwy','Highway','Hwy','Close']);

function parsePostal(s) { if (!s) return ''; const m = String(s).toUpperCase().match(/[A-Z]\d[A-Z]\s?\d[A-Z]\d/); if (!m) return ''; const raw = m[0].replace(/\s+/g, ''); return raw.slice(0, 3) + ' ' + raw.slice(3); }
function parseProvince(s) { if (!s) return ''; const t = String(s).trim(); const up = t.toUpperCase(); if (PROVINCES[up]) return PROVINCES[up]; const found = Object.values(PROVINCES).find(name => name.toLowerCase() === t.toLowerCase()); return found || ''; }

function splitAddressLine(line) {
  const out = { unit: '', number: '', name: '', type: '', city: '', province: '', postal: '' };
  if (!line) return out;
  const trimmed = String(line).trim();
  out.postal = parsePostal(trimmed);
  let head = trimmed.replace(out.postal, '').trim();
  const provCodeMatch = head.match(/(\bAB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT\b)$/i);
  if (provCodeMatch) { out.province = parseProvince(provCodeMatch[1]); head = head.slice(0, provCodeMatch.index).trim(); }
  else {
    const names = Object.values(PROVINCES).sort((a, b) => b.length - a.length);
    for (const name of names) { const rx = new RegExp(`\\b${name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b$`, 'i'); const m = head.match(rx); if (m) { out.province = name; head = head.slice(0, m.index).trim(); break; } }
  }
  const tokens = head.split(/\s+/).filter(Boolean);
  if (tokens.length >= 3) {
    for (let take = Math.min(3, tokens.length - 2); take >= 1; take--) { const cityTry = tokens.slice(-take).join(' '); const streetTry = tokens.slice(0, tokens.length - take); if (streetTry.length >= 2) { out.city = cityTry; head = streetTry.join(' '); break; } }
  }
  const st = head.split(/\s+/).filter(Boolean);
  if (st.length) {
    if (/^\d+[A-Z]?$/i.test(st[0])) { out.number = st.shift(); }
    if (st.length) { const last = st[st.length - 1]; if (STREET_TYPES.has(last) || STREET_TYPES.has(last.replace(/\.?$/, ''))) { out.type = last.replace(/\.?$/, ''); st.pop(); } }
    out.name = st.join(' ');
  }
  if (!out.type) out.type = 'Street';
  return out;
}

async function ensureManualAddressMode(ui) {
  try { if (await ui.exists('Borrowers.address.manual.section', 600)) return; } catch {}
  try { await ui.click('Borrowers.address.typeManually'); } catch {}
  try { await ui.expectVisible('Borrowers.address.manual.section', 3000); } catch {}
  try { const num = await ui.byKey('Borrowers.address.manual.streetNumber'); const deadline = Date.now() + 3000; while (Date.now() < deadline) { try { if (!(await num.isDisabled())) break; } catch {} await ui.page.waitForTimeout(120); } } catch {}
}

async function fillManualAddress(ui, parts, provinceHint) {
  await ensureManualAddressMode(ui);
  const prov = parseProvince(provinceHint) || parts.province;
  if (parts.unit) { try { await ui.fill('Borrowers.address.manual.unit', parts.unit); } catch {} }
  if (parts.number) { try { await ui.fill('Borrowers.address.manual.streetNumber', parts.number); } catch {} }
  if (parts.name) { try { await ui.fill('Borrowers.address.manual.streetName', parts.name); } catch {} }
  if (parts.type) { try { await ui.selectByLabel('Borrowers.address.manual.streetType', parts.type); } catch {} }
  if (parts.city) { try { await ui.fill('Borrowers.address.manual.city', parts.city); } catch {} }
  if (prov) { try { await ui.selectByLabel('Borrowers.address.manual.province', prov); } catch {} }
  if (parts.postal) { try { await ui.fill('Borrowers.address.manual.postal', parts.postal); } catch {} }
}

async function fillManualAddressFromApplicant(ui, applicant, { faker } = {}) {
  const raw = applicant?.get?.('Address');
  const parts = splitAddressLine(raw || '');
  if (!parts.number || !parts.name) {
    const province = applicant?.get?.('Province') || applicant?.get?.('ProvinceCode');
    const addr = faker?.getAddress?.(province);
    const fallback = { unit: '', number: addr?.street_no || '', name: addr?.str_name || '', type: addr?.str_type || 'Street', city: addr?.city || '', province: parseProvince(addr?.province || province), postal: (addr?.postal_code || '').toUpperCase() };
    await fillManualAddress(ui, fallback, province);
    return;
  }
  const provinceHint = applicant?.get?.('Province') || applicant?.get?.('ProvinceCode');
  await fillManualAddress(ui, parts, provinceHint);
}

async function expandEmployment(ui) { try { await ui.click('Borrowers.employment.add'); } catch {} }

module.exports = {
  addBorrowerFromBag,
  fillBorrowerProfileFromApplicant,
  fillCurrentAddress,
  fillCurrentAddressFromApplicant,
  fillManualAddressFromApplicant,
  expandEmployment,
  rankAddressRows,
};

