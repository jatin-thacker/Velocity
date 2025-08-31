const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const dash = path.resolve('reports/mchr/index.html');
const std  = path.resolve('reports/cucumber-report.html');

console.log('\n=== Reports ===');
console.log('Cucumber HTML :', std);
console.log('Dashboard HTML :', dash);

let toOpen = fs.existsSync(dash) ? dash : std;
try {
  if (process.platform === 'win32') execSync(`start "" "${toOpen.replace(/\//g,'\\')}"`);
  else if (process.platform === 'darwin') execSync(`open "${toOpen}"`);
  else execSync(`xdg-open "${toOpen}"`);
} catch {
  console.log('Open manually:', toOpen);
}
