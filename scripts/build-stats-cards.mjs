import { readFile, writeFile } from 'node:fs/promises';

// Source of truth for the existing portfolio facts; no external data or media.
const stats = [
  { key:'ranking', name:'Ranked Designer', heading:'Designer ranking', value:'1', suffix:'%',
    description:'I was ranked in the top 1% of designers by AngelList (Wellfound).' },
  { key:'capital', name:'Stats Card', heading:'Capital raised', value:'22.8', suffix:'m',
    description:'My work has directly contributed to $22.8 million in capital raised.' },
  { key:'rating', name:'Stats w/ Dark Stars', heading:'App Store rating', value:'4.9', suffix:'', stars:true,
    description:'I designed and led the highest-ranked AR app in the Apple App Store.' }
];
const escape = (text) => text.replace(/[&<>"']/g,(character) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function render(stat) {
  const suffix = stat.suffix ? `<span class="br-stat-suffix">${escape(stat.suffix)}</span>` : '';
  const stars = stat.stars ? '<div class="br-stat-stars" aria-hidden="true">' + '<span class="br-stat-star"></span>'.repeat(5) + '</div>' : '';
  return `<section id="stats-${stat.key}" class="br-stat-card" data-stat="${stat.key}" data-framer-name="${stat.name}" aria-labelledby="stats-${stat.key}-heading">
  <div class="br-stat-shell">
    <span class="br-stat-chip" data-framer-name="Text Chip">Stats</span>
    <h2 id="stats-${stat.key}-heading" class="br-stat-heading">${stat.heading}</h2>
    <div class="br-stat-core">
      <div class="br-stat-metric">
        <p class="br-stat-value"><span>${stat.value}</span>${suffix}</p>${stars ? '\n        '+stars : ''}
      </div>
      <p class="br-stat-description">${stat.description}</p>
    </div>
  </div>
</section>`;
}
function divEnd(html,start) {
  let depth=0;
  for (const token of html.slice(start).matchAll(/<\/?div\b[^>]*>/g)) {
    depth += token[0].startsWith('</') ? -1 : 1;
    if (depth===0) return start+token.index+token[0].length;
  }
  throw Error('Unclosed stats card near '+start);
}
function replaceCard(html,stat) {
  const first=`<!-- br-stat:${stat.key}:start -->`, last=`<!-- br-stat:${stat.key}:end -->`;
  const markup=first+render(stat)+last;
  if (html.includes(first)) {
    const start=html.indexOf(first), end=html.indexOf(last,start);
    if (end===-1 || html.indexOf(first,start+first.length)!==-1) throw Error('Ambiguous or unclosed '+stat.key+' insertion');
    return html.slice(0,start)+markup+html.slice(end+last.length);
  }
  const pattern=new RegExp('<div\\b[^>]*data-framer-name="'+stat.name+'"[^>]*>','g');
  const matches=[...html.matchAll(pattern)];
  if(matches.length!==1) throw Error('Expected one original '+stat.name+' card');
  let start=matches[0].index;
  // Exported component cards have a sole-child DIV wrapper. Replace that
  // wrapper too, so its old intrinsic sizing cannot constrain the native card.
  const parent=html.slice(0,start).match(/<div\b[^>]*>\s*$/);
  if(parent && /class="[^"]*\bframer-[^"\s]*-container(?:\s|")/.test(parent[0])) start=parent.index;
  return html.slice(0,start)+markup+html.slice(divEnd(html,start));
}
const path=new URL('../export/index.html',import.meta.url);
const original=await readFile(path,'utf8');
let html=original;
for(const stat of stats) html=replaceCard(html,stat);
if(!html.includes('href="stats-cards.css"')) html=html.replace('</head>','<link rel="stylesheet" href="stats-cards.css"></head>');
if(html!==original) await writeFile(path,html);
console.log('Three native, image-free stats cards are present.');
