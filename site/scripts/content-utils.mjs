/**
 * content-utils.mjs
 *
 * Pure, side-effect-free content builders used by sync-content.mjs.
 * Kept separate so they can be unit-tested with `node --test tests/`
 * (Node 24 built-in runner, no extra dependencies).
 *
 * These functions take data in and return HTML/markdown strings out —
 * no filesystem writes happen here.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);

export const KANDAS = [
  { dir: 'bala_kanda', sa: 'बालकाण्डम्', en: 'Bala Kanda', sub: 'Book of Childhood' },
  { dir: 'ayodhya_kanda', sa: 'अयोध्याकाण्डम्', en: 'Ayodhya Kanda', sub: 'Book of Ayodhyā' },
  { dir: 'aranya_kanda', sa: 'अरण्यकाण्डम्', en: 'Aranya Kanda', sub: 'Book of the Forest' },
  { dir: 'kishkindha_kanda', sa: 'किष्किन्धाकाण्डम्', en: 'Kishkindha Kanda', sub: 'Book of the Monkey Kingdom' },
  { dir: 'sundara_kanda', sa: 'सुन्दरकाण्डम्', en: 'Sundara Kanda', sub: 'Book of Beauty' },
  { dir: 'yuddha_kanda', sa: 'युद्धकाण्डम्', en: 'Yuddha Kanda', sub: 'Book of War · Lankā Kāṇḍa' },
  { dir: 'uttara_kanda', sa: 'उत्तरकाण्डम्', en: 'Uttara Kanda', sub: 'The Last Book' },
];

export const SLOKA_HEAD = /^###\s*Sl\u014dka\s+(\d+)\s*(\/\s*श्लोक\s+([०-९\d]+))?\s*#*\s*$/u;
const DEV_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
export const devNum = (n) => String(n).replace(/\d/g, (d) => DEV_DIGITS[+d]);

// Translation languages, in display order after Sanskrit. Sanskrit ('sa')
// is always rendered; each entry here adds one stacked translation per
// verse plus a toggle pill in the reader bar. To add another language,
// drop its files under translations/<dir>/ and add one entry here. There
// is no hard cap: the toolbar, CSS and show/hide logic are generated per
// entry, so LANGS can hold any number of languages.
// See translations/README.md.
export const LANGS = [{ code: 'en', dir: 'en', htmlLang: 'en', pill: 'English' },
                      { code: 'te', dir: 'te', htmlLang: 'te', pill: 'తెలుగు' },
                      { code: 'hi', dir: 'hi', htmlLang: 'hi', pill: 'हिन्दी' }];
export const TRANSLATIONS = path.join(REPO, 'translations');

export const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Language toggle bar injected at the top of every chapter page. */
export function readerBar() {
  const pills = [
    `<button type="button" class="lang-pill is-on" data-lang="sa" aria-pressed="true"><span>संस्कृतम्</span></button>`,
    ...LANGS.map(
      (L) =>
        `<button type="button" class="lang-pill is-on" data-lang="${L.code}" aria-pressed="true"><span>${esc(L.pill)}</span></button>`,
    ),
  ].join('\n  ');
  return `<div class="reader-bar" role="toolbar" aria-label="Reading languages">
  <span class="reader-bar-label">Read in</span>
  ${pills}
</div>
<script>
(function(){if(window.__rbInit)return;window.__rbInit=true;
var KEY='ramayana-langs';
function read(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return{}}}
function apply(){var h=read(),root=document.documentElement;
root.classList.toggle('hide-sa',h['sa']===false);
${LANGS.map((L) => `root.classList.toggle('hide-${L.code}',h['${L.code}']===false);`).join('\n')}
document.querySelectorAll('.lang-pill').forEach(function(b){var on=h[b.dataset.lang]!==false;b.classList.toggle('is-on',on);b.setAttribute('aria-pressed',String(on));});}
document.addEventListener('click',function(e){var b=e.target.closest('.lang-pill');if(!b)return;var h=read(),l=b.dataset.lang,next=!(h[l]!==false);if(!next){var pills=document.querySelectorAll('.lang-pill'),any=false;for(var i=0;i<pills.length;i++){if(pills[i]!==b&&pills[i].classList.contains('is-on')){any=true;break;}}if(!any)return;}h[l]=next;try{localStorage.setItem(KEY,JSON.stringify(h))}catch(e){}apply();});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply);else apply();})();
</script>`;
}

/** Reading-progress tracker injected at the end of every chapter page.
 *  - Remembers the furthest verse read per chapter (localStorage).
 *  - Offers a "resume" pill when reopening a chapter mid-way.
 *  - Marks chapters complete and shows a ✓ on their sidebar links. */
export function progressScript() {
  return `<script>
(function(){if(window.__rpInit)return;window.__rpInit=true;
var KEY='ramayana-progress-v1';
var load=function(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){return{}}};
var save=function(d){try{localStorage.setItem(KEY,JSON.stringify(d))}catch(e){}};
var run=function(){
var m=location.pathname.match(/([^\\/]+)\\/chapter(\\d+)\\/?$/);
var verses=document.querySelectorAll('.verse');
if(!m||!verses.length)return;
var id=m[1]+'/chapter'+m[2],data=load(),entry=data[id]||{};
function persist(){data[id]={verse:maxVerse,done:!!entry.done,ts:Date.now()};save(data);}
/* Resume pill, dismissed after 20s or on click. */
if(entry.verse&&!location.hash){
var anchor=document.querySelector('#v'+entry.verse+' .verse-num');
var b=document.createElement('button');b.type='button';b.className='resume-pill';
b.innerHTML='<span aria-hidden="true">\\u25B6</span> '+(anchor?anchor.textContent.trim():'')+' \\u00B7 resume';
b.addEventListener('click',function(){var t=document.getElementById('v'+entry.verse);if(t)t.scrollIntoView();b.remove();});
document.body.appendChild(b);
setTimeout(function(){if(b.parentNode)b.remove()},20000);
}
/* Furthest verse seen (middle band of the viewport = "reading"). */
var maxVerse=entry.verse||0,t=null;
var io=new IntersectionObserver(function(es){var c=false;es.forEach(function(e){if(!e.isIntersecting)return;var v=parseInt(e.target.id.slice(1),10)||0;if(v>maxVerse){maxVerse=v;c=true;}});if(c){clearTimeout(t);t=setTimeout(persist,800);}},{rootMargin:'-40% 0px -55% 0px'});
verses.forEach(function(v){io.observe(v);});
/* Chapter counts as read once its final verse is seen. */
var last=verses[verses.length-1];
new IntersectionObserver(function(es,obs){es.forEach(function(e){if(e.isIntersecting){entry.done=true;persist();markDone();obs.disconnect();}});},{threshold:0.35}).observe(last);
/* Checkmarks on finished chapters in the sidebar. */
function markDone(){document.querySelectorAll('.sidebar a[href]').forEach(function(a){var hm=(a.getAttribute('href')||'').match(/([^\\/]+)\\/chapter(\\d+)\\/?$/);if(hm&&!a.querySelector('.rp-done')){var d=data[hm[1]+'/chapter'+hm[2]];if(d&&d.done){var s=document.createElement('span');s.className='rp-done';s.textContent=' \\u2713';a.appendChild(s);}}});}
markDone();
window.addEventListener('pagehide',persist);
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();
</script>`;
}

/** Normalize one chapter markdown file into verse sections with translations.
 *  Each `###Slōka N` block becomes a <section class="verse"> holding the
 *  Sanskrit padas plus one stacked translation div per configured language.
 *  Verse numbers become anchor links (#vN); translations come from
 *  translations/<lang>/<kanda>/chapterN.json via `tr`. */
export function convertChapter(kanda, num, src, tr) {
  const lines = src.split('\n');
  let i = 0;

  // Skip leading blank lines.
  while (i < lines.length && lines[i].trim() === '') i++;
  // Skip the kanda title line + setext `===` underline.
  if (i < lines.length && /=+$/.test((lines[i + 1] || '').trim())) i += 2;
  while (i < lines.length && lines[i].trim() === '') i++;
  // Skip the `## Chapter N / ...` line — the chapter number goes to frontmatter.
  if (/^##\s*Chapter\s+\d+/.test(lines[i].trim())) i++;
  while (i < lines.length && lines[i].trim() === '') i++;

  const out = [];
  let verseBuf = [];
  let verseNum = 0;
  let fallbackNum = 0;
  let lastHeading = 0;

  const flushVerses = () => {
    if (verseBuf.length === 0) return;
    const n = verseNum || ++fallbackNum;
    out.push('', `<section class="verse" id="v${n}">`);
    out.push(
      `<a class="verse-num" href="#v${n}" aria-label="Link to verse ${n}"><span lang="sa">${devNum(n)}</span></a>`,
    );
    out.push('<div class="verse-sa" lang="sa">');
    for (const v of verseBuf)
      out.push(`<span class="pada">${esc(v.replace(/^ {4}/, '').trim())}</span>`);
    out.push('</div>');
    for (const L of LANGS) {
      const t = (tr[L.code] || {})[String(n)];
      if (t)
        out.push(
          `<div class="verse-tr" lang="${L.htmlLang}" data-lang="${L.code}">${esc(t)}</div>`,
        );
    }
    out.push('</section>');
    verseBuf = [];
  };

  while (i < lines.length) {
    const raw = lines[i];
    const line = raw.trim();
    const m = line.match(SLOKA_HEAD);

    if (m) {
      flushVerses();
      const n = parseInt(m[1], 10);
      // Drop a doubled `###Slōka N###` heading repeating the previous one
      // (kishkindha quirk) — the verse number is already captured.
      if (n === lastHeading) {
        i++;
        while (i < lines.length && lines[i].trim() === '') i++;
        continue;
      }
      lastHeading = n;
      verseNum = n;
      i++;
      continue;
    }

    if (/^ {4}\S/.test(raw)) {
      verseBuf.push(raw);
      i++;
      continue;
    }

    if (line === '') {
      // Blank lines inside a verse block are just spacing; otherwise keep one.
      if (verseBuf.length > 0) {
        i++;
        continue;
      }
      if (out.at(-1) !== '') out.push('');
      i++;
      continue;
    }

    flushVerses();
    out.push(raw);
    i++;
  }
  flushVerses();

  // Collapse 3+ blank lines and trim.
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function kandaSummaryHtml(kandaDir) {
  const summariesP = path.join(REPO, 'site', 'src', 'data', 'kanda-summaries.json');
  let data;
  try {
    data = JSON.parse(fs.readFileSync(summariesP, 'utf8'))[kandaDir];
  } catch { return ''; }
  if (!data) return '';
  const langs = [
    { code: 'sa', label: 'संस्कृतम्' },
    { code: 'en', label: 'English' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'hi', label: 'हिन्दी' },
  ];
  const pills = langs.map((l, i) =>
    `<button type="button" class="lang-pill${i === 0 ? ' is-on' : ''}" data-summary-lang="${l.code}" aria-pressed="${i === 0}"><span>${l.label}</span></button>`
  ).join('\n');
  const panels = langs.map((l, i) => {
    const s = data[l.code];
    if (!s) return '';
    const paras = Array.isArray(s.paragraphs) ? s.paragraphs : [s.synopsis];
    const paraHtml = paras.map(p => `<p>${p}</p>`).join('\n');
    return `<div class="summary-panel" data-summary-panel="${l.code}"${i !== 0 ? ' hidden' : ''}>\n<p><strong>${s.intro}</strong></p>\n${paraHtml}\n</div>`;
  }).join('\n');
  return `<div class="kanda-summary" data-kanda-summary>\n<div class="reader-bar" role="tablist" aria-label="Summary language">\n${pills}\n</div>\n${panels}\n</div>\n\n<script>\n(function(){\nvar root=document.currentScript.previousElementSibling;\nwhile(root&&!root.hasAttribute('data-kanda-summary'))root=root.previousElementSibling;\nif(!root)return;\nvar pills=root.querySelectorAll('[data-summary-lang]');\nvar panels=root.querySelectorAll('[data-summary-panel]');\nfunction select(lang){\n  pills.forEach(function(p){var on=p.getAttribute('data-summary-lang')===lang;p.classList.toggle('is-on',on);p.setAttribute('aria-pressed',on);});\n  panels.forEach(function(p){p.hidden=p.getAttribute('data-summary-panel')!==lang;});\n  try{localStorage.setItem('ramayana-summary-lang',lang);}catch(e){}\n}\ntry{var saved=localStorage.getItem('ramayana-summary-lang');if(saved)select(saved);}catch(e){}\npills.forEach(function(p){p.addEventListener('click',function(){select(p.getAttribute('data-summary-lang'));});});\n})();\n</script>`;
}

export function heroPage(totalChapters, totalSlokas) {
  const cards = KANDAS.map(
    (k) =>
      `  <LinkCard title="${k.sa}" description="${k.en} — ${k.sub}" href="${k.dir}/" />`,
  ).join('\n');
  return `---
title: रामायणम्
description: The Rāmāyaṇa of Vālmīki — complete Sanskrit text.
template: splash
hero:
  title: रामायणम्
  tagline: The Rāmāyaṇa of Vālmīki — ${totalChapters} sargas across seven kāṇḍas, in Sanskrit with English translation.
  actions:
    - text: Start reading
      link: bala_kanda/
      icon: right-arrow
      variant: primary
    - text: View on GitHub
      link: https://github.com/svenkatreddy/Ramayana_Book
      icon: external
---

import { CardGrid, LinkCard } from '@astrojs/starlight/components';

<CardGrid>
${cards}
</CardGrid>

<p class="home-refs"><a href="./translation-sources/">Translation sources</a> · <a href="./references/">References</a> · <a href="./contributors/">Contributors</a></p>
`;
}

export function translationSourcesPage() {
  // The short, canonical attribution for the site's texts and translations.
  return `---
title: Translation sources
description: Where the Sanskrit text and translations on this site come from.
---

# Translation sources

Sanskrit: [Sanskrit Wikisource](https://sa.wikisource.org/) (Wikimedia) — the repository's original source. Three chapters were restored from [IIT Kanpur's Valmiki Ramayanam](https://www.valmiki.iitk.ac.in/) (critical edition) where this repo's copies were corrupt: Kishkindha 11, Yuddha 25, and Yuddha 31.
English: [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT), from M.N. Dutt's translation (1891–1894), IIT Kanpur, and Gyaandweep.
Telugu: [Telugu Wikisource](https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము) contributors (CC BY-SA).
Hindi: Chaturvedi Dwarka Prasad Sharma's Hindi translation.

This site only publishes translations that are cleanly licensed and
human-produced — never machine-translated.
`;
}

export function referencesPage() {
  return `---
title: References
description: Sources, editions, and credits behind this reader.
---

# References

## Texts and translations

- **Sanskrit:** [Sanskrit Wikisource](https://sa.wikisource.org/) (Wikimedia) — the repository's original source. Three chapters were restored akshara-for-akshara from IITK's text where this repo's copies were corrupt: Kishkindha 11, Yuddha 25, and Yuddha 31 (see issue #31).
- **English:** [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT licence), from M.N. Dutt's English translation (1891–1894), IIT Kanpur, and Gyaandweep.
- **Telugu:** [Telugu Wikisource](https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము) contributors (CC BY-SA).
- **Hindi:** Chaturvedi Dwarka Prasad Sharma's Hindi translation.

## This site

- Reader built with [Astro Starlight](https://starlight.astro.build/).
- Sanskrit UI strings, reading-progress tracking, and the themes (light, dark, and the तालपत्रम् palm-leaf manuscript theme) are this project's own additions.

See [Translation sources](./translation-sources/) for the short version of the credits.
`;
}

export function contributorsPage() {
  return `---
title: Contributors
description: The people behind the Ramayana Book project.
---

# Contributors

## Project

- **[svenkatreddy](https://github.com/svenkatreddy)** — Project maintainer and creator

## Code contributors

- **[accessvasu](https://github.com/accessvasu)**
- **[puthiyavan](https://github.com/puthiyavan)**
- **[pranavsutar](https://github.com/pranavsutar)**
- **[vedupraity](https://github.com/vedupraity)**

## Translation sources

- **Sanskrit:** [Sanskrit Wikisource](https://sa.wikisource.org/) contributors (Wikimedia)
- **English:** [M.N. Dutt](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (1891–1894), via the Valmiki Ramayan Dataset (MIT)
- **Telugu:** [Telugu Wikisource](https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము) contributors (CC BY-SA)
- **Hindi:** Chaturvedi Dwarka Prasad Sharma

---

Want to contribute? See the [gaps and how to help](https://github.com/svenkatreddy/Ramayana_Book#gaps--contributing) in the README.
`;
}
