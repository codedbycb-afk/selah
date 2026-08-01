/* ============================================================
   Selah — app logic
   Device profiles · translations · SRS flashcards · tracker
   ============================================================ */
'use strict';
const $ = (s,r=document)=>r.querySelector(s);
const $$ = (s,r=document)=>[...r.querySelectorAll(s)];
const POOLMAP = Object.fromEntries(POOL);

/* ---------- dates ---------- */
const dayKey = (d=new Date())=>{ const z=new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
const addDays=(k,n)=>{ const d=new Date(k+"T00:00:00"); d.setDate(d.getDate()+n); return dayKey(d); };

/* ---------- storage (per-profile) ---------- */
const DB = {
  profiles:()=>JSON.parse(localStorage.getItem('selah.profiles')||'[]'),
  setProfiles:p=>localStorage.setItem('selah.profiles',JSON.stringify(p)),
  current:()=>localStorage.getItem('selah.current'),
  setCurrent:id=>localStorage.setItem('selah.current',id),
  profile:()=>DB.profiles().find(p=>p.id===DB.current())||null,
  k:key=>`selah.${DB.current()}.${key}`,
  get:(key,def)=>{ const v=localStorage.getItem(DB.k(key)); return v==null?def:JSON.parse(v); },
  set:(key,v)=>localStorage.setItem(DB.k(key),JSON.stringify(v)),
};
const defaultSettings={translation:'web',goal:30,esvKey:'',nltKey:''};
const settings=()=>Object.assign({},defaultSettings,DB.get('settings',{}));
const saveSettings=s=>DB.set('settings',s);

/* ---------- icons ---------- */
const IC={
  book:'<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/>',
  read:'<path d="M4 5c3 0 6 1 8 2 2-1 5-2 8-2v14c-3 0-6 1-8 2-2-1-5-2-8-2V5z"/><path d="M12 7v12"/>',
  learn:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M6 10v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',
  track:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
  heart:'<path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5.5 5.2 5.5c1.9 0 3.1 1.1 3.8 2.1.7-1 1.9-2.1 3.8-2.1C16 5.5 17.5 9 15.5 12.5 13 16.65 12 21 12 21z"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h8"/>',
  share:'<path d="M12 3v13M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
};
const svg=(p,cls='')=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const archSVG=`<svg viewBox="0 0 40 48" fill="none"><path d="M20 2C8 10 2 22 2 46H38C38 22 32 10 20 2Z" stroke="var(--gold)" stroke-width="1.2" opacity=".85"/><path d="M20 11C12 17 8 27 8 46H32C32 27 28 17 20 11Z" stroke="var(--gold)" stroke-width=".7" opacity=".4"/></svg>`;
const heartFill='<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.35-9.5-8.5C.5 9 2 5.5 5.2 5.5c1.9 0 3.1 1.1 3.8 2.1.7-1 1.9-2.1 3.8-2.1C16 5.5 17.5 9 15.5 12.5 13 16.65 12 21 12 21z"/></svg>';

/* ---------- jewel fields (stained glass) ---------- */
const FIELDS=[
 {field:"linear-gradient(165deg,#0c1440 0%,#1c2a78 55%,#0a0f30 100%)",glow:"rgba(90,130,255,.5)"},   // sapphire
 {field:"linear-gradient(165deg,#3a0a14 0%,#7d1826 55%,#2a060d 100%)",glow:"rgba(255,120,120,.42)"},  // ruby
 {field:"linear-gradient(165deg,#052b1e 0%,#0f5a3f 55%,#03200f 100%)",glow:"rgba(90,230,170,.4)"},    // emerald
 {field:"linear-gradient(165deg,#1e0a3a 0%,#4a1c7a 55%,#150826 100%)",glow:"rgba(190,120,255,.42)"},   // amethyst
 {field:"linear-gradient(165deg,#3a1e02 0%,#8a4a0c 55%,#2a1300 100%)",glow:"rgba(255,180,90,.42)"},    // topaz
 {field:"linear-gradient(165deg,#04222e 0%,#0a5066 55%,#03151c 100%)",glow:"rgba(90,210,240,.4)"},     // aqua
 {field:"linear-gradient(165deg,#2a0620 0%,#6b1450 55%,#1c0416 100%)",glow:"rgba(255,120,210,.4)"},    // magenta rose
];

/* ============================================================
   TRANSLATIONS
   ============================================================ */
const TRANSLATIONS={
  web:{name:"World English",short:"WEB",kind:"bundled"},
  kjv:{name:"King James",short:"KJV",kind:"bibleapi"},
  esv:{name:"English Standard",short:"ESV",kind:"esv",needsKey:true,signup:"https://api.esv.org/"},
  nlt:{name:"New Living",short:"NLT",kind:"nlt",needsKey:true,signup:"https://api.nlt.to/"},
};
const txCache=k=>localStorage.getItem('selah.tx.'+k);
const txStore=(k,v)=>{ try{localStorage.setItem('selah.tx.'+k,v);}catch(e){} };

async function getText(ref,text /*web fallback*/){
  const t=settings().translation;
  if(t==='web') return text;
  const ck=t+'|'+ref; const c=txCache(ck); if(c) return c;
  let out=null;
  try{
    const spec=TRANSLATIONS[t];
    if(spec.kind==='bibleapi'){
      const r=await fetch(`https://bible-api.com/${encodeURIComponent(ref)}?translation=${t}`);
      if(r.ok){ const d=await r.json(); out=(d.text||'').replace(/\s+/g,' ').trim(); }
    }else if(spec.kind==='esv'){
      const key=settings().esvKey; if(!key) return text;
      const u=`https://api.esv.org/v3/passage/text/?q=${encodeURIComponent(ref)}&include-headings=false&include-footnotes=false&include-verse-numbers=false&include-short-copyright=false&include-passage-references=false`;
      const r=await fetch(u,{headers:{Authorization:'Token '+key}});
      if(r.ok){ const d=await r.json(); out=(d.passages&&d.passages[0]||'').replace(/\s+/g,' ').trim(); }
    }else if(spec.kind==='nlt'){
      const key=settings().nltKey; if(!key) return text;
      const r=await fetch(`https://api.nlt.to/api/passages?ref=${encodeURIComponent(ref)}&version=NLT&key=${key}`);
      if(r.ok){ let h=await r.text();
        h=h.replace(/<h2[\s\S]*?<\/h2>/g,'').replace(/<span class="vn">.*?<\/span>/g,'');
        out=h.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
    }
  }catch(e){ out=null; }
  if(out && out.length>4){ txStore(ck,out); return out; }
  return text; // graceful fallback to WEB
}

/* ============================================================
   FEED (Read)
   ============================================================ */
const feed=$('#feed');
let deck=[], served=0, recent=new Set(), hintGone=false;
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
function nextVerse(){
  if(deck.length<3) deck=deck.concat(shuffle(POOL));
  let v=deck.shift(),g=0;
  while(recent.has(v[0])&&deck.length>4&&g++<8){deck.push(v);v=deck.shift();}
  recent.add(v[0]); if(recent.size>18) recent=new Set([...recent].slice(-12));
  return v;
}
const savedList=()=>DB.get('saved',[]);
const isSaved=ref=>savedList().some(s=>s[0]===ref);

function makePane(ref,text){
  const el=document.createElement('article'); el.className='pane';
  const f=FIELDS[served%FIELDS.length];
  el.style.setProperty('--field',f.field); el.style.setProperty('--glow',f.glow);
  el.dataset.ref=ref; el.dataset.web=text;
  const first=text.charAt(0), rest=text.slice(1);
  el.innerHTML=`
    <div class="field"></div><div class="lead"></div><div class="frost"></div>
    <div class="content">
      <div class="arch">${archSVG}<span class="ref caps">${ref}</span></div>
      <p class="verse"><span class="drop">${first}</span>${rest}</p>
      <p class="trans caps">${TRANSLATIONS[settings().translation].name}</p>
    </div>
    <div class="rail">
      <button class="save ${isSaved(ref)?'on':''}" aria-label="Keep">${svg(IC.heart)}<span class="lab">Keep</span></button>
      <button class="copy" aria-label="Copy">${svg(IC.copy)}<span class="lab">Copy</span></button>
      <button class="share" aria-label="Share">${svg(IC.share)}<span class="lab">Share</span></button>
    </div>`;
  el.querySelector('.save').onclick=e=>toggleSave(ref,el.dataset.text||text,e.currentTarget);
  el.querySelector('.copy').onclick=e=>{copyVerse(ref,el.dataset.text||text);burst(e.currentTarget);};
  el.querySelector('.share').onclick=e=>{shareVerse(ref,el.dataset.text||text);burst(e.currentTarget);};
  // translation swap (async)
  if(settings().translation!=='web'){
    getText(ref,text).then(t=>{ el.dataset.text=t; const v=el.querySelector('.verse');
      v.innerHTML=`<span class="drop">${t.charAt(0)}</span>${t.slice(1)}`; });
  }else el.dataset.text=text;
  served++; return el;
}
function appendBatch(n=4){ for(let i=0;i<n;i++){const[r,t]=nextVerse();feed.appendChild(makePane(r,t));} }

const io=new IntersectionObserver(es=>{es.forEach(en=>{
  if(en.isIntersecting&&en.intersectionRatio>0.6){
    en.target.classList.add('live');
    const cards=[...feed.children];
    if(cards.indexOf(en.target)>=cards.length-3){ appendBatch(4); }
    if(!en.target.dataset.counted){ en.target.dataset.counted='1'; if(served>1) logRead(); }
    if(served>1) hideHint();
  }
});},{root:feed,threshold:[0.6]});
new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(n=>{if(n.nodeType===1)io.observe(n);}))).observe(feed,{childList:true});

function rebuildFeed(){ feed.innerHTML=''; served=0; deck=[]; recent=new Set(); appendBatch(5);
  requestAnimationFrame(()=>feed.firstElementChild?.classList.add('live')); }

/* ---------- feed actions ---------- */
function toggleSave(ref,text,btn){
  const s=savedList(); const i=s.findIndex(x=>x[0]===ref);
  if(i>=0){s.splice(i,1);btn?.classList.remove('on');toast('Removed');}
  else{s.unshift([ref,text]);btn?.classList.add('on');burst(btn);toast('Kept');}
  DB.set('saved',s); vibrate(8);
}
async function copyVerse(ref,text){ try{await navigator.clipboard.writeText(`“${text}”\n— ${ref} (${TRANSLATIONS[settings().translation].short})`);toast('Copied');}catch{toast('Copy unavailable');} }
async function shareVerse(ref,text){ const s=`“${text}”\n— ${ref}`; if(navigator.share){try{await navigator.share({text:s,title:'Selah'});}catch{}}else copyVerse(ref,text); }
function burst(b){ if(!b)return; b.classList.add('burst'); setTimeout(()=>b.classList.remove('burst'),400); vibrate(6); }
function vibrate(n){ if(navigator.vibrate) navigator.vibrate(n); }
let toastT; function toast(m){ const el=$('#toast'); el.textContent=m; el.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),1400); }
function hideHint(){ if(hintGone)return; hintGone=true; const h=$('#hint'); if(h){h.style.opacity='0';setTimeout(()=>h.remove(),600);} }

/* ============================================================
   ACTIVITY / STATS
   ============================================================ */
const activity=()=>DB.get('activity',{});
function bump(kind,xp=0){
  const a=activity(); const k=dayKey(); const day=a[k]||{xp:0,read:0,lessons:0};
  if(kind==='read') day.read++;
  if(kind==='lesson') day.lessons++;
  day.xp+=xp; a[k]=day; DB.set('activity',a);
}
function logRead(){ bump('read',0); refreshChrome(); }
function streakCount(){
  const a=activity(); let k=dayKey(), n=0;
  if(!a[k]||!(a[k].read||a[k].lessons||a[k].xp)) k=addDays(k,-1); // allow yesterday to keep streak alive today
  while(a[k]&&(a[k].read||a[k].lessons||a[k].xp)){ n++; k=addDays(k,-1); }
  return n;
}
function longestStreak(){
  const a=activity(); const days=Object.keys(a).filter(d=>a[d].read||a[d].lessons||a[d].xp).sort();
  let best=0,run=0,prev=null;
  days.forEach(d=>{ run=(prev&&addDays(prev,1)===d)?run+1:1; best=Math.max(best,run); prev=d; });
  return best;
}
const totalXP=()=>Object.values(activity()).reduce((s,d)=>s+(d.xp||0),0);
const totalRead=()=>Object.values(activity()).reduce((s,d)=>s+(d.read||0),0);
const todayXP=()=>{ const d=activity()[dayKey()]; return d?d.xp:0; };
const srsAll=()=>DB.get('srs',{});
const masteredCount=()=>Object.values(srsAll()).filter(c=>c.ivl>=21).length;
const learningCount=()=>Object.values(srsAll()).filter(c=>c.reps>0&&c.ivl<21).length;

/* ============================================================
   SRS
   ============================================================ */
function card(ref){ const s=srsAll(); return s[ref]||{ease:2.5,ivl:0,due:0,reps:0,lapses:0}; }
function saveCard(ref,c){ const s=srsAll(); s[ref]=c; DB.set('srs',s); }
function grade(ref,q){
  let c=card(ref); const now=Date.now();
  if(q==='again'){ c.reps=0; c.lapses++; c.ivl=0; c.ease=Math.max(1.3,c.ease-0.2); c.due=now; }
  else{
    c.reps++;
    if(q==='hard'){ c.ivl=Math.max(1,Math.round(c.ivl*1.2||1)); c.ease=Math.max(1.3,c.ease-0.15); }
    else if(q==='good'){ c.ivl=c.reps<=1?1:c.reps===2?3:Math.round(c.ivl*c.ease); }
    else{ c.ivl=Math.round((c.reps<=1?2:c.ivl*c.ease)*1.3); c.ease=Math.min(3,c.ease+0.1); }
    c.due=now+c.ivl*86400000;
  }
  saveCard(ref,c); return c;
}
function dueCards(){
  const now=Date.now();
  const due=MEMORY_VERSES.filter(v=>{const c=card(v.ref);return c.reps>0&&c.due<=now;});
  const fresh=MEMORY_VERSES.filter(v=>card(v.ref).reps===0);
  return {due,fresh};
}
function verseText(v){ const t=settings().translation; return v[t]||v.web||v.kjv; }

/* ============================================================
   LESSON RUNNER
   ============================================================ */
let LS=null;
function startLesson(){
  const {due,fresh}=dueCards();
  let queue=[...due, ...fresh.slice(0,4)];
  if(queue.length===0) queue=shuffle(MEMORY_VERSES).slice(0,5); // practice
  queue=shuffle(queue).slice(0,8);
  LS={queue,idx:0,total:queue.length,xp:0,hearts:5,correct:0};
  $('#lesson').classList.add('open');
  renderQ();
}
function endLessonEarly(){ $('#lesson').classList.remove('open'); LS=null; }
function tokens(t){ return t.replace(/\s+/g,' ').trim().split(' '); }

function pickKind(v){
  const c=card(v.ref); const n=tokens(verseText(v)).length;
  if(c.reps===0) return n<=12?'order':'blank';
  if(c.reps<3) return n<=14?'blank':'recall';
  return Math.random()<0.5?'recall':'match';
}
function renderQ(){
  if(!LS) return;
  const prog=$('#lesson .progress i'); prog.style.width=(LS.idx/LS.total*100)+'%';
  $('#hearts-n').textContent=LS.hearts;
  const body=$('#lesson .lesson-body'), foot=$('#lesson .lesson-foot');
  foot.innerHTML='';
  if(LS.idx>=LS.total){ return finishLesson(); }
  const v=LS.queue[LS.idx]; const kind=pickKind(v); LS.kind=kind; LS.v=v;
  const txt=verseText(v);
  if(kind==='order') return qOrder(v,txt,body,foot);
  if(kind==='blank') return qBlank(v,txt,body,foot);
  if(kind==='match') return qMatch(v,txt,body,foot);
  return qRecall(v,txt,body,foot);
}
function nextQ(){ LS.idx++; renderQ(); }
function reward(q){ // apply SRS + xp
  grade(LS.v.ref,q);
  const gain=q==='again'?0:q==='hard'?8:q==='easy'?15:12;
  LS.xp+=gain; if(q!=='again') LS.correct++;
}
function showFeedback(good,answer){
  const fb=$('#feedback');
  fb.className='feedback show '+(good?'good':'bad');
  fb.innerHTML=good?`<b>Amen ✦</b><small>${LS.v.ref}</small>`:`<b>Not quite</b><small>${answer}</small>`;
}

/* --- order tiles --- */
function qOrder(v,txt,body,foot){
  const correct=tokens(txt);
  body.innerHTML=`<div class="q-kind">Arrange the verse</div><div class="q-ref caps">${v.ref}</div>
    <div class="answer-line" id="ans"></div><div class="bank" id="bank"></div>`;
  const bank=$('#bank',body), ans=$('#ans',body); const chosen=[];
  shuffle(correct.map((w,i)=>({w,i}))).forEach(o=>{
    const b=document.createElement('button'); b.className='tile'; b.textContent=o.w;
    b.onclick=()=>{ b.classList.add('used'); chosen.push({w:o.w,el:b});
      const t=document.createElement('button'); t.className='tile'; t.textContent=o.w;
      t.onclick=()=>{ t.remove(); b.classList.remove('used'); const k=chosen.findIndex(c=>c.el===b); if(k>=0)chosen.splice(k,1); check(); };
      ans.appendChild(t); check(); };
    bank.appendChild(b);
  });
  function check(){ if(chosen.length===correct.length){ submit(); } }
  function submit(){
    const good=chosen.map(c=>c.w).join(' ')===correct.join(' ');
    finalize(good, `“${txt}”`);
  }
  // allow submit via button if they want partial
  foot.innerHTML=`<div class="feedback" id="feedback"></div>`;
}
/* --- fill blanks --- */
function qBlank(v,txt,body,foot){
  const toks=tokens(txt);
  const idxs=toks.map((w,i)=>i).filter(i=>toks[i].replace(/[^A-Za-z’']/g,'').length>3);
  const blanks=shuffle(idxs).slice(0,Math.max(1,Math.min(3,Math.round(idxs.length*0.28)))).sort((a,b)=>a-b);
  const answers=blanks.map(i=>toks[i]);
  // distractors from other verses
  const pool=shuffle(MEMORY_VERSES.filter(m=>m.ref!==v.ref).flatMap(m=>tokens(verseText(m))).filter(w=>w.replace(/[^A-Za-z]/g,'').length>3));
  const bankWords=shuffle([...answers, ...pool.slice(0,3)]);
  let filled=0;
  const html=toks.map((w,i)=>blanks.includes(i)?`<span class="blank" data-b="${blanks.indexOf(i)}"></span>`:w).join(' ');
  body.innerHTML=`<div class="q-kind">Fill the blanks</div><div class="q-ref caps">${v.ref}</div>
    <div class="q-prompt">${html}</div><div class="bank" id="bank"></div>`;
  const bank=$('#bank',body);
  bankWords.forEach(w=>{ const b=document.createElement('button'); b.className='tile'; b.textContent=w;
    b.onclick=()=>{ const slot=$$('.blank',body).find(s=>!s.classList.contains('filled')); if(!slot)return;
      slot.textContent=w; slot.classList.add('filled'); slot.dataset.word=w; b.classList.add('used'); slot._tile=b; filled++;
      slot.onclick=()=>{ slot.textContent=''; slot.classList.remove('filled'); b.classList.remove('used'); filled--; slot.onclick=null; };
      if(filled===blanks.length){ const good=blanks.every((bi,k)=>$(`.blank[data-b="${k}"]`,body).dataset.word===answers[k]); finalize(good,`“${txt}”`); }
    };
    bank.appendChild(b);
  });
  foot.innerHTML=`<div class="feedback" id="feedback"></div>`;
}
/* --- reference match --- */
function qMatch(v,txt,body,foot){
  const others=shuffle(MEMORY_VERSES.filter(m=>m.ref!==v.ref)).slice(0,3).map(m=>m.ref);
  const opts=shuffle([v.ref,...others]);
  body.innerHTML=`<div class="q-kind">Which reference?</div>
    <div class="q-prompt">“${txt}”</div><div class="choices" id="ch"></div>`;
  const ch=$('#ch',body);
  opts.forEach(o=>{ const b=document.createElement('button'); b.className='choice caps'; b.textContent=o;
    b.onclick=()=>{ if(LS.locked)return; LS.locked=true;
      const good=o===v.ref; b.classList.add(good?'correct':'wrong');
      if(!good){ $$('.choice',ch).forEach(x=>{if(x.textContent===v.ref)x.classList.add('correct');}); }
      finalize(good, v.ref); };
    ch.appendChild(b);
  });
  LS.locked=false;
  foot.innerHTML=`<div class="feedback" id="feedback"></div>`;
}
/* --- recall + self-rate --- */
function qRecall(v,txt,body,foot){
  body.innerHTML=`<div class="q-kind">Recall from memory</div><div class="q-ref caps">${v.ref}</div>
    <p style="color:var(--ink-dim);font-size:1.15rem">Say it in your head, then reveal.</p>
    <div id="rev"></div>`;
  foot.innerHTML=`<button class="cta" id="revealBtn">Reveal</button>`;
  $('#revealBtn').onclick=()=>{
    $('#rev',body).innerHTML=`<div class="reveal">“${txt}”</div>`;
    foot.innerHTML=`<div class="rate">
      <button data-q="again">Again<small>blanked</small></button>
      <button data-q="hard">Hard<small>barely</small></button>
      <button data-q="good">Good<small>got it</small></button>
      <button data-q="easy">Easy<small>perfect</small></button></div>`;
    $$('.rate button',foot).forEach(b=>b.onclick=()=>{ reward(b.dataset.q); vibrate(8); nextQ(); });
  };
}
/* finalize auto-graded exercises */
function finalize(good,answer){
  showFeedback(good,answer);
  if(good){ reward('good'); vibrate(10); }
  else{ reward('again'); LS.hearts=Math.max(0,LS.hearts-1); $('#hearts-n').textContent=LS.hearts; vibrate([20,40,20]); }
  const foot=$('#lesson .lesson-foot');
  const btn=document.createElement('button'); btn.className='cta'; btn.style.marginTop='10px';
  btn.textContent=good?'Continue':'Got it';
  btn.onclick=nextQ; foot.appendChild(btn);
}
function finishLesson(){
  bump('lesson',LS.xp);
  const body=$('#lesson .lesson-body'), foot=$('#lesson .lesson-foot');
  $('#lesson .progress i').style.width='100%';
  const s=streakCount();
  body.innerHTML=`<div class="done-card">
    <div class="halo">✦</div><h2>Lesson complete</h2>
    <p>${LS.correct} of ${LS.total} from memory</p>
    <div class="done-stats">
      <div class="stat-chip"><div class="n">+${LS.xp}</div><div class="k">XP</div></div>
      <div class="stat-chip"><div class="n">${s}</div><div class="k">Day streak</div></div>
      <div class="stat-chip"><div class="n">${masteredCount()}</div><div class="k">Mastered</div></div>
    </div></div>`;
  foot.innerHTML=`<button class="cta" id="doneBtn">Done</button>`;
  $('#doneBtn').onclick=()=>{ $('#lesson').classList.remove('open'); LS=null; renderLearn(); refreshChrome(); };
  vibrate([10,40,10,40,20]);
}

/* ============================================================
   LEARN page
   ============================================================ */
function renderLearn(){
  const {due,fresh}=dueCards();
  const dueN=due.length, newN=Math.min(4,fresh.length);
  const goal=settings().goal, tXP=todayXP();
  const pct=Math.min(1,tXP/goal);
  const c=2*Math.PI*32;
  $('#learn-body').innerHTML=`
    <div class="page-h"><div class="eyebrow">Memorize</div><h1>Hide the Word</h1>
      <p>A few verses a day. Spaced so they actually stick.</p></div>
    <div class="goal-ring">
      <svg viewBox="0 0 74 74"><circle cx="37" cy="37" r="32" stroke="rgba(230,196,115,.14)" stroke-width="7" fill="none"/>
        <circle cx="37" cy="37" r="32" stroke="url(#gg)" stroke-width="7" fill="none" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" transform="rotate(-90 37 37)"/>
        <defs><linearGradient id="gg" x1="0" x2="1"><stop offset="0" stop-color="#c79a3c"/><stop offset="1" stop-color="#e6c473"/></linearGradient></defs></svg>
      <div class="t"><b>${tXP} / ${goal} XP today</b><span>${pct>=1?'Daily goal complete ✦':'Keep going'}</span></div>
    </div>
    <div class="streak-band">
      <div class="stat-chip"><div class="n">${streakCount()}</div><div class="k">Day streak</div></div>
      <div class="stat-chip"><div class="n">${dueN}</div><div class="k">Due now</div></div>
      <div class="stat-chip"><div class="n">${masteredCount()}</div><div class="k">Mastered</div></div>
    </div>
    <button class="cta" id="startBtn">${dueN+newN>0?`Start lesson · ${dueN+newN} cards`:'Practice'}</button>
    <div class="deck">
      <h3>Your verses</h3>
      ${MEMORY_VERSES.map(v=>{ const cc=card(v.ref); const st=cc.ivl>=21?'mastered':cc.reps>0?'learning':'';
        const due=cc.reps===0?'New':cc.ivl>=21?'Mastered':cc.due<=Date.now()?'Due':`${Math.ceil((cc.due-Date.now())/86400000)}d`;
        return `<div class="vrow"><span class="dot ${st}"></span><div class="r"><b>${v.ref}</b><span>${verseText(v)}</span></div><span class="due">${due}</span></div>`;
      }).join('')}
    </div>`;
  $('#startBtn').onclick=startLesson;
}

/* ============================================================
   TRACK page
   ============================================================ */
function renderTrack(){
  const goal=settings().goal, tXP=todayXP(), pct=Math.min(1,tXP/goal);
  const c=2*Math.PI*80;
  // heatmap last 91 days
  const a=activity(); const cells=[];
  let d=addDays(dayKey(),-90);
  for(let i=0;i<91;i++){ const day=a[d]; const x=day?(day.xp||0):0;
    const l=x>=goal?3:x>=goal*0.5?2:x>0||(day&&day.read)?1:0; cells.push(l); d=addDays(d,1); }
  $('#track-body').innerHTML=`
    <div class="page-h"><div class="eyebrow">Your walk</div><h1>Tracker</h1></div>
    <div class="big-ring"><div class="ring-wrap">
      <svg viewBox="0 0 190 190"><circle cx="95" cy="95" r="80" stroke="rgba(230,196,115,.12)" stroke-width="11" fill="none"/>
        <circle cx="95" cy="95" r="80" stroke="url(#gg2)" stroke-width="11" fill="none" stroke-linecap="round"
          stroke-dasharray="${c}" stroke-dashoffset="${c*(1-pct)}" transform="rotate(-90 95 95)"/>
        <defs><linearGradient id="gg2" x1="0" x2="1"><stop offset="0" stop-color="#c79a3c"/><stop offset="1" stop-color="#e6c473"/></linearGradient></defs></svg>
      <div class="center"><b>${streakCount()}</b><span>Day streak</span></div>
    </div></div>
    <div class="grid2">
      <div class="metric"><div class="n">${tXP}<small> / ${goal}</small></div><div class="k">XP today</div></div>
      <div class="metric"><div class="n">${totalXP()}</div><div class="k">Total XP</div></div>
      <div class="metric"><div class="n">${totalRead()}</div><div class="k">Verses read</div></div>
      <div class="metric"><div class="n">${masteredCount()}<small> / ${MEMORY_VERSES.length}</small></div><div class="k">Memorized</div></div>
      <div class="metric"><div class="n">${learningCount()}</div><div class="k">Learning</div></div>
      <div class="metric"><div class="n">${longestStreak()}</div><div class="k">Longest streak</div></div>
    </div>
    <div class="heat gc" style="padding:18px"><h3>Last 13 weeks</h3>
      <div class="heatgrid">${cells.map(l=>`<i data-l="${l}"></i>`).join('')}</div></div>`;
}

/* ============================================================
   ME / profile page
   ============================================================ */
function renderMe(){
  const p=DB.profile(); const s=settings();
  const txBtns=Object.entries(TRANSLATIONS).map(([id,t])=>
    `<button data-tx="${id}" class="${s.translation===id?'on':''}">${t.short}</button>`).join('');
  $('#me-body').innerHTML=`
    <div class="page-h" style="margin-bottom:18px"><div class="eyebrow">Account</div><h1>Me</h1></div>
    <div class="me-head"><div class="avatar">${p.avatar||p.name.charAt(0).toUpperCase()}</div>
      <div class="who"><b>${p.name}</b><span>${streakCount()}-day streak · ${masteredCount()} memorized</span></div></div>

    <div class="setting"><div class="lab"><b>Translation</b><span>ESV & NLT need a free key</span></div>
      <div class="seg" id="txseg">${txBtns}</div></div>
    <div id="keyNote"></div>
    <div class="setting"><div class="lab"><b>Daily goal</b><span>XP per day</span></div>
      <input type="number" id="goalIn" min="10" max="200" step="5" value="${s.goal}"></div>
    <div class="setting"><div class="lab"><b>PIN lock</b><span>${p.pin?'On':'Off'}</span></div>
      <button class="cta ghost sm" id="pinBtn" style="width:auto;padding:10px 16px">${p.pin?'Change':'Set PIN'}</button></div>

    <div style="margin-top:24px" class="link-row" id="switchP"><span>Switch profile</span><small>›</small></div>
    <div class="link-row" id="addP"><span>Add profile</span><small>›</small></div>
    <div class="link-row" id="signout"><span class="danger">Sign out</span><small>›</small></div>
    <p style="color:var(--ink-dim);font-size:.8rem;margin-top:26px;line-height:1.5">
      Selah · Scripture from the World English Bible (public domain). KJV via bible-api.com.
      ESV © Crossway, NLT © Tyndale — shown via their official free APIs with your key.</p>`;

  $$('#txseg button').forEach(b=>b.onclick=()=>{
    const id=b.dataset.tx; const t=TRANSLATIONS[id];
    if(t.needsKey && !(id==='esv'?s.esvKey:s.nltKey)){ askKey(id); return; }
    const ns=settings(); ns.translation=id; saveSettings(ns); renderMe(); rebuildFeed(); toast(t.short+' selected');
  });
  const note=$('#keyNote');
  if((s.translation==='esv'&&!s.esvKey)||(s.translation==='nlt'&&!s.nltKey)){
    note.innerHTML=`<p style="color:#e5b56b;font-size:.85rem;padding:8px 2px">Add your free key to use this translation.</p>`;
  }
  $('#goalIn').onchange=e=>{ const ns=settings(); ns.goal=Math.max(10,+e.target.value||30); saveSettings(ns); toast('Goal updated'); };
  $('#pinBtn').onclick=()=>setupPin();
  $('#switchP').onclick=()=>openProfilePicker();
  $('#addP').onclick=()=>startOnboarding(true);
  $('#signout').onclick=()=>{ DB.setCurrent(''); location.reload(); };
}
function askKey(id){
  const t=TRANSLATIONS[id];
  const k=prompt(`Paste your free ${t.short} API key.\n\nGet one (2 min, free) at:\n${t.signup}\n\nLeave blank to cancel.`);
  if(k&&k.trim()){ const ns=settings(); if(id==='esv')ns.esvKey=k.trim(); else ns.nltKey=k.trim(); ns.translation=id; saveSettings(ns); renderMe(); rebuildFeed(); toast(t.short+' connected'); }
}

/* ============================================================
   NAV / router
   ============================================================ */
function go(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+view));
  $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.go===view));
  $('#topbar').style.display = view==='read'?'flex':'none';
  if(view==='learn')renderLearn();
  if(view==='track')renderTrack();
  if(view==='me')renderMe();
}
function refreshChrome(){ if($('#view-learn').classList.contains('active'))renderLearn();
  if($('#view-track').classList.contains('active'))renderTrack(); }

/* ============================================================
   SAVED drawer
   ============================================================ */
function openSaved(){
  const s=savedList(); const list=$('#savedList');
  list.innerHTML = s.length? s.map((v,i)=>`<div class="saved-item"><div class="r">${v[0]}</div><div class="t">“${v[1]}”</div><button data-i="${i}">Remove</button></div>`).join('')
    : `<div class="empty"><b>Nothing kept yet</b>Tap Keep on a verse and it waits for you here.</div>`;
  $$('#savedList button[data-i]').forEach(b=>b.onclick=()=>{ const s2=savedList(); s2.splice(+b.dataset.i,1); DB.set('saved',s2); openSaved(); });
  $('#sheet').classList.add('open');
}

/* ============================================================
   GATES — onboarding, profile picker, PIN lock
   ============================================================ */
const AVATARS=['✝','✦','☩','🕊','⛪','📖','🌿','☀','⭐','🔥','🍞','👑'];
function startOnboarding(adding){
  const gate=$('#gate'); let name='', avatar=AVATARS[0];
  gate.innerHTML=`<div class="mark caps">SELAH</div><h2>${adding?'Add profile':'Welcome'}</h2>
    <p>${adding?'Create another profile on this device.':'Set up your profile. Everything stays on your phone.'}</p>
    <input class="tf" id="nm" placeholder="Your name" maxlength="18" autocomplete="off">
    <div class="avatar-pick" id="ap">${AVATARS.map((a,i)=>`<button data-a="${a}" class="${i===0?'on':''}">${a}</button>`).join('')}</div>
    <button class="cta" id="createBtn" style="width:min(320px,80vw)">Create profile</button>
    ${adding?'<button class="cta ghost sm" id="cancelBtn" style="width:auto;padding:10px 18px;margin-top:14px">Cancel</button>':''}`;
  gate.classList.add('open');
  $('#nm').oninput=e=>name=e.target.value.trim();
  $$('#ap button').forEach(b=>b.onclick=()=>{ $$('#ap button').forEach(x=>x.classList.remove('on')); b.classList.add('on'); avatar=b.dataset.a; });
  $('#createBtn').onclick=()=>{
    if(!name){ $('#nm').focus(); return; }
    const id='p'+Date.now(); const ps=DB.profiles(); ps.push({id,name,avatar,pin:null}); DB.setProfiles(ps); DB.setCurrent(id);
    gate.classList.remove('open'); bootApp();
  };
  if(adding)$('#cancelBtn').onclick=()=>{ gate.classList.remove('open'); };
}
function openProfilePicker(){
  const gate=$('#gate'); const ps=DB.profiles();
  gate.innerHTML=`<div class="mark caps">SELAH</div><h2>Who's reading?</h2><p>&nbsp;</p>
    <div class="profile-list">${ps.map(p=>`<button data-id="${p.id}"><span class="av">${p.avatar||p.name.charAt(0)}</span><b>${p.name}</b></button>`).join('')}</div>
    <button class="cta ghost sm" id="addNew" style="width:auto;padding:11px 20px">Add profile</button>`;
  gate.classList.add('open');
  $$('.profile-list button').forEach(b=>b.onclick=()=>{ const p=ps.find(x=>x.id===b.dataset.id);
    DB.setCurrent(p.id); if(p.pin){ gate.classList.remove('open'); lockScreen(p); } else { gate.classList.remove('open'); bootApp(); } });
  $('#addNew').onclick=()=>startOnboarding(true);
}
function hash(s){ let h=0; for(let i=0;i<s.length;i++){h=(h*31+s.charCodeAt(i))|0;} return ''+h; }
function setupPin(){
  const gate=$('#gate'); let pin='';
  gate.innerHTML=pinMarkup('Set a 4-digit PIN','This locks your profile on this device.');
  gate.classList.add('open');
  wirePad(d=>{ if(d==='del'){pin=pin.slice(0,-1);} else if(pin.length<4){pin+=d;} paintDots(pin.length);
    if(pin.length===4){ const p=DB.profile(); p.pin=hash(pin); const ps=DB.profiles(); const i=ps.findIndex(x=>x.id===p.id); ps[i]=p; DB.setProfiles(ps);
      setTimeout(()=>{ gate.classList.remove('open'); renderMe(); toast('PIN set'); },200); } });
}
function lockScreen(p){
  const gate=$('#gate'); let pin='';
  gate.innerHTML=pinMarkup(`Welcome back, ${p.name}`,'Enter your PIN');
  gate.classList.add('open');
  wirePad(d=>{ if(d==='del'){pin=pin.slice(0,-1);} else if(pin.length<4){pin+=d;} paintDots(pin.length);
    if(pin.length===4){ if(hash(pin)===p.pin){ setTimeout(()=>{gate.classList.remove('open');bootApp();},150); }
      else { vibrate([30,60,30]); const dots=$('#dots'); dots.animate([{transform:'translateX(-8px)'},{transform:'translateX(8px)'},{transform:'none'}],{duration:250}); pin=''; setTimeout(()=>paintDots(0),260); } } });
}
function pinMarkup(title,sub){ return `<div class="mark caps">SELAH</div><h2>${title}</h2><p>${sub}</p>
  <div class="pin-dots" id="dots"><i></i><i></i><i></i><i></i></div>
  <div class="keypad" id="pad">${[1,2,3,4,5,6,7,8,9].map(n=>`<button data-d="${n}">${n}</button>`).join('')}
    <button class="blank"></button><button data-d="0">0</button><button data-d="del">⌫</button></div>`; }
function paintDots(n){ $$('#dots i').forEach((d,i)=>d.classList.toggle('on',i<n)); }
function wirePad(cb){ $$('#pad button[data-d]').forEach(b=>b.onclick=()=>{vibrate(5);cb(b.dataset.d);}); }

/* ============================================================
   BOOT
   ============================================================ */
function bootApp(){
  $('#shell').style.display='block';
  rebuildFeed();
  go('read');
  refreshCount();
}
function refreshCount(){ /* saved count no longer shown as number; keep hook */ }

function init(){
  // wire chrome
  $('#openSaved').onclick=openSaved;
  $('#closeSaved').onclick=()=>$('#sheet').classList.remove('open');
  $('#lessonX').onclick=endLessonEarly;
  $$('.nav button').forEach(b=>b.onclick=()=>go(b.dataset.go));
  window.addEventListener('online',()=>{});

  const ps=DB.profiles(), cur=DB.current();
  if(!ps.length){ startOnboarding(false); return; }
  const p=ps.find(x=>x.id===cur);
  if(!p){ openProfilePicker(); return; }
  if(p.pin){ lockScreen(p); return; }
  bootApp();
}
init();
