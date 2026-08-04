/* ============================================================
   Selah — Flashcards
   A scrollable stack of verses with the reference hidden. Flip a
   card, name the book, then name chapter:verse. Grades into the
   same SRS as the lesson runner.
   ============================================================ */
'use strict';

const Cards = (() => {
  let SES = null;   // {queue, answers:{}, xp, right, scope}

  /* ---------- distractors ----------
     Wrong answers have to be plausible or the drill is free. Books come from
     the same division of the canon where possible; references come from real
     verses in the same book first, and only then from a synthesised number
     that still fits inside that book's real chapter count. */
  const divisionOf = name => {
    const b = (window.Journey ? Journey.BIBLE : []).find(x => x.name === name);
    return b ? b.div : null;
  };
  const chaptersIn = name => {
    const b = (window.Journey ? Journey.BIBLE : []).find(x => x.name === name);
    return b ? b.chapters : 30;
  };

  function bookOptions(v) {
    const answer = bookOf(v.ref);
    const all = [...new Set(MEMORY_VERSES.map(x => bookOf(x.ref)))].filter(b => b !== answer);
    const sameDiv = all.filter(b => divisionOf(b) === divisionOf(answer));
    const pool = sameDiv.length >= 3 ? sameDiv : all;
    return shuffle([answer, ...shuffle(pool).slice(0, 3)]);
  }

  function refOptions(v) {
    const book = bookOf(v.ref);
    const answer = v.ref;
    // real references from the same book, from anywhere in the app's data
    const real = [...new Set([
      ...MEMORY_VERSES.map(x => x.ref),
      ...(window.POOL || []).map(p => p[0]),
    ])].filter(r => r !== answer && bookOf(r) === book);

    const opts = shuffle(real).slice(0, 3);
    // top up with plausible invented references inside the real chapter count
    const max = chaptersIn(book);
    const m = answer.match(/(\d+):(\d+)$/);
    let guard = 0;
    while (opts.length < 3 && guard++ < 40) {
      const ch = Math.max(1, Math.min(max, (+m[1]) + (Math.floor(Math.random() * 9) - 4)));
      const vs = Math.max(1, (+m[2]) + (Math.floor(Math.random() * 11) - 5));
      const cand = `${book} ${ch}:${vs}`;
      if (cand !== answer && !opts.includes(cand)) opts.push(cand);
    }
    return shuffle([answer, ...opts]);
  }

  /* ---------- a card ---------- */
  function cardEl(v, i, total) {
    const el = document.createElement('article');
    el.className = 'fcard';
    el.dataset.i = i;
    const txt = verseText(v);
    el.innerHTML = `
      <div class="fcard-inner">
        <div class="fface front">
          <div class="fc-count caps">${i + 1} / ${total}</div>
          <p class="fc-verse">“${txt}”</p>
          <div class="fc-flip caps">Tap to flip ↻</div>
        </div>
        <div class="fface back">
          <div class="fc-count caps">${i + 1} / ${total}</div>
          <div class="fc-body"></div>
        </div>
      </div>`;
    el.querySelector('.front').onclick = () => flip(el, v, i);
    return el;
  }

  function flip(el, v, i) {
    if (el.classList.contains('flipped')) return;
    el.classList.add('flipped');
    vibrate(8);
    askBook(el, v, i);
  }

  /* step 1 — which book */
  function askBook(el, v, i) {
    const body = el.querySelector('.fc-body');
    const answer = bookOf(v.ref);
    body.innerHTML = `<div class="fc-q caps">Which book?</div>
      <div class="fc-choices">${bookOptions(v).map(b =>
        `<button class="fc-choice" data-b="${b}">${b}</button>`).join('')}</div>`;
    let locked = false;
    body.querySelectorAll('.fc-choice').forEach(b => b.onclick = () => {
      if (locked) return; locked = true;
      const ok = b.dataset.b === answer;
      b.classList.add(ok ? 'right' : 'wrong');
      if (!ok) body.querySelectorAll('.fc-choice').forEach(x => {
        if (x.dataset.b === answer) x.classList.add('right');
      });
      vibrate(ok ? 10 : [20, 40, 20]);
      setTimeout(() => askRef(el, v, i, ok), ok ? 380 : 900);
    });
  }

  /* step 2 — which chapter and verse */
  function askRef(el, v, i, bookOK) {
    const body = el.querySelector('.fc-body');
    const short = r => r.replace(bookOf(r), '').trim();   // "3:16"
    body.innerHTML = `<div class="fc-q caps">${bookOf(v.ref)} — which verse?</div>
      <div class="fc-choices tight">${refOptions(v).map(r =>
        `<button class="fc-choice num" data-r="${r}">${short(r)}</button>`).join('')}</div>`;
    let locked = false;
    body.querySelectorAll('.fc-choice').forEach(b => b.onclick = () => {
      if (locked) return; locked = true;
      const ok = b.dataset.r === v.ref;
      b.classList.add(ok ? 'right' : 'wrong');
      if (!ok) body.querySelectorAll('.fc-choice').forEach(x => {
        if (x.dataset.r === v.ref) x.classList.add('right');
      });
      vibrate(ok ? 10 : [20, 40, 20]);
      setTimeout(() => settle(el, v, i, bookOK, ok), ok ? 320 : 800);
    });
  }

  /* verdict + grade */
  function settle(el, v, i, bookOK, refOK) {
    const q = bookOK && refOK ? 'good' : (bookOK || refOK) ? 'hard' : 'again';
    const xp = q === 'good' ? 12 : q === 'hard' ? 6 : 0;
    grade(v.ref, q);
    if (xp) bump('lesson', xp);
    SES.xp += xp;
    if (q === 'good') SES.right++;
    SES.answers[v.ref] = q;

    const body = el.querySelector('.fc-body');
    const last = i >= SES.queue.length - 1;
    body.innerHTML = `
      <div class="fc-verdict ${q}">
        <b class="caps">${q === 'good' ? 'Both right ✦' : q === 'hard' ? 'Half right' : 'Not this time'}</b>
        <div class="fc-answer caps">${v.ref}</div>
        ${xp ? `<div class="fc-xp">+${xp} XP</div>` : ''}
      </div>
      <p class="fc-recap">“${verseText(v)}”</p>
      <div class="fc-acts">
        <button class="cta ghost sm" data-act="hear">Hear it</button>
        <button class="cta sm" data-act="next">${last ? 'Finish' : 'Next card'}</button>
      </div>`;
    body.querySelector('[data-act="hear"]').onclick = e => { e.stopPropagation(); speak(verseText(v)); };
    body.querySelector('[data-act="next"]').onclick = e => { e.stopPropagation(); last ? finish() : goTo(i + 1); };
    if (window.Sync) Sync.queue();
  }

  function goTo(i) {
    const el = document.querySelector(`.fcard[data-i="${i}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- session ---------- */
  function open(scope) {
    const pool = scopedDeck(scope);
    if (!pool.length) return toast('Nothing in that set yet');
    let queue;
    if (scope && scope.refs) {
      queue = shuffle(pool);                 // a path node reviews its exact set
    } else {
      // due and half-learned verses first — that's where naming the reference bites
      const weight = v => { const c = card(v.ref); return c.reps === 0 ? 1 : c.due <= Date.now() ? 2 : 0; };
      queue = shuffle(pool).sort((a, b) => weight(b) - weight(a)).slice(0, 12);
    }
    SES = { queue, answers: {}, xp: 0, right: 0, scope: scope || null,
            onDone: (scope && scope.onDone) || null };

    const wrap = $('#cards');
    wrap.classList.add('open');
    wrap.innerHTML = `
      <div class="fc-top">
        <button class="x" id="cardsX" aria-label="Close">×</button>
        <div class="fc-title caps">Flashcards${scope && scope.pack ? ' · ' + packById(scope.pack).label : scope && scope.book ? ' · ' + scope.book : ''}</div>
        <div class="fc-score caps" id="fcScore">0 XP</div>
      </div>
      <div class="fc-scroll" id="fcScroll"></div>
      <div class="fc-hint caps" id="fcHint">Swipe up for the next card</div>`;
    const sc = $('#fcScroll');
    queue.forEach((v, i) => sc.appendChild(cardEl(v, i, queue.length)));
    $('#cardsX').onclick = close;
    sc.addEventListener('scroll', () => {
      const h = $('#fcHint'); if (h) { h.style.opacity = '0'; setTimeout(() => h.remove(), 500); }
    }, { once: true });
  }

  function finish() {
    const sc = $('#fcScroll');
    const done = document.createElement('article');
    done.className = 'fcard done';
    const pct = SES.queue.length ? Math.round(SES.right / SES.queue.length * 100) : 0;
    done.innerHTML = `<div class="fcard-inner"><div class="fface front">
        <div class="done-card">
          <div class="halo">✦</div>
          <h2>Deck complete</h2>
          <p>${SES.right} of ${SES.queue.length} placed exactly</p>
          <div class="done-stats">
            <div class="stat-chip"><div class="n">+${SES.xp}</div><div class="k">XP</div></div>
            <div class="stat-chip"><div class="n">${pct}%</div><div class="k">Exact</div></div>
            <div class="stat-chip"><div class="n">${streakCount()}</div><div class="k">Day streak</div></div>
          </div>
          <button class="cta" id="fcDone">Done</button>
          <button class="cta ghost sm" id="fcAgain" style="margin-top:10px">Another deck</button>
        </div></div></div>`;
    sc.appendChild(done);
    done.scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('#fcDone').onclick = close;
    $('#fcAgain').onclick = () => { const s = SES.scope; close(); open(s); };
    vibrate([10, 40, 10, 40, 20]);
  }

  function close() {
    const cb = SES && SES.onDone;
    const stats = SES ? { right: SES.right, total: SES.queue.length, xp: SES.xp } : null;
    $('#cards').classList.remove('open');
    $('#cards').innerHTML = '';
    SES = null;
    if (cb) cb(stats);
    renderLearn();
    refreshChrome();
  }

  /* keep the score chip honest as you go */
  setInterval(() => {
    if (!SES) return;
    const s = document.getElementById('fcScore');
    if (s) s.textContent = SES.xp + ' XP';
  }, 400);

  return { open, close };
})();

window.Cards = Cards;
