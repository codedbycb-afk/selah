/* ============================================================
   Selah — The Journey
   A pilgrim carries his cross from Genesis to Revelation.
   66 book milestones · 1,189 chapter stones · read-through plan
   ============================================================ */
'use strict';

/* ---------- the road ---------- */
const DIVISIONS = {
  law:      {label:'The Law',        sub:'Genesis — Deuteronomy',  glass:'#7d1826'},
  history:  {label:'History',        sub:'Joshua — Esther',        glass:'#8a4a0c'},
  poetry:   {label:'Poetry',         sub:'Job — Song of Solomon',  glass:'#0f5a3f'},
  major:    {label:'Major Prophets', sub:'Isaiah — Daniel',        glass:'#1c2a78'},
  minor:    {label:'Minor Prophets', sub:'Hosea — Malachi',        glass:'#0a5066'},
  gospels:  {label:'The Gospels',    sub:'Matthew — John',         glass:'#c79a3c'},
  acts:     {label:'The Church',     sub:'Acts',                   glass:'#4a1c7a'},
  paul:     {label:'Paul’s Letters', sub:'Romans — Philemon',      glass:'#6b1450'},
  general:  {label:'The Letters',    sub:'Hebrews — Jude',         glass:'#0f5a3f'},
  apoc:     {label:'The Revelation', sub:'Revelation',             glass:'#8a4a0c'},
};

const BIBLE = [
  ['Genesis',50,'law'],['Exodus',40,'law'],['Leviticus',27,'law'],['Numbers',36,'law'],['Deuteronomy',34,'law'],
  ['Joshua',24,'history'],['Judges',21,'history'],['Ruth',4,'history'],['1 Samuel',31,'history'],['2 Samuel',24,'history'],
  ['1 Kings',22,'history'],['2 Kings',25,'history'],['1 Chronicles',29,'history'],['2 Chronicles',36,'history'],
  ['Ezra',10,'history'],['Nehemiah',13,'history'],['Esther',10,'history'],
  ['Job',42,'poetry'],['Psalms',150,'poetry'],['Proverbs',31,'poetry'],['Ecclesiastes',12,'poetry'],['Song of Solomon',8,'poetry'],
  ['Isaiah',66,'major'],['Jeremiah',52,'major'],['Lamentations',5,'major'],['Ezekiel',48,'major'],['Daniel',12,'major'],
  ['Hosea',14,'minor'],['Joel',3,'minor'],['Amos',9,'minor'],['Obadiah',1,'minor'],['Jonah',4,'minor'],['Micah',7,'minor'],
  ['Nahum',3,'minor'],['Habakkuk',3,'minor'],['Zephaniah',3,'minor'],['Haggai',2,'minor'],['Zechariah',14,'minor'],['Malachi',4,'minor'],
  ['Matthew',28,'gospels'],['Mark',16,'gospels'],['Luke',24,'gospels'],['John',21,'gospels'],
  ['Acts',28,'acts'],
  ['Romans',16,'paul'],['1 Corinthians',16,'paul'],['2 Corinthians',13,'paul'],['Galatians',6,'paul'],['Ephesians',6,'paul'],
  ['Philippians',4,'paul'],['Colossians',4,'paul'],['1 Thessalonians',5,'paul'],['2 Thessalonians',3,'paul'],
  ['1 Timothy',6,'paul'],['2 Timothy',4,'paul'],['Titus',3,'paul'],['Philemon',1,'paul'],
  ['Hebrews',13,'general'],['James',5,'general'],['1 Peter',5,'general'],['2 Peter',3,'general'],
  ['1 John',5,'general'],['2 John',1,'general'],['3 John',1,'general'],['Jude',1,'general'],
  ['Revelation',22,'apoc'],
].map(([name,chapters,div],i)=>({name,chapters,div,i}));

const TOTAL_CHAPTERS = BIBLE.reduce((s,b)=>s+b.chapters,0); // 1189

/* short label that fits inside a medallion */
function abbr(name){
  const m = name.match(/^([123])\s+(\w)/);
  if(m) return m[1]+m[2].toUpperCase();
  if(name==='Song of Solomon') return 'Sng';
  if(name==='Philemon') return 'Phm';
  if(name==='Philippians') return 'Php';
  return name.slice(0,3);
}

/* ============================================================
   PROGRESS
   shape: { "Genesis":[1,2,3], "John":[1] }
   ============================================================ */
const jRead        = ()=>DB.get('journey',{});
const jSaveRead    = v=>DB.set('journey',v);
const bookRead     = b=>(jRead()[b.name]||[]).length;
const isChapterRead= (book,ch)=>(jRead()[book]||[]).includes(ch);
const chaptersRead = ()=>Object.values(jRead()).reduce((s,a)=>s+a.length,0);
const journeyPct   = ()=>chaptersRead()/TOTAL_CHAPTERS;

/* the book the pilgrim is standing on: first book not yet finished */
function currentBook(){
  const r=jRead();
  for(const b of BIBLE){ if((r[b.name]||[]).length < b.chapters) return b; }
  return BIBLE[BIBLE.length-1];
}
/* next unread chapter overall — the "continue" target */
function nextStop(){
  const b=currentBook(), done=jRead()[b.name]||[];
  for(let c=1;c<=b.chapters;c++) if(!done.includes(c)) return {book:b,ch:c};
  return {book:b,ch:b.chapters};
}
function markChapterRead(bookName,ch){
  const r=jRead(); const a=r[bookName]||[];
  if(a.includes(ch)) return false;
  a.push(ch); a.sort((x,y)=>x-y); r[bookName]=a; jSaveRead(r);
  bump('chapter',12);                      // counts toward streak + daily goal
  if(window.Sync) Sync.queue('journey');
  return true;
}

/* ============================================================
   CHAPTER TEXT — fetch + offline cache (IndexedDB)
   ============================================================ */
const IDB = (()=>{
  let dbp=null;
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{
    const r=indexedDB.open('selah-scripture',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('chapters');
    r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
  }));
  const tx=async(mode)=>(await open()).transaction('chapters',mode).objectStore('chapters');
  return {
    async get(k){ try{ const s=await tx('readonly');
      return await new Promise(r=>{const q=s.get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});
    }catch(e){ return null; } },
    async set(k,v){ try{ const s=await tx('readwrite'); s.put(v,k); }catch(e){} },
  };
})();

async function fetchChapter(bookName,ch){
  const t=settings().translation;
  const key=`${t}|${bookName} ${ch}`;
  const hit=await IDB.get(key); if(hit) return hit;
  const ref=`${bookName} ${ch}`;
  let verses=null;
  try{
    const spec=TRANSLATIONS[t];
    if(t==='web'||spec.kind==='bibleapi'){
      const r=await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${t==='web'?'web':t}`);
      if(r.ok){ const d=await r.json();
        verses=(d.verses||[]).map(v=>[v.verse,(v.text||'').replace(/\s+/g,' ').trim()]); }
    }else if(spec.kind==='esv'){
      const k=settings().esvKey; if(!k) throw 0;
      const u=`https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(ref)}&include-headings=false&include-footnotes=false&include-short-copyright=false&include-passage-references=false`;
      const r=await fetch(u,{headers:{Authorization:'Token '+k}});
      if(r.ok){ const d=await r.json(); verses=parseNumbered(d.passages&&d.passages[0]||''); }
    }else if(spec.kind==='nlt'){
      const k=settings().nltKey; if(!k) throw 0;
      const r=await fetch(`https://api.nlt.to/api/passages?ref=${encodeURIComponent(ref)}&version=NLT&key=${k}`);
      if(r.ok){ let h=await r.text();
        h=h.replace(/<h2[\s\S]*?<\/h2>/g,'').replace(/<span class="vn">(\d+)<\/span>/g,'[$1] ');
        verses=parseNumbered(h.replace(/<[^>]+>/g,' ')); }
    }
  }catch(e){ verses=null; }
  if(!verses||!verses.length){
    // last resort: WEB through bible-api so the road never dead-ends
    try{ const r=await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=web`);
      if(r.ok){ const d=await r.json();
        verses=(d.verses||[]).map(v=>[v.verse,(v.text||'').replace(/\s+/g,' ').trim()]); } }catch(e){}
  }
  if(verses&&verses.length){ IDB.set(key,verses); return verses; }
  return null;
}
/* "[1] text [2] text" -> [[1,"text"],[2,"text"]] */
function parseNumbered(s){
  const out=[]; const parts=s.split(/\[(\d+)\]/).slice(1);
  for(let i=0;i<parts.length;i+=2){ const n=+parts[i], t=(parts[i+1]||'').replace(/\s+/g,' ').trim(); if(t) out.push([n,t]); }
  if(!out.length){ const t=s.replace(/\s+/g,' ').trim(); if(t) out.push([1,t]); }
  return out;
}

/* ============================================================
   THE PATH
   ============================================================ */
const STEP=112;              // vertical distance between milestones
const BANNER=104;            // height of a division banner (leaves room for the pilgrim)

function layout(){
  const rows=[]; let y=52, lastDiv=null;
  BIBLE.forEach(b=>{
    if(b.div!==lastDiv){ rows.push({type:'banner',div:b.div,y}); y+=BANNER; lastDiv=b.div; }
    rows.push({type:'book',b,y,x:Math.sin(b.i*0.62)*30});   // x = % offset from centre
    y+=STEP;
  });
  return {rows,height:y+40};
}

function renderJourney(){
  // two roads share this tab: the read-through, and the learning path
  if(window.Path && Path.mode()==='learn') return Path.render();
  const {rows,height}=layout();
  const cur=currentBook(), stop=nextStop();
  const pts=rows.filter(r=>r.type==='book');

  /* the road itself — one smooth SVG spline through every milestone */
  let d=`M ${50+pts[0].x} ${pts[0].y}`;
  for(let i=1;i<pts.length;i++){
    const p=pts[i-1], c=pts[i], my=(p.y+c.y)/2;
    d+=` C ${50+p.x} ${my}, ${50+c.x} ${my}, ${50+c.x} ${c.y}`;
  }

  const nodes=rows.map(r=>{
    if(r.type==='banner'){
      const dv=DIVISIONS[r.div];
      return `<div class="j-banner" style="top:${r.y}px;--glass:${dv.glass}">
        <b class="caps">${dv.label}</b><span>${dv.sub}</span></div>`;
    }
    const b=r.b, done=bookRead(b), pct=done/b.chapters;
    const state = done>=b.chapters ? 'done' : (b.i<=cur.i ? 'open' : 'locked');
    const deg=Math.round(pct*360);
    const mem=countMastered(bookVerses(b.name));      // verses hidden from this book
    return `<button class="j-node ${state}" data-book="${b.name}"
        style="top:${r.y}px;left:calc(50% + ${r.x}%);--deg:${deg}deg;--glass:${DIVISIONS[b.div].glass}">
        <span class="ring"></span>
        <span class="face">${done>=b.chapters?'✦':abbr(b.name)}</span>
        ${mem>0?`<span class="mem" title="verses memorized">✦${mem}</span>`:''}
        <span class="nm">${b.name}</span>
        ${state!=='locked'?`<span class="cnt">${done}/${b.chapters}</span>`:''}
      </button>`;
  }).join('');

  const pctAll=journeyPct();
  const memAll=masteredCount(), memTotal=MEMORY_VERSES.length;
  const memPct=memTotal?memAll/memTotal:0;
  const booksWithMem=BIBLE.filter(b=>countMastered(bookVerses(b.name))>0).length;
  $('#journey-body').innerHTML=`
    ${window.Path?Path.modeSwitch('read'):''}
    <p class="j-lede">Genesis to Revelation, one chapter at a time.</p>

    <div class="j-hero gc">
      <div class="j-track">
        <div class="j-track-h"><b class="caps">Read</b>
          <span>${chaptersRead()} of ${TOTAL_CHAPTERS} chapters · ${Math.round(pctAll*1000)/10}%</span></div>
        <div class="j-bar"><i style="width:${Math.max(pctAll*100,1.2)}%"></i></div>
      </div>
      <div class="j-track">
        <div class="j-track-h"><b class="caps">Memorized</b>
          <span>${memAll} of ${memTotal} verses · ${Math.round(memPct*1000)/10}%</span></div>
        <div class="j-bar mem"><i style="width:${Math.max(memPct*100,memAll?2:0)}%"></i></div>
      </div>
      <div class="j-hero-top">
        <div><b class="caps">${BIBLE.filter(b=>bookRead(b)>=b.chapters).length}</b><span>books finished</span></div>
        <div><b class="caps">${booksWithMem}</b><span>books touched</span></div>
        <div><b class="caps">${streakCount()}</b><span>day streak</span></div>
      </div>
      <div class="j-cta2">
        <button class="cta" id="jContinue">Read · ${stop.book.name} ${stop.ch}</button>
        <button class="cta ghost" id="jLearn">Memorize</button>
      </div>
    </div>

    <div class="j-path" style="height:${height}px">
      <svg class="j-road" viewBox="0 0 100 ${height}" preserveAspectRatio="none" aria-hidden="true">
        <path d="${d}" class="road-base"  vector-effect="non-scaling-stroke"/>
        <path d="${d}" class="road-inner" vector-effect="non-scaling-stroke"/>
      </svg>
      ${nodes}
      <div class="pilgrim" id="pilgrim"></div>
    </div>`;

  if(window.Path) Path.wireMode();
  $('#jContinue').onclick=()=>openChapter(stop.book.name,stop.ch);
  $('#jLearn').onclick=()=>{ if(window.Path) Path.setMode('learn'); else go('learn'); };
  $$('#journey-body .j-node').forEach(n=>n.onclick=()=>{
    if(n.classList.contains('locked')){ toast('Finish the road ahead of it first'); vibrate(12); return; }
    openBook(n.dataset.book);
  });
  placePilgrim(rows,cur);
}

/* the little guy with the cross, standing on the current milestone */
function placePilgrim(rows,cur){
  const row=rows.find(r=>r.type==='book'&&r.b.name===cur.name); if(!row) return;
  const p=$('#pilgrim'); if(!p) return;
  p.style.top=(row.y-10)+'px';   // level with the medallion, clear of the label above
  p.style.left=`calc(50% + ${row.x}% - 46px)`;   // left of the medallion so he
                                                 // doesn't cover the progress arc
  p.innerHTML=`<img src="assets/pilgrim.png" alt="" onerror="this.parentNode.innerHTML=PILGRIM_SVG">`;
  // scroll the road so he's in view
  requestAnimationFrame(()=>{
    const sc=$('#view-journey .scroll');
    const node=$(`#journey-body .j-node[data-book="${CSS.escape(cur.name)}"]`);
    if(sc&&node) sc.scrollTop=Math.max(0,node.offsetTop-sc.clientHeight*0.55);
  });
}

/* inline fallback so the path works before/without the art asset */
const PILGRIM_SVG=`
<svg viewBox="0 0 48 60" fill="none" aria-hidden="true">
  <g class="walk">
    <path d="M31 8 L31 44" stroke="#8a6d24" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M23 17 L39 17" stroke="#8a6d24" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M14 24c0-5 3-8 7-8s7 3 7 8l2 15c0 2-2 3-4 3h-10c-2 0-4-1-4-3z" fill="#e6c473"/>
    <path d="M14 24c0-5 3-8 7-8s7 3 7 8l1 7H13z" fill="#1c2a78" opacity=".55"/>
    <circle cx="21" cy="13" r="6" fill="#f6efdd"/>
    <path d="M15 13c0-4 3-7 6-7s6 3 6 7c0 1-1 2-2 2h-8c-1 0-2-1-2-2z" fill="#c79a3c"/>
    <path class="leg l" d="M18 42 L17 52" stroke="#f6efdd" stroke-width="3" stroke-linecap="round"/>
    <path class="leg r" d="M25 42 L27 52" stroke="#f6efdd" stroke-width="3" stroke-linecap="round"/>
  </g>
</svg>`;

/* ============================================================
   BOOK SHEET — the chapter stones
   ============================================================ */
function openBook(name){
  const b=BIBLE.find(x=>x.name===name); if(!b) return;
  const done=jRead()[b.name]||[];
  const chips=Array.from({length:b.chapters},(_,k)=>k+1).map(c=>
    `<button class="chip ${done.includes(c)?'on':''}" data-ch="${c}">${c}</button>`).join('');
  const vs=bookVerses(b.name);                       // deck verses from this book
  const mem=countMastered(vs);
  $('#bookSheet').innerHTML=`
    <div class="sheet-h">
      <div><h2 class="caps">${b.name}</h2>
        <small>${done.length} of ${b.chapters} chapters · ${DIVISIONS[b.div].label}</small></div>
      <button class="x" id="closeBook">×</button>
    </div>
    <div class="body">
      <div class="j-bar sm"><i style="width:${Math.max(done.length/b.chapters*100,1.5)}%"></i></div>
      <div class="chips">${chips}</div>
      ${done.length<b.chapters?`<button class="cta" id="bookNext">Read chapter ${(()=>{for(let c=1;c<=b.chapters;c++)if(!done.includes(c))return c;})()}</button>`:
        `<div class="j-finished caps">✦ Book complete</div>`}

      ${vs.length?`
        <div class="deck">
          <h3>Verses to hide from ${b.name}</h3>
          <div class="j-bar sm mem"><i style="width:${Math.max(mem/vs.length*100,mem?3:0)}%"></i></div>
          <p class="q-hint" style="margin:0 0 14px">${mem} of ${vs.length} memorized</p>
          ${vs.map(v=>vrow(v)).join('')}
          <div class="mode-row" style="margin-top:16px">
            <button class="cta ghost" id="bookLearn">
              ${mem>=vs.length?`Review ${b.name}`:`Memorize`}</button>
            <button class="cta ghost" id="bookCards">Flashcards</button>
          </div>
        </div>`:`
        <div class="deck"><h3>Verses to hide from ${b.name}</h3>
          <p class="q-hint">None from this book in the deck yet.</p></div>`}
    </div>`;
  $('#bookSheet').classList.add('open');
  $('#closeBook').onclick=()=>$('#bookSheet').classList.remove('open');
  $$('#bookSheet .chip').forEach(c=>c.onclick=()=>openChapter(b.name,+c.dataset.ch));
  const nx=$('#bookNext'); if(nx) nx.onclick=()=>{ for(let c=1;c<=b.chapters;c++) if(!done.includes(c)) return openChapter(b.name,c); };
  const bl=$('#bookLearn'); if(bl) bl.onclick=()=>startLesson({book:b.name});
  const bc=$('#bookCards'); if(bc) bc.onclick=()=>{ $('#bookSheet').classList.remove('open'); Cards.open({book:b.name}); };
}

/* ============================================================
   READER
   ============================================================ */
let RD=null;
async function openChapter(bookName,ch){
  const b=BIBLE.find(x=>x.name===bookName); if(!b) return;
  RD={book:bookName,ch};
  const el=$('#reader');
  el.classList.add('open');
  el.innerHTML=`<div class="rd-top">
      <button class="x" id="rdX" aria-label="Close">×</button>
      <div class="rd-ref caps">${bookName} ${ch}</div>
      <div class="rd-tx caps">${TRANSLATIONS[settings().translation].short}</div>
    </div>
    <div class="rd-body" id="rdBody"><div class="rd-load">Opening the scroll…</div></div>`;
  $('#rdX').onclick=closeReader;

  const verses=await fetchChapter(bookName,ch);
  if(!RD||RD.book!==bookName||RD.ch!==ch) return;      // user moved on
  const body=$('#rdBody');
  if(!verses){
    body.innerHTML=`<div class="rd-load">Couldn’t reach the text.<br><small>Go online once and this chapter is yours offline.</small></div>`;
    return;
  }
  const already=isChapterRead(bookName,ch);
  body.innerHTML=`
    <h1 class="rd-h caps">${bookName} ${ch}</h1>
    <div class="rd-text">${verses.map(([n,t])=>`<span class="v"><sup>${n}</sup>${t}</span> `).join('')}</div>
    <button class="cta ${already?'ghost':''}" id="rdDone">${already?'Read ✦ mark again':'Mark chapter read'}</button>
    <div class="rd-nav">
      ${ch>1?`<button class="ghost sm" data-go="${ch-1}">‹ ${ch-1}</button>`:'<span></span>'}
      ${ch<b.chapters?`<button class="ghost sm" data-go="${ch+1}">${ch+1} ›</button>`:'<span></span>'}
    </div>`;
  $('#rdDone').onclick=()=>{
    const fresh=markChapterRead(bookName,ch);
    vibrate(fresh?[10,40,10]:8);
    toast(fresh?'+12 XP · chapter kept':'Already on your road');
    if(ch<b.chapters) openChapter(bookName,ch+1);
    else { closeReader(); renderJourney(); }
  };
  $$('#rdBody .rd-nav button').forEach(x=>x.onclick=()=>openChapter(bookName,+x.dataset.go));
}
function closeReader(){ RD=null; $('#reader').classList.remove('open'); renderJourney(); refreshChrome(); }

window.PILGRIM_SVG=PILGRIM_SVG;   // the inline onerror fallback needs it on the global
window.Journey={render:renderJourney,open:openChapter,openBook,TOTAL_CHAPTERS,BIBLE,
  chaptersRead,journeyPct,currentBook,nextStop,markChapterRead,isChapterRead};
