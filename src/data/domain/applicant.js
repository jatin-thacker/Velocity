// inside helpers/data/applicants.js (or applicant.js)
const { DataBag } = require('./DataBag.js');  // exact case + .js
const Data = require('../../utils/data');


const ALLOWED_TITLES = new Set(['Mr','Ms','Mrs','Dr']); // extend only by agreement

function parseStrictCASL(row, idLabel) {
  const caslRaw   = row.CASL !== undefined ? String(row.CASL).trim() : '';
  const statusRaw = row.CASLStatus !== undefined ? String(row.CASLStatus).trim() : '';
  const hasCASL = caslRaw !== '';
  const hasStatus = statusRaw !== '';
  if (hasCASL && hasStatus) throw new Error(`${idLabel}: provide only one of CASL or CASLStatus`);
  if (!hasCASL && !hasStatus) throw new Error(`${idLabel}: CASL or CASLStatus is required`);
  if (hasCASL) {
    if (caslRaw !== 'true' && caslRaw !== 'false') throw new Error(`${idLabel}: CASL must be "true" or "false"`);
    return caslRaw === 'true';
  }
  if (statusRaw !== 'opt in' && statusRaw !== 'opt out')
    throw new Error(`${idLabel}: CASLStatus must be "opt in" or "opt out"`);
  return statusRaw === 'opt in';
}

// Fetch a catalog row, validate basics, return a DataBag + casl + meta
async function getApplicantById(ctx, applicantId) {
  const id = String(applicantId || '').trim();
  if (!id) throw new Error('ApplicantsCatalog: ApplicantID is empty');

  const row = await ctx.excel.getRow('ApplicantsCatalog', { ApplicantID: id });
  if (!row) throw new Error(`ApplicantsCatalog: no row for ApplicantID=${id}`);

  // Title is strictly required & whitelisted (you said testers are technical)
  const title = String(row.Title || '').trim();
  if (!title) throw new Error(`ApplicantsCatalog[${id}].Title is required`);
  if (!ALLOWED_TITLES.has(title)) {
    throw new Error(`ApplicantsCatalog[${id}].Title "${title}" invalid. Allowed: ${[...ALLOWED_TITLES].join(', ')}`);
  }

  // CASL parsed here (strict, never faked)
  const casl = parseStrictCASL(row, `ApplicantsCatalog[${id}]`);

  // Trim everything once; leave blanks as '' so DataBag returns undefined
  const sanitized = Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v).trim()])
  );

  return { id, title, casl, bag: new DataBag(sanitized) };
}

// Convenience for primary on a scenario
async function getPrimaryApplicantForScenario(ctx, scenarioID, { dealSheet = 'EndToEnd' } = {}) {
  const scen = String(scenarioID || '').trim();
  if (!scen) throw new Error('ScenarioID missing');

  // If your "Read the test data..." step already loaded the row, use it.
  let dealRow =
    (ctx.testData && String(ctx.testData.ScenarioID).trim() === scen)
      ? ctx.testData
      : await ctx.excel.getRow(dealSheet, { ScenarioID: scen });

  if (!dealRow) {
    throw new Error(`No row for ScenarioID=${scen} in sheet "${dealSheet}"`);
  }

  const primaryId = String(dealRow.PrimaryApplicantID || '').trim();
  if (!primaryId) {
    throw new Error(`PrimaryApplicantID missing in sheet "${dealSheet}" for ScenarioID=${scen}`);
  }

  const applicantRow = await ctx.excel.getRow('ApplicantsCatalog', { ApplicantID: primaryId });
  if (!applicantRow) {
    throw new Error(`ApplicantsCatalog: no row for ApplicantID=${primaryId}`);
  }

  const casl = parseStrictCASL(applicantRow, `ApplicantsCatalog[${primaryId}]`);

  const sanitized = Object.fromEntries(
    Object.entries(applicantRow).map(([k, v]) => [k, v == null ? '' : String(v).trim()])
  );

  return { id: primaryId, bag: new DataBag(sanitized), casl, scenarioID: scen };
}

async function getAdditionalApplicantIds(ctx, scenarioID, { dealSheet = 'EndToEnd', excludePrimary = true } = {}) {
  const scen = String(scenarioID || '').trim();
  if (!scen) throw new Error('ScenarioID missing');

  // Reuse already-loaded row if your "Read the test data..." step set it
  const dealRow =
    (ctx.testData && String(ctx.testData.ScenarioID).trim() === scen)
      ? ctx.testData
      : await ctx.excel.getRow(dealSheet, { ScenarioID: scen });

  const cols = ['SecondApplicantID','ThirdApplicantID','FourthApplicantID','FifthApplicantID','SixthApplicantID'];
  const norm = v => (v == null ? '' : String(v).trim());

  const primary = norm(dealRow.PrimaryApplicantID);
  let ids = cols
    .map(c => norm(dealRow[c]))
    .filter(id => id !== '');            // keep only non-empty

  if (excludePrimary && primary) {
    ids = ids.filter(id => id !== primary);
  }

  // de-dup just in case the sheet repeats an ID
  ids = [...new Set(ids)];
  return ids;
}

module.exports = {
  getApplicantById,
  getPrimaryApplicantForScenario,
  getAdditionalApplicantIds,
};

// --------- Facade helpers for more readable call-sites ---------

function toApplicantFacade(core) {
  // core: { id, title?, casl, bag: DataBag }
  return {
    id: core.id,
    casl: core.casl,
    title: core.title,
    bag: core.bag,
    get: (columnName, opts) => Data.get(core.bag, columnName, opts),
    toObject: () => core.bag?.toObject?.() || {},
  };
}

async function getApplicantDetail(ctx, applicantId) {
  const core = await getApplicantById(ctx, applicantId);
  return toApplicantFacade(core);
}

async function listApplicantsForScenario(ctx, scenarioID, { dealSheet = 'EndToEnd', includePrimary = true } = {}) {
  const list = [];
  if (includePrimary) {
    const prim = await getPrimaryApplicantForScenario(ctx, scenarioID, { dealSheet });
    list.push(toApplicantFacade(prim));
  }
  const extraIds = await getAdditionalApplicantIds(ctx, scenarioID, { dealSheet, excludePrimary: true });
  for (const id of extraIds) {
    const core = await getApplicantById(ctx, id);
    list.push(toApplicantFacade(core));
  }
  return list;
}

async function listAdditionalApplicantsForScenario(ctx, scenarioID, { dealSheet = 'EndToEnd' } = {}) {
  return listApplicantsForScenario(ctx, scenarioID, { dealSheet, includePrimary: false });
}

module.exports.getApplicantDetail = getApplicantDetail;
module.exports.listApplicantsForScenario = listApplicantsForScenario;
module.exports.listAdditionalApplicantsForScenario = listAdditionalApplicantsForScenario;
