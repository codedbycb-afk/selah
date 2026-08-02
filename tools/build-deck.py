#!/usr/bin/env python3
"""Build data.js from real scripture text.

Every verse is pulled from bible-api.com in both WEB and KJV rather than typed
from memory, so the bundled deck can't drift from what the text actually says.
Throttled to stay inside the public rate limit. Re-runs are cheap: the fetch
cache in tools/.verse-cache.json is reused.

    python3 tools/build-deck.py
"""
import json, os, sys, time, urllib.parse, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CACHE = os.path.join(HERE, ".verse-cache.json")
DELAY = 2.1  # seconds between calls

# ---------------------------------------------------------------- the deck
# Short, high-value, memorizable. Grouped so the Learn list reads as a journey.
DECK = [
    # foundations
    "Genesis 1:1", "John 3:16", "John 1:1", "John 14:6", "Romans 3:23", "Romans 6:23",
    "Romans 5:8", "Romans 10:9", "Ephesians 2:8", "Ephesians 2:9", "Acts 4:12",
    "1 John 1:9", "2 Corinthians 5:17", "Titus 3:5", "John 1:12",
    # trust & fear
    "Proverbs 3:5", "Proverbs 3:6", "Joshua 1:9", "Isaiah 41:10", "Psalm 56:3",
    "2 Timothy 1:7", "Psalm 27:1", "Psalm 23:1", "Psalm 23:4", "Deuteronomy 31:6",
    "Isaiah 43:2", "Psalm 46:1", "Psalm 46:10", "Psalm 91:1", "Psalm 118:6",
    # anxiety & rest
    "Philippians 4:6", "Philippians 4:7", "Matthew 11:28", "1 Peter 5:7",
    "Matthew 6:34", "Psalm 55:22", "John 14:27", "Psalm 94:19", "Matthew 6:26",
    # strength
    "Philippians 4:13", "Isaiah 40:31", "Ephesians 6:10", "2 Corinthians 12:9",
    "Nehemiah 8:10", "Psalm 28:7", "Habakkuk 3:19", "Isaiah 40:29",
    # the Word & wisdom
    "Psalm 119:105", "Psalm 119:11", "2 Timothy 3:16", "Hebrews 4:12", "Isaiah 40:8",
    "James 1:5", "Proverbs 9:10", "Proverbs 4:23", "Proverbs 16:3", "Proverbs 27:17",
    "Colossians 3:16", "Joshua 1:8",
    # love & others
    "1 Corinthians 13:4", "1 Corinthians 13:13", "1 Corinthians 16:14", "1 John 4:19",
    "1 John 4:18", "John 13:34", "Mark 12:31", "Romans 12:10", "Ephesians 4:32",
    "Colossians 3:13", "1 Peter 4:8", "Proverbs 15:1",
    # walking it out
    "Micah 6:8", "Matthew 5:14", "Matthew 5:16", "Colossians 3:23", "Galatians 5:22",
    "Galatians 5:23", "Romans 12:2", "Romans 12:12", "James 1:22", "Hebrews 12:1",
    "1 Corinthians 10:31", "Galatians 6:9", "Matthew 6:33", "Luke 6:31",
    # hope & promise
    "Jeremiah 29:11", "Romans 8:28", "Romans 8:31", "Romans 8:38", "Lamentations 3:23",
    "Revelation 21:4", "Psalm 30:5", "Isaiah 26:3", "Romans 15:13", "Philippians 1:6",
    "Hebrews 11:1", "2 Corinthians 5:7", "Psalm 34:18", "Psalm 147:3", "Psalm 37:4",
    # prayer & presence
    "Matthew 7:7", "1 Thessalonians 5:16", "1 Thessalonians 5:17", "1 Thessalonians 5:18",
    "James 5:16", "Jeremiah 33:3", "Psalm 145:18", "Matthew 28:20", "Hebrews 13:5",
    # identity
    "Psalm 139:14", "Ephesians 2:10", "Galatians 2:20", "1 Peter 2:9", "John 15:5",
    "Jeremiah 1:5", "Zephaniah 3:17", "1 John 3:1",
    # the end of it
    "Psalm 19:1", "Psalm 121:2", "Isaiah 53:5", "Hebrews 13:8", "Revelation 3:20",
    "Matthew 19:26", "Luke 1:37", "Philippians 2:3", "Proverbs 18:10", "Joshua 24:15",
]

# extra verses for the scroll feed (deck verses are added automatically)
FEED_EXTRA = [
    "Psalm 1:1", "Psalm 8:4", "Psalm 16:8", "Psalm 18:2", "Psalm 25:4", "Psalm 32:8",
    "Psalm 33:4", "Psalm 42:1", "Psalm 51:10", "Psalm 62:1", "Psalm 84:11", "Psalm 90:12",
    "Psalm 100:4", "Psalm 103:2", "Psalm 116:1", "Psalm 118:24", "Psalm 126:5",
    "Psalm 133:1", "Psalm 143:8", "Psalm 150:6",
    "Proverbs 11:25", "Proverbs 12:25", "Proverbs 13:20", "Proverbs 16:9", "Proverbs 17:17",
    "Proverbs 17:22", "Proverbs 19:21", "Proverbs 22:6", "Proverbs 28:1", "Proverbs 31:25",
    "Ecclesiastes 3:1", "Ecclesiastes 4:9", "Ecclesiastes 3:11",
    "Isaiah 1:18", "Isaiah 6:8", "Isaiah 12:2", "Isaiah 30:21", "Isaiah 41:13",
    "Isaiah 43:19", "Isaiah 55:8", "Isaiah 55:11", "Isaiah 58:11", "Isaiah 61:1",
    "Jeremiah 17:7", "Jeremiah 31:3", "Ezekiel 36:26", "Daniel 3:17", "Joel 2:25",
    "Micah 7:7", "Habakkuk 2:4", "Zechariah 4:6", "Malachi 3:10",
    "Matthew 4:4", "Matthew 5:9", "Matthew 6:21", "Matthew 7:12", "Matthew 9:37",
    "Matthew 22:37", "Mark 9:23", "Mark 10:27", "Mark 11:24", "Luke 6:38",
    "Luke 12:34", "Luke 16:10", "John 8:12", "John 8:32", "John 10:10", "John 15:13",
    "John 16:33", "Acts 1:8", "Acts 20:35", "Romans 1:16", "Romans 5:3", "Romans 12:21",
    "Romans 14:8", "1 Corinthians 1:18", "1 Corinthians 10:13", "1 Corinthians 15:58",
    "2 Corinthians 1:3", "2 Corinthians 4:16", "2 Corinthians 4:18", "2 Corinthians 9:7",
    "Galatians 5:1", "Galatians 6:2", "Ephesians 3:20", "Ephesians 4:2", "Ephesians 5:1",
    "Ephesians 6:11", "Philippians 2:13", "Philippians 4:8", "Philippians 4:19",
    "Colossians 3:2", "Colossians 3:12", "1 Thessalonians 5:11", "2 Thessalonians 3:3",
    "1 Timothy 4:12", "1 Timothy 6:6", "2 Timothy 2:15", "2 Timothy 4:7",
    "Hebrews 6:19", "Hebrews 10:24", "Hebrews 11:6", "Hebrews 12:2", "Hebrews 13:2",
    "James 1:2", "James 1:12", "James 1:19", "James 4:7", "James 4:10",
    "1 Peter 3:15", "1 Peter 5:6", "2 Peter 3:9", "1 John 4:4", "1 John 5:14",
    "3 John 1:4", "Jude 1:24", "Revelation 1:8", "Revelation 21:5", "Revelation 22:13",
]


def load_cache():
    if os.path.exists(CACHE):
        with open(CACHE) as f:
            return json.load(f)
    return {}


def fetch(ref, translation, cache):
    key = f"{translation}|{ref}"
    if key in cache:
        return cache[key]
    url = ("https://bible-api.com/" + urllib.parse.quote(ref)
           + "?translation=" + translation)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(url, timeout=25) as r:
                d = json.loads(r.read().decode())
            text = " ".join((d.get("text") or "").split()).strip()
            # strip a leading verse number some responses carry
            if text:
                cache[key] = text
                with open(CACHE, "w") as f:
                    json.dump(cache, f)
                return text
        except Exception as e:
            wait = DELAY * (attempt + 2)
            print(f"  retry {ref} {translation} ({e}) in {wait:.0f}s", file=sys.stderr)
            time.sleep(wait)
    return None


def js_str(s):
    return json.dumps(s, ensure_ascii=False)


if __name__ == "__main__":
    cache = load_cache()
    deck, feed = [], []

    all_refs = list(dict.fromkeys(DECK + FEED_EXTRA))
    print(f"{len(all_refs)} references, {len(DECK)} in the memory deck")

    for i, ref in enumerate(all_refs, 1):
        need_kjv = ref in DECK
        web = cache.get("web|" + ref)
        if not web:
            web = fetch(ref, "web", cache); time.sleep(DELAY)
        kjv = None
        if need_kjv:
            kjv = cache.get("kjv|" + ref)
            if not kjv:
                kjv = fetch(ref, "kjv", cache); time.sleep(DELAY)
        if not web:
            print("  !! skipped", ref, file=sys.stderr)
            continue
        feed.append((ref, web))
        if need_kjv and kjv:
            deck.append((ref, web, kjv))
        if i % 20 == 0:
            print(f"  {i}/{len(all_refs)}")

    out = ["/* ============================================================",
           "   Selah — verse data",
           "   GENERATED by tools/build-deck.py — do not hand-edit.",
           "   Feed pool + memory deck, text pulled from bible-api.com",
           "   (World English Bible & King James, both public domain).",
           "   ============================================================ */",
           "", "// ---- Feed pool (WEB) ----", "window.POOL = ["]
    for ref, web in feed:
        out.append(f" [{js_str(ref)},{js_str(web)}],")
    out.append("];")
    out.append("")
    out.append("// ---- Memory deck (WEB + KJV bundled so switching works offline) ----")
    out.append("window.MEMORY_VERSES = [")
    for ref, web, kjv in deck:
        out.append(f" {{ref:{js_str(ref)}, web:{js_str(web)}, kjv:{js_str(kjv)}}},")
    out.append("];")
    out.append("")

    with open(os.path.join(ROOT, "data.js"), "w") as f:
        f.write("\n".join(out))
    print(f"\ndata.js written — {len(feed)} feed verses, {len(deck)} memory verses")
