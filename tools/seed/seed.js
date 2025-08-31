// scripts/seed.js
// Usage: node scripts/seed.js uat   OR   node scripts/seed.js sit
// Seeds Playwright storage after manual login+OTP in the *Playwright* browser.

const { chromium } = require('playwright'); // not @playwright/test
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ---- Configuration ----
const ENV = (process.argv[2] || 'uat').toLowerCase();
const BASE = {
  uat: 'https://www.scotiamortgageauthority-uat.scointnet.net/home/',
  sit: 'https://scotiamortgageauthority-ist.apps.stg.azr-cc-pcf.cloud.bns/home/'
}[ENV];

if (!BASE) {
  console.error('Usage: node scripts/seed.js <uat|sit>');
  process.exit(2);
}

// Selectors
const sel = {
  // landing CTA
  signInCta: '#sign-in-button, .sign-in-link, a#sign-in-button',
  // login form (JSF)
  loginUser: '#myForm\\:userName',
  loginPass: '#myForm\\:password',
  loginBtn:  '#myForm\\:loginBtn',
  // optional "register this device"
  registerDevice: '#myForm\\:opt2',
  // authenticated-only markers
  pipelineId: '#mat-tab-link-1',
  pipelineText: 'a:has-text("Pipeline")'
};

const AUTH_PATH = path.resolve(`config/env/${ENV}.json`);

let saved = false;

// ---- Small prompt helpers (mask password) ----
function prompt(question, { mask = false } = {}) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (mask) {
    rl._writeToOutput = function (stringToWrite) {
      if (rl.stdoutMuted) rl.output.write('*');
      else rl.output.write(stringToWrite);
    };
  }
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
    if (mask) rl.stdoutMuted = true;
  });
}

async function ensureCreds() {
  let user = process.env[`USER_${ENV.toUpperCase()}`];
  let pass = process.env[`PASS_${ENV.toUpperCase()}`];

  if (!user) user = await prompt(`Username (${ENV.toUpperCase()}): `);
  if (!pass) pass = await prompt(`Password (${ENV.toUpperCase()}): `, { mask: true });

  if (!user || !pass) {
    console.error('Username and password are required.');
    process.exit(2);
  }
  return { user, pass };
}

async function saveState(context, note = '') {
  if (saved) return;
  saved = true;
  fs.mkdirSync(path.dirname(AUTH_PATH), { recursive: true });
  await context.storageState({ path: AUTH_PATH });
  console.log(`\n✅ Saved storage state → ${AUTH_PATH}${note ? ' — ' + note : ''}`);
}

(async () => {
  console.log(`\n🌐 Seeding ${ENV.toUpperCase()} — opening: ${BASE}`);

  const creds = await ensureCreds();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  // If user closes the browser before saving, don't attempt to save then.
  browser.on('disconnected', () => {
    if (!saved) {
      console.warn('\n⚠️ Browser closed before saving auth state. Nothing was saved.');
      process.exit(1);
    } else {
      process.exit(0);
    }
  });

  // Manual fallback: press Enter to force-save & exit
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt('\n🔧 Press <Enter> at any time to save current session and exit...\n');
  rl.prompt();
  rl.on('line', async () => {
    rl.close();
    try {
      await saveState(context, 'manual save');
      await browser.close();
    } catch (e) {
      console.error('❌ Manual save failed:', e.message);
      process.exit(1);
    }
  });

  // 1) Go to landing
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });

  // 2) Click "Sign In" (landing CTA)
  const hasSignIn = await page.locator(sel.signInCta).first().isVisible().catch(() => false);
  if (hasSignIn) {
    await page.locator(sel.signInCta).first().click();
  }

  // 3) Wait for login form, then fill
  await page.locator(sel.loginUser).first().waitFor({ timeout: 15000 });
  await page.fill(sel.loginUser, creds.user);
  await page.fill(sel.loginPass, creds.pass);

  // Optional "Register this device" to reduce OTP prompts next time
  try {
    const reg = page.locator(sel.registerDevice).first();
    if (await reg.isVisible()) await reg.check().catch(() => {});
  } catch {}

  // 4) Submit and handle OTP manually in the opened browser
  await page.locator(sel.loginBtn).first().click();

  console.log('\n👉 Complete OTP on your phone in the opened browser window…');

  // 5) Detect authenticated UI (must be post-login)
  //    - Pipeline id or text visible
  //    - NOT on login url
  const deadline = Date.now() + 5 * 60 * 1000; // 5 minutes
  while (Date.now() < deadline) {
    try {
      const onPipelineId = await page.locator(sel.pipelineId).first().isVisible({ timeout: 500 }).catch(() => false);
      const onPipelineText = await page.locator(sel.pipelineText).first().isVisible({ timeout: 500 }).catch(() => false);
      const notLoginUrl = !/\/login\.bns/i.test(page.url());

      if ((onPipelineId || onPipelineText) && notLoginUrl) {
        console.log('✅ Authenticated UI detected (Pipeline present).');
        await saveState(context);
        await browser.close();
        return;
      }

      await page.waitForLoadState('domcontentloaded', { timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(400);
    } catch {
      // ignore transient DOM issues
    }
  }

  console.error('⏰ Timed out waiting for authenticated state (5 min). Press <Enter> to force-save, or re-run.');
})();
