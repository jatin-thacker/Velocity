const { Given } = require('@cucumber/cucumber');
const { DEFAULT_DATA_FILE } = require('../../src/data/adapters/excel.js');
const { setContext, getEnvConfigFromUserRow, readScenario } =
  require('../../src/utils/dataStore');
const { UI } = require('../../src/utils/ui');

function attachOf(world) {
  return typeof world.attach === 'function' ? world.attach.bind(world) : async () => {};
}

// ... your "Read the test data..." step stays the same ...

// strict: exact header names
const REQUIRED_ENV_HEADERS = ['LoginID', 'BASE_URL', 'USER_EMAIL', 'USER_PASSWORD', 'Role'];

function attachOf(world) {
  return typeof world.attach === 'function' ? world.attach.bind(world) : async () => {};
}

function assertEnvHeaders(row) {
  const missing = REQUIRED_ENV_HEADERS.filter(h => !(h in row));
  if (missing.length) {
    throw new Error(
      `Environment row missing required headers (strict): ${missing.join(', ')} | Present: ${Object.keys(row).join(', ')}`
    );
  }
}

function findEnvUserRowStrict(world, sheetName, loginId) {
  const row = world.excel.getRow(sheetName, { LoginID: loginId });
  if (!row) {
    const first = world.excel.getRows(sheetName)[0] || {};
    throw new Error(`User '${loginId}' not found in '${sheetName}' (strict). Headers: ${Object.keys(first).join(', ')}`);
  }
  return row;
}



function attachOf(world) {
  return typeof world.attach === 'function' ? world.attach.bind(world) : async () => {};
}

// --- Step 1: Read full scenario row ---
Given('Read the test data for {string} from {string}', async function (scenarioId, scenarioSheet) {
  const params = this.parameters || {};

  setContext({
    dataFile: params.dataFile || DEFAULT_DATA_FILE,
    scenarioSheet: scenarioSheet || params.scenarioSheet || 'Data',
    scenarioKey: params.scenarioKey || 'ScenarioID'
  });

  const row = readScenario(scenarioSheet, scenarioId);
  this.testData = row;

  await attachOf(this)(`Scenario '${scenarioId}' loaded from sheet '${scenarioSheet}' → ${JSON.stringify(row)}`);
});

// Helper to locate a user row by common header names
function findUserRow(world, sheetName, userId) {
  return (
    world.excel.getRow(sheetName, { LoginID: userId }) ||
    world.excel.getRow(sheetName, { Login: userId }) ||
    world.excel.getRow(sheetName, { USER: userId }) ||
    world.excel.getRow(sheetName, { Username: userId })
  );
};


// --- strict login step ---
Given(
  'Login into the Velocity Application using user {string} from environment sheet {string}',
  async function (userId, sheetName) {
    const attach = typeof this.attach === 'function' ? this.attach.bind(this) : async () => {};
    const sheet  = sheetName || 'SIT';

    // Strict row + strict headers (you already have these helpers wired)
    const row = findEnvUserRowStrict(this, sheet, userId);
    assertEnvHeaders(row);

    // Strict values (already strings per your latest logs)
    const baseUrl      = String(row['BASE_URL']).trim();
    const userEmail    = String(row['USER_EMAIL']).trim();
    const userPassword = String(row['USER_PASSWORD']).trim();

    await attach(`Env row for '${userId}' (${sheet}) [STRICT]: ${JSON.stringify(row)}`);
    await attach(`Using [STRICT] → BASE_URL=${baseUrl} | USER_EMAIL=${userEmail}`);

    if (!baseUrl) {
      await attach(`Headers present: ${Object.keys(row).join(', ')}`);
      throw new Error(`No BASE_URL found for user '${userId}' in sheet '${sheet}' (strict)`);
    }

    // Navigate to login page
    await this.page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await attach(`After goto → ${this.page.url()}`);

    const ui = new UI(this.page, attach);

    // FIRST: try your exact IDs quickly (fast-path strict check)
    const userById = this.page.locator('#amember-login');
    const passById = this.page.locator('#amember-pass');

    // Give the DOM a fair chance to render
    try {
      await userById.waitFor({ state: 'visible', timeout: 3000 });
      await passById.waitFor({ state: 'visible', timeout: 3000 });
    } catch {
      // If IDs aren’t visible yet, dump candidate diagnostics before failing
      await attach('Login IDs not visible after 3s; checking registry candidates...');
      await ui.debugCandidates('login.username', 800);
      await ui.debugCandidates('login.password', 800);
      // Try attached (not visible) one more time (some pages animate)
      try {
        await userById.waitFor({ state: 'attached', timeout: 1500 });
        await passById.waitFor({ state: 'attached', timeout: 1500 });
      } catch {
        throw new Error('Login form not present — cannot continue.');
      }
    }

    // Fill and submit using explicit IDs (strictest) and fall back to registry keys if needed
    try {
      await userById.fill(userEmail);
      await passById.fill(userPassword);
    } catch (e) {
      await attach(`ID fill failed: ${e && e.message}`);
      // Fallback to your registry keys (still strict keys, not fuzzy)
      await ui.fill('login.username', userEmail);
      await ui.fill('login.password', userPassword);
    }

    // Submit: try specific selectors then registry keys
    const submitByCss = this.page.locator("#am-login-form input[type='submit']");
    try {
      await submitByCss.first().click({ timeout: 1500 });
    } catch {
      if (await ui.exists('login.submit', 800))       await ui.click('login.submit');
      else if (await ui.exists('login.signin', 800))  await ui.click('login.signin');
      else if (await ui.exists('login.login', 800))   await ui.click('login.login');
      else {
        await ui.debugCandidates('login.submit', 800);
        await ui.debugCandidates('login.signin', 800);
        await ui.debugCandidates('login.login', 800);
        throw new Error('Login submit button not found under known keys.');
      }
    }

    // Wait for a post-login signal: URL change or disappearance of the login form
    await this.page.waitForLoadState('domcontentloaded');
    const stillOnLogin =
      (await userById.count()) > 0 && (await userById.first().isVisible().catch(() => false));
    if (stillOnLogin) {
      await attach('Still on login screen after submit; dumping candidates…');
      await ui.debugCandidates('login.username', 800);
      await ui.debugCandidates('login.password', 800);
      await ui.debugCandidates('login.submit', 800);
      throw new Error('Login appears to have failed (still on login form).');
    }

    await attach('Login form submitted and page transitioned.');
    this.testData.env = { userId, baseUrl, userEmail, userPassword, sheet: sheetName || 'SIT' };
  }
);

