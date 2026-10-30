import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// Restore the shared ASCII assets and readiness adapter after a Framer export.
const exportDir = fileURLToPath(new URL("../export/", import.meta.url));

const htmlFiles = (await readdir(exportDir)).filter((file) => file.endsWith(".html"));
const changed = [];

for (const file of htmlFiles) {
  const filePath = join(exportDir, file);
  const html = await readFile(filePath, "utf8");
  const adapter = file === 'index.html' ? 'card-loaders.js' : 'media-loaders.js';
  const snippet = ['ascii-skeletons.js', 'ascii-loaders.js', adapter]
    .map((script) => `<script src="${script}"></script>`).join('\n  ');
  const clean = html.replace(/\s*<script src="(?:ascii-skeletons|ascii-loaders|card-loaders|media-loaders)\.js"><\/script>/g, '');

  const head = /<head(?:\s[^>]*)?>/i;
  if (!head.test(html)) throw new Error(`${file} does not include a head element`);

  // Right after <head>, so the loader is watching before the parser creates any media.
  const updated = clean.replace(head, (tag) => `${tag}\n  ${snippet}`);
  if (updated !== html) {
    await writeFile(filePath, updated, "utf8");
    changed.push(file);
  }
}

console.log(changed.length ? `media-loaders: added to ${changed.join(", ")}` : "media-loaders: already present on every page");
