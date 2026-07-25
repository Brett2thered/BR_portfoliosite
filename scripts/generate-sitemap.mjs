import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const siteRoot = new URL('../', import.meta.url).pathname;
const exportDir = join(siteRoot, 'export');
const sitemapPath = join(exportDir, 'sitemap.xml');
const origin = 'https://www.brett.red';

const escapeXml = (value) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;'
})[character]);

const htmlFiles = (await readdir(exportDir))
  .filter((file) => file.endsWith('.html'))
  .sort();

const urls = new Set();
for (const file of htmlFiles) {
  const html = await readFile(join(exportDir, file), 'utf8');
  const ogUrl = html.match(/<meta property="og:url" content="([^"]+)"/i)?.[1];
  const canonical = html.match(/<link rel="canonical" href="([^"]+)"/i)?.[1];
  const url = ogUrl ?? (canonical && new URL(canonical, `${origin}/`).href);

  if (!url) {
    throw new Error(`Missing canonical URL metadata in ${file}`);
  }
  if (new URL(url).origin !== origin) {
    throw new Error(`Canonical URL in ${file} is outside ${origin}: ${url}`);
  }
  urls.add(url);
}

const entries = [...urls]
  .sort()
  .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
  .join('\n');
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`;

await mkdir(dirname(sitemapPath), { recursive: true });
await writeFile(sitemapPath, sitemap, 'utf8');
