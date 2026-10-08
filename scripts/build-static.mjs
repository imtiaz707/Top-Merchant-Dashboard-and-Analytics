// Builds docs/index.html: a single self-contained demo page (no server, no login)
// for GitHub Pages. The sample-data generator is inlined and runs in the browser,
// so the page always shows a window ending today.
//   node scripts/build-static.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(join(root, 'templates', 'dashboard.html'), 'utf8');
const generator = readFileSync(join(root, 'lib', 'demoData.js'), 'utf8').replace(/^export /gm, '');

const staticScript = `<script>(function(){
${generator}
window.__STATIC__ = {
  data: getDemoDashboardData,
  csvUrl: function () {
    var esc = function (v) { v = v == null ? '' : String(v); return /[",\\r\\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var csv = '\\uFEFF' + getDemoCsvExport().values.map(function (row) { return row.map(esc).join(','); }).join('\\r\\n');
    return URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  },
};
})();</script>`;

const fill = {
  '%%CB_ROLE%%': 'Leads', // the static page has no login; show the full feature set
  '%%STATIC_SCRIPT%%': staticScript,
  '%%FONTS_LINK%%': '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">',
  '%%ECHARTS_SRC%%': '<script src="https://cdnjs.cloudflare.com/ajax/libs/echarts/5.5.0/echarts.min.js"></script>',
  '%%DATA_SOURCE%%': 'Sample data',
  '%%DEMO_PILL%%': '<span class="demopill" title="All merchants and figures are generated sample data">Demo data</span>',
};

let html = template;
for (const [token, value] of Object.entries(fill)) html = html.split(token).join(value);

const left = html.match(/%%[A-Z_]+%%/);
if (left) { console.error('Unfilled placeholder: ' + left[0]); process.exit(1); }

mkdirSync(join(root, 'docs'), { recursive: true });
writeFileSync(join(root, 'docs', 'index.html'), html);
console.log(`docs/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
