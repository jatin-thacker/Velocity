## 2025-08-28 17:43:48
- Consolidated locators into `locators/registry.json` using global keys like `loginpage.username`.
- Updated `helpers/locators.js` with `getSpec(key)` and `loadRegistry()`.
- Refactored `BasePage` to pull specs from the registry and enforce strictness by default.
- Added `helpers/ui.js` providing simple verbs (click/fill/expectVisible/within).
- Added atomic generic steps in `features/steps/ui.steps.js`.
- Began page refactors to remove literals; further passes recommended using the selector hit list.
- Strengthened hooks try/catch; ensured screenshots on failure.
- Patched MCHR cleanup with MutationObserver for sticky footer removal.
