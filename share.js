/* ============================================================
   Selah — shareable cards
   Paints a 1080×1920 stained-glass card on canvas and hands it to
   the native share sheet (or a download when there isn't one).
   ============================================================ */
'use strict';

const Share = (() => {
  const W = 1080, H = 1920;
  let bg = null;

  const loadBG = () => bg || (bg = new Promise(res => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => res(null);
    i.src = './assets/road-card.jpg';
  }));

  const fit = (ctx, text, font, max, size) => {
    let s = size;
    do { ctx.font = font.replace('%s', s + 'px'); s -= 2; }
    while (ctx.measureText(text).width > max && s > 18);
    return s + 2;
  };

  function wrap(ctx, text, max) {
    const words = text.split(' '), lines = []; let line = '';
    words.forEach(w => {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; }
      else line = t;
    });
    if (line) lines.push(line);
    return lines;
  }

  async function render(kind) {
    try { await document.fonts.ready; } catch (e) {}
    const img = await loadBG();
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');

    /* ---- ground ---- */
    x.fillStyle = '#07070c'; x.fillRect(0, 0, W, H);
    if (img) {
      const s = Math.max(W / img.width, H / img.height);
      x.globalAlpha = .85;
      x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
      x.globalAlpha = 1;
    }
    // scrim so type always reads
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(7,7,12,.92)'); g.addColorStop(.42, 'rgba(7,7,12,.44)');
    g.addColorStop(.72, 'rgba(7,7,12,.80)'); g.addColorStop(1, 'rgba(7,7,12,.97)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    /* ---- gold frame ---- */
    x.strokeStyle = 'rgba(230,196,115,.42)'; x.lineWidth = 3;
    x.strokeRect(46, 46, W - 92, H - 92);
    x.strokeStyle = 'rgba(230,196,115,.16)'; x.lineWidth = 1;
    x.strokeRect(64, 64, W - 128, H - 128);

    const CINZEL = '600 %s "Cinzel", Georgia, serif';
    const GARA   = '500 %s "Cormorant Garamond", Georgia, serif';
    const gold   = '#e6c473', ink = '#f6efdd', dim = 'rgba(216,201,163,.72)';
    x.textAlign = 'center';

    /* ---- wordmark ---- */
    x.fillStyle = gold; x.font = CINZEL.replace('%s', '46px');
    x.letterSpacing = '14px';
    x.fillText('SELAH', W / 2, 176);
    x.letterSpacing = '0px';
    x.fillStyle = dim; x.font = GARA.replace('%s', '32px');
    x.fillText('scroll the word', W / 2, 224);

    const p = DB.profile() || { name: 'A pilgrim', avatar: '✝' };
    const streak = streakCount();

    if (kind === 'verse' && Share._verse) {
      /* ---------- verse card ---------- */
      const [ref, text] = Share._verse;
      x.fillStyle = ink;
      const size = text.length > 210 ? 46 : text.length > 120 ? 56 : 66;
      x.font = GARA.replace('%s', size + 'px');
      const lines = wrap(x, '“' + text + '”', W - 260);
      const lh = size * 1.42;
      let y = H / 2 - (lines.length * lh) / 2;
      lines.forEach(l => { x.fillText(l, W / 2, y); y += lh; });
      x.fillStyle = gold; x.font = CINZEL.replace('%s', '40px');
      x.letterSpacing = '4px';
      x.fillText(ref.toUpperCase(), W / 2, y + 60);
      x.letterSpacing = '0px';
      x.fillStyle = dim; x.font = GARA.replace('%s', '28px');
      x.fillText(TRANSLATIONS[settings().translation].name, W / 2, y + 108);
    } else {
      /* ---------- streak card ---------- */
      x.fillStyle = dim; x.font = GARA.replace('%s', '38px');
      x.fillText(p.name + ' is walking the Word', W / 2, 400);

      // the number
      x.fillStyle = gold;
      x.shadowColor = 'rgba(230,196,115,.45)'; x.shadowBlur = 60;
      x.font = CINZEL.replace('%s', '320px');
      x.fillText(String(streak), W / 2, 720);
      x.shadowBlur = 0;
      x.fillStyle = ink; x.font = CINZEL.replace('%s', '56px');
      x.letterSpacing = '8px';
      x.fillText(streak === 1 ? 'DAY STREAK' : 'DAY STREAK', W / 2, 800);
      x.letterSpacing = '0px';

      // rule
      x.strokeStyle = 'rgba(230,196,115,.3)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(260, 872); x.lineTo(W - 260, 872); x.stroke();

      // journey progress
      const pct = window.Journey ? Journey.journeyPct() : 0;
      const read = window.Journey ? Journey.chaptersRead() : 0;
      const total = window.Journey ? Journey.TOTAL_CHAPTERS : 1189;
      const cur = window.Journey ? Journey.currentBook().name : '';

      x.fillStyle = dim; x.font = GARA.replace('%s', '34px');
      x.fillText('THE JOURNEY', W / 2, 950);

      const bx = 200, bw = W - 400, by = 990;
      x.fillStyle = 'rgba(230,196,115,.14)';
      x.fillRect(bx, by, bw, 16);
      x.fillStyle = gold;
      x.fillRect(bx, by, Math.max(bw * pct, 6), 16);
      x.strokeStyle = 'rgba(230,196,115,.35)'; x.lineWidth = 1.5;
      x.strokeRect(bx, by, bw, 16);

      x.fillStyle = ink; x.font = GARA.replace('%s', '40px');
      x.fillText(`${read} of ${total} chapters · ${Math.round(pct * 1000) / 10}%`, W / 2, 1078);
      if (cur) {
        x.fillStyle = gold; x.font = CINZEL.replace('%s', '38px');
        x.fillText('Now in ' + cur, W / 2, 1146);
      }

      // three stats
      const stats = [
        [String(masteredCount()), 'MEMORIZED'],
        [String(totalXP()), 'TOTAL XP'],
        [String(longestStreak()), 'BEST STREAK'],
      ];
      stats.forEach(([n, k], i) => {
        const cx = W / 2 + (i - 1) * 300;
        x.fillStyle = ink; x.font = CINZEL.replace('%s', '72px');
        x.fillText(n, cx, 1330);
        x.fillStyle = dim; x.font = GARA.replace('%s', '28px');
        x.letterSpacing = '3px';
        x.fillText(k, cx, 1378);
        x.letterSpacing = '0px';
      });
    }

    /* ---- footer ---- */
    x.fillStyle = 'rgba(230,196,115,.72)'; x.font = CINZEL.replace('%s', '30px');
    x.letterSpacing = '6px';
    x.fillText('SELAH · SCROLL THE WORD', W / 2, H - 190);
    x.letterSpacing = '0px';
    const url = (window.SELAH_CONFIG || {}).SITE_URL || '';
    if (url) {
      x.fillStyle = dim; x.font = GARA.replace('%s', '28px');
      x.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), W / 2, H - 140);
    }

    return new Promise(res => c.toBlob(res, 'image/png'));
  }

  async function send(kind) {
    toast('Painting the glass…');
    let blob;
    try { blob = await render(kind); } catch (e) { blob = null; }
    if (!blob) { toast('Couldn’t make the card'); return; }

    const streak = streakCount();
    const url = (window.SELAH_CONFIG || {}).SITE_URL || '';
    const text = kind === 'verse' && Share._verse
      ? `“${Share._verse[1]}”\n— ${Share._verse[0]}`
      : `${streak} days in the Word. ${window.Journey ? Math.round(Journey.journeyPct() * 1000) / 10 : 0}% of the way from Genesis to Revelation.`;
    const file = new File([blob], 'selah-streak.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text, title: 'Selah' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    if (navigator.share) {
      try { await navigator.share({ text: text + (url ? '\n' + url : ''), title: 'Selah' }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'selah-streak.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Card saved');
  }

  return {
    streak: () => send('streak'),
    verse: (ref, text) => { Share._verse = [ref, text]; return send('verse'); },
    render, _verse: null,
  };
})();

window.Share = Share;
