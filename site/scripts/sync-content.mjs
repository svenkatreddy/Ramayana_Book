/**
 * sync-content.mjs
 *
 * Generates the Starlight content tree from the repo's source of truth (`san/`).
 * Run: `node scripts/sync-content.mjs` (also runs automatically as `prebuild`).
 *
 * The pure content builders (verse sections, reader bar, summary tabs, static
 * pages) live in content-utils.mjs so they can be unit-tested — see tests/
 * (`npm test` uses Node 24's built-in test runner, no extra dependencies).
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
 * (see translations/README.md) and add one entry to LANGS in
 * content-utils.mjs.
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

import {
  KANDAS, LANGS, TRANSLATIONS,
  devNum, readerBar, progressScript, convertChapter,
  kandaSummaryHtml, heroPage,
  translationSourcesPage, referencesPage, contributorsPage,
} from './content-utils.mjs';

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

let warnings = [];
let pages = 0;

function clean() {
  fs.rmSync(DOCS, { recursive: true, force: true });
  fs.rmSync(API, { recursive: true, force: true });
  fs.mkdirSync(DOCS, { recursive: true });
  fs.mkdirSync(API, { recursive: true });
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
    // Remove the English-only Introduction/Synopsis; replaced by the
    // multilingual summary tabs below.
    body = body
      .replace(/\*\*Introduction:\*\*[\s\S]*?(?=### Synopsis)/, '')
      .replace(/### Synopsis[\s\S]*?(?=### Chapters)/, '')
      .trim();
  }
  const summaryHtml = kandaSummaryHtml(kanda.dir);
  return (
    '---\n' +
    `title: '${kanda.sa} · ${kanda.en}'\n` +
    `description: '${kanda.en} — ${kanda.sub}. ${count} sargas.'\n` +
    'sidebar:\n' +
    `  label: '${kanda.sa}'\n` +
    '  order: 0\n' +
    '---\n\n' +
    summaryHtml +
    '\n\n' +
    body +
    '\n'
  );
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

<<<<<<< HEAD
function translationSourcesPage() {
  // The short, canonical attribution for the site's texts and translations.
  return `---
title: Translation sources
description: Where the Sanskrit text and translations on this site come from.
---

# Translation sources

Sanskrit: [Sanskrit Wikisource](https://sa.wikisource.org/) (Wikimedia). Three chapters were restored akshara-for-akshara from [IIT Kanpur's Valmiki Ramayanam](https://www.valmiki.iitk.ac.in/) (critical edition) where this repo's copies were corrupt: Kishkindha 11, Yuddha 25, and Yuddha 31.
English: [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT), from M.N. Dutt's translation (1891–1894), IIT Kanpur, and Gyaandweep.
Telugu: [Telugu Wikisource](https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము) contributors (CC BY-SA) — 322 verses so far; the wiki's Telugu translation is still in progress.

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

- **Sanskrit:** [Sanskrit Wikisource](https://sa.wikisource.org/) (Wikimedia). Three chapters were restored akshara-for-akshara from [IIT Kanpur's Valmiki Ramayanam](https://www.valmiki.iitk.ac.in/) (critical edition) where this repo's copies were corrupt: Kishkindha 11, Yuddha 25, and Yuddha 31 (see issue #31).
- **English:** [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT licence), from M.N. Dutt's English translation (1891–1894), IIT Kanpur, and Gyaandweep.
- **Telugu:** [Telugu Wikisource](https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము) contributors (CC BY-SA) — 322 verses across 10 Bala Kanda sargas so far; the wiki's Telugu translation is still in progress.

## This site

- Reader built with [Astro Starlight](https://starlight.astro.build/).
- Sanskrit UI strings, reading-progress tracking, and the themes (light, dark, and the तालपत्रम् palm-leaf manuscript theme) are this project's own additions.

See [Translation sources](./translation-sources/) for the short version of the credits.
`;
}

=======
>>>>>>> origin/master
fs.writeFileSync(path.join(DOCS, 'index.mdx'), heroPage(totalChapters, totalSlokas));
pages++;

fs.writeFileSync(path.join(DOCS, 'translation-sources.md'), translationSourcesPage());
pages++;

fs.writeFileSync(path.join(DOCS, 'references.md'), referencesPage());
pages++;

fs.writeFileSync(path.join(DOCS, 'contributors.md'), contributorsPage());
pages++;

for (const w of warnings) console.warn('warning:', w);
console.log(
  `synced ${pages} pages (${totalChapters} chapters, ~${totalSlokas.toLocaleString('en-US')} slokas) across ${KANDAS.length} kandas`,
);
