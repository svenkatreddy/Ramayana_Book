/**
 * validate-content.js
 *
 * Validates the Ramayana_Book content structure. Runs in CI (no npm
 * dependencies — Node builtins only) and locally with `node scripts/validate-content.js`.
 *
 * Checks:
 *   1. Every san/<kanda>/chapterN.json is valid JSON with the expected shape:
 *      { "<kandaname>": { "sanskrit_name": "...", "chapters": [{ "chapter_number": N, "slokas": [...] }] } }
 *   2. No two chapter files are byte-for-byte identical (file-level duplicate).
 *      This is the exact signature of known issue #31, where
 *      san/kishkindha_kanda/chapter11.json was a byte-for-byte clone of
 *      chapter10.json (same bytes, embedded chapter_number still 10).
 *   3. The embedded chapter_number matches the filename (chapterN.json).
 *   4. No two chapters share identical sloka content (semantic duplicate),
 *      even if the embedded metadata was patched.
 *   5. Every chapter JSON has a matching chapterN.md (the human-readable layer).
 *
 * Exit code 0 = clean, 1 = errors found. Warnings never fail the build.
 * Errors are emitted as GitHub Actions annotations (::error:: / ::warning::).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SAN = path.join(ROOT, 'san');

const errors = [];
const warnings = [];

function sha16(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16);
}

let kandaDirs;
try {
  kandaDirs = fs.readdirSync(SAN, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
} catch (e) {
  console.log(`::error::Could not read san/ directory: ${e.message}`);
  process.exit(1);
}

if (kandaDirs.length === 0) {
  errors.push('No kanda directories found under san/');
}

const seenByteHashes = new Map(); // raw file hash -> "kanda/chapterN.json" (first seen)
const seenSlokaHashes = new Map(); // sloka-content hash -> "kanda/chapterN.json" (first seen)
let chaptersChecked = 0;

for (const kanda of kandaDirs) {
  const dir = path.join(SAN, kanda);
  const files = fs.readdirSync(dir);
  const jsonFiles = files.filter((f) => /^chapter\d+\.json$/.test(f)).sort();

  if (jsonFiles.length === 0) {
    warnings.push(`${kanda}: no chapter JSON files found`);
    continue;
  }

  for (const jf of jsonFiles) {
    const chapterNum = Number(jf.match(/^chapter(\d+)\.json$/)[1]);
    const label = `${kanda}/${jf}`;
    const jp = path.join(dir, jf);

    let raw;
    try {
      raw = fs.readFileSync(jp);
    } catch (e) {
      errors.push(`${label}: could not read file — ${e.message}`);
      continue;
    }

    // 2. Byte-for-byte duplicate detection (issue #31 signature)
    const byteHash = sha16(raw);
    if (seenByteHashes.has(byteHash)) {
      errors.push(
        `${label}: byte-for-byte duplicate of ${seenByteHashes.get(byteHash)} — see issue #31`
      );
      // Still continue with the remaining checks so the full picture is reported.
    } else {
      seenByteHashes.set(byteHash, label);
    }

    // 1. Valid JSON
    let data;
    try {
      data = JSON.parse(raw.toString('utf8'));
    } catch (e) {
      errors.push(`${label}: invalid JSON — ${e.message}`);
      continue;
    }

    // 1b. Expected shape
    const topKeys = Object.keys(data);
    if (topKeys.length !== 1) {
      errors.push(`${label}: expected exactly one top-level key, found ${topKeys.length}`);
      continue;
    }
    const book = data[topKeys[0]];
    if (!book || !Array.isArray(book.chapters) || book.chapters.length === 0) {
      errors.push(`${label}: missing non-empty "chapters" array under "${topKeys[0]}"`);
      continue;
    }
    chaptersChecked++;

    // 3. Embedded chapter_number matches filename. If it doesn't match, still
    // use the first chapter entry for the duplicate check below so a cloned
    // file (like #31) is reported as a duplicate too, not just a mismatch.
    const chapter =
      book.chapters.find((c) => Number(c.chapter_number) === chapterNum) || book.chapters[0];
    if (Number(chapter.chapter_number) !== chapterNum) {
      errors.push(
        `${label}: embedded chapter_number is ${chapter.chapter_number}, expected ${chapterNum}`
      );
    }

    if (!Array.isArray(chapter.slokas) || chapter.slokas.length === 0) {
      errors.push(`${label}: chapter ${chapterNum} has no slokas`);
      continue;
    }

    // 4. Semantic duplicate detection (identical sloka content)
    const slokaHash = sha16(chapter.slokas.join('\n'));
    if (seenSlokaHashes.has(slokaHash)) {
      errors.push(
        `${label}: sloka content identical to ${seenSlokaHashes.get(slokaHash)} — possible duplicate chapter (see issue #31)`
      );
    } else {
      seenSlokaHashes.set(slokaHash, label);
    }

    // 5. Markdown pairing
    const mdp = path.join(dir, `chapter${chapterNum}.md`);
    if (!fs.existsSync(mdp)) {
      warnings.push(`${label}: missing matching chapter${chapterNum}.md`);
    }
  }

  // Orphan markdown files (md without json)
  const mdFiles = files.filter((f) => /^chapter\d+\.md$/.test(f));
  for (const mf of mdFiles) {
    const n = mf.match(/^chapter(\d+)\.md$/)[1];
    if (!fs.existsSync(path.join(dir, `chapter${n}.json`))) {
      warnings.push(`${kanda}/${mf}: markdown has no matching chapter${n}.json`);
    }
  }
}

for (const w of warnings) console.log(`::warning::${w}`);
for (const e of errors) console.log(`::error::${e}`);

console.log(`\nChecked ${chaptersChecked} chapters across ${kandaDirs.length} kandas: ${errors.length} error(s), ${warnings.length} warning(s).`);
process.exit(errors.length ? 1 : 0);
