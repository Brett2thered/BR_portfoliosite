import { readFile, writeFile } from 'node:fs/promises';

// Preserve native, full-card links when the Framer HTML is re-exported.
const path = new URL('../export/index.html', import.meta.url);
const html = await readFile(path, 'utf8');
const links = [
  {
    name: 'Abdullah reference',
    pattern: /<a\b[^>]*\bclass="[^"]*\bframer-qhhse3\b[^"]*"[^>]*>/g,
    url: 'https://www.linkedin.com/in/mrshakur/',
    label: 'View Abdullah’s LinkedIn profile (opens in a new tab)',
  },
  {
    name: 'Navdy',
    pattern: /<a\b[^>]*\bdata-framer-name="Navdy"[^>]*>/g,
    url: 'https://youtu.be/pKL4PJICS40?si=51z_0Nj5QPSR0pb-',
    label: 'Watch the Navdy video on YouTube (opens in a new tab)',
  },
  {
    name: 'Anthem',
    pattern: /<(?:a|div)\b[^>]*\bdata-framer-name="Anthem"[^>]*>/g,
    url: 'anthem.html',
    label: 'Read the Anthem Health OS project',
    target: '_self',
  },
  {
    name: 'Wonder Workshop',
    pattern: /<a\b[^>]*\bdata-framer-name="Wonder"[^>]*>/g,
    url: 'https://www.makewonder.com/dash/',
    label: 'Explore Dash at Wonder Workshop (opens in a new tab)',
  },
];
let updated = html;
for (const { name, pattern, url, label, target = '_blank' } of links) {
  const matches = [...updated.matchAll(pattern)];
  if (matches.length !== 1) throw Error(`Expected exactly one ${name} card`);
  const tag = matches[0][0];
  if (/^<div\b/.test(tag)) {
    // Anthem was exported as a non-link DIV. Convert its matching closing
    // tag as well, without rebuilding or inserting anything inside the card.
    const contentStart = matches[0].index + tag.length;
    let depth = 1, closing;
    for (const token of updated.slice(contentStart).matchAll(/<\/?div\b[^>]*>/g)) {
      depth += token[0].startsWith('</') ? -1 : 1;
      if (depth === 0) { closing = contentStart + token.index; break; }
    }
    if (closing === undefined) throw Error(`Unclosed ${name} card`);
    updated = updated.slice(0, closing) + '</a>' + updated.slice(closing + '</div>'.length);
  }
  const external = target === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
  const linked = tag.replace(/^<div\b/, '<a').replace(/\s(?:href|target|rel|aria-label)="[^"]*"/g, '').replace(/>$/,
    ` href="${url}"${external} aria-label="${label}">`);
  updated = updated.replace(tag, linked);
  console.log(`${name} card: destination link present.`);
}
if (updated !== html) await writeFile(path, updated);
