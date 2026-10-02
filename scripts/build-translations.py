#!/usr/bin/env python3
"""Build verse-aligned English translations for the Ramayana book.

For each of the 645 chapters under san/, aligns our verse N with the
dataset's English prose translation for (kanda, sarga, shloka N) and writes
translations/en/<kanda>/chapterN.json.

Source (credible, verse-aligned, MIT-licensed):
  Ashutosh Vijay's "Valmiki Ramayan Dataset"
  https://github.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset (MIT licence)
  Its English prose translations ("explanation" field) draw on the
  dataset's documented sources: M.N. Dutt's English translation (1891-1894),
  IIT Kanpur's Valmiki Ramayanam (https://www.valmiki.iitk.ac.in/), and
  Gyaandweep (per the dataset README's Sources & Credits). Our Sanskrit
  follows IITK's critical-edition numbering, so verse numbers line up.

Gap-fill overlay (same MIT dataset, manually corrected copy):
  https://github.com/andvraman/valmiki-ramayana (data_1..7.json)
  Used ONLY for verses missing from the canonical file.

Method notes:
  - Alignment is by (kanda, sarga, shloka number), not by text: our repo's
    Sanskrit has different spacing/orthography, but the numbering matches
    the critical edition.
  - Where IIT Kanpur prints one translation for two verses, the dataset
    repeats the combined translation on both entries — both of our verses
    then correctly show the same English text.
  - ~1% of our verses (colophons absorbed as verses, sarga bleed-through
    in a few legacy chapters) have no translation; they are left without
    English rather than inventing any.

Usage: python3 scripts/build-translations.py [--cache-dir DIR]
Writes translations/en/**. Regenerating is deterministic.
"""
import argparse
import glob
import io
import json
import os
import re
import sys
import urllib.request

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(REPO, "translations", "en")

CANONICAL_URL = (
    "https://raw.githubusercontent.com/Ashutosh-Vijay/Valmiki_Ramayan_Dataset"
    "/main/data/Valmiki_Ramayan_Shlokas.json"
)
OVERLAY_URLS = [
    "https://raw.githubusercontent.com/andvraman/valmiki-ramayana"
    f"/main/data_{i}.json"
    for i in range(1, 8)
]

KANDA_NAMES = {
    "Bala Kanda": "bala_kanda",
    "Ayodhya Kanda": "ayodhya_kanda",
    "Aranya Kanda": "aranya_kanda",
    "Kishkindha Kanda": "kishkindha_kanda",
    "Sundara Kanda": "sundara_kanda",
    "Yuddha Kanda": "yuddha_kanda",
    "Uttara Kanda": "uttara_kanda",
}
KANDAS = list(KANDA_NAMES.values())
KIDX = {k: i + 1 for i, k in enumerate(KANDAS)}

SOURCE_NOTE = (
    "English translations via the MIT-licensed Valmiki Ramayan "
    "Dataset by Ashutosh Vijay; the dataset credits M.N. Dutt's "
    "English translation (1891-1894), IIT Kanpur's Valmiki Ramayanam "
    "(https://www.valmiki.iitk.ac.in/), and Gyaandweep."
)


def download(url, cache_dir):
    os.makedirs(cache_dir, exist_ok=True)
    name = re.sub(r"[^A-Za-z0-9_.-]", "_", url.split("/")[-1]) or "data.json"
    dest = os.path.join(cache_dir, name)
    if not os.path.exists(dest):
        print(f"downloading {url}")
        req = urllib.request.Request(url, headers={"User-Agent": "RamayanaBook/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r, open(dest, "wb") as f:
            f.write(r.read())
    return dest


def clean(text):
    return re.sub(r"\s+", " ", (text or "")).strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache-dir", default="/tmp/ramayana-translations-cache")
    args = ap.parse_args()

    # Our chapters: (kidx, chapter) -> verse count
    ours = {}
    for k in KANDAS:
        ki = KIDX[k]
        for p in sorted(glob.glob(os.path.join(REPO, "san", k, "chapter*.json"))):
            ch = int(os.path.basename(p).split("chapter")[1].split(".")[0])
            with io.open(p, encoding="utf-8") as f:
                d = json.load(f)
            kd = d[k if k in d else next(iter(d))]
            ours[(ki, ch)] = len(kd["chapters"][0]["slokas"])
    print(f"our chapters: {len(ours)}")

    # Canonical dataset: (ki, sarga, shloka) -> english
    eng = {}
    canon_path = download(CANONICAL_URL, args.cache_dir)
    with io.open(canon_path, encoding="utf-8") as f:
        entries = json.load(f)
    for e in entries:
        kdir = KANDA_NAMES.get(e.get("kanda"))
        if not kdir:
            continue
        t = clean(e.get("explanation"))
        if t:
            eng[(KIDX[kdir], e["sarga"], e["shloka"])] = t
    print(f"canonical entries with English: {len(eng)}")

    # Overlay: fill only gaps
    filled = 0
    for url in OVERLAY_URLS:
        op = download(url, args.cache_dir)
        with io.open(op, encoding="utf-8") as f:
            for e in json.load(f):
                t = clean(e.get("explanation"))
                if not t:
                    continue
                key = (KIDX[KANDA_NAMES[e["kanda"]]], e["sarga"], e["shloka"])
                if key not in eng:
                    eng[key] = t
                    filled += 1
    print(f"overlay gap-fills: {filled}")

    # Write per-chapter files
    covered = total = 0
    missing_chapters = []
    for (ki, ch), n in sorted(ours.items()):
        kdir = KANDAS[ki - 1]
        verses = {}
        for v in range(1, n + 1):
            total += 1
            t = eng.get((ki, ch, v))
            if t:
                verses[str(v)] = t
                covered += 1
        if not verses:
            missing_chapters.append((kdir, ch))
        out_dir = os.path.join(OUT, kdir)
        os.makedirs(out_dir, exist_ok=True)
        payload = {
            "kanda": kdir,
            "chapter": ch,
            "language": "en",
            "source": SOURCE_NOTE,
            "verses": verses,
        }
        with io.open(os.path.join(out_dir, f"chapter{ch}.json"), "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=1)
            f.write("\n")

    print(f"wrote {len(ours)} files under translations/en/")
    print(f"coverage: {covered}/{total} verses = {100.0*covered/total:.1f}%")
    if missing_chapters:
        print(f"chapters with zero translations: {missing_chapters}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
