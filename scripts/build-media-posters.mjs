import { mkdir, readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Explicit asset-generation step, not a runtime dependency or publish-time
// network request. Keep the generated previews and manifest in version control.
const exportDir = fileURLToPath(new URL('../export/', import.meta.url));
const force = process.argv.includes('--force');
const destination = join(exportDir, 'assets/ascii-posters');
await mkdir(destination, { recursive: true });
const sources = new Map();
for (const file of (await readdir(exportDir)).filter((name) => name.endsWith('.html'))) {
  const html = await readFile(join(exportDir, file), 'utf8');
  for (const match of html.matchAll(/<(video|iframe)\b[^>]*\bsrc="([^"]+)"/g)) {
    const src = match[2].replaceAll('&amp;', '&');
    const key = src.split('?')[0];
    if (match[1] === 'video' || /loom\.com\/embed\/|player\.vimeo\.com\/video\//.test(src)) sources.set(key, match[1]);
  }
}
const manifest = {
  names: {
    'Brett Player': 'assets/brett-video-poster.jpg',
    'Cloud People': 'assets/cloud-people.webp',
    'Triton Player': 'assets/triton-poster.jpg',
  },
  media: {},
};
const vimeoPosters = {
  '757828085': 'assets/brett-video-poster.jpg',
  '1041311268': 'assets/cloud-people.webp',
  '1041311340': 'assets/triton-poster.jpg',
};
async function json(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return response.json();
}
async function extract(input, output, video) {
  const args = ['-hide_banner', '-loglevel', 'error', '-nostdin', '-y'];
  if (/^https?:/.test(input)) args.push('-rw_timeout', '30000000');
  if (video) args.push('-ss', '1');
  args.push('-i', input, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '6', output);
  await new Promise((resolve, reject) => {
    const process = spawn('ffmpeg', args);
    let error = '';
    process.stderr.on('data', (chunk) => { error += chunk; });
    process.on('error', reject);
    process.on('exit', (code) => code === 0 ? resolve() : reject(Error(error)));
  });
}
for (const [src, tag] of sources) {
  const id = /vimeo\.com\/video\/(\d+)/.exec(src)?.[1];
  if (id && vimeoPosters[id]) { manifest.media[src] = vimeoPosters[id]; continue; }
  const filename = createHash('sha256').update(src).digest('hex').slice(0, 12) + '.jpg';
  const output = join(destination, filename);
  const exists = await stat(output).then((info) => info.size > 0, () => false);
  if (force || !exists) {
    let input = src;
    if (tag === 'iframe') {
      const loom = /loom\.com\/embed\/([a-z\d]+)/i.exec(src)?.[1];
      const metadata = await json(loom
        ? 'https://www.loom.com/v1/oembed?url=' + encodeURIComponent('https://www.loom.com/share/' + loom)
        : 'https://vimeo.com/api/oembed.json?url=' + encodeURIComponent('https://vimeo.com/' + id));
      if (!metadata.thumbnail_url) throw Error(`No thumbnail for ${src}`);
      input = metadata.thumbnail_url;
    } else if (!/^https?:/.test(src)) input = join(exportDir, src);
    await extract(input, output, tag === 'video');
    console.log(`Generated ${filename} from ${src}`);
  }
  manifest.media[src] = 'assets/ascii-posters/' + filename;
}
await writeFile(join(exportDir, 'ascii-posters.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Color-safe preview manifest: ${Object.keys(manifest.media).length} media sources.`);
