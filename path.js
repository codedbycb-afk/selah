/* ============================================================
   Selah — The Learning Path
   A gated road through the deck, built the way a language tree is:
   small units, several short nodes each, review that sweeps back over
   what you've already seen, and a mastery test that has to be perfect
   before the next unit opens.
   ============================================================ */
'use strict';

const Path = (() => {

  /* ---------- units ----------
     One unit per themed pack, in the order they're defined. Foundations
     first: 15 verses, and nothing else opens until they're all clean. */
  const units = () => (window.PACKS || []).map((p, i) => ({
    id: p.id, label: p.label, sub: p.sub, i,
    verses: MEMORY_VERSES.filter(v => v.pack === p.id),
  })).filter(u => u.verses.length);

  const unitById = id => units().find(u => u.id === id);

  /* ---------- nodes ----------
     Three verses per lesson — small enough to finish standing up. A
     flashcard sweep after every second lesson pulls back everything the
     unit has covered so far, so nothing gets learned and abandoned. The
     unit ends on a test over all of it. */
  const CHUNK = 3;
  function nodesFor(u) {
    const out = [];
    const chunks = [];
    for (let i = 0; i < u.verses.length; i += CHUNK) chunks.push(u.verses.slice(i, i + CHUNK));
    chunks.forEach((c, i) => {
      out.push({ type: 'lesson', refs: c.map(v => v.ref), label: `Verses ${i * CHUNK + 1}–${i * CHUNK + c.length}` });
      if (i % 2 === 1 && i < chunks.length - 1) {
        const seen = u.verses.slice(0, (i + 1) * CHUNK).map(v => v.ref);
        out.push({ type: 'cards', refs: seen, label: 'Review' });
      }
    });
    out.push({ type: 'test', refs: u.verses.map(v => v.ref), label: 'Mastery' });
    return out;
  }

  /* ---------- progress ---------- */
  const store = () => DB.get('path', {});
  const save = p => { DB.set('path', p); if (window.Sync) Sync.queue(); };
  const unitState = id => Object.assign({ done: [], test: { passed: false, best: 0 } }, store()[id] || {});

  function markNode(unitId, idx, result) {
    const p = store();
    const st = Object.assign({ done: [], test: { passed: false, best: 0 } }, p[unitId] || {});
    const node = nodesFor(unitById(unitId))[idx];
    if (node.type === 'test') {
      st.test.best = Math.max(st.test.best || 0, result.pct);
      if (result.pct >= 100) { st.test.passed = true; if (!st.done.includes(idx)) st.done.push(idx); }
    } else if (!st.done.includes(idx)) {
      st.done.push(idx);
    }
    st.done.sort((a, b) => a - b);
    p[unitId] = st; save(p);
  }

  /* ---------- gating ---------- */
  const unitOpen = u => u.i === 0 || unitState(units()[u.i - 1].id).test.passed;
  const nodeOpen = (u, idx) => unitOpen(u) && (idx === 0 || unitState(u.id).done.includes(idx - 1));
  const unitDone = u => unitState(u.id).test.passed;

  /* where the learner actually is */
  function current() {
    for (const u of units()) {
      if (!unitOpen(u)) break;
      const ns = nodesFor(u), st = unitState(u.id);
      for (let i = 0; i < ns.length; i++) if (!st.done.includes(i)) return { unit: u, idx: i, node: ns[i] };
    }
    const last = units()[units().length - 1];
    return { unit: last, idx: 0, node: nodesFor(last)[0] };
  }

  const totalNodes = () => units().reduce((s, u) => s + nodesFor(u).length, 0);
  const doneNodes = () => units().reduce((s, u) => s + unitState(u.id).done.length, 0);

  /* ---------- launching a node ---------- */
  function openNode(u, idx) {
    if (!unitOpen(u)) { toast('Finish the unit before this one first'); vibrate(12); return; }
    if (!nodeOpen(u, idx)) { toast('Complete the step before it'); vibrate(12); return; }
    const node = nodesFor(u)[idx];
    const done = res => { markNode(u.id, idx, res); render(); };

    if (node.type === 'lesson') {
      startLesson({ refs: node.refs, onDone: r => done({ pct: 100, ...r }) });
    } else if (node.type === 'cards') {
      Cards.open({ refs: node.refs, onDone: r => done({ pct: 100, ...r }) });
    } else {
      startLesson({
        refs: node.refs, test: true, unit: u.label,
        onDone: r => {
          const pct = r.total ? Math.round(r.correct / r.total * 100) : 0;
          markNode(u.id, idx, { pct, ...r });
          render();
        },
      });
    }
  }

  /* ---------- the road ---------- */
  const STEP = 108, HEAD = 118;

  const ICON = {
    lesson: '<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
    cards: '<rect x="7" y="4" width="12" height="15" rx="2"/><path d="M4 7v11a2 2 0 0 0 2 2h9"/>',
    test: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M6 4h12v4a6 6 0 0 1-12 0z"/><path d="M18 5h3v2a3 3 0 0 1-3 3"/><path d="M6 5H3v2a3 3 0 0 0 3 3"/>',
  };
  const svgIcon = t => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round">${ICON[t]}</svg>`;

  function render() {
    const body = $('#journey-body');
    const us = units();
    const cur = current();

    let y = 0, html = '', pts = [];
    us.forEach(u => {
      const open = unitOpen(u), st = unitState(u.id), ns = nodesFor(u);
      const pct = ns.length ? st.done.length / ns.length : 0;
      html += `<div class="lp-head ${open ? '' : 'locked'} ${unitDone(u) ? 'done' : ''}" style="top:${y}px">
          <div class="lp-head-in">
            <div class="lp-h-top">
              <b class="caps">${u.label}</b>
              ${unitDone(u) ? '<span class="lp-seal caps">✦ Mastered</span>'
                : open ? `<span class="lp-n">${st.done.length}/${ns.length}</span>`
                : '<span class="lp-lock">🔒</span>'}
            </div>
            <span class="lp-sub">${u.sub}</span>
            <div class="pack-bar"><i style="width:${Math.max(pct * 100, pct > 0 ? 4 : 0)}%"></i></div>
          </div>
        </div>`;
      y += HEAD;

      ns.forEach((n, i) => {
        const x = Math.sin((u.i * 3 + i) * 0.7) * 26;
        const isDone = st.done.includes(i);
        const canDo = nodeOpen(u, i);
        const isHere = open && !isDone && canDo && cur.unit.id === u.id && cur.idx === i;
        const state = isDone ? 'done' : canDo ? 'open' : 'locked';
        pts.push({ x, y });
        // namespaced: a bare "cards" class would collide with the flashcard
        // overlay's .cards { display:none } and render the node invisible
        html += `<button class="lp-node ${state} lp-${n.type} ${isHere ? 'here' : ''}"
            data-u="${u.id}" data-i="${i}" style="top:${y}px;left:calc(50% + ${x}%)">
            ${isHere ? '<span class="lp-flag caps">Start</span>' : ''}
            <span class="lp-face">${isDone ? '✦' : svgIcon(n.type)}</span>
            <span class="lp-label">${n.label}</span>
            ${n.type === 'test' && !isDone && st.test.best ? `<span class="lp-best">best ${st.test.best}%</span>` : ''}
          </button>`;
        y += STEP;
      });
      y += 16;
    });

    let d = pts.length ? `M ${50 + pts[0].x} ${pts[0].y}` : '';
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], c = pts[i], my = (p.y + c.y) / 2;
      d += ` C ${50 + p.x} ${my}, ${50 + c.x} ${my}, ${50 + c.x} ${c.y}`;
    }

    const pctAll = totalNodes() ? doneNodes() / totalNodes() : 0;
    body.innerHTML = `
      ${modeSwitch('learn')}
      <div class="j-hero gc">
        <div class="j-track">
          <div class="j-track-h"><b class="caps">The path</b>
            <span>${doneNodes()} of ${totalNodes()} steps · ${Math.round(pctAll * 1000) / 10}%</span></div>
          <div class="j-bar mem"><i style="width:${Math.max(pctAll * 100, doneNodes() ? 2 : 0)}%"></i></div>
        </div>
        <div class="j-hero-top">
          <div><b class="caps">${units().filter(unitDone).length}</b><span>units mastered</span></div>
          <div><b class="caps">${masteredCount()}</b><span>verses hidden</span></div>
          <div><b class="caps">${streakCount()}</b><span>day streak</span></div>
        </div>
        <button class="cta" id="lpContinue">Continue · ${cur.unit.label}</button>
      </div>
      <div class="lp-path" style="height:${y + 40}px">
        <svg class="j-road" viewBox="0 0 100 ${y + 40}" preserveAspectRatio="none" aria-hidden="true">
          <path d="${d}" class="road-base" vector-effect="non-scaling-stroke"/>
          <path d="${d}" class="road-inner" vector-effect="non-scaling-stroke"/>
        </svg>
        ${html}
      </div>`;

    wireMode();
    $('#lpContinue').onclick = () => openNode(cur.unit, cur.idx);
    $$('#journey-body .lp-node').forEach(b => b.onclick = () => openNode(unitById(b.dataset.u), +b.dataset.i));

    requestAnimationFrame(() => {
      const sc = $('#view-journey .scroll');
      const here = $('#journey-body .lp-node.here') || $('#journey-body .lp-node.open');
      if (sc && here) sc.scrollTop = Math.max(0, here.offsetTop - sc.clientHeight * 0.45);
    });
  }

  /* ---------- the Read / Learn switch, shared by both roads ---------- */
  const mode = () => DB.get('journeyMode', 'read');
  const setMode = m => { DB.set('journeyMode', m); Journey.render(); };
  const modeSwitch = active => `
    <div class="page-h"><div class="eyebrow">The road</div><h1>Journey</h1></div>
    <div class="seg wide" id="jMode">
      <button data-m="read" class="${active === 'read' ? 'on' : ''}">Reading</button>
      <button data-m="learn" class="${active === 'learn' ? 'on' : ''}">Learning</button>
    </div>`;
  const wireMode = () => $$('#jMode button').forEach(b => b.onclick = () => setMode(b.dataset.m));

  return { render, units, unitById, nodesFor, unitState, current, openNode,
           unitOpen, unitDone, nodeOpen, totalNodes, doneNodes, mode, setMode, modeSwitch, wireMode };
})();

window.Path = Path;
