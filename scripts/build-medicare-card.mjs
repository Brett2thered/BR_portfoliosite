import { readFile, writeFile } from 'node:fs/promises';

const path = new URL('../export/index.html', import.meta.url);
const original = await readFile(path, 'utf8');
const template = (await readFile(new URL('templates/medicare-card.html', import.meta.url), 'utf8')).trim();
const start = '<!-- br-medicare-card:start -->', end = '<!-- br-medicare-card:end -->';
const block = start + template + end;
let html = original;
if (html.includes(start)) {
  const first = html.indexOf(start), last = html.indexOf(end, first);
  if (last === -1) throw Error('Unclosed Medicare card insertion');
  html = html.slice(0, first) + block + html.slice(last + end.length);
} else {
  const column = /<div\b[^>]*data-framer-name="Column 2"[^>]*>/g;
  if ([...html.matchAll(column)].length !== 1) throw Error('Expected one Column 2');
  html = html.replace(column, '$&' + block);
}
if (!html.includes('href="medicare-card.css"')) html = html.replace('</head>', '<link rel="stylesheet" href="medicare-card.css"></head>');
if (!html.includes('src="medicare-card.js"')) html = html.replace('</body>', '<script src="medicare-card.js" defer></script></body>');
if (html !== original) await writeFile(path, html);
console.log('Medicare native card, styles and motion are present.');
