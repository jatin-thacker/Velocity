# Execution Flow & Conventions

**CLI ➜ Config ➜ Cucumber ➜ World/Hooks ➜ Steps ➜ Pages ➜ Utils/Locators**

- Steps are thin: just call Page methods.
- Pages own interactions; inherit from `src/core/basePage.js`.
- Utils are stateless; locators resolved via `src/utils/locators.js`.
- Env state (cookies, storageState) lives in `config/env/*.json`.
- Reports written to `./reports` and opened by `tools/report` scripts.

## Paths
- Features: `tests/features/**/*.feature`
- Steps: `tests/steps/**/*.js`
- Support: `tests/support/**/*.js`
- Pages: `src/pages/**/*.js`

## Running
- `npm run bdd` (headless) — uses `cucumber.cjs` which forwards to `config/cucumber.cjs`.
- `ENV=uat npm run bdd` — selects `config/env/uat.json` for storageState.
