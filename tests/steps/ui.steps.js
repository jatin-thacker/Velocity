/**
 * features/steps/ui.steps.js – generic atomic steps
 *
 * Usage: When I click "loginpage.submit" | When I fill "loginpage.username" with "value"
 * Used by: All features that prefer atomic, composable actions.
 * Notes: Backed by helpers/ui.js; favors readability and reuse.
 */
const { When, Then } = require('@cucumber/cucumber');
const { UI } = require('../../src/utils/ui');

function getAttach(world){ return (typeof world.attach === 'function') ? world.attach.bind(world) : async () => {}; }

When('I click {string}', async function (key) {
  const ui = new UI(this.page, getAttach(this));
  await ui.click(key);
});

When('I open the Borrowers section', async function () {
  const ui = new UI(this.page, getAttach(this));
  await ui.ensureBorrowersOpen();
});

When('I fill {string} with {string}', async function (key, value) {
  const ui = new UI(this.page, getAttach(this));
  await ui.fill(key, value);
});

Then('I expect {string} to be visible', async function (key) {
  const ui = new UI(this.page, getAttach(this));
  await ui.expectVisible(key);
});


const { Given } = require('@cucumber/cucumber');

Given('I open the application', async function () {
  await this.attach(`Application will be launched`);
});


When('I fill {string} from env {string}', async function (key, envName) {
  const { UI } = require('../../src/utils/ui');
  const ui = new UI(this.page, (typeof this.attach==='function')?this.attach.bind(this):async()=>{});
  const value = process.env[envName] || '';
  await ui.fill(key, value);
});


const { getSpec } = require('../../src/utils/locators');
const { fake } = require('../../src/utils/fakerUtil');

function keyExists(key) {
  try { return !!getSpec(key); } catch { return false; }
}




/** Random data steps (names, email, phone, numbers) */
const fakerUtil = require('../../src/utils/fakerUtil');

function _attach(world) { return (typeof world.attach === 'function') ? world.attach.bind(world) : async () => {}; }
function _keyExists(key) { try { return !!getSpec(key); } catch { return false; } }

When('I fill {string} name fields with random values', async function (prefix) {
  const ui = new UI(this.page, _attach(this));
  const name = fakerUtil.getName();
  const map = [
    [`${prefix}.firstName`, name.firstName],
    [`${prefix}.lastName`, name.lastName]
  ];
  for (const [key, value] of map) {
    if (_keyExists(key)) await ui.fill(key, String(value));
  }
  await _attach(this)(`Random name used: ${JSON.stringify(name)}`);
});

When('I fill {string} with a fake email', async function (key) {
  const ui = new UI(this.page, _attach(this));
  const email = fakerUtil.getEmail();
  await ui.fill(key, email);
  await _attach(this)(`Fake email: ${email}`);
});

When('I fill {string} with a fake phone', async function (key) {
  const ui = new UI(this.page, _attach(this));
  const phone = fakerUtil.getPhone();
  await ui.fill(key, phone);
  await _attach(this)(`Fake phone: ${phone}`);
});

When('I fill {string} with a random number between {float} and {float}', async function (key, min, max) {
  const ui = new UI(this.page, _attach(this));
  const num = fakerUtil.numberInRange(min, max, 2);
  await ui.fill(key, String(num));
  await _attach(this)(`Random number between ${min}-${max}: ${num}`);
});

When('I fill {string} with a random number between {float} and {float} with {int} decimals', async function (key, min, max, decimals) {
  const ui = new UI(this.page, _attach(this));
  const num = fakerUtil.numberInRange(min, max, decimals);
  await ui.fill(key, String(num));
  await _attach(this)(`Random number ${min}-${max} (${decimals} dp): ${num}`);
});


When('I select the checkbox {string}', async function (key) {
  const ui = new UI(this.page, _attach(this));
  await ui.check(key);;
});


When('I get a random number', async function () {
  randNum = fakerUtil.numberInRange(10,99);
  await _attach(this)(`Random number ${randNum} added`);
   // underline-active assertionS
});
