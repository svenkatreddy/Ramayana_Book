#!/usr/bin/env python3
"""Build verse-aligned Telugu translations for the Ramayana book.

For each of the 645 chapters under san/, aligns our verse N with the
Telugu prose translation for (kanda, sarga, shloka N) from Telugu
Wikisource and writes translations/te/<kanda>/chapterN.json.

Source (credible, verse-aligned, openly licensed):
  Telugu Wikisource, "వాల్మీకి రామాయణము" (CC BY-SA)
  https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము
  Sarga-wise pages ("<kanda> - సర్గము N") carry the Sanskrit shloka with a
  |k-s-v| verse marker followed by Telugu prose ending in a [k-s-v, ...]
  bracket naming the verses it translates. The Wikisource index cites IIT
  Kanpur's Valmiki Ramayanam site, Gita Press's Telugu Valmiki Ramayanam,
  and a 1933 printed edition as its sources.

Method notes:
  - Alignment is by (kanda, sarga, shloka number), not by text.
  - Where Wikisource prints one Telugu paragraph for several verses
    (e.g. [1-2-1, 2]), the combined translation is repeated on each verse,
    the same convention used for the English translations.
  - Verses with no Telugu paragraph on Wikisource are left untranslated
    rather than invented; sarga counts also differ slightly between the
    Wikisource text and our chapters (e.g. yuddha 131 vs 128), so coverage
    is reported per kanda instead of assumed complete.

Usage: python3 scripts/build-telugu.py [--kanda bala_kanda] [--limit N]
Writes translations/te/**. Regenerating is deterministic.
"""
import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

REPO = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(REPO, "translations", "te")
SAN = os.path.join(REPO, "san")

UA = "RamayanaBookBot/1.0 (research; contact via github.com/svenkatreddy/Ramayana_Book)"
API = "https://te.wikisource.org/w/api.php"

KANDAS = [
    ("bala_kanda", "బాలకాండము", 1),
    ("ayodhya_kanda", "అయోధ్యాకాండము", 2),
    ("aranya_kanda", "అరణ్యకాండము", 3),
    ("kishkindha_kanda", "కిష్కింధకాండము", 4),
    ("sundara_kanda", "సుందరకాండము", 5),
    ("yuddha_kanda", "యుద్ధకాండము", 6),
    ("uttara_kanda", "ఉత్తరకాండము", 7),
]

SOURCE = (
    "Telugu translations by Telugu Wikisource contributors (CC BY-SA), "
    "https://te.wikisource.org/wiki/వాల్మీకి_రామాయణము ; "
    "the Wikisource index cites IIT Kanpur's Valmiki Ramayanam site "
    "(https://www.valmiki.iitk.ac.in/), Gita Press's Telugu Valmiki "
    "Ramayanam, and a 1933 printed edition as its sources."
)

TELUGU_DIGITS = str.maketrans("౦౧౨౩౪౫౬౭౮౯", "0123456789")
SHLOKA_MARK = re.compile(r"\|(\d+)-(\d+)-(\d+)\|?")
BRACKET = re.compile(r"\[([^\]]+)\]\s*$")
FULL_REF = re.compile(r"^(\d+)\s*-\s*(\d+)\s*-\s*(.+)$")
VERSE_PART = re.compile(r"^[\d\s,\-\u2013\u2014]+$")
COLOPHON = re.compile(r"ఇత్యార్షే|ఇతి[^.]{0,40}సర్గ")


def _num(s):
    return int(s.translate(TELUGU_DIGITS))
TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")
LINK = re.compile(r"\[\[([^\]|]*\|)?([^\]]+)\]\]")
REF = re.compile(r"<ref[^>]*>.*?</ref>", re.S)
BOLD = re.compile(r"'''?")

DIAG = {"mismatch": 0, "dup": 0, "no_bracket_text": 0}


def api_get(params):
    # POST: 50 Telugu titles URL-encoded exceed GET length limits (HTTP 414).
    data = urllib.parse.urlencode(params).encode("utf-8")
    req = urllib.request.Request(API, data=data,
                                 headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def list_sarga_pages(te_kanda):
    """Return {sarga_number: page_title} for '<kanda> - సర్గము N' pages."""
    out = {}
    cont = {}
    pat = re.compile(r"^" + re.escape(te_kanda) + r" - సర్గము (\d+)$")
    while True:
        d = api_get({
            "action": "query", "list": "allpages",
            "apprefix": te_kanda + " - సర్గము",
            "aplimit": "500", "format": "json", **cont})
        for p in d["query"]["allpages"]:
            m = pat.match(p["title"])
            if m:
                out[int(m.group(1))] = p["title"]
        if "continue" not in d:
            break
        cont = d["continue"]
        time.sleep(0.2)
    return out


def fetch_wikitext(titles):
    """titles: list of (sarga_number, page_title) -> {sarga_number: wikitext}.

    The wiki is mid-migration from "<kanda> - సర్గము N" to "<kanda>/సర్గము N"
    titles; some dash pages are redirects. redirects=1 resolves them.
    """
    out = {}
    for i in range(0, len(titles), 50):
        batch = titles[i:i + 50]
        d = api_get({
            "action": "query", "prop": "revisions",
            "rvprop": "content", "rvslots": "main",
            "titles": "|".join(t for _, t in batch), "redirects": "1",
            "format": "json", "formatversion": "2"})
        redir = {r["to"]: r["from"]
                 for r in d["query"].get("redirects", [])}
        want = {t: n for n, t in batch}
        for pg in d["query"]["pages"]:
            orig = redir.get(pg["title"], pg["title"])
            n = want.get(orig)
            if n is None:
                continue
            revs = pg.get("revisions") or []
            if revs:
                out[n] = revs[0]["slots"]["main"]["content"]
        time.sleep(0.4)
    return out


def clean_wiki(text):
    text = REF.sub("", text)
    text = TEMPLATE.sub("", text)
    text = LINK.sub(lambda m: m.group(2), text)
    text = BOLD.sub("", text)
    text = text.replace("&nbsp;", " ")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def expand_verses(vpart):
    verses = []
    vpart = vpart.translate(TELUGU_DIGITS)
    for el in vpart.split(","):
        el = el.strip()
        if not el:
            continue
        m = re.match(r"^(\d+)\s*[-\u2013\u2014]\s*(\d+)$", el)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            verses.extend(range(a, b + 1))
        elif el.isdigit():
            verses.append(int(el))
    return verses


def _assign(verses, vlist, text):
    for v in vlist:
        if v not in verses:
            verses[v] = text
        else:
            DIAG["dup"] += 1


def parse_page(wikitext, k, s):
    """Return {verse_number: telugu_text} for one sarga page.

    Two contributor formats are handled:
    - Bracket format: Telugu prose ends with [k-s-v, ...] or [v]/[v1 - v2].
    - Positional format: prose directly follows its shloka(s), whose
      |k-s-v| markers may use Telugu-script digits; no brackets.
    A small state machine unifies both: shloka blocks open verses,
    text blocks close them (explicitly via bracket or positionally).
    """
    verses = {}
    open_verses = []  # (bk, bs, v) tuples awaiting their translation
    open_text = []    # paragraphs not yet assigned

    def close(text, explicit=None):
        # Only real Telugu prose is kept: shloka padas and colophons that
        # slip through block classification are all < 65 chars, while
        # genuine translations on these pages are 95+ chars (verified by
        # sampling the output length distribution and all bracketed
        # translations). The 80-char floor sits safely in the gap.
        vlist = explicit if explicit is not None else [v for _, _, v in open_verses]
        if text and len(text) >= 80:
            _assign(verses, vlist, text)
        open_verses.clear()
        open_text.clear()

    for raw in re.split(r"\n\s*\n", wikitext):
        b = raw.strip()
        if not b:
            continue
        if b.startswith("{{") or b.startswith("=") or b.startswith("[["):
            continue
        if b.startswith("'''") and b.endswith("'''") and len(b) < 200:
            continue  # section heading
        marks = [(_num(a), _num(c), _num(d))
                 for a, c, d in SHLOKA_MARK.findall(b)]
        rstripped = b.rstrip()
        if marks or rstripped.endswith("|") or rstripped.endswith("-"):
            # Shloka block: a |k-s-v|-marked half-verse, an unmarked pada
            # (its half-verse carries the marker), or an editorial variant
            # reading ("...-"). All are Sanskrit, never translation text:
            # unmarked padas / variants are skipped, marked blocks open
            # their verses.
            if open_text:
                if open_verses:
                    close(clean_wiki(" ".join(open_text)))
                else:
                    open_text.clear()
            for bk, bs, v in marks:
                if (bk, bs) != (k, s):
                    DIAG["mismatch"] += 1
            open_verses.extend(marks)
            continue
        # Text block.
        if COLOPHON.search(b):
            open_text.clear()
            continue
        m = BRACKET.search(b)
        if m:
            ref = m.group(1).strip()
            fm = FULL_REF.match(ref)
            if fm:
                bk, bs = _num(fm.group(1)), _num(fm.group(2))
                vpart = fm.group(3)
            else:
                bk, bs, vpart = k, s, ref
            if not VERSE_PART.match(vpart):
                continue  # not a verse reference (editorial note)
            if (bk, bs) != (k, s):
                DIAG["mismatch"] += 1
            text = clean_wiki(" ".join(open_text + [b[:m.start()]]))
            open_text.clear()
            if text:
                close(text, expand_verses(vpart))
            else:
                DIAG["no_bracket_text"] += 1
            continue
        if len(b) > 20:
            open_text.append(b)
    if open_text and open_verses:
        close(clean_wiki(" ".join(open_text)))
    return verses


def local_chapters(kanda):
    """Return {chapter_number: [verse numbers]} from san/ chapter files.

    File shape: {<topkey>: {'chapters': [{'chapter_number': N,
    'slokas': [...]}, ...]}}; verses are numbered 1..len(slokas).
    """
    out = {}
    d = os.path.join(SAN, kanda)
    for fn in sorted(os.listdir(d)):
        m = re.match(r"chapter(\d+)\.json$", fn)
        if not m:
            continue
        n = int(m.group(1))
        with open(os.path.join(d, fn), encoding="utf-8") as f:
            data = json.load(f)
        kd = data[next(iter(data))]
        slokas = kd["chapters"][0]["slokas"]
        out[n] = list(range(1, len(slokas) + 1))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--kanda", default=None)
    ap.add_argument("--limit", type=int, default=None,
                    help="max sarga pages per kanda (testing)")
    args = ap.parse_args()

    total_cov = total_loc = 0
    for kanda, te_kanda, knum in KANDAS:
        if args.kanda and kanda != args.kanda:
            continue
        print(f"== {kanda} ==", flush=True)
        sarga_pages = list_sarga_pages(te_kanda)
        print(f"   wikisource sarga pages: {len(sarga_pages)}", flush=True)
        nums = sorted(sarga_pages)
        if args.limit:
            nums = nums[:args.limit]
        wt = fetch_wikitext([(n, sarga_pages[n]) for n in nums])
        print(f"   fetched: {len(wt)}", flush=True)

        local = local_chapters(kanda)
        cov = loc = 0
        written = 0
        for n in nums:
            if n not in local or n not in wt:
                continue  # wikisource sarga with no local chapter, or no text
            te = parse_page(wt[n], knum, n)
            verses = {str(v): te[v] for v in sorted(te) if v in local[n]}
            cov += len(verses)
            loc += len(local[n])
            if not verses:
                continue
            doc = {"kanda": kanda, "chapter": n, "language": "te",
                   "source": SOURCE, "verses": verses}
            kd = os.path.join(OUT, kanda)
            os.makedirs(kd, exist_ok=True)
            with open(os.path.join(kd, f"chapter{n}.json"), "w",
                      encoding="utf-8") as f:
                json.dump(doc, f, ensure_ascii=False, indent=1)
                f.write("\n")
            written += 1
        print(f"   chapters written: {written}, verses {cov}/{loc}", flush=True)
        total_cov += cov
        total_loc += loc

    print(f"TOTAL: {total_cov}/{total_loc} verses")
    print("diagnostics:", DIAG)


if __name__ == "__main__":
    sys.exit(main())
