/**
 * sync-content.mjs
 *
 * Generates the Starlight content tree from the repo's source of truth (`san/`).
 * Run: `node scripts/sync-content.mjs` (also runs automatically as `prebuild`).
 *
 * What it does:
 *  - san/<kanda>/chapterN.md -> site/src/content/docs/<kanda>/chapterN.md
 *    with Starlight frontmatter. Each `###Slōka N` block becomes a
 *    <section class="verse"> holding the Sanskrit padas plus one stacked
 *    translation div per language in LANGS (from translations/<lang>/).
 *  - A reader bar with language toggle pills is injected at the top of
 *    every chapter page (choice persisted in localStorage).
 *  - Fixes legacy heading quirks: `###Slōka 1###` (no space, not valid
 *    CommonMark) and the doubled sloka headings kishkindha_kanda carries.
 *  - Kishkindha sarga 11, yuddha sargas 25 and 31 were restored from the
 *    IIT Kanpur critical-edition text (issue #31); see scripts/fix_*.py for
 *    provenance. They flow through the normal chapter path like the rest.
 *  - san/<kanda>/README.md -> <kanda>/index.md (kanda landing page).
 *  - Generates the site hero (index.mdx) and copies per-chapter JSON to
 *    public/api/<kanda>/chapterN.json (static JSON API).
 *
 * To add a translation language: drop files under translations/<code>/
 * (see translations/README.md) and add one entry to LANGS below.
 * Generated output is gitignored; CI regenerates it on every build.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
);
const SAN = path.join(REPO, 'san');
const DOCS = path.join(REPO, 'site', 'src', 'content', 'docs');
const API = path.join(REPO, 'site', 'public', 'api');

const KANDAS = [
  { dir: 'bala_kanda', sa: 'बालकाण्डम्', en: 'Bala Kanda', sub: 'Book of Childhood' },
  { dir: 'ayodhya_kanda', sa: 'अयोध्याकाण्डम्', en: 'Ayodhya Kanda', sub: 'Book of Ayodhyā' },
  { dir: 'aranya_kanda', sa: 'अरण्यकाण्डम्', en: 'Aranya Kanda', sub: 'Book of the Forest' },
  { dir: 'kishkindha_kanda', sa: 'किष्किन्धाकाण्डम्', en: 'Kishkindha Kanda', sub: 'Book of the Monkey Kingdom' },
  { dir: 'sundara_kanda', sa: 'सुन्दरकाण्डम्', en: 'Sundara Kanda', sub: 'Book of Beauty' },
  { dir: 'yuddha_kanda', sa: 'युद्धकाण्डम्', en: 'Yuddha Kanda', sub: 'Book of War · Lankā Kāṇḍa' },
  { dir: 'uttara_kanda', sa: 'उत्तरकाण्डम्', en: 'Uttara Kanda', sub: 'The Last Book' },
];

const SLOKA_HEAD = /^###\s*Sl\u014dka\s+(\d+)\s*(\/\s*श्लोक\s+([०-९\d]+))?\s*#*\s*$/u;
const DEV_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
const devNum = (n) => String(n).replace(/\d/g, (d) => DEV_DIGITS[+d]);

// Translation languages, in display order after Sanskrit. Sanskrit ('sa')
// is always rendered; each entry here adds one stacked translation per
// verse plus a toggle pill in the reader bar. To add another language,
// drop its files under translations/<dir>/ and add one entry here. There
// is no hard cap: the toolbar, CSS and show/hide logic are generated per
// entry, so LANGS can hold any number of languages.
// See translations/README.md.
const LANGS = [{ code: 'en', dir: 'en', htmlLang: 'en', pill: 'English' }];
const TRANSLATIONS = path.join(REPO, 'translations');

const esc = (s) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Verse-number -> translated text for one chapter, per configured language. */
function loadTranslations(kandaDir, num) {
  const out = {};
  for (const L of LANGS) {
    const p = path.join(TRANSLATIONS, L.dir, kandaDir, `chapter${num}.json`);
    if (fs.existsSync(p)) {
      try {
        out[L.code] = JSON.parse(fs.readFileSync(p, 'utf8')).verses || {};
      } catch {
        out[L.code] = {};
      }
    } else {
      out[L.code] = {};
    }
  }
  return out;
}

/** Language toggle bar injected at the top of every chapter page. */
function readerBar() {
  const pills = [
    `<button type="button" class="lang-pill is-on" data-lang="sa" aria-pressed="true">संस्कृतम्</button>`,
    ...LANGS.map(
      (L) =>
        `<button type="button" class="lang-pill is-on" data-lang="${L.code}" aria-pressed="true">${esc(L.pill)}</button>`,
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
function progressScript() {
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


let warnings = [];
let pages = 0;

function clean() {
  fs.rmSync(DOCS, { recursive: true, force: true });
  fs.rmSync(API, { recursive: true, force: true });
  fs.mkdirSync(DOCS, { recursive: true });
  fs.mkdirSync(API, { recursive: true });
}

/** Normalize one chapter markdown file into verse sections with translations.
 *  Each `###Slōka N` block becomes a <section class="verse"> holding the
 *  Sanskrit padas plus one stacked translation div per configured language.
 *  Verse numbers become anchor links (#vN); translations come from
 *  translations/<lang>/<kanda>/chapterN.json via `tr`. */
function convertChapter(kanda, num, src, tr) {
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

function chapterPage(kanda, num) {
  const label = `सर्गः ${devNum(num)}`;
  const fm = [
    '---',
    `title: '${label} · Chapter ${num}'`,
    `description: '${kanda.sa} · ${label}'`,
    'sidebar:',
    `  label: '${label}'`,
    `  order: ${num}`,
    '---',
    '',
  ].join('\n');

  const tr = loadTranslations(kanda.dir, num);
  const src = fs.readFileSync(
    path.join(SAN, kanda.dir, `chapter${num}.md`),
    'utf8',
  );
  const body = convertChapter(kanda, num, src, tr);
  // Translation credits live on their own page (translation-sources),
  // not on every chapter — see translationSourcesPage() below.
  return fm + readerBar() + '\n\n' + body + '\n' + progressScript() + '\n';
}

function kandaIndex(kanda, count) {
  const readmeP = path.join(SAN, kanda.dir, 'README.md');
  let body = '';
  if (fs.existsSync(readmeP)) {
    const lines = fs.readFileSync(readmeP, 'utf8').split('\n');
    let i = 0;
    while (i < lines.length && lines[i].trim() === '') i++;
    if (/=+$/.test((lines[i + 1] || '').trim())) i += 2; // title + setext underline
    body = lines
      .slice(i)
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      // Legacy READMEs write ATX headings without the space CommonMark
      // requires (e.g. `###Synopsis###`), which renders as plain text.
      .replace(/^###([^#\s][^#]*?)###[ \t]*$/gm, '### $1')
      .trim();
  }
  return (
    '---\n' +
    `title: '${kanda.sa} · ${kanda.en}'\n` +
    `description: '${kanda.en} — ${kanda.sub}. ${count} sargas.'\n` +
    'sidebar:\n' +
    `  label: '${kanda.sa}'\n` +
    '  order: 0\n' +
    '---\n\n' +
    body +
    '\n'
  );
}

function heroPage(totalChapters, totalSlokas) {
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

<p class="home-refs"><a href="./translation-sources/">Translation sources</a> · <a href="./references/">References</a></p>
`;
}

clean();

let totalSlokas = 0;
let totalChapters = 0;

for (const kanda of KANDAS) {
  const kdir = path.join(SAN, kanda.dir);
  const outDir = path.join(DOCS, kanda.dir);
  const apiDir = path.join(API, kanda.dir);
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(apiDir, { recursive: true });

  const chapters = fs
    .readdirSync(kdir)
    .filter((f) => /^chapter\d+\.md$/.test(f))
    .map((f) => +f.slice(7, -3))
    .sort((a, b) => a - b);

  for (const num of chapters) {
    fs.writeFileSync(
      path.join(outDir, `chapter${num}.md`),
      chapterPage(kanda, num),
    );
    const jp = path.join(kdir, `chapter${num}.json`);
    if (fs.existsSync(jp)) {
      fs.copyFileSync(jp, path.join(apiDir, `chapter${num}.json`));
      try {
        const d = JSON.parse(fs.readFileSync(jp, 'utf8'));
        const kk = Object.keys(d)[0];
        totalSlokas += d[kk].chapters[0].slokas.length;
      } catch { /* leave count alone */ }
    } else {
      warnings.push(`${kanda.dir}/chapter${num}.md has no matching JSON`);
    }
    totalChapters++;
    pages++;
  }

  fs.writeFileSync(path.join(outDir, 'index.md'), kandaIndex(kanda, chapters.length));
  pages++;
}

function translationSourcesPage() {
  // The short, canonical attribution for the site's texts and translations.
  return `---
title: Translation sources
description: Where the Sanskrit text and translations on this site come from.
---

# Translation sources

Sanskrit: [Valmiki Ramayanam, IIT Kanpur](https://www.valmiki.iitk.ac.in/) (critical edition).
English: [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT), from M.N. Dutt's translation (1891–1894), IIT Kanpur, and Gyaandweep.

Telugu and further languages will be credited here as they are added. This
site only publishes translations that are cleanly licensed and
human-produced — never machine-translated.
`;
}

function referencesPage() {
  return `---
title: References
description: Sources, editions, and credits behind this reader.
---

# References

## Texts and translations

- **Sanskrit:** [Valmiki Ramayanam, IIT Kanpur](https://www.valmiki.iitk.ac.in/) — critical edition. Three chapters were restored akshara-for-akshara from IITK's text where this repo's copies were corrupt: Kishkindha 11, Yuddha 25, and Yuddha 31 (see issue #31).
- **English:** [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT licence), from M.N. Dutt's English translation (1891–1894), IIT Kanpur, and Gyaandweep.
- **Telugu:** in progress — we are looking for a cleanly-licensed, verse-by-verse human translation.

## This site

- Reader built with [Astro Starlight](https://starlight.astro.build/).
- Sanskrit UI strings, reading-progress tracking, and the themes (light, dark, and the तालपत्रम् palm-leaf manuscript theme) are this project's own additions.

See [Translation sources](./translation-sources/) for the short version of the credits.
`;
}

fs.writeFileSync(path.join(DOCS, 'index.mdx'), heroPage(totalChapters, totalSlokas));
pages++;

fs.writeFileSync(path.join(DOCS, 'translation-sources.md'), translationSourcesPage());
pages++;

fs.writeFileSync(path.join(DOCS, 'references.md'), referencesPage());
pages++;

for (const w of warnings) console.warn('warning:', w);
console.log(
  `synced ${pages} pages (${totalChapters} chapters, ~${totalSlokas.toLocaleString('en-US')} slokas) across ${KANDAS.length} kandas`,
);
