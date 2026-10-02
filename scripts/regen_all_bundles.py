#!/usr/bin/env python3
"""Regenerate the legacy combined `*_all.json` bundles deterministically.

The old per-kanda `json_combiner.js` scripts were racy (async forEach over a
shared buffer), which left the bundles with scrambled chapter order and
missing chapters (bala 70-72, aranya 24, kishkindha 11/65, yuddha 4/67/114).

This script rebuilds each bundle from the current per-chapter files under
san/<kanda>/chapterN.json, sorted by chapter_number, preserving the bundle's
top-level key and sanskrit_name. Run from the repo root:

    python3 scripts/regen_all_bundles.py
"""

import glob
import json
import os
import re
import sys

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# (bundle file, kanda dir with the per-chapter files)
BUNDLES = [
    ("san/balakanda_all.json", "bala_kanda"),
    ("san/ayodhyakanda_all.json", "ayodhya_kanda"),
    ("san/aranyakanda_all.json", "aranya_kanda"),
    ("san/kishkindhakanda_all.json", "kishkindha_kanda"),
    ("san/sundarakanda_all.json", "sundara_kanda"),
    ("san/yudhhakanda_all.json", "yuddha_kanda"),
    ("san/uttarakanda_all.json", "uttara_kanda"),
]


def main() -> int:
    errors = 0
    for bundle_rel, kdir in BUNDLES:
        bundle_path = os.path.join(REPO, bundle_rel)
        with open(bundle_path, encoding="utf-8") as fh:
            old = json.load(fh)
        (top_key,) = old.keys()
        sanskrit_name = old[top_key].get("sanskrit_name", "")

        chapter_files = sorted(
            glob.glob(os.path.join(REPO, "san", kdir, "chapter*.json")),
            key=lambda p: int(re.search(r"chapter(\d+)\.json$", p).group(1)),
        )
        chapters = []
        seen = set()
        for cf in chapter_files:
            num = int(re.search(r"chapter(\d+)\.json$", cf).group(1))
            with open(cf, encoding="utf-8") as fh:
                data = json.load(fh)
            # Read via the file's own top-level key (restored files have
            # occasionally used the directory-style key); write under the
            # bundle's canonical key.
            (file_key,) = data.keys()
            item = data[file_key]["chapters"][0]
            if item["chapter_number"] != num:
                print(f"ERROR: {cf}: chapter_number {item['chapter_number']} != file {num}")
                errors += 1
            if num in seen:
                print(f"ERROR: {cf}: duplicate chapter {num}")
                errors += 1
            seen.add(num)
            chapters.append(item)

        chapters.sort(key=lambda c: c["chapter_number"])
        new = {top_key: {"sanskrit_name": sanskrit_name, "chapters": chapters}}
        with open(bundle_path, "w", encoding="utf-8") as fh:
            json.dump(new, fh, ensure_ascii=False, indent=2)
            fh.write("\n")
        print(f"{bundle_rel}: wrote {len(chapters)} chapters (sanskrit_name={sanskrit_name})")

    if errors:
        print(f"{errors} error(s)")
        return 1
    print("all bundles regenerated cleanly")
    return 0


if __name__ == "__main__":
    sys.exit(main())
