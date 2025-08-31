// src/core/basePage.js
const audit = require('../../tests/support/audit');
const { getSpec } = require('../utils/locators');

let selectorHealer = null;
try { selectorHealer = require('../utils/selectorHealer'); } catch {}

class BasePage {
  constructor(page, attach) {
    if (!page) throw new Error('BasePage requires a Playwright Page');
    this.page = page;
    this.attach = attach;
  }

  _parseRoleSelector(sel) {
    if (!sel || !sel.startsWith('role=')) return null;
    const m = sel.match(/^role=([^\[\s]+)(?:\[(.+)\])?$/i);
    if (!m) return null;
    const role = m[1];
    const opts = {};
    if (m[2]) {
      const nameMatch = m[2].match(/name=(\/.+\/[a-z]*|".+"|'.+')/i);
      if (nameMatch) {
        const raw = nameMatch[1];
        if (raw.startsWith('/')) {
          const rx = raw.slice(1, raw.lastIndexOf('/'));
          const flags = raw.slice(raw.lastIndexOf('/') + 1);
          opts.name = new RegExp(rx, flags);
        } else {
          opts.name = raw.replace(/^['"]|['"]$/g, '');
        }
      }
    }
    return { role, options: opts };
  }

  _locatorFromCandidate(sel, containerFn) {
    const roleSpec = this._parseRoleSelector(sel);
    const scope = typeof containerFn === 'function' ? containerFn() : null;
    if (roleSpec) {
      const base = scope ? scope.getByRole(roleSpec.role, roleSpec.options || {}) : this.page.getByRole(roleSpec.role, roleSpec.options || {});
      return base.first();
    }
    const base = scope ? scope.locator(sel) : this.page.locator(sel);
    return base.first();
  }

  async byKey(key, fallbackFactory) {
    const spec = getSpec(key) || {};
    const candidates = Array.isArray(spec.candidates) ? spec.candidates.filter(Boolean) : [];
    const total = candidates.length;
    const required = spec.required !== false;
    const timeout = Number.isFinite(spec.timeout) ? spec.timeout : 8000;

    if (total === 0) {
      try {
        const { getAllKeys } = require('../utils/locators');
        const keys = (typeof getAllKeys === 'function') ? getAllKeys() : [];
        const hint = keys.filter(k => k.includes((key.split('.').pop() || ''))).slice(0, 10).join(', ');
        await this.attach?.(
          `No candidates in spec for "${key}".\n` +
          `Registry has ${keys.length} keys. Nearby: ${hint || '(none)'}`
        );
      } catch {}
      audit.record(key, { usedIndex: undefined, total, usedSelector: '', mode: 'FAIL' });
      if (required) throw new Error(`No locator candidate matched for key "${key}"`);
      return this.page.locator(':root');
    }

    const errors = [];

    for (let i = 0; i < candidates.length; i++) {
      const sel = candidates[i];
      try {
        const loc = this._locatorFromCandidate(sel);
        await loc.waitFor({ state: 'attached', timeout });
        await loc.waitFor({ state: 'visible',  timeout });

        const mode = i === 0 ? 'PRIMARY' : 'HEALED';
        audit.record(key, { usedIndex: i + 1, total, usedSelector: sel, mode });
        await this.attach?.(`Locator resolved [${mode}] for ${key} (${i + 1}/${total})`);
        return loc;
      } catch (e) {
        errors.push(`[#${i + 1}] ${e?.message || e}`);
      }
    }

    if (total > 0 && spec?.healer?.enabled && typeof selectorHealer === 'function') {
      try {
        const healed = await selectorHealer(this.page, candidates, { timeout: spec.healer.timeout || 1200 });
        if (healed?.locator) {
          audit.record(key, { usedIndex: undefined, total, usedSelector: healed.selector || '', mode: 'HEALER' });
          await this.attach?.(`Locator resolved [HEALER] for ${key}`);
          return healed.locator;
        }
      } catch (e) {
        errors.push(`healer: ${e?.message || e}`);
      }
    }

    if (typeof fallbackFactory === 'function') {
      try {
        const fb = await Promise.resolve(fallbackFactory());
        if (fb) {
          audit.record(key, { usedIndex: undefined, total, usedSelector: 'fallbackFactory', mode: 'FALLBACK' });
          await this.attach?.(`Locator resolved [FALLBACK] for ${key}`);
          return fb;
        }
      } catch {}
    }

    const url = this.page.url();
    await this.attach?.(
      `Locator resolution FAILED for key: ${key}\n` +
      `URL: ${url}\n` +
      `Tried ${total} candidates:\n- ${errors.join('\n- ')}`
    );
    audit.record(key, { usedIndex: undefined, total, usedSelector: '', mode: 'FAIL' });

    if (required) throw new Error(`No locator candidate matched for key "${key}"`);
    return this._locatorFromCandidate(candidates[0]) || this.page.locator(':root');
  }
}

module.exports = { BasePage };
