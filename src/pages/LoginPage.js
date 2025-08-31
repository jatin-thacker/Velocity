/**
 * pages/LoginPage.js – Page object (verbs only)
 *
 * Usage: const { UI } = require('../utils/ui'); // within steps/pages, call UI verbs with registry keys
 * Used by: Feature steps that orchestrate flows; do not put selectors here.
 * Notes: Keep methods minimal; rely on locators/registry.json and UI helper.
 */
const { BasePage } = require('../core/basePage');
const { expect } = require('@playwright/test');

class LoginPage extends BasePage {
  constructor(page, cfg, attach) {
    super(page, attach);
this.cfg = cfg;
  }

  async open() {
    await this.page.goto(this.cfg.baseUrl, { waitUntil: 'domcontentloaded' });
    await this.attach?.('Opened landing page');
    await this._snap('01-landing');
  }

  async goToLoginForm() {
    // If username field already visible, we're on the form
    const usernameCss = "#myForm\\:userName";
    if (await this.page.locator(usernameCss).first().isVisible().catch(() => false)) {
      await this.attach?.('Login form already visible (username field detected).');
      await this._snap('02-login-form-visible');
      return;
    }

    // Click Sign In (ordered candidates live in locators/login.json)
    const signIn = await this.byKey('signInLink');
    await signIn.click();
    await this.attach?.('Clicked "Sign In" to reach JSF login form.');
    await this.page.locator(usernameCss).first().waitFor({ timeout: 10000 });

    await this._snap('02-login-form-visible');
  }

  async fillUsername(value) {
    const el = await this.byKey('username');
    await el.fill(value);
    await this.attach?.(`Filled username with value for user "${this.cfg.userEmail}".`);
    await this._snap('03-username-filled');
  }

  async fillPassword(value) {
    const el = await this.byKey('password');
    await el.fill(value);
    await this.attach?.('Filled password (masked).');
    await this._snap('04-password-filled');
  }


  async submit() {
    // Scope to actual login form to avoid clicking header buttons
    const form = this.page.locator('form#myForm, form[name="myForm"]').first();
    
    const btn = await this.byKey(
      'submit',
      () => form.locator('button[type=submit], input[type=submit]').first()
    );

    await btn.waitFor({ state: 'visible', timeout: 4000 });
    if (!(await btn.isEnabled().catch(() => false))) {
      throw new Error('Login submit button is disabled.');
    }

    await this._snap('06-before-submit');
    await btn.click();
    await this.attach?.('Clicked login submit');

    // Wait for navigation/settle
    await Promise.any([
      this.page.waitForURL(url => !/\/login\.bns/i.test(String(url)), { timeout: 15000 }),
      this.page.waitForLoadState('networkidle', { timeout: 15000 })
    ]).catch(() => { /* not all flows navigate */ });

    // Detect OTP page proactively
    const html = (await this.page.content()).toLowerCase();
    if (/\botp\b|one[-\s]?time|verification code/.test(html)) {
      await this._snap('07-otp-detected');
      throw new Error(
        'OTP challenge detected. Re-login manually to trust the device (OTP window <24h), then rerun.'
      );
    }

    await this._snap('07-after-submit-stable');
    await this.attach?.(`Post-login URL: ${this.page.url()}`);
  }

  // --- utilities ---
  async _snap(label) {
    // small delay to avoid capturing during paint/transition
    await this.page.waitForTimeout(300);
    try {
      const shot = await this.page.screenshot({ fullPage: false });
      await this.attach?.(shot, 'image/png');
      await this.attach?.(`Screenshot: ${label}`);
    } catch { /* ignore */ }
  }
}

module.exports = { LoginPage };
