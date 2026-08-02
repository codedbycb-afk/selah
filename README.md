# Selah — Scroll the Word

A doom-scroll Bible with teeth. Full-screen vertical snap feed of Scripture, a
Duolingo-style memorization engine, a Genesis-to-Revelation journey you walk one
chapter at a time, a habit tracker, and friends to keep you honest.

Static site — no build step, works offline, installs to your home screen.

**Live:** https://codedbycb-afk.github.io/selah/

---

## The five tabs

- **Read** — infinite verse feed, each verse set behind one of **30 cathedral windows**, every
  one a different Bible story. A verse is matched to the window that tells its story where one
  exists (Psalm 23 lands on the Good Shepherd, John 3:16 on the Crucifixion) and falls back to a
  hash of the reference otherwise, so a verse always gets the same window. Keep / Copy / Share,
  where Share paints a real stained-glass card.
- **Journey** — the road from Genesis to Revelation. 66 book milestones on a winding path,
  1,189 chapter stones, and a little pilgrim carrying his cross who advances as you read.
  Tap a book → tap a chapter → read it → mark it. Chapters cache to IndexedDB, so anything
  you've opened once is yours offline. The road tracks **two** things: chapters read (gold) and
  verses memorized (green), with a badge on each book showing how many of its verses you've
  hidden and a shortcut to memorize straight from that book.
- **Learn** — "Memorize The Word." SM-2-lite spaced repetition over a 127-verse deck split into
  **11 themed packs** (Foundations, Trust & Fear, Anxiety & Rest, Strength, …), each with its own
  progress and its own lesson. **Six exercise types** that escalate with the card — arrange the
  verse, fill the blanks, reference match, first-letters, type it from memory (scored word for
  word), and recall + self-rate — plus a **rank** that runs Seedling → Oak across the whole deck,
  and "Hear it" text-to-speech. XP, hearts, daily goal ring.
- **Track** — day streak ring, XP, chapters, memorized/learning counts, longest streak,
  13-week heatmap, and the share-my-streak card.
- **Me** — device profiles (name + avatar + optional PIN), reminders, sync, translations.

## Reminders

- **Daily verse** at a time you choose.
- **Lesson reminder** that only fires if you haven't hit the day's goal yet.

Delivered as real web push from a Supabase edge function on a 10-minute cron, so they
arrive whether or not the app is open. With no backend configured, an on-device fallback
covers the case where the app is running. On iPhone, notifications require the app to be
added to the Home Screen (iOS 16.4+) — the app detects this and says so.

## Sync & friends

Optional. Sign in with an emailed code (no password) and your streak, chapters, memory
deck, and kept verses follow you to any device — merged, not overwritten, so opening
Selah on a second phone can't cost you a chapter.

Friends work like YouVersion: add by `@handle`, see where each other are in the Bible,
how long the streak is, and which verses they've kept.

Setup lives in [`supabase/SETUP.md`](supabase/SETUP.md). Leave `config.js` blank and
everything stays local — the app is fully usable signed out.

## Translations

- **WEB** (World English Bible) — bundled, offline, public domain.
- **KJV** — via bible-api.com (public domain), bundled for the memory deck.
- **ESV / NLT** — copyrighted; shown via their **official free APIs**. Add your own free key
  in Me → Translation (api.esv.org / api.nlt.to). Keys stay on-device and are never synced.

## Files

| File | What it is |
|---|---|
| `index.html` | shell — nav, views, lesson runner, reader, sheets, gates |
| `styles.css` | stained-glass design system (Cinzel + Cormorant Garamond) |
| `config.js` | Supabase + VAPID keys. Blank = local-only mode |
| `data.js` | feed pool + memory deck — **generated**, see `tools/build-deck.py` |
| `journey.js` | the 66-book road, chapter reader, offline scripture cache |
| `app.js` | profiles, feed, SRS engine, tracker, account & friends UI |
| `push.js` | permission flow, subscriptions, reminder settings |
| `sync.js` | Supabase REST client, state merge, friends |
| `share.js` | canvas streak / verse cards |
| `sw.js` | offline shell + push handler |
| `supabase/` | schema, RLS, edge function, setup guide |
| `assets/` | icons, pilgrim sprite, stained-glass art |

## Regenerating data and art

```bash
python3 tools/build-deck.py     # re-pulls every verse from bible-api.com (WEB + KJV)
python3 assets/build-assets.py  # re-cuts the pilgrim and re-mints every icon size
```

`build-deck.py` exists so the bundled text always comes from the source rather than being
typed from memory. It caches, so a re-run after adding a few references is quick.

## Run locally

```bash
cd ~/Developer/selah && python3 -m http.server 8791
# open http://localhost:8791
```

The service worker caches aggressively. While developing, either bump `VERSION` in
`sw.js` or clear the cache from DevTools → Application.

## Deploy

```bash
git add -A && git commit -m "…" && git push
```

Same URL. **Bump `VERSION` in `sw.js` on any release that changes a cached file**, or
returning users sit on the old shell for an extra load.
