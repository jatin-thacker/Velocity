// scripts/build-cucumber-html.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const inFile = path.resolve('reports/messages.ndjson');
const outFile = path.resolve('reports/cucumber.html');

if (!fs.existsSync(inFile)) {
  console.error(`No ${inFile} found. Run tests first.`);
  process.exit(1);
}

// Resolve the local binary installed with @cucumber/html-formatter
const binWin = path.resolve('node_modules/.bin/cucumber-html-formatter.cmd');
const binNix = path.resolve('node_modules/.bin/cucumber-html-formatter');
const bin = process.platform === 'win32' ? binWin : binNix;

if (!fs.existsSync(bin)) {
  console.error('cucumber-html-formatter binary not found. Is @cucumber/html-formatter installed?');
  process.exit(1);
}

// Spawn the formatter and pipe the NDJSON into stdin
const child = spawn(bin, ['--output', outFile], {
  stdio: ['pipe', 'inherit', 'inherit'], // stdin from us, stdout/stderr to console
  shell: false
});

// Stream file into the formatter
const rs = fs.createReadStream(inFile);
rs.on('error', (err) => {
  console.error('Failed to read NDJSON:', err.message);
  try { child.kill(); } catch {}
  process.exit(1);
});
rs.pipe(child.stdin);

child.on('close', (code) => {
  if (code === 0) {
    console.log(`HTML report written to ${outFile}`);
  } else {
    console.error(`cucumber-html-formatter exited with code ${code}`);
    process.exit(code || 1);
  }
});
