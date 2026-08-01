# Selah — Scroll the Word

A doom-scroll Bible with teeth. Full-screen vertical snap feed of Scripture, plus a
Duolingo-style memorization engine, a habit tracker, device profiles, and multiple translations.
Static site — no build, works offline, installs to your home screen.

**Live:** https://codedbycb-afk.github.io/selah/

## Features
- **Read** — infinite stained-glass verse feed (jewel-tone "windows", lancet-arch motif, illuminated drop caps). Keep / Copy / Share. WEB pool offline + live random pull online.
- **Learn** — "Hide the Word." Spaced-repetition (SM-2-lite) memory deck with 4 Duolingo-style exercise types: arrange-the-verse tiles, fill-the-blank word bank, reference match, and recall + self-rate. XP, hearts, daily goal ring.
- **Track** — day streak ring, XP, verses read, memorized / learning counts, longest streak, 13-week activity heatmap.
- **Me** — device profiles (name + avatar + optional PIN lock), multi-profile switcher, translation + daily-goal settings. All data on-device.

## Translations
- **WEB** (World English Bible) — bundled, offline, public domain.
- **KJV** — via bible-api.com (public domain).
- **ESV / NLT** — copyrighted; shown via their **official free APIs**. Add your own free key in
  Me → Translation (get one at api.esv.org / api.nlt.to, ~2 min). Keys stay on-device.

## Files
- `index.html` — shell (nav, views, lesson runner, gates)
- `styles.css` — stained-glass design system (Cinzel + Cormorant Garamond)
- `data.js` — feed pool (WEB) + memory deck (WEB + KJV)
- `app.js` — profiles, translations, feed, SRS lesson engine, tracker

## Run locally
```bash
cd ~/Developer/selah && python3 -m http.server 8791
# open http://localhost:8791
```

## Deploy updates
Edit files, then `git add -A && git commit -m "…" && git push`. Same URL.
