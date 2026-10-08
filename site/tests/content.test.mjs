/**
 * content.test.mjs
 *
 * Unit tests for the pure content builders in scripts/content-utils.mjs.
 * Run: `npm test` (node --test tests/, Node 24 built-in runner, no deps).
 *
 * These lock in behaviors Smarty has explicitly asked for or flagged:
 *  - pill buttons wrap labels in spans for per-language optical-centering nudges
 *  - language pills can never be fully deselected
 *  - kanda summaries: 10 paragraphs x 4 languages, no em dashes
 *  - Hindi credit is a plain credit, never "used with permission" wording
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  KANDAS, LANGS, SLOKA_HEAD,
  esc, devNum,
  readerBar, convertChapter, kandaSummaryHtml,
  heroPage, translationSourcesPage, referencesPage, contributorsPage,
} from '../scripts/content-utils.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('esc', () => {
  it('escapes HTML special characters', () => {
    assert.equal(esc('a&b<c>d"e'), 'a&amp;b&lt;c&gt;d&quot;e');
  });
  it('leaves Devanagari untouched', () => {
    assert.equal(esc('रामायणम्'), 'रामायणम्');
  });
});

describe('devNum', () => {
  it('converts digits to Devanagari numerals', () => {
    assert.equal(devNum(1), '१');
    assert.equal(devNum(2026), '२०२६');
    assert.equal(devNum(0), '०');
  });
});

describe('SLOKA_HEAD', () => {
  it('matches legacy headings without spaces', () => {
    assert.match('###Slōka 1###', SLOKA_HEAD);
  });
  it('matches spaced headings', () => {
    assert.match('### Slōka 12 ###', SLOKA_HEAD);
  });
  it('captures the verse number', () => {
    assert.equal('###Slōka 42###'.match(SLOKA_HEAD)[1], '42');
  });
});

describe('convertChapter', () => {
  const src = [
    'बालकाण्डम्',
    '===========',
    '',
    '## Chapter 1',
    '',
    '###Slōka 1###',
    '    तपस्स्वाध्याय निरतं तपस्वी वाग्विदां वरम् ।',
    '    नारदं परिपप्रच्छ वाल्मीकिर्मुनिपुंगवम् ॥१-१-१॥',
    '',
    '###Slōka 2###',
    '    कोन्वस्मिन् साम्प्रतं लोके गुणवान् कश्च वीर्यवान् ।',
  ].join('\n');
  const tr = {
    en: { 1: 'Ascetic Valmiki enquired of Narada.', 2: 'Who lives today endowed with qualities?' },
    te: { 1: 'తెలుగు అనువాదం' },
    hi: {},
  };

  it('builds verse sections with anchor links and Devanagari numerals', () => {
    const html = convertChapter('bala_kanda', 1, src, tr);
    assert.match(html, /<section class="verse" id="v1">/);
    assert.match(html, /<section class="verse" id="v2">/);
    assert.match(
      html,
      /<a class="verse-num" href="#v1" aria-label="Link to verse 1"><span lang="sa">१<\/span><\/a>/,
    );
  });

  it('wraps padas in spans inside a Sanskrit div', () => {
    const html = convertChapter('bala_kanda', 1, src, tr);
    assert.match(html, /<div class="verse-sa" lang="sa">/);
    assert.match(html, /<span class="pada">तपस्स्वाध्याय निरतं तपस्वी वाग्विदां वरम् ।<\/span>/);
  });

  it('stacks one translation div per language only when a translation exists', () => {
    const html = convertChapter('bala_kanda', 1, src, tr);
    assert.match(html, /<div class="verse-tr" lang="en" data-lang="en">Ascetic Valmiki enquired of Narada\.<\/div>/);
    assert.match(html, /<div class="verse-tr" lang="te" data-lang="te">తెలుగు అనువాదం<\/div>/);
    // No Hindi translation for verse 1 -> no Hindi div in that section.
    const v1 = html.slice(html.indexOf('id="v1"'), html.indexOf('id="v2"'));
    assert.doesNotMatch(v1, /data-lang="hi"/);
  });

  it('skips the kanda title, setext underline, and chapter heading', () => {
    const html = convertChapter('bala_kanda', 1, src, tr);
    assert.doesNotMatch(html, /बालकाण्डम्/);
    assert.doesNotMatch(html, /## Chapter 1/);
  });

  it('drops a doubled sloka heading (kishkindha quirk)', () => {
    const doubled = src.replace('###Slōka 2###', '###Slōka 2###\n###Slōka 2###');
    const html = convertChapter('kishkindha_kanda', 11, doubled, {});
    assert.equal((html.match(/id="v2"/g) || []).length, 1);
  });

  it('HTML-escapes verse text', () => {
    const evil = '###Slōka 1###\n    a & b <c> "d" ।\n';
    const html = convertChapter('bala_kanda', 1, evil, {});
    assert.match(html, /<span class="pada">a &amp; b &lt;c&gt; &quot;d&quot; ।<\/span>/);
  });

  it('falls back to sequential numbering when a heading is missing', () => {
    const html = convertChapter('bala_kanda', 1, '    पादः ।\n', {});
    assert.match(html, /<section class="verse" id="v1">/);
  });
});

describe('readerBar', () => {
  const bar = readerBar();

  it('renders one pill per language with a nudgable label span', () => {
    // Pills wrap the label in a <span> so per-language optical-centering
    // nudges target the text, not the whole button (see custom.css).
    assert.match(bar, /<button type="button" class="lang-pill is-on" data-lang="sa" aria-pressed="true"><span>संस्कृतम्<\/span><\/button>/);
    for (const L of LANGS) {
      assert.match(bar, new RegExp(`data-lang="${L.code}"[^>]*><span>${L.pill}</span><`));
    }
  });

  it('covers Sanskrit plus every configured translation language', () => {
    const langs = [...bar.matchAll(/data-lang="([a-z]+)"/g)].map((m) => m[1]);
    assert.deepEqual(langs, ['sa', ...LANGS.map((L) => L.code)]);
  });

  it('persists the choice in localStorage', () => {
    assert.match(bar, /var KEY='ramayana-langs';/);
    assert.match(bar, /localStorage\.getItem\(KEY/);
    assert.match(bar, /localStorage\.setItem\(KEY/);
  });

  it('never lets the last language be deselected', () => {
    // At least one language must always stay on.
    assert.match(bar, /if\(!any\)return;/);
  });

  it('is labelled as a toolbar for assistive tech', () => {
    assert.match(bar, /role="toolbar" aria-label="Reading languages"/);
  });
});

describe('kandaSummaryHtml (against the real summaries data)', () => {
  const summaries = JSON.parse(
    fs.readFileSync(path.join(REPO, 'site', 'src', 'data', 'kanda-summaries.json'), 'utf8'),
  );

  it('covers all 7 kandas in all 4 languages', () => {
    assert.deepEqual(Object.keys(summaries).sort(), KANDAS.map((k) => k.dir).sort());
    for (const kanda of Object.keys(summaries)) {
      assert.deepEqual(Object.keys(summaries[kanda]).sort(), ['en', 'hi', 'sa', 'te']);
    }
  });

  it('has ~10 detailed paragraphs per language', () => {
    for (const [kanda, langs] of Object.entries(summaries)) {
      for (const [lang, s] of Object.entries(langs)) {
        assert.ok(
          Array.isArray(s.paragraphs) && s.paragraphs.length >= 10,
          `${kanda}/${lang}: expected >= 10 paragraphs, got ${s.paragraphs?.length}`,
        );
        assert.ok(s.intro && s.intro.trim().length > 0, `${kanda}/${lang}: missing intro`);
      }
    }
  });

  it('contains no em dashes (AI-slop check)', () => {
    for (const [kanda, langs] of Object.entries(summaries)) {
      for (const [lang, s] of Object.entries(langs)) {
        for (const p of s.paragraphs) {
          assert.doesNotMatch(p, /—/, `${kanda}/${lang}: em dash found`);
        }
      }
    }
  });

  it('renders language pills and one panel per language', () => {
    const html = kandaSummaryHtml('bala_kanda');
    for (const code of ['sa', 'en', 'te', 'hi']) {
      assert.match(html, new RegExp(`data-summary-lang="${code}"`));
      assert.match(html, new RegExp(`data-summary-panel="${code}"`));
    }
    // First panel (Sanskrit) visible, the rest hidden.
    assert.match(html, /data-summary-panel="sa">/);
    assert.match(html, /data-summary-panel="en" hidden/);
  });

  it('wraps the intro in <strong>', () => {
    const html = kandaSummaryHtml('bala_kanda');
    assert.match(html, /<p><strong>[^<]+<\/strong><\/p>/);
  });

  it('returns empty string for an unknown kanda', () => {
    assert.equal(kandaSummaryHtml('nope_kanda'), '');
  });
});

describe('heroPage', () => {
  const hero = heroPage(645, 23334);

  it('links every kanda', () => {
    for (const k of KANDAS) {
      assert.match(hero, new RegExp(`href="${k.dir}/"`));
    }
  });

  it('links the contributors page from home', () => {
    assert.match(hero, /href="\.\/contributors\/"/);
  });

  it('reports the chapter and verse counts', () => {
    assert.match(hero, /645 sargas/);
  });
});

describe('attribution pages', () => {
  it('credits the Hindi translation plainly, without "permission" wording', () => {
    for (const page of [translationSourcesPage(), referencesPage()]) {
      assert.match(page, /Chaturvedi Dwarka Prasad Sharma/);
      assert.doesNotMatch(page, /permission/i);
    }
  });

  it('contributors page lists the maintainer, code contributors, and translation sources', () => {
    const page = contributorsPage();
    assert.match(page, /svenkatreddy.*Project maintainer/);
    for (const user of ['accessvasu', 'puthiyavan', 'pranavsutar', 'vedupraity']) {
      assert.match(page, new RegExp(`https://github.com/${user}`));
    }
    assert.match(page, /gaps--contributing/);
  });
});

describe('LANGS config', () => {
  it('has unique language codes', () => {
    const codes = LANGS.map((L) => L.code);
    assert.equal(new Set(codes).size, codes.length);
  });

  it('points at translation directories that exist on disk', () => {
    for (const L of LANGS) {
      assert.ok(
        fs.existsSync(path.join(REPO, 'translations', L.dir)),
        `translations/${L.dir} missing`,
      );
    }
  });
});

describe('translation data smoke test', () => {
  it('every English chapter file parses and carries a verses object', () => {
    const files = fs
      .readdirSync(path.join(REPO, 'translations', 'en'))
      .flatMap((kanda) =>
        fs.readdirSync(path.join(REPO, 'translations', 'en', kanda))
          .filter((f) => f.endsWith('.json'))
          .map((f) => path.join(REPO, 'translations', 'en', kanda, f)),
      );
    assert.equal(files.length, 645);
    for (const f of files) {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      assert.ok(d.verses && typeof d.verses === 'object', `${f}: missing verses`);
    }
  });
});
