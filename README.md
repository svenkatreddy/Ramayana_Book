# Ramayana Book

A modern, readable web edition of the **Valmiki Ramayana** — all 24,000 verses across seven kāṇḍas and 645 sargas, with verse-by-verse English and Telugu translations.

**Read it:** https://svenkatreddy.github.io/Ramayana_Book/ (preview builds on Vercel for every PR)

## Sources

**Sanskrit:** [Sanskrit Wikisource](https://sa.wikisource.org/) (Wikimedia). Three chapters were restored akshara-for-akshara from [IIT Kanpur's Valmiki Ramayanam](https://www.valmiki.iitk.ac.in/) (critical edition) where this repo's copies were corrupt: Kishkindha 11, Yuddha 25, and Yuddha 31 (see issue #31).

**English:** [Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset) (MIT licence) — from M.N. Dutt's translation (1891–1894), IIT Kanpur, and Gyaandweep. Covers ~99% of verses.

**Telugu:** [Telugu Wikisource](https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము) contributors (CC BY-SA) — 322 verses across 10 Bala Kanda sargas so far; the wiki's Telugu translation is still in progress.

We only publish cleanly-licensed, human-produced translations — never machine-translated.

## Repository layout

```
san/                    Sanskrit text: 7 kandas × chapter JSON files
translations/
  en/                   English, verse-aligned (645 chapters)
  te/                   Telugu, verse-aligned (10 chapters so far)
  README.md             Sourcing policy and per-language provenance
site/                   Astro + Starlight reader (deploys to GitHub Pages)
scripts/
  validate-content.js   Checks all 645 chapters (run before every change)
  build-translations.py Build English translations from the dataset
  build-telugu.py       Build Telugu translations from Wikisource
```

## Development

```bash
cd site && npm install && npm run dev     # local preview
node scripts/validate-content.js          # must pass: 0 errors, 0 warnings
```

The site is generated: `site/scripts/sync-content.mjs` converts `san/` + `translations/` into Starlight pages. Don't edit generated files under `site/src/content/docs/`.

## The seven kāṇḍas

- **Bāla Kāṇḍa** — the book of childhood (77 sargas)
- **Ayodhyā Kāṇḍa** — the book of Ayodhya (119 sargas)
- **Araṇya Kāṇḍa** — the book of the forest (75 sargas)
- **Kiṣkindhā Kāṇḍa** — the book of the monkey kingdom (67 sargas)
- **Sundara Kāṇḍa** — the book of beauty (68 sargas)
- **Yuddha Kāṇḍa** — the book of war (128 sargas)
- **Uttara Kāṇḍa** — the last book (111 sargas)

## Contributing

Found a mistake in a verse or translation? [Open an issue](../../issues). We welcome corrections backed by a credible source — especially complete, openly-licensed Telugu or Hindi translations.
