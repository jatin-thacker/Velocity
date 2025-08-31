const fs = require('fs');
const p = require('path');
const file = p.resolve('reports/cucumber-report.html');
if (!fs.existsSync(file)) { console.error('Report not found:', file); process.exit(0); }
let html = fs.readFileSync(file, 'utf8');
html = html.replace(/<details>/g, '<details open>');
html = html.replace('</head>', `
<style>
  .cucumber-report img { max-width: 100%; height: auto; }
  details > summary { font-weight: 600; cursor: pointer; }
  details[open] { border-left: 3px solid #e33; padding-left:.5rem; margin:.5rem 0; }
</style>
</head>
`);
fs.writeFileSync(file, html, 'utf8');
console.log('Report expanded.');
