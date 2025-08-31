// scripts/build-mchr.js

/**
 * Build a Multiple Cucumber HTML Reporter (MCHR) dashboard with audit integration.
 *
 * What this script does:
 *  1) Reads cucumber.json output from Cucumber tests
 *  2) Reads audit summaries (JSON + Markdown) written during test runs
 *  3) Generates a rich HTML report using `multiple-cucumber-html-reporter`
 *  4) Injects custom CSS, an audit summary panel, and a cleanup script
 *
 * Output:
 *  - Dashboard at reports/mchr/index.html
 *  - Includes locator audit KPIs and a table
 */

const reporter = require('multiple-cucumber-html-reporter');
const fs = require('fs');
const path = require('path');

const REPORTS_DIR   = 'reports';
const INPUT_DIR     = path.join(REPORTS_DIR, 'mchr_input'); // MCHR reads JSON here
const OUTPUT_DIR    = path.join(REPORTS_DIR, 'mchr');
const CUCUMBER_JSON = path.join(REPORTS_DIR, 'cucumber.json');

// ---- read audit (from reports/audit) ----
const AUDIT_MD   = path.join(REPORTS_DIR, 'audit', 'audit-summary.md');
const AUDIT_JSON = path.join(REPORTS_DIR, 'audit', 'audit-summary.json');

let auditMd = '';
let counts = { primary: 0, healed: 0, failed: 0 };
if (fs.existsSync(AUDIT_MD)) {
  auditMd = fs.readFileSync(AUDIT_MD, 'utf8');
}
if (fs.existsSync(AUDIT_JSON)) {
  try {
    counts = JSON.parse(fs.readFileSync(AUDIT_JSON, 'utf8')).counts || counts;
  } catch {
    // ignore parse errors, fallback to default counts
  }
}

// Audit panel markup
const auditPanel = `
<div class="mchrt-audit">
  <div class="mchrt-kpis">
    <div class="kpi"><div class="kpi-label">Primary</div><div class="kpi-value">${counts.primary}</div></div>
    <div class="kpi"><div class="kpi-label">Healed</div><div class="kpi-value">${counts.healed}</div></div>
    <div class="kpi"><div class="kpi-label">Failed</div><div class="kpi-value">${counts.failed}</div></div>
  </div>
  <pre class="mchrt-table">${auditMd || 'No audit summary found.'}</pre>
</div>
`;

// Custom CSS injected into the dashboard
const STYLE_TAG_ID = 'mchr-audit-style';
const STYLE_TAG = `<style id="${STYLE_TAG_ID}">
  .footer, footer, .template-footer { display:none !important; }

  .mchrt-audit {
    border-radius:14px; padding:14px;
    background:linear-gradient(180deg,#0f172a,#111827);
    color:#e5e7eb; box-shadow:0 10px 24px rgba(0,0,0,.18);
    border:1px solid rgba(255,255,255,.06);
    width:100%; max-width:100%;
  }
  .mchrt-kpis {
    display:grid; grid-template-columns:repeat(3,minmax(180px,1fr));
    gap:12px; margin-bottom:12px;
  }
  .mchrt-audit .kpi {
    background:#1f2937; border-radius:10px; padding:12px; text-align:center;
    border:1px solid rgba(255,255,255,.06);
  }
  .mchrt-audit .kpi-label {
    font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#93c5fd;
  }
  .mchrt-audit .kpi-value {
    font-size:22px; font-weight:700; margin-top:2px;
  }
  .mchrt-table {
    width:100%; box-sizing:border-box;
    max-height:60vh; overflow:auto;
    background:#0b1020; border-radius:10px; padding:12px;
    font-family:ui-monospace,Menlo,Consolas,"Liberation Mono","Courier New",monospace;
    font-size:12px; line-height:1.35; color:#d1d5db; white-space:pre-wrap;
    border:1px solid rgba(255,255,255,.06);
  }
</style>`;

// ---- prepare input dir ----
fs.rmSync(INPUT_DIR, { recursive: true, force: true });
fs.mkdirSync(INPUT_DIR, { recursive: true });

if (!fs.existsSync(CUCUMBER_JSON)) {
  console.warn("WARNING: reports/cucumber.json not found. Report will be empty.");
} else {
  fs.copyFileSync(CUCUMBER_JSON, path.join(INPUT_DIR, 'cucumber.json'));
}

// Clean old output to avoid stale HTML
fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });

// ---- generate MCHR ----
reporter.generate({
  jsonDir: INPUT_DIR,
  reportPath: OUTPUT_DIR,
  reportName: 'BCP Broker E2E',
  pageTitle: 'BCP Broker E2E',
  displayDuration: true,
  metadata: {
    browser: { name: 'chromium' },
    device: process.platform,
    platform: { name: process.platform }
  },
  //customStyle: '.footer, footer, .template-footer { display:none !important; }'
});

// ---- post-process HTML: inject CSS + audit section ----
// 

// ---- post-process: inject CSS + a full-width audit section across ALL pages ----
// const STYLE_TAG_ID = 'mchr-audit-style';
// const STYLE_TAG = `<style id="${STYLE_TAG_ID}">
//   .footer, footer, .template-footer { display:none !important; }
//   .mchrt-audit{
//     border-radius:14px; padding:14px;
//     background:linear-gradient(180deg,#0f172a,#111827);
//     color:#e5e7eb; box-shadow:0 10px 24px rgba(0,0,0,.18);
//     border:1px solid rgba(255,255,255,.06);
//     width:100%; max-width:100%;
//   }
//   .mchrt-kpis{
//     display:grid; grid-template-columns:repeat(3,minmax(180px,1fr));
//     gap:12px; margin-bottom:12px;
//   }
//   .mchrt-audit .kpi{
//     background:#1f2937; border-radius:10px; padding:12px; text-align:center;
//     border:1px solid rgba(255,255,255,.06);
//   }
//   .mchrt-audit .kpi-label{ font-size:12px; letter-spacing:.04em; text-transform:uppercase; color:#93c5fd; }
//   .mchrt-audit .kpi-value{ font-size:22px; font-weight:700; margin-top:2px; }
//   .mchrt-table{
//     width:100%; box-sizing:border-box;
//     max-height: 60vh; overflow:auto;
//     background:#0b1020; border-radius:10px; padding:12px;
//     font-family:ui-monospace,Menlo,Consolas,"Liberation Mono","Courier New",monospace;
//     font-size:12px; line-height:1.35; color:#d1d5db; white-space:pre-wrap;
//     border:1px solid rgba(255,255,255,.06);
//   }
// </style>`;

const SCRIPT_TAG_ID = 'mchr-audit-cleanup';
const SCRIPT_TAG = `<script id="${SCRIPT_TAG_ID}">
document.addEventListener('DOMContentLoaded', () => {
  ['.footer','footer','.template-footer'].forEach(sel =>
    document.querySelectorAll(sel).forEach(el => el.remove())
  );
  // remove credit text, if present
  [...document.querySelectorAll('body *')].forEach(el => {
    if (el.textContent && /Maintained by Wasiq/i.test(el.textContent)) el.remove();
  });
});
</script>`;

const SECTION_ID = 'mchr-audit-section';

// Recursively collect all .html files under OUTPUT_DIR
function allHtmlFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allHtmlFiles(full));
    else if (entry.isFile() && full.toLowerCase().endsWith('.html')) out.push(full);
  }
  return out;
}

const htmlFiles = fs.existsSync(OUTPUT_DIR) ? allHtmlFiles(OUTPUT_DIR) : [];

// Inject CSS/cleanup into every page; add audit panel ONLY to index.html
for (const filePath of htmlFiles) {
  let html = fs.readFileSync(filePath, 'utf8');

  // Inject CSS once
  if (!html.includes(`id="${STYLE_TAG_ID}"`)) {
    html = html.includes('</head>')
      ? html.replace('</head>', `${STYLE_TAG}\n</head>`)
      : html.replace('<body', `${STYLE_TAG}\n<body`);
  }

  // Inject cleanup once
  if (!html.includes(`id="${SCRIPT_TAG_ID}"`)) {
    html = html.replace('</body>', `${SCRIPT_TAG}\n</body>`);
  }

  // Only the main index gets the audit section
  if (path.basename(filePath).toLowerCase() === 'index.html' && !html.includes(`id="${SECTION_ID}"`)) {
    const inject = `
  <div id="${SECTION_ID}" class="container-fluid mt-3 mb-4">
    <div class="row"><div class="col-12">
      <div class="card shadow-sm border-0">
        <div class="card-header"><h5 class="mb-0">Execution & Audit</h5></div>
        <div class="card-body">
          ${auditPanel}
        </div>
      </div>
    </div></div>
  </div>`;
    html = html.replace('</body>', `${inject}\n</body>`);
  }

  fs.writeFileSync(filePath, html, 'utf8');
}
