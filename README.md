# Selah — Scroll the Word

A doom-scroll Bible. Full-screen vertical snap feed, one verse per screen, infinite.
Built like TikTok, but every swipe is Scripture. Single self-contained `index.html` — no build, no dependencies, works offline.

- **Text:** World English Bible (public domain). ~115 curated verses offline + live random pull from bible-api.com when online (infinite).
- **Features:** Keep (saved verses, stored on-device), Copy, Share, rotating time-of-day atmospheres, illuminated drop caps.
- **Type:** Iowan Old Style — native on iPhone, zero network.
- **Install:** Add to Home Screen on iOS → runs full-screen like a real app.

## Run locally
```bash
cd ~/Developer/selah
python3 -m http.server 8791
# open http://localhost:8791
```

## Put it on your phone
Deploy the folder to any static host (Vercel/Netlify/GitHub Pages), open the URL on your iPhone,
Share → Add to Home Screen. Done — a real doom-scroll Bible app on your home screen.
