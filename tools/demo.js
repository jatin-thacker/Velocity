// scripts/demo.js
const { spawnSync, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const envArg = (process.argv[2] || 'uat').toLowerCase();
if (!['uat','sit'].includes(envArg)) {
  console.log('Usage: node scripts/demo.js <uat|sit>');
  process.exit(2);
}

const reportsDir = path.resolve('reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

// 1) clean reports
try { execSync('npm run clean:reports', { stdio: 'inherit' }); } catch {}

const rawScript = envArg === 'uat' ? 'bdd:uat:raw' : 'bdd:ist:raw';

// 2) run tests (capture exit code, but do NOT stop)
console.log(`\n=== Running tests for ENV=${envArg.toUpperCase()} ===\n`);
const run = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', rawScript], {
  stdio: 'inherit',
  env: { ...process.env, ENV: envArg }
});
const exitCode = run.status ?? 1;

// 3) post-process reports (always)
console.log('\n=== Building reports ===\n');
try { execSync('npm run report:expand', { stdio: 'inherit' }); } catch (e) { console.warn('report:expand failed:', e.message); }
try { execSync('npm run report:mchr',   { stdio: 'inherit' }); } catch (e) { console.warn('report:mchr failed:', e.message); }

// 4) print paths & open dashboard
const stdHtml = path.join(reportsDir, 'cucumber-report.html');
const dashHtml = path.join(reportsDir, 'mchr', 'index.html');

console.log('\n=== Reports ===');
console.log('Cucumber HTML :', stdHtml);
console.log('Dashboard HTML :', dashHtml);

try {
  if (process.platform === 'win32') {
    execSync(`start "" "${dashHtml.replace(/\//g, '\\')}"`);
  } else if (process.platform === 'darwin') {
    execSync(`open "${dashHtml}"`);
  } else {
    execSync(`xdg-open "${dashHtml}"`);
  }
} catch (e) {
  console.warn('Auto-open failed; open manually:', dashHtml);
}

// 5) exit with the original test status (so CI still knows pass/fail)
process.exit(exitCode);
