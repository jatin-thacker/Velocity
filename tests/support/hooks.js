// features/support/hooks.js
const {
  BeforeAll,
  AfterAll,
  Before,
  After,
  BeforeStep,
  AfterStep,
  setDefaultTimeout,
  Status,
} = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Centralized audit helper (new API with counters + per-step flush)
const audit = require('./audit');

setDefaultTimeout(60 * 1000);

// ---------- small helpers ----------
function currentEnv() {
  return (process.env.ENV || 'uat').toLowerCase();
}
function authPathForEnv() {
  return path.resolve(`config/env/${currentEnv()}.json`);
}
function ensureReportsDir() {
  fs.mkdirSync(path.resolve('reports'), { recursive: true });
}
function nowTag() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, '-');
}

/** Always call with: await safeAttach.call(this, data, mime) */
async function safeAttach(data, mime = 'text/plain') {
  if (typeof this?.attach !== 'function') return;
  try {
    if (Buffer.isBuffer(data)) {
      await this.attach(data, mime);
    } else {
      await this.attach(String(data), mime);
    }
  } catch {
    /* ignore attachment errors */
  }
}

// Locator registry diagnostics
const { clearRegistryCache, registryPath, getAllKeys } = require('../../src/utils/locators');

// ---------------- Test Run (global) lifecycle ----------------
BeforeAll(function () {
  // fresh locator registry each run
  clearRegistryCache();
  if (typeof this.attach === 'function') {
    try {
      this.attach(`Locator registry path: ${registryPath()}`);
      this.attach(`Locator keys loaded (count): ${getAllKeys().length}`);
    } catch (e) {
      this.attach(`Locator loader error: ${e?.message || e}`);
    }
  }

  // start audit counters and clear per-step buffer
  if (typeof audit.resetAll === 'function') {
    audit.resetAll();
  }
});

AfterAll(async function () {
  try {
    const outDir = path.resolve('reports', 'audit');
    fs.mkdirSync(outDir, { recursive: true });

    if (typeof audit.writeAuditSummary === 'function') {
      await audit.writeAuditSummary(outDir);
    } else if (typeof audit.persist === 'function') {
      await audit.persist(path.join(outDir, 'audit-summary'));
    }

    if (typeof audit.buildPlainTableSummary === 'function') {
      console.log('\n===== Locator Audit (full run) =====\n' + audit.buildPlainTableSummary());
    }
  } catch (e) {
    console.error('AfterAll: failed to write/attach audit summary:', e?.message || e);
  }

  // Always try to build and open HTML reports, even if tests failed
  try {
    const nodeBin = process.execPath || 'node';
    const buildMchr = path.resolve('tools', 'report', 'build-mchr.js');
    const buildStd  = path.resolve('tools', 'report', 'build-cucumber-html.js');
    const openDash  = path.resolve('tools', 'report', 'open-report.js');

    if (fs.existsSync(buildMchr)) {
      require('child_process').execFileSync(nodeBin, [buildMchr], { stdio: 'inherit' });
    }
    if (fs.existsSync(buildStd)) {
      try { require('child_process').execFileSync(nodeBin, [buildStd], { stdio: 'inherit' }); } catch {}
    }
    if (fs.existsSync(openDash)) {
      try { require('child_process').execFileSync(nodeBin, [openDash], { stdio: 'inherit' }); } catch {}
    }
  } catch (e) {
    console.warn('AfterAll: report build/open had an issue:', e?.message || e);
  }
});

// ---------------- Scenario lifecycle ----------------
BeforeStep(async function ({ pickleStep }) {
  await safeAttach.call(this, `➡️ Step: ${pickleStep.text}`);
});

Before(async function () {
  ensureReportsDir();

  const env = currentEnv();
  const authPath = authPathForEnv();
  const hasState = fs.existsSync(authPath);

  // Launch browser
  this.browser = await chromium.launch({
    headless: process.env.HEADED ? false : true,
    args: ['--start-maximized'],
  });

  this.context = await this.browser.newContext({
    viewport: null,
    ignoreHTTPSErrors: true,
    storageState: hasState ? authPath : undefined,
  });

  await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  this.page = await this.context.newPage();

  // Collect logs to attach later
  this._consoleLogs = [];
  this._pageErrors = [];
  this._requestFails = [];

  this.page.on('console', (msg) => {
    const entry = `[${msg.type().toUpperCase()}] ${msg.text()}`;
    this._consoleLogs.push(entry);
  });
  this.page.on('pageerror', (err) => {
    this._pageErrors.push(`${err?.name || 'Error'}: ${err?.message || String(err)}`);
  });
  this.page.on('requestfailed', (req) => {
    this._requestFails.push(`${req.failure()?.errorText || 'failed'} ${req.method()} ${req.url()}`);
  });

  await safeAttach.call(this, `ENV: ${env}`);
  await safeAttach.call(
    this,
    hasState
      ? `Loaded storageState from: ${authPath}`
      : `No storageState at ${authPath} — running cold.`
  );
});

AfterStep(async function ({ result }) {
  try {
    await safeAttach.call(this, `AfterStep | status=${result?.status}`);
    // give the DOM a beat to settle for better screenshots
    await this.page.waitForLoadState('domcontentloaded').catch(() => {});
    await this.page.waitForTimeout(100);

    const full = result?.status === Status.FAILED;
    const shot = await this.page.screenshot({ type: 'png', fullPage: full });
    await safeAttach.call(this, shot, 'image/png');
  } catch (e) {
    await safeAttach.call(this, `AfterStep screenshot failed: ${e?.message || e}`);
  }

  // Per-step audit flush: attaches JSON event list but keeps counters
  if (typeof audit.attachFlush === 'function') {
    await audit.attachFlush(this.attach);
  }
});

After(async function () {
  try {
    const finalShot = await this.page.screenshot({ fullPage: true });
    await safeAttach.call(this, finalShot, 'image/png');
    await safeAttach.call(this, `Final URL: ${this.page.url()}`);
  } catch {}

  if (this._consoleLogs?.length) {
    await safeAttach.call(this, `Console logs:\n${this._consoleLogs.join('\n')}`);
  }
  if (this._pageErrors?.length) {
    await safeAttach.call(this, `Page errors:\n${this._pageErrors.join('\n')}`);
  }
  if (this._requestFails?.length) {
    await safeAttach.call(this, `Network failures:\n${this._requestFails.join('\n')}`);
  }

  try {
    const tracePath = path.resolve(`reports/trace-${nowTag()}.zip`);
    await this.context.tracing.stop({ path: tracePath });
    await safeAttach.call(this, `Playwright trace saved: ${tracePath}`);
  } catch {}

  if (typeof audit.buildPlainTableSummary === 'function') {
    try {
      const txt = audit.buildPlainTableSummary();
      if (txt) await safeAttach.call(this, txt, 'text/plain');
    } catch {}
  }

  await this.context?.close().catch(() => {});
  await this.browser?.close().catch(() => {});
});
