// features/steps/debug.steps.js
const { Then } = require('@cucumber/cucumber');
const { getSpec, getAllKeys } = require('../../src/utils/locators');

Then('DEBUG show spec for {string}', async function (key) {
  const spec = getSpec(key);
  const keys = getAllKeys();
  await (this.attach?.bind(this) ?? (()=>Promise.resolve()))(
    `Spec for "${key}": ${JSON.stringify(spec)}\nKnown keys (first 40): ${keys.slice(0,40).join(', ')}`
  );
});
