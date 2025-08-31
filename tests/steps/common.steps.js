// features/steps/common.steps.js
const { Given, When, Then } = require('@cucumber/cucumber');
const { LoginPage } = require('../../src/pages/LoginPage');
const { UI } = require('../../src/utils/ui');

function getAttach(world) {
  return (typeof world.attach === 'function') ? world.attach.bind(world) : async () => {};
}


/**
 * Clicks the left "Add" menu then selects "Application".
 * - Expands the menu if collapsed
 * - Waits for "Application" to be visible, then clicks it
 */
When('I open Add and start a new Application', async function () {
  const ui = new UI(this.page, getAttach(this));

  await this.page.waitForLoadState('domcontentloaded').catch(() => {});

  // 1) Click/hover the Add toggle
  const add = await ui.byKey('nav.add.toggle');
  try {
    await add.click({ timeout: 6000 });
  } catch {
    await add.hover(); // some skins open on hover
  }

  // 2) Wait for submenu and click Application
  await ui.expectVisible('nav.add.application');
  await ui.click('nav.add.application');

  // 3) Optional: wait for the Application shell to render
  await this.page.waitForLoadState('domcontentloaded');
  // If there’s a distinctive header, uncomment and tune:
  // await this.page.getByRole('heading', { name: /application/i }).waitFor({ timeout: 10000 });
});
