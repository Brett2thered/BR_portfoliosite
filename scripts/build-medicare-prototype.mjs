import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Run once with the two supplied source files. Originals are never modified.
const [source, hero] = process.argv.slice(2);
if (!source || !hero) throw Error('Provide the guided-flow HTML and hero screenshot paths');
let html = await readFile(source, 'utf8');
const timelineCss = await readFile(new URL('templates/medicare-timeline.css', import.meta.url), 'utf8');
if (!html.includes('const FLOW = {') || !html.includes('id="track"')) throw Error('Unexpected Medicare prototype structure');
const banner = '<div class="gov-banner" role="note"><strong>Portfolio prototype</strong><span>Sample data only · Not a government service</span></div>';
html = html.replace(/<div class="gov-banner">[\s\S]*?<\/div>/, banner);
html = html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />
<meta name="robots" content="noindex, nofollow">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">`);
html = html.replace('</style>', `
/* Portfolio presentation: never imply that this is the government service.
   Keep the supplied guided flow intact; hide inactive site-chrome placeholders. */
.gov-banner { position:sticky; top:0; z-index:70; display:flex; flex-wrap:wrap; gap:2px 14px; background:#e8f1ed; color:#175e45; }
.gov-banner strong { font-size:13px; }
.site-header { position:relative; gap:16px; }
.site-nav, .menu-btn, .header-actions > .icon-btn:not(.menu-btn), .header-actions > .pill.solid { display:none !important; }
.header-actions { margin-left:auto; }
.portfolio-notice { margin:0 0 24px; font-size:14px; color:#3d5b50; padding:14px 16px; border:1px solid #d5e3dc; border-radius:12px; background:#f2f7f4; }
.panel form input { min-width:0; }
@media (max-width:380px) {
  .site-header { padding:12px; gap:8px; }
  .logo { font-size:20px; }
  .header-actions { margin-left:auto; }
  .gov-banner { padding:10px 12px; font-size:11px; }
  .canvas-inner { padding-inline:12px; }
  .q-card { padding:18px 12px; }
  .answer-card { flex-wrap:wrap; }
  .answer-card .body { flex:1 1 100px; }
}
@media (prefers-reduced-motion:reduce) { html { scroll-behavior:auto; } }
${timelineCss}
</style>`);
html = html.replace('<div class="track" id="track">', '<p class="portfolio-notice">Interactive design prototype. Plans, prices, and guidance are illustrative—not medical, insurance, or enrollment advice. Use fictional answers. No application is submitted.</p><div class="track" id="track">');
html = html.replace('<div class="track" id="track"></div>', '<div class="track" id="track"></div><noscript><p>This interactive prototype needs JavaScript. <a href="../../medicare.html">Read the project case study</a>.</p></noscript>');
const prototypeDir = fileURLToPath(new URL('../export/prototypes/medicare/', import.meta.url));
const assetDir = fileURLToPath(new URL('../export/assets/medicare/', import.meta.url));
await mkdir(prototypeDir, { recursive:true });
await mkdir(assetDir, { recursive:true });
await writeFile(prototypeDir + 'index.html', html);
await copyFile(hero, assetDir + 'hero-reference.png');
console.log('Medicare prototype and original hero copied; local-only interaction and source artwork preserved.');
