# Ramayana Book — रामायणम्

**Live reader:** https://svenkatreddy.github.io/Ramayana_Book/

The complete Vālmīki Rāmāyaṇa — 645 sargas across seven kāṇḍas — as structured
data and a modern web reader, in Sanskrit with verse-aligned translations.

## Repository layout

| Path | What it is |
| ---- | ---------- |
| `san/` | Sanskrit source of truth: per-chapter JSON + Markdown, plus combined `*_all.json` bundles |
| `translations/` | Verse-aligned translations (`en/` English, 98.9% coverage). New languages welcome — see `translations/README.md` |
| `site/` | Astro Starlight reader: stacked Sanskrit + translations, full-text search, light/dark/palm-leaf themes |
| `scripts/` | Content tooling (all dependency-free or stdlib-only) |
| `.github/workflows/` | Dependabot config + GitHub Pages deploy workflow |

Legacy Grunt/GitBook build files and the abandoned `en/`, `tel/`, `assests/`
stubs were removed in 2026; the history is preserved in git.

## Reading

Open https://svenkatreddy.github.io/Ramayana_Book/ — pick a kāṇḍa, read
verse-by-verse with translations stacked below the Sanskrit, toggle languages
from the reader bar, and use search (works in Devanagari and English).

## Development

Reader site (Node 24, see `.nvmrc`):

```bash
cd site
npm install
npm run dev     # http://localhost:4321/Ramayana_Book/
npm run build   # production build to site/dist/
```

Validate the Sanskrit content (no dependencies):

```bash
node scripts/validate-content.js
```

Regenerate the combined `*_all.json` bundles deterministically:

```bash
python3 scripts/regen_all_bundles.py
```

## Translations

English translations are supplied via the MIT-licensed
[Valmiki Ramayan Dataset](https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset),
which credits M. N. Dutt's English translation (1891–1894), IIT Kanpur's
Valmiki Ramayanam, and Gyaandweep. Coverage: 23,075 of 23,334 verses (98.9%);
the remainder are mostly colophons, not untranslated verses. Built with
`scripts/build-translations.py`.

## Deployment

- **Production:** GitHub Pages via `.github/workflows/deploy-pages.yml`
  (builds `site/` on every push to `master`).
- **PR previews:** Vercel — project root directory `site`, env `SITE_BASE=/`
  (the Astro config defaults to the `/Ramayana_Book/` base Pages needs).

## Sources

- Sanskrit text: [Valmiki Ramayanam, IIT Kanpur](https://www.valmiki.iitk.ac.in/)
  (critical edition).
- English: see Translations above.
