
# Velocity Automation Framework

End‑to‑end UI automation with Cucumber (BDD) + Playwright + Node.js. The design emphasizes:
- Small, composable steps you can reuse across flows
- A dynamic data layer driven from Excel (add columns without code churn)
- A single locator registry with auditing so selectors are easy to evolve

This README is the primary onboarding guide for engineers and also a quick reference for AI coding assistants working in this repo.

---

## Project Structure

- config/
  - env/ — storage state and per‑env JSON (uat.json, sit.json, …)
- data/
  - addresses.json — curated Canadian addresses used by faker fallback
  - *.xlsx — data catalogs (ApplicantsCatalog, EndToEnd, …)
- reports/ — Playwright traces, audit summaries, and HTML reports
- src/
  - core/
    - basePage.js — base class for locator resolution + audit
  - data/
    - adapters/excel.js — Excel adapter (xlsx)
    - domain/ — domain mappers (applicant.js, DataBag.js)
  - utils/ — helpers (ui.js, fakerUtil.js, data.js, locators.js)
  - locators/
    - registry.json — all logical UI keys and selector candidates
- tests/
  - features/ — Gherkin feature files
  - steps/ — step definitions
  - support/ — hooks + audit system

---

## Quick Start

- Install: `npm install`
- Run headless: `npm run bdd`
- Run headed (debug): `npm run demo`
- Slow‑mo (interactive): `cross-env HEADED=1 SLOWMO=250 cucumber-js`
- Build HTML report: `npm run report:mchr && npm run open:cucumber`

Environment
- Optional `.env.uat`/`.env.sit` read via `config/env.js`.
- Useful vars:
  - `ENV=uat|sit` — selects `.env.<env>` if present
  - `DATA_FILE=./data/<your-file>.xlsx` — override default workbook
  - `MAX_BORROWERS=<n>` — cap for additional borrowers (safety)

---

## Core Concepts

1) Atomic Steps
- Compose flows from small steps (see `tests/features/smoke.feature`).
- Typical flow: Read data → Login → Open Velocity → Start Application → Fill Initial → Fill Additional Borrowers.

2) Locator Registry
- Code uses logical keys (e.g., `Borrowers.addBorrower`, `quick.firstName`) resolved by `src/locators/registry.json`.
- Multiple selector candidates per key; resolution is audited to `reports/audit`.

3) Dynamic Data Layer
- Access Excel via `src/utils/data.js` and `DataBag`. Add columns to `ApplicantsCatalog` or scenario sheets without touching code.
- Column names are case/space/underscore‑insensitive and support aliases.

4) Robust UI Utilities
- `UI` class wraps Playwright with conveniences: within() scoping, panel openers, borrower tab selection, modal save checks, etc.

---

## Data Model (Excel)

Scenario sheet (e.g., `EndToEnd`)
- `ScenarioID` (key)
- `PrimaryApplicantID`, `SecondApplicantID`, … `SixthApplicantID`

ApplicantsCatalog (typical columns; extend freely)
- Required: `ApplicantID`
- Common: `Title`, `FirstName`, `LastName`, `Email`, `DateOfBirth` (alias: `DOB`), `MaritalStatus`, `ResidentType` (alias: `Residency`), `HomePhone`, `CellPhone`, `BusinessPhone` (Work), `FaxNumber` (Fax), `ContactPreference`
- Address support used by automation:
  - `Address` — preferred search string for the Current Address type‑ahead
  - If `Address` is blank: `Province` or `ProvinceCode` is used to pick a curated Canadian address from `data/addresses.json`
  - Optional bias (if present): `City`, `Postal`/`PostalCode`

Aliases (selected)
- `DOB` ↔ `DateOfBirth`
- `Residency` ↔ `ResidentType`
- `ContactPref` ↔ `ContactPreference`
- `Mobile` ↔ `CellPhone`

See `src/utils/data.js` and `src/data/domain/DataBag.js` for details.

---

## Borrowers Workflow

Initial application (primary)
- Step: “I fill the initial application details”
- Fills primary first/last, CASL, closing date, agent, amount; saves.

Additional borrowers
- Step: “I fill additional borrowers”
- Phase 1 (per additional borrower):
  - Open Add Borrower modal → fill first/last/email/DOB → CASL & contact preference → save
  - Switch to the newly added borrower’s tab
  - Current Address: type‑ahead search using ApplicantsCatalog `Address`, else curated address by `Province`/`ProvinceCode`
  - Expand Employment section (ready for data fill in future steps)
- Phase 2:
  - Iterate borrower tabs 1..N and fill profile fields from ApplicantsCatalog:
    - Selects: Language, Marital Status, Residency, Contact Preference (only if empty)
    - Inputs: DOB (if empty), Initial, SIN, Home, Cell, Work, Fax (only if empty)

Notes
- Tabs are robustly discovered whether they are anchors or DIV triggers.
- The flow clamps to the number of visible tabs to avoid overrun if the UI hides the Add button.

---

## Address Entry

- Source Columns
  - Address: the preferred free‑text string to search (e.g., "60 Erie Street Welland Ontario L3B5J9").
  - Province/ProvinceCode: used to derive a curated address when Address is blank.
  - Optional hints: City, Postal/PostalCode help disambiguate suggestions.

- Behavior
  - Tries the Current Address type‑ahead first. Types minimal tokens ("60 Erie Street"), then full string, then street name only. Picks the best suggestion using City/Province/Postal if present.
  - If the dropdown never appears (some pages re‑render the DOM on first keystroke), the flow switches to Type Manually and fills Unit/Street #/Name/Type/City/Province/Postal. Province codes (ON/AB/QC/...) are mapped to full names.
  - When Address is blank, a curated address is selected from `data/addresses.json` using the given Province.

- Manual Fields (locators)
  - `Address_UnitNumber`, `Address_StreetNumber`, `Address_StreetName`, `Address_StreetType`, `Address_City`, `Address_Province`, `Address_PostalCode`.

---

## Locator Registry (how to read/update)

- File: `src/locators/registry.json`
- Keys map to one or more selector candidates (CSS, role=, or XPath). Examples:
  - Borrower tabs: supports anchors and DIV triggers with `data-toggle='tab'`/`.arep` classes.
  - Active pane: `.tab-pane.active` (with or without `.tab-content`).
  - Profile inputs: keys are scoped to the active pane so hidden fields on other tabs don’t match.
- Keep candidates narrow, fast, and ordered from most‑likely to least‑likely.

---

## Utilities

- `src/utils/ui.js`
  - `within(key)` → scope subsequent locators under `key`
  - `ensureBorrowersOpen()` / `assertBorrowersOpen()`
  - `listBorrowerTabs()` / `selectBorrowerTab(n)` / `withinActiveBorrower()`
  - `ensureModalSaved()` records validation or success
  - `fillIfEmpty` / `selectIfEmpty` helpers preserve user‑provided values

- `src/utils/fakerUtil.js`
  - `getAddress('ON')` returns a curated address from `data/addresses.json`
  - Used only when `ApplicantsCatalog.Address` is blank (province fallback)

---

## Running & Debugging

Common commands
- Single feature: `npx cucumber-js tests/features/smoke.feature`
- By tag: `npx cucumber-js --tags @smoke`
- Clean reports: `npm run clean:reports`

Diagnostics
- Audit summary: `reports/audit/audit-summary.json`
- Playwright trace: see `reports/trace-*.zip` (open in PW viewer)
- Step attachments: visible in console and Cucumber reports

Common issues
- Borrowers panel closed → `UI.ensureBorrowersOpen()` toggles accordion and verifies the button
- Address list doesn’t appear → ensure `data/addresses.json` exists or provide `ApplicantsCatalog.Address`
- Add Borrower hidden at four borrowers → flow clamps to visible tabs and stops gracefully

---

## Extending

- Add/adjust locators in `src/locators/registry.json` only; refer to them by logical key in code.
- To fill Employment details, add keys (e.g., `Borrowers.employment.*`) and implement helpers in `src/tasks/borrowers.js`, then call them from the step after “Expand Employment”.
- To support more address formats, extend `pickAddressQuery()` and/or `fillCurrentAddress()` in `src/tasks/borrowers.js`.

---

## Code Pointers

- Steps: `tests/steps/quick_deal.steps.js`
- UI helpers: `src/utils/ui.js`
- Borrowers tasks (profile + address): `src/tasks/borrowers.js`
- Data access: `src/utils/data.js`, `src/data/domain/DataBag.js`
- Applicants domain helpers: `src/data/domain/applicant.js`
- Locators: `src/locators/registry.json`

---

## Summary

- Scalable: add columns to ApplicantsCatalog; code reads them dynamically.
- Audited: every locator resolution and action is recorded.
- Robust: selectors and flows are resilient to markup variants (tabs, panes, modals).
- Debbugable: traces, audit logs, and attachments make failures actionable.

Read this README, browse `tests/features/`, and extend using `UI`, `Data`, `fakerUtil`, and the locator registry.

---

## Notes For Future Me (and Codex)

- Employment Fill: We currently expand Employment; implement field fill (employer name, status, start date, income) next. Add registry keys under `Borrowers.employment.*`.
- Primary Address: Optionally fill the primary borrower’s Current Address the same way (tab 1) for completeness.
- DOB/Marital Overwrite: Consider making DOB and Marital status unconditional (instead of fillIfEmpty) behind a flag.
- Manual‑Only Toggle: Add an env/param (e.g., `ADDRESS_MODE=manual|search|auto`) to force strategy.
- Tabs: We select the newly added borrower using `idx + 2` (primary is tab 1). Keep an eye on any UI variants that insert hidden tabs.
- Data Aliases: If sheets introduce new synonyms, extend `src/utils/data.js` ALIASES.
- Testing: Add a lightweight mock step that exercises the address parser with a small table of examples.
