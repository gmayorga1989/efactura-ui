import fs from 'node:fs';

const path = new URL('../src/app/core/i18n/ui-i18n.service.ts', import.meta.url);
const lines = fs.readFileSync(path, 'utf8').split('\n');
const langStarts = {};
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/^  (es|en|pt|fr): \{$/);
  if (m) langStarts[m[1]] = i + 1;
}
const order = ['es', 'en', 'pt', 'fr'];
const ranges = {};
for (let i = 0; i < order.length; i++) {
  const lang = order[i];
  const start = langStarts[lang];
  const startIdx = start - 1;
  const nextLang = order[i + 1];
  const end = nextLang
    ? langStarts[nextLang] - 1
    : lines.findIndex((l, idx) => idx > startIdx && l.trim() === '};') + 1;
  ranges[lang] = [start, end];
}

function keysInRange(start, end) {
  const set = new Set();
  for (let i = start - 1; i < end && i < lines.length; i++) {
    const m = lines[i].match(/^\s*'([^']+)'\s*:/);
    if (m) set.add(m[1]);
  }
  return set;
}

const blocks = {};
for (const [lang, [a, b]] of Object.entries(ranges)) {
  blocks[lang] = keysInRange(a, b);
  console.log(lang, blocks[lang].size);
}

const es = blocks.es;
for (const lang of ['en', 'pt', 'fr']) {
  const missing = [...es].filter((k) => !blocks[lang].has(k)).sort();
  const extra = [...blocks[lang]].filter((k) => !es.has(k)).sort();
  console.log(`\n${lang} missing vs es:`, missing.length);
  console.log(`${lang} extra vs es:`, extra.length);
  if (missing.length) console.log(missing.slice(0, 30).join('\n'), missing.length > 30 ? '...' : '');
}
