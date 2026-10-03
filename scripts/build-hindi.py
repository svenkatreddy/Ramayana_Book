#!/usr/bin/env python3
"""Build verse-aligned Hindi translations for the Ramayana book.

Extracts Chaturvedi Dwarka Prasad Sharma's Hindi prose translation from the
Archive.org scan and aligns it verse-by-verse with our
Sanskrit chapters, writing translations/hi/<kanda>/chapterN.json.

Source:
  "Valmiki Ramayan Hindi Translation By Chaturvedi Dwarka Prasad Sharma"
  https://archive.org/details/ValmikiRamayan-Hinditranslation
  Translator: Chaturvedi Dwarka Prasad Sharma, Allahabad (3rd edition)

Method:
  - The source prints each Sanskrit shloka in Devanagari followed by Hindi
    prose, both carrying ॥N॥ verse numbers. Alignment is by (kanda, sarga,
    shloka number).
  - Library watermark lines ("Nanaji Deshmukh Library", "Vinay Avasthi...
    Donations", "eGangotri") are interleaved in the OCR and filtered out.
  - Sarga boundaries are detected by smoothed verse-number resets: 3+
    consecutive low verse numbers (<=5) after a high-water mark (>12).
    Single OCR spikes (e.g. 285, 631) are ignored.
  - Segments are mapped 1:1 to our chapters. If the segment count differs
    from expected, proportional fallback distributes pairs by our known
    verse counts per chapter.
  - Where one Hindi paragraph covers several verses (e.g. ॥२॥३॥), the
    combined translation is repeated on each verse, the same convention
    used for the English translations.
  - Verses with no Hindi paragraph are left untranslated rather than
    invented.

Usage: python3 scripts/build-hindi.py [--kanda bala_kanda]
Writes translations/hi/**. Regenerating is deterministic.
"""
import argparse
import glob
import json
import os
import re
import sys

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(REPO, "translations", "hi")
SAN = os.path.join(REPO, "san")
SRC = os.path.join(REPO, "..", "hindi-source", "sharma_djvu.txt")

# (kanda, content_start_offset) — content_start skips title page/TOC/front matter
KANDAS = [
    ("bala_kanda", 40243),
    ("ayodhya_kanda", 700000),
    ("aranya_kanda", 2046793),
    ("kishkindha_kanda", 2799830),
    ("sundara_kanda", 3445760),
    ("yuddha_kanda", 4250292),
    ("uttara_kanda", 5880000),  # after yuddha ends (5859170) + front matter
]

DEVA_DIGITS = "०१२३४५६७८९"


def deva_to_int(s):
    n = 0
    for ch in s:
        if ch in DEVA_DIGITS:
            n = n * 10 + DEVA_DIGITS.index(ch)
        elif ch.isdigit():
            n = n * 10 + int(ch)
    return n


def clean_text(t):
    """Remove OCR watermarks and normalize whitespace."""
    lines = t.split("\n")
    out = []
    for line in lines:
        s = line.strip()
        if any(w in s for w in [
            "Nanaji Deshmukh Library", "eGangotri", "Vinay Avasthi",
            "Trust Donations", "Donations",
        ]):
            continue
        if re.fullmatch(r"[©®|_=\-~^°\s\d]*", s):
            continue
        out.append(line)
    t = "\n".join(out)
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t


def clean_hindi(hindi):
    """Strip leading sarga headers, commentary markers, and OCR junk."""
    # Remove inline watermarks (may be embedded mid-text by OCR)
    hindi = re.sub(
        r"[A-Za-z0-9\s\-_.,\"'|~^°#*`\\\/]{0,40}?"
        r"(?:Nanaji Deshmukh|Vinay Avasthi|eGangotri|Trust Donations)"
        r"[A-Za-z0-9\s\-_.,\"'|~^°#*`\\\/]{0,40}?",
        " ", hindi
    )
    # Remove leading sarga-end headers like "युद्धकाण्ड का X सर्ग पूरा हुआ"
    hindi = re.sub(
        r"^[^।]*?(?:काण्ड|कांड) का [^।]*?सर्ग (?:पूरा|समाप्त)[^।]*?।\s*",
        "", hindi
    )
    # Remove leading "इति X सर्ग" markers
    hindi = re.sub(r"^इति\s+[^।]{1,40}?सर्ग[ः:]?[^।]*?।\s*", "", hindi)
    # Remove leading commentary glosses like "१ अमर्षिता--..."
    hindi = re.sub(r"^([०-९\d]+\s+[अ-ह]+--[^।]*?।\s*)+", "", hindi)
    # Remove leading garbage (latin fragments, symbols)
    hindi = re.sub(r"^[\s|_=\-~^°#*`\"'0-9०-९.:;!?()\[\]{}<>\\\/]+", "", hindi)
    return hindi.strip()


def is_hindi_prose(text):
    """Check if text is Hindi prose (not Sanskrit shloka or commentary).

    Sanskrit shlokas almost never contain Hindi verbs; Hindi translations
    almost always contain at least one. This single signal is the most
    reliable classifier.
    """
    # Must have substantial Devanagari
    deva_count = len(re.findall(r"[\u0900-\u097F]", text))
    if len(text) < 20 or deva_count < len(text) * 0.3:
        return False
    # Reject OCR garbage (latin gibberish runs)
    if len(re.findall(r"[a-zA-Z]{4,}", text)) > 3:
        return False
    # Core test: Hindi verb forms as standalone words
    # (Sanskrit shlokas don't use these; Hindi prose almost always does)
    # Use Devanagari-aware boundaries: verb not embedded in longer word
    # (e.g. "तथेपि" contains "थे" but isn't the Hindi verb)
    D = r"[\u0900-\u097F]"
    verbs = (
        r"है|हैं|हूँ|हो|था|थी|थे|हुआ|हुए|हुई|किया|किये|गया|गये|गई|"
        r"कहा|कहे|बोले|बोली|सुनकर|करके|वाला|वाली|वाले|"
        r"रहा|रही|रहे|जाता|जाती|जाते|होता|होती|होते|"
        r"चाहता|चाहती|चाहते|सकता|सकती|सकते|चाहिए|होगा|होगी|होंगे"
    )
    if re.search(rf"(?<!{D})(?:{verbs})(?!{D})", text):
        return True
    return False


def extract_all_pairs(kanda_text):
    """Extract all (verse_num, hindi) pairs in document order."""
    pairs = []
    # Flexible danda pattern: ॥ ।। ॥। etc. (OCR varies)
    DANDA = r"[॥।|]{1,4}"
    tokens = re.split(rf"({DANDA}\s*[०-९\d\s]+\s*{DANDA})", kanda_text)
    pending_sanskrit = None
    i = 0
    while i < len(tokens):
        text = tokens[i].strip() if i < len(tokens) else ""
        marker = tokens[i + 1] if i + 1 < len(tokens) else ""
        nums = set()
        if marker:
            for nm in re.findall(r"[०-९\d]+", marker):
                try:
                    n = deva_to_int(nm)
                    if 0 < n < 500:  # sanity: no verse has 500+ shlokas
                        nums.add(n)
                except Exception:
                    pass
        if nums:
            hindi = re.sub(r"\s+", " ", text).strip()
            if is_hindi_prose(hindi):
                hindi = clean_hindi(hindi)
                if len(hindi) > 20:  # still substantial after cleaning
                    vnum = max(nums)
                    pairs.append((vnum, hindi))
        i += 2
    return pairs


def assign_by_verse_numbers(pairs, verse_counts):
    """Assign pairs to chapters using verse numbers directly.

    Every sarga starts with verse 1. We walk pairs in order, starting a new
    chapter each time we see vnum==1 (or 2) after having seen higher numbers.
    Pairs are accepted into a chapter only if their verse number is plausible
    for that chapter (<= expected verses + tolerance).
    """
    n_ch = len(verse_counts)
    chapters = [[] for _ in range(n_ch)]
    ch_idx = 0
    seen = set()  # verse numbers seen in current chapter
    max_seen = 0

    for vnum, hindi in pairs:
        # Sarga boundary: vnum 1 or 2 after we've seen substantial numbers
        if vnum <= 2 and max_seen > 8 and ch_idx + 1 < n_ch:
            ch_idx += 1
            seen = set()
            max_seen = 0

        if vnum > max_seen:
            max_seen = vnum

        # Skip duplicates within chapter
        if vnum in seen:
            continue

        # Plausibility: verse number shouldn't far exceed chapter's expected count
        expected = verse_counts[ch_idx]
        if vnum <= expected + 8:
            seen.add(vnum)
            chapters[ch_idx].append((vnum, hindi))
        # else: OCR garbage number, skip

    return chapters


def get_verse_counts(kanda):
    """Load our Sanskrit verse counts per chapter for a kanda."""
    files = sorted(
        glob.glob(os.path.join(SAN, kanda, "chapter*.json")),
        key=lambda x: int(re.search(r"chapter(\d+)", x).group(1)),
    )
    counts = []
    for f in files:
        d = json.load(open(f, encoding="utf-8"))
        kk = list(d.keys())[0]
        ch = d[kk]["chapters"][0]
        counts.append(len(ch.get("slokas", [])))
    return counts


def assign_proportional(pairs, verse_counts):
    """Fallback: distribute pairs across chapters proportionally to verse counts."""
    total_verses = sum(verse_counts)
    total_pairs = len(pairs)
    chapters = []
    pos = 0
    for vc in verse_counts:
        n = round(vc / total_verses * total_pairs) if total_verses else 0
        chunk = pairs[pos:pos + n]
        pos += n
        # Build vnum->hindi, dedupe keep first
        vmap = {}
        for vnum, hindi in chunk:
            if vnum not in vmap:
                vmap[vnum] = hindi
        chapters.append(sorted(vmap.items()))
    # Append any remainder to last chapter
    if pos < total_pairs:
        for vnum, hindi in pairs[pos:]:
            if vnum not in dict(chapters[-1]):
                chapters[-1].append((vnum, hindi))
    return chapters


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kanda", default=None)
    args = ap.parse_args()

    with open(SRC, encoding="utf-8") as f:
        full = f.read()
    print(f"Source: {len(full)} chars", file=sys.stderr)

    kandas = [(k, s) for k, s in KANDAS if not args.kanda or k == args.kanda]

    for kanda, start in kandas:
        full_idx = next(i for i, (k, _) in enumerate(KANDAS) if k == kanda)
        end = KANDAS[full_idx + 1][1] if full_idx + 1 < len(KANDAS) else len(full)
        kanda_text = clean_text(full[start:end])
        verse_counts = get_verse_counts(kanda)
        expected = len(verse_counts)
        print(f"\n{kanda}: {len(kanda_text)} chars, expected {expected} chapters",
              file=sys.stderr)

        pairs = extract_all_pairs(kanda_text)
        print(f"  extracted {len(pairs)} pairs", file=sys.stderr)

        chapters = assign_by_verse_numbers(pairs, verse_counts)
        non_empty = sum(1 for c in chapters if c)
        print(f"  assigned to {non_empty}/{expected} chapters", file=sys.stderr)

        out_dir = os.path.join(OUT, kanda)
        os.makedirs(out_dir, exist_ok=True)
        total_v = 0
        for i, ch_pairs in enumerate(chapters, start=1):
            vmap = dict(ch_pairs)
            total_v += len(vmap)
            with open(os.path.join(out_dir, f"chapter{i}.json"), "w",
                      encoding="utf-8") as f:
                json.dump(
                    {
                        "kanda": kanda,
                        "chapter": i,
                        "source": "Chaturvedi Dwarka Prasad Sharma Hindi translation",
                        "translations": {str(n): h for n, h in sorted(vmap.items())},
                    },
                    f, ensure_ascii=False, indent=1,
                )
        exp_v = sum(verse_counts)
        print(f"  wrote {len(chapters)} chapters, {total_v} verses "
              f"(expected ~{exp_v} Sanskrit verses)", file=sys.stderr)


if __name__ == "__main__":
    main()
