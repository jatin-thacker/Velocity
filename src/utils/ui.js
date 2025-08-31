// src/utils/ui.js
const { expect } = require('@playwright/test');
const { BasePage } = require('../core/basePage');
const { getSpec } = require('./locators');
const audit = require('../../tests/support/audit');


class UI extends BasePage {
  constructor(page, attach) {
    super(page, attach);
    this._container = null;
  }

  within(containerKey) {
    this._container = containerKey;
    return this;
  }

  async _loc(key) {
    // Resolve spec + candidates for audit
    const spec = getSpec(key);
    const candidates = Array.isArray(spec.candidates)
      ? spec.candidates
      : [spec.selector].filter(Boolean);

    let locator;
    if (this._container) {
      const container = await this.byKey(this._container);
      locator = await this.byKey(key, () => container);
      this._container = null;
    } else {
      locator = await this.byKey(key);
    }

    // Best-effort: discover which selector matched (first visible/attached)
    let usedSelector = null;
    for (const sel of candidates) {
      try {
        const l = this._locatorFromCandidate(sel);
        await l.first().waitFor({ state: 'attached', timeout: 1 });
        usedSelector = sel;
        break;
      } catch { /* keep trying */ }
    }

    audit.recordLocate({
      key,
      candidates,
      usedSelector,
      url: this.page.url(),
    });

    return locator;
  }

  // Return a locator for all candidate matches for a key (not first-only)
  async _locAll(key) {
    const spec = getSpec(key);
    const candidates = Array.isArray(spec.candidates)
      ? spec.candidates
      : [spec.selector].filter(Boolean);
    for (const sel of candidates) {
      try {
        const loc = this._locatorFromCandidate(sel);
        await loc.first().waitFor({ state: 'attached', timeout: 200 });
        // Rebuild as non-first for enumeration
        const scope = null;
        const roleSpec = this._parseRoleSelector(sel);
        const all = roleSpec
          ? this.page.getByRole(roleSpec.role, roleSpec.options || {})
          : this.page.locator(sel);
        return all;
      } catch { /* try next */ }
    }
    // Lightweight fallback:
    // - Avoid heavy waits from byKey (which are tuned for required locates)
    // - Prefer a combined CSS locator when possible; otherwise return the
    //   first candidate as-is without extra waiting.
    try {
      const cssOnly = candidates.filter(s => typeof s === 'string' && !s.startsWith('role=') && !s.startsWith('xpath='));
      if (cssOnly.length > 0) {
        return this.page.locator(cssOnly.join(', '));
      }
    } catch {}
    return this.page.locator(String(candidates[0] || ':root *'));
  }

  async exists(key, timeout = 2000) {
    const spec = getSpec(key);
    const cands = Array.isArray(spec.candidates)
      ? spec.candidates
      : [spec.selector].filter(Boolean);

    for (const sel of cands) {
      const loc = this._locatorFromCandidate(sel);
      try {
        await loc.first().waitFor({ state: 'visible', timeout });
        return true;
      } catch {
        try {
          await loc.first().waitFor({ state: 'attached', timeout: Math.min(600, timeout) });
          return true;
        } catch { /* try next */ }
      }
    }
    return false;
  }

  async debugCandidates(key, timeout = 1000) {
    const lines = [`Locator debug for key "${key}":`];
    try {
      const spec = getSpec(key);
      const cands = Array.isArray(spec.candidates)
        ? spec.candidates
        : [spec.selector].filter(Boolean);
      let i = 0;
      for (const sel of cands) {
        i += 1;
        const loc = this._locatorFromCandidate(sel);
        try {
          await loc.first().waitFor({ state: 'attached', timeout });
          const count = await loc.count();
          lines.push(`- [${i}] ATTACHED (${count}) :: ${sel}`);
          try {
            await loc.first().waitFor({ state: 'visible', timeout: 200 });
            lines.push(`      ↳ VISIBLE`);
          } catch {
            lines.push(`      ↳ not visible`);
          }
        } catch {
          lines.push(`- [${i}] MISSING :: ${sel}`);
        }
      }
    } catch (e) {
      lines.push(`! getSpec/byKey failed: ${(e && e.message) || e}`);
    }
    const msg = lines.join('\n');
    try { await this.attach?.(msg); } catch {}
    return msg;
  }

  async click(key, { waitVisible = true, timeout = 10000 } = {}) {
    const loc = await this._loc(key);
    if (waitVisible) await expect(loc).toBeVisible({ timeout });

    // capture tiny DOM snippet for audit
    const h = await loc.first().elementHandle();
    const snippet = h ? await h.evaluate(el => el.outerHTML?.slice(0, 200)) : null;

    await loc.click();

    audit.recordClick({
      key,
      usedSelector: undefined, // already logged in locate
      url: this.page.url(),
      snippet,
    });
    await this.attach?.(`Clicked ${key}`);
  }

  async fill(key, value, { timeout = 10000 } = {}) {
    const loc = await this._loc(key);
    await expect(loc).toBeVisible({ timeout });

    const h = await loc.first().elementHandle();
    const snippet = h ? await h.evaluate(el => el.outerHTML?.slice(0, 200)) : null;

    await loc.fill(String(value ?? ''));
    audit.recordFill({
      key,
      usedSelector: undefined,
      url: this.page.url(),
      value,
      snippet,
    });
    await this.attach?.(`Filled ${key}`);
  }

  async selectByLabel(key, label, { timeout = 10000 } = {}) {
    const loc = await this._loc(key);
    await expect(loc).toBeVisible({ timeout });

    const h = await loc.first().elementHandle();
    const snippet = h ? await h.evaluate(el => el.outerHTML?.slice(0, 200)) : null;

    await loc.selectOption({ label: String(label) });
    audit.recordSelect({
      key,
      usedSelector: undefined,
      label,
      url: this.page.url(),
      snippet,
    });
    await this.attach?.(`Selected "${label}" in ${key}`);
  }

  async check(key, { timeout = 10000 } = {}) {
    const loc = await this._loc(key);
    await expect(loc).toBeVisible({ timeout });

    const h = await loc.first().elementHandle();
    const snippet = h ? await h.evaluate(el => el.outerHTML?.slice(0, 200)) : null;

    let changed = false;
    if (!(await loc.isChecked())) {
      await loc.check();
      changed = true;
    }
    audit.recordCheck({
      key,
      usedSelector: undefined,
      checked: changed ? 'checked' : 'already-checked',
      url: this.page.url(),
      snippet,
    });
    await this.attach?.(changed ? `Checked ${key}` : `Already checked: ${key}`);
  }

  async expectVisible(key, timeout = 10000) {
    const loc = await this._loc(key);
    await expect(loc).toBeVisible({ timeout });
    await this.attach?.(`Visible: ${key}`);
  }

  async text(key, { timeout = 10000 } = {}) {
    const loc = await this._loc(key);
    await expect(loc).toBeVisible({ timeout });
    return await loc.textContent();
  }

  // Simple boolean check using a registry key
  async isOpen(key, timeout = 800) {
    return await this.exists(key, timeout);
  }

  async readValue(key) {
    const loc = await this._loc(key);
    try {
      return (await loc.inputValue())?.trim?.() || '';
    } catch {
      try {
        const h = await loc.first().elementHandle();
        if (!h) return '';
        const v = await h.evaluate(el => (el && 'value' in el) ? String(el.value || '') : '');
        return (v || '').trim();
      } catch { return ''; }
    }
  }

  async fillIfEmpty(key, value, { timeout = 10000 } = {}) {
    const current = await this.readValue(key);
    if (current) return false;
    await this.fill(key, value, { timeout });
    return true;
  }

  async selectIfEmpty(key, label, { timeout = 10000 } = {}) {
    const loc = await this._loc(key);
    // attempt to detect current value; if empty or placeholder, select
    let current = '';
    try { current = await this.readValue(key); } catch {}
    if (current && current !== 'object:null') return false; // treat null/placeholder as empty
    await this.selectByLabel(key, label, { timeout });
    return true;
  }

  // Simple boolean check using a registry key
  async isOpen(key, timeout = 800) {
    return await this.exists(key, timeout);
  }

  // Modal save verifier + borrower tab snapshot
  async ensureModalSaved(modalKey = 'Borrowers.modal.root', { timeout = 6000 } = {}) {
    const modal = await this._loc(modalKey);
    try {
      await modal.waitFor({ state: 'detached', timeout });
      audit.recordModal({ action: 'close', key: modalKey, ok: true, url: this.page.url() });
      await this.attach?.('Modal closed (save presumed successful).');

      // snapshot borrower tabs if present
      const tabs = await this.page
        .locator('.nav-tabs li a, .borrowers .nav li a, .nav-tabs li [href^="#borrower"], .nav-tabs li [ng-href^="#borrower"], .nav-tabs li div[data-toggle="tab"], .nav-tabs li .arep')
        .allTextContents()
        .catch(() => []);
      if (tabs && tabs.length) {
        audit.recordTabs({ names: tabs.map(s => s.trim()).filter(Boolean), url: this.page.url() });
        await this.attach?.(`Borrower tabs now: ${tabs.join(' | ')}`);
      }
      return;
    } catch {
      const msgs = this.page.locator(
        ".has-error .help-block, .ng-invalid + .help-block, .error, .validation-error, .alert-danger"
      );
      const texts = await msgs.allTextContents().catch(() => []);
      audit.recordModal({
        action: 'close',
        key: modalKey,
        ok: false,
        details: texts.join(' | ') || '<none>',
        url: this.page.url(),
      });
      await this.attach?.(
        `Modal did not close within ${timeout}ms. Visible validation: ${texts.join(' | ') || '<none>'}`
      );
      throw new Error('Modal did not close (likely validation or save failure).');
    }
  }

  /** Force-refresh the Borrowers panel: collapse then expand and verify button. */
  async refreshBorrowersPanel() {
    try {
      // If currently open, collapse once
      const open = await this.exists('Borrowers.panel.open', 500);
      const hdr = await this.byKey('Borrowers.header');
      if (open) {
        await hdr.click();
        await this.page.waitForTimeout(150);
      }
      // Expand
      await hdr.click();
      // Verify ready
      await this.expectVisible('Borrowers.addBorrower', 4000);
      await this.attach?.('Borrowers panel refreshed (collapsed + expanded).');
    } catch (e) {
      await this.attach?.(`Borrowers panel refresh failed: ${e?.message || e}`);
    }
  }

  // Borrower tabs helpers
  async listBorrowerTabs() {
    try {
      const tabs = await this._locAll('Borrowers.tabs.labels');
      const count = await tabs.count();
      if (count > 0) {
        const texts = await tabs.allTextContents();
        return (texts || []).map(s => String(s || '').trim());
      }
    } catch {}
    // Fallback: anchors/divs that target borrower panes within the section
    try {
      const section = await this.byKey('Borrowers.section');
      const anchors = section.locator("a[href^='#borrower'], [href^='#borrower'], [ng-href^='#borrower'], div[data-toggle='tab']");
      const count = await anchors.count();
      if (count > 0) {
        const texts = await anchors.allTextContents();
        return (texts || []).map(s => String(s || '').trim());
      }
    } catch {}
    // Fallback: derive from tab panes ids
    try {
      const panes = this.page.locator('.tab-content .tab-pane, .tab-pane');
      const n = await panes.count();
      if (n > 0) {
        const names = [];
        for (let i = 0; i < n; i++) {
          const id = await panes.nth(i).getAttribute('id');
          names.push(id ? `#${id}` : `#pane-${i + 1}`);
        }
        return names;
      }
    } catch {}
    return [];
  }

  async selectBorrowerTab(nameOrIndex, { timeout = 6000 } = {}) {
    let tabs;
    let count = 0;
    try {
      tabs = await this._locAll('Borrowers.tabs.labels');
      count = await tabs.count();
    } catch {}
    if (!tabs || count === 0) {
      // Fallback A: anchors/divs inside section
      try {
        const section = await this.byKey('Borrowers.section');
        tabs = section.locator("a[href^='#borrower'], [href^='#borrower'], [ng-href^='#borrower'], div[data-toggle='tab'], .nav-tabs li .arep");
        count = await tabs.count();
      } catch {}
    }
    if (!tabs || count === 0) {
      // Fallback B: anchors/divs anywhere on the page
      try {
        tabs = this.page.locator("a[href^='#borrower'], [href^='#borrower'], [ng-href^='#borrower'], .nav-tabs li div[data-toggle='tab'], .nav-tabs li .arep");
        count = await tabs.count();
      } catch {}
    }
    if (!tabs || count === 0) {
      // Fallback C: compute target from panes and click by href
      const panes = this.page.locator('.tab-content .tab-pane, .tab-pane');
      const pn = await panes.count();
      if (pn === 0) throw new Error('No borrower tabs found');
      let idx = 0;
      if (typeof nameOrIndex === 'number' && Number.isFinite(nameOrIndex)) idx = Math.max(1, Math.min(pn, Math.floor(nameOrIndex))) - 1;
      const pane = panes.nth(idx);
      const pid = await pane.getAttribute('id');
      if (pid) {
        const trigger = this.page.locator(`a[href='#${pid}'], [href='#${pid}'], [ng-href='#${pid}'], .nav-tabs li div[data-toggle='tab'][href='#${pid}'], .nav-tabs li .arep[ng-href='#${pid}'], .nav-tabs li .arep[href='#${pid}']`);
        await trigger.first().click({ timeout: 3000 }).catch(() => {});
      }
      // ensure active
      try { await this.expectVisible('Borrowers.tab.activePane', timeout); } catch {}
      return;
    }

    let idx = -1;
    if (typeof nameOrIndex === 'number' && Number.isFinite(nameOrIndex)) {
      idx = Math.max(1, Math.min(count, Math.floor(nameOrIndex))) - 1;
    } else if (typeof nameOrIndex === 'string') {
      const want = String(nameOrIndex).trim().toLowerCase();
      for (let i = 0; i < count; i++) {
        const txt = String((await tabs.nth(i).textContent()) || '').trim().toLowerCase();
        const norm = txt.replace(/^\d+\s*[\.).-]?\s*/, ''); // strip leading numbering
        if (norm === want || norm.includes(want)) { idx = i; break; }
      }
      if (idx < 0) idx = 0; // default to first if not matched
    } else {
      idx = 0;
    }

    await tabs.nth(idx).click();
    // wait for active pane to be present/visible
    try { await this.expectVisible('Borrowers.tab.activePane', timeout); } catch {}
  }

  withinActiveBorrower() {
    return this.within('Borrowers.tab.activePane');
  }

    async assertBorrowerTabVisible(timeout = 8000) {
    // 1) Fast path: header is present & visible
    try {
      await this.expectVisible('Borrowers.header', timeout);
      return;
    } catch (e) {
      // fall through to try to bring it into view
    }

    // 2) Try to scroll the section into view, then re-assert header
    try {
      const section = await this.byKey('Borrowers.section');
      if (section && typeof section.scrollIntoViewIfNeeded === 'function') {
        await section.scrollIntoViewIfNeeded();
      } else {
        // fallback scroll to top; harmless if already in view
        await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
      await this.expectVisible('Borrowers.header', Math.max(2000, Math.floor(timeout / 2)));
      return;
    } catch (e2) {
      // fall through to final throw
    }

    // 3) No luck → emit a clear error (BasePage expectVisible already attached diagnostics)
    throw new Error('Borrowers tab/section is not visible on the page');
  }
  // --- Add to the UI class ---

/** Wait until the New Contact modal is fully gone. */
async waitForBorrowerModalClose(timeout = 12000) {
  const modal = this.page.locator(".modal-content:has(.modal-title)");
  // If it’s still there, wait for it to detach
  if (await modal.count()) {
    await modal.first().waitFor({ state: 'detached', timeout }).catch(() => {});
    await this.attach?.('Modal closed (save presumed successful).');
  }
}

  /** Ensure the Borrowers accordion is open and interactive (idempotent, registry-only). */
  async ensureBorrowersOpen() {
    const isOpen = async () => {
      if (await this.exists('Borrowers.panel.open', 800)) return true;
      if (await this.exists('Borrowers.addBorrower', 800)) return true;
      return false;
    };

    if (await isOpen()) {
      await this.attach?.('Borrowers panel already open.');
      return;
    }

    // Bring section into view (best-effort) using registry keys, but avoid heavy waits
    try {
      if (await this.exists('Borrowers.section', 600)) {
        const section = await this.byKey('Borrowers.section');
        if (section && typeof section.scrollIntoViewIfNeeded === 'function') {
          await section.scrollIntoViewIfNeeded();
        } else {
          await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
        }
      } else {
        await this.page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      }
    } catch {}

    // Try up to 3 times to open via header key
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const hdr = await this.byKey('Borrowers.header');
        await hdr.click();
      } catch {}

      const deadline = Date.now() + 2500;
      while (Date.now() < deadline) {
        if (await isOpen()) {
          await this.attach?.(`Borrowers panel is open (attempt ${attempt}).`);
          return;
        }
        await this.page.waitForTimeout(150);
      }
    }

    // Diagnostics then fail (registry keys only)
    try { await this.debugCandidates('Borrowers.header', 800); } catch {}
    try { await this.debugCandidates('Borrowers.panel.open', 800); } catch {}
    try { await this.debugCandidates('Borrowers.addBorrower', 800); } catch {}
    throw new Error('Borrowers panel did not open');
  }

/** Strong assertion that the Borrowers panel is open (uses the button as oracle). */
async assertBorrowersOpen() {
  await this.expectVisible('Borrowers.header');               // header present
  const addBtn = await this.byKey('Borrowers.addBorrower');   // button present => panel open
  await addBtn.waitFor({ state: 'visible', timeout: 8000 });
  await this.attach?.('Asserted Borrowers panel open (Add Borrower visible).');
}

}

module.exports = { UI };
