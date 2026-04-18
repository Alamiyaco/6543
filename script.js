/* ════════════════════════════════════════════════════
   MIDNIGHT COMMAND CENTER — script.js
   Sidebar nav · Particle canvas · Stat chips
   Multi-proxy sheet · Toast · Counter animation
   ════════════════════════════════════════════════════ */

// ── DOM ──────────────────────────────────────────────
const G = id => document.getElementById(id);
const pageTitle     = G("pageTitle");
const pageSubtitle  = G("pageSubtitle");
const phBadge       = G("phBadge");
const sidebarDate   = G("sidebarDate");
const lastUpdated   = G("lastUpdated");
const refreshBtn    = G("refreshBtn");
const refreshIcon   = G("refreshIcon");
const sidebarNav    = G("sidebarNav");
const statsSection  = G("statsSection");
const pageContent   = G("pageContent");
const searchInput   = G("searchInput");
const dynamicFilter = G("dynamicFilter");
const dynBox        = G("dynamicFilterBox");
const windowFilter  = G("windowFilter");
const winBox        = G("windowFilterBox");
const toastZone     = G("toastZone");
const evalTpl       = G("evalTpl");
const eventTpl      = G("eventTpl");

// ── TODAY ────────────────────────────────────────────
const TODAY = new Date();
TODAY.setHours(0,0,0,0);

// ── STATE ────────────────────────────────────────────
const S = {
  page: window.APP_CONFIG?.defaultPage || "evaluations",
  cache: {}, cacheAt: {}, TTL: 5*60*1000,
  counts: {}           // pageKey → { late, todayN, upcoming, total }
};
let autoT;

// ── NAV ICONS ────────────────────────────────────────
const PAGE_ICONS = {
  evaluations:    "📋", generalEvents: "📅",
  employeeEvents: "👤", birthdays:     "🎂"
};
const PAGE_EMOJIS = {
  generalEvents: "📅", employeeEvents: "🎉", birthdays: "🎂"
};

/* ════════════════════════════════════════════════════
   PARTICLES
   ════════════════════════════════════════════════════ */
(function initParticles() {
  const cv = G("particleCanvas");
  if (!cv) return;
  const ctx = cv.getContext("2d");
  let W, H, dots = [];

  function resize() {
    W = cv.width  = window.innerWidth;
    H = cv.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  function mkDot() {
    return {
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*.9+.2,
      vx:(Math.random()-.5)*.18, vy:(Math.random()-.5)*.18,
      a: Math.random()*.5+.1
    };
  }
  for (let i=0;i<90;i++) dots.push(mkDot());

  function draw() {
    ctx.clearRect(0,0,W,H);
    dots.forEach(d=>{
      ctx.beginPath();
      ctx.arc(d.x,d.y,d.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(140,160,255,${d.a})`;
      ctx.fill();
      d.x+=d.vx; d.y+=d.vy;
      if(d.x<0||d.x>W) d.vx*=-1;
      if(d.y<0||d.y>H) d.vy*=-1;
    });
    // Draw faint lines between nearby dots
    for(let i=0;i<dots.length;i++) for(let j=i+1;j<dots.length;j++){
      const dx=dots[i].x-dots[j].x, dy=dots[i].y-dots[j].y;
      const dist=Math.sqrt(dx*dx+dy*dy);
      if(dist<100){
        ctx.beginPath();
        ctx.moveTo(dots[i].x,dots[i].y);
        ctx.lineTo(dots[j].x,dots[j].y);
        ctx.strokeStyle=`rgba(99,102,241,${.12*(1-dist/100)})`;
        ctx.lineWidth=.5;
        ctx.stroke();
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ════════════════════════════════════════════════════
   TOAST
   ════════════════════════════════════════════════════ */
function toast(msg, type="info", ms=4000) {
  const ic = {success:"✅",error:"❌",info:"ℹ️",warn:"⚠️"};
  const el = document.createElement("div");
  el.className=`toast t-${type}`;
  el.innerHTML=`<span class="toast-ico">${ic[type]||"ℹ️"}</span><span>${msg}</span>`;
  toastZone.appendChild(el);
  setTimeout(()=>{
    el.classList.add("out");
    el.addEventListener("animationend",()=>el.remove(),{once:true});
  },ms);
}

/* ════════════════════════════════════════════════════
   TEXT HELPERS
   ════════════════════════════════════════════════════ */
function norm(v){
  return (v||"").toString().trim().toLowerCase()
    .replace(/\s+/g," ").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي");
}
function hasV(v){ const s=(v||"").toString().trim(); return s&&s!=="-"&&s!=="—"; }
function fcol(obj,keys){
  for(const k of Object.keys(obj)){
    const nk=norm(k);
    for(const c of keys) if(nk===norm(c)||nk.includes(norm(c))||norm(c).includes(nk)) return obj[k];
  }
  return "";
}
function initials(name){
  const words=(name||"").trim().split(/\s+/);
  if(!words.length) return "?";
  return words[0].charAt(0)+(words.length>1?words[words.length-1].charAt(0):"");
}

/* ════════════════════════════════════════════════════
   DATES
   ════════════════════════════════════════════════════ */
function pd(v){
  if(!v&&v!==0) return null;
  if(typeof v==="number"){
    const d=new Date(new Date(Date.UTC(1899,11,30)).getTime()+v*86400000);
    d.setHours(0,0,0,0); return d;
  }
  const raw=String(v).trim(); if(!raw) return null;
  let m;
  if((m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)))
    { const d=new Date(+m[1],+m[2]-1,+m[3]); d.setHours(0,0,0,0); return d; }
  if((m=raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)))
    { const yr=m[3].length===2?+`20${m[3]}`:+m[3]; const d=new Date(yr,+m[2]-1,+m[1]); d.setHours(0,0,0,0); return d; }
  const d=new Date(raw); if(!isNaN(d)){d.setHours(0,0,0,0);return d;} return null;
}
function toIso(v){ const d=pd(v); if(!d)return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function fmtAr(s){
  const d=pd(s); if(!d)return "-";
  return new Intl.DateTimeFormat("ar-IQ",{year:"numeric",month:"long",day:"numeric"}).format(d);
}
function dDiff(from,to){ return Math.round((to-from)/86400000); }
function upLbl(n){
  if(n===0) return "اليوم 🎉"; if(n===1) return "غداً"; if(n===2) return "بعد يومين";
  return `بعد ${n} أيام`;
}
function lateLbl(n){
  const a=Math.abs(n);
  if(a===1) return "متأخر يوم"; if(a===2) return "متأخر يومين";
  return `متأخر ${a} أيام`;
}

/* ════════════════════════════════════════════════════
   CSV
   ════════════════════════════════════════════════════ */
function parseLine(line){
  const r=[]; let cur="",inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i],nx=line[i+1];
    if(c==='"'){if(inQ&&nx==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){r.push(cur);cur="";}
    else cur+=c;
  }
  r.push(cur); return r.map(x=>x.trim());
}
function parseCsv(txt){
  return txt.replace(/^\uFEFF/,"").split(/\r?\n/).filter(r=>r.trim()).map(parseLine);
}
function toObjs(rows){
  if(!rows.length)return[];
  const heads=rows[0].map((h,i)=>h.trim()||`c${i}`);
  return rows.slice(1).filter(r=>r.some(hasV)).map(r=>{
    const o={}; heads.forEach((h,i)=>o[h]=r[i]??""); return o;
  });
}

/* ════════════════════════════════════════════════════
   FETCH + PROXIES
   ════════════════════════════════════════════════════ */
const PROXIES=[
  u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u=>`https://corsproxy.io/?${encodeURIComponent(u)}`,
  u=>u
];
async function fetchTxt(url){
  let last;
  for(const px of PROXIES){
    try{
      const r=await fetch(px(url),{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const t=await r.text();
      if(t.trim().length<5)throw new Error("empty");
      return t;
    }catch(e){last=e;}
  }
  throw last;
}
function csvUrl(sheetName){
  const id=window.APP_CONFIG?.spreadsheetId;
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

/* ════════════════════════════════════════════════════
   MAPPERS
   ════════════════════════════════════════════════════ */
function mapEvals(rows){
  return toObjs(rows).map(r=>({
    name:       fcol(r,["اسم الموظف","الاسم","name","الموظف"]),
    department: fcol(r,["القسم","department","الادارة","الوحدة"])||"بدون قسم",
    evaluations:[
      {type:"التقييم الأول",key:"first",
       date:toIso(fcol(r,["التقييم الاول","التقييم الأول","first evaluation","تاريخ التقييم الاول","تاريخ التقييم الأول"])),
       result:fcol(r,["نتيجة التقييم الاول","نتيجة الاول","نتيجة 1","النتيجة 1","result 1","نتيجة الأول","نتيجة التقييم الأول"])},
      {type:"التقييم الثاني",key:"second",
       date:toIso(fcol(r,["التقييم الثاني","second evaluation","تاريخ التقييم الثاني"])),
       result:fcol(r,["نتيجة التقييم الثاني","نتيجة الثاني","نتيجة 2","النتيجة 2","result 2"])},
      {type:"التقييم الثالث",key:"third",
       date:toIso(fcol(r,["التقييم الثالث","third evaluation","تاريخ التقييم الثالث"])),
       result:fcol(r,["نتيجة التقييم الثالث","نتيجة الثالث","نتيجة 3","النتيجة 3","result 3"])}
    ]
  })).filter(x=>hasV(x.name));
}
function mapEvts(rows,pageKey){
  const def=pageKey==="birthdays"?"عيد ميلاد":pageKey==="employeeEvents"?"مناسبة موظف":"مناسبة عامة";
  return toObjs(rows).map(r=>({
    title: fcol(r,["عنوان المناسبة","المناسبة","العنوان","title","نوع المناسبة","event"])||def,
    name:  fcol(r,["اسم الموظف","الاسم","name","الموظف"]),
    dept:  fcol(r,["القسم","department","الادارة","الوحدة"]),
    type:  fcol(r,["النوع","نوع المناسبة","type","التصنيف"])||def,
    cat:   fcol(r,["التصنيف","الفئة","category","الصنف"]),
    note:  fcol(r,["ملاحظة","ملاحظات","الملاحظات","note","notes","تعليق"]),
    date:  toIso(fcol(r,["التاريخ","تاريخ المناسبة","date","تاريخ الميلاد","birthday","تاريخ عيد الميلاد"]))
  })).filter(x=>hasV(x.title)||hasV(x.name));
}

/* ════════════════════════════════════════════════════
   LOAD (cache + fallback)
   ════════════════════════════════════════════════════ */
async function loadData(pageKey,force=false){
  const now=Date.now();
  if(!force&&S.cache[pageKey]&&(now-(S.cacheAt[pageKey]||0))<S.TTL) return S.cache[pageKey];
  try{
    const cfg=window.APP_CONFIG.pages[pageKey];
    const txt=await fetchTxt(csvUrl(cfg.sheetName));
    const rows=parseCsv(txt);
    const data=pageKey==="evaluations"?mapEvals(rows):mapEvts(rows,pageKey);
    if(data.length){ S.cache[pageKey]=data; S.cacheAt[pageKey]=now; markUpdated(); return data; }
    throw new Error("empty");
  }catch(e){
    console.warn(`[${pageKey}]`,e.message);
    const fb=window.FALLBACK_DATA?.[pageKey]||[];
    if(fb.length){
      toast("تم التحميل من البيانات الاحتياطية — تحقق من اتصالك أو صلاحيات الشيت","warn",5500);
      S.cache[pageKey]=fb; S.cacheAt[pageKey]=now; return fb;
    }
    toast("فشل تحميل البيانات","error"); return [];
  }
}

/* ════════════════════════════════════════════════════
   SKELETON
   ════════════════════════════════════════════════════ */
function skelKard(){
  return `<div class="skel-kard">
    <div class="sk" style="height:13px;width:55%;margin-bottom:8px"></div>
    <div class="sk" style="height:11px;width:38%"></div>
    <div class="sk" style="height:11px;width:28%;margin-top:14px"></div>
  </div>`;
}
function skelPanel(){
  return `<div class="skel-panel">
    <div class="sk" style="height:16px;width:45%;margin-bottom:20px"></div>
    ${skelKard()}${skelKard()}${skelKard()}
  </div>`;
}
function showSkel(cols=3){
  statsSection.innerHTML=`<div class="skel-stats">${Array.from({length:4},()=>`
    <div class="skel-chip">
      <div class="sk" style="height:11px;width:40%;margin-bottom:10px"></div>
      <div class="sk" style="height:32px;width:52%"></div>
    </div>`).join("")}</div>`;
  pageContent.innerHTML=`<div class="skel-panels" style="grid-template-columns:repeat(${cols},1fr)">
    ${skelPanel()}${skelPanel()}${cols===3?skelPanel():""}
  </div>`;
}

/* ════════════════════════════════════════════════════
   COUNTER ANIMATION
   ════════════════════════════════════════════════════ */
function countUp(el,n,ms=650){
  const t0=performance.now();
  (function f(now){
    const p=Math.min((now-t0)/ms,1);
    el.textContent=Math.round((1-Math.pow(1-p,3))*n);
    if(p<1)requestAnimationFrame(f); else el.textContent=n;
  })(t0);
}
function animateChips(){ statsSection.querySelectorAll("[data-n]").forEach(el=>countUp(el,+el.dataset.n)); }

/* ════════════════════════════════════════════════════
   STAT CHIP
   ════════════════════════════════════════════════════ */
function chip(label,n,cls,icon){
  return `<div class="sc ${cls}" style="animation-delay:${Math.random()*.15}s">
    <span class="sc-icon">${icon}</span>
    <span class="sc-label">${label}</span>
    <span class="sc-num" data-n="${n}">0</span>
  </div>`;
}

/* ════════════════════════════════════════════════════
   PANEL BUILDER
   ════════════════════════════════════════════════════ */
function panel(icon,title,sub,id,cls,count){
  return `<div class="panel ${cls}">
    <div class="ph">
      <div>
        <div class="ph-title"><span class="ph-title-icon">${icon}</span>${title}</div>
        <div class="ph-sub-text">${sub}</div>
      </div>
      <span class="ph-badge-num">${count}</span>
    </div>
    <div id="${id}" class="kards"></div>
  </div>`;
}
function empty(el,txt,ico="🔍"){
  el.innerHTML=`<div class="empty"><span class="empty-ico">${ico}</span><span>${txt}</span></div>`;
}

/* ════════════════════════════════════════════════════
   EVAL CARD
   ════════════════════════════════════════════════════ */
function badgeCls(k){ return k==="first"?"b-first":k==="second"?"b-second":"b-third"; }

function evalCard(item,mode,i){
  const n=evalTpl.content.cloneNode(true);
  const card=n.querySelector(".kard");
  card.style.animationDelay=`${i*50}ms`;
  if(mode==="late") card.classList.add("late");

  const av=n.querySelector(".kard-avatar");
  av.textContent=initials(item.name);
  n.querySelector(".kard-name").textContent=item.name||"-";
  n.querySelector(".kard-sub").textContent=`${item.dept} · ${item.type}`;

  const b=n.querySelector(".kard-badge");
  b.textContent=item.type; b.classList.add(badgeCls(item.key));

  n.querySelector(".kard-date-txt").textContent=fmtAr(item.date);
  const dl=n.querySelector(".kard-days");
  if(mode==="late"){   dl.textContent=lateLbl(item.d); dl.classList.add("is-late"); }
  else if(mode==="today"){ dl.textContent="مستحق اليوم ✔"; dl.classList.add("is-today"); }
  else dl.textContent=upLbl(item.d);
  return n;
}

/* ════════════════════════════════════════════════════
   EVENT CARD
   ════════════════════════════════════════════════════ */
function eBadgeCls(pageKey){ return pageKey==="birthdays"?"b-birthday":pageKey==="employeeEvents"?"b-employee":"b-general"; }

function evtCard(item,pageKey,i){
  const n=eventTpl.content.cloneNode(true);
  const card=n.querySelector(".kard");
  card.style.animationDelay=`${i*50}ms`;

  const df=dDiff(TODAY,pd(item.date));
  if(df<0) card.classList.add("late");

  const iw=n.querySelector(".kard-icon-wrap");
  iw.textContent=PAGE_EMOJIS[pageKey]||"📅";

  const disp=item.title||item.name||"-";
  n.querySelector(".kard-name").textContent=disp;
  const meta=[item.name,item.dept,item.cat,item.type].filter(Boolean).filter(p=>p!==disp).join(" · ");
  n.querySelector(".kard-sub").textContent=meta||"-";

  const b=n.querySelector(".kard-badge");
  b.textContent=item.type||item.cat||"مناسبة"; b.classList.add(eBadgeCls(pageKey));

  const note=(item.note||"").trim();
  if(note){ const nr=n.querySelector(".kard-note-row"); nr.style.display=""; n.querySelector(".kard-note").textContent=note; }

  n.querySelector(".kard-date-txt").textContent=fmtAr(item.date);
  const dl=n.querySelector(".kard-days");
  if(df<0){       dl.textContent=lateLbl(df);  dl.classList.add("is-late"); }
  else if(df===0){ dl.textContent="اليوم 🎉";  dl.classList.add("is-today"); }
  else            dl.textContent=upLbl(df);
  return n;
}

/* ════════════════════════════════════════════════════
   FILTER DROPDOWN
   ════════════════════════════════════════════════════ */
function fillFilt(opts,def){
  const cur=dynamicFilter.value;
  dynamicFilter.innerHTML=`<option value="">${def}</option>`;
  opts.forEach(o=>{ const el=document.createElement("option"); el.value=el.textContent=o; dynamicFilter.appendChild(el); });
  if([...dynamicFilter.options].some(o=>o.value===cur)) dynamicFilter.value=cur;
}

/* ════════════════════════════════════════════════════
   EVALUATIONS
   ════════════════════════════════════════════════════ */
function flatEvals(emps){
  const items=[];
  emps.forEach(e=>{
    (e.evaluations||[]).forEach(ev=>{
      if(!ev.date)return;
      const dt=pd(ev.date); if(!dt)return;
      items.push({
        name:e.name, dept:e.department||"بدون قسم",
        type:ev.type, key:ev.key, date:toIso(ev.date),
        done:hasV(ev.result), d:dDiff(TODAY,dt)
      });
    });
  });
  return items.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function renderEvals(emps){
  const flat=flatEvals(emps);
  const q=norm(searchInput.value), dept=dynamicFilter.value, maxD=+windowFilter.value;
  const late=[],tod=[],up=[],names=new Set();

  flat.forEach(it=>{
    const tm=!q||norm(it.name).includes(q)||norm(it.dept).includes(q);
    const dm=!dept||it.dept===dept;
    if(!(tm&&dm))return;
    names.add(it.name);
    if(it.done)return;
    if(it.d<0)      late.push(it);
    else if(it.d===0)tod.push(it);
    else if(it.d<=maxD)up.push(it);
  });

  const depts=[...new Set(emps.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
  fillFilt(depts,"كل الأقسام");
  dynBox.classList.remove("hidden"); winBox.classList.remove("hidden");

  S.counts[S.page]={late:late.length,todayN:tod.length,upcoming:up.length,total:names.size||emps.length};
  updateNavCounts();

  statsSection.innerHTML=
    chip("التقييمات المتأخرة", late.length, "sc-red",   "⚠️")+
    chip("مستحق اليوم",        tod.length,  "sc-amber", "📌")+
    chip("التقييمات القادمة",  up.length,   "sc-cyan",  "🗓️")+
    chip("إجمالي الموظفين",    names.size||emps.length, "sc-violet","👥");
  animateChips();

  pageContent.innerHTML=`<div class="panels col3">
    ${panel("⚠️","المتأخرة",  "تقييمات لم تُنجز في وقتها",     "lL","panel-red",   late.length)}
    ${panel("📌","اليوم",     "مستحق تقييمه اليوم",              "tL","panel-amber", tod.length)}
    ${panel("🗓️","القادمة",   "مرتبة من الأقرب للأبعد",         "uL","",            up.length)}
  </div>`;

  const lL=G("lL"),tL=G("tL"),uL=G("uL");
  late.length ? late.forEach((it,i)=>lL.appendChild(evalCard(it,"late",i)))    : empty(lL,"لا توجد تقييمات متأخرة — ممتاز!","✅");
  tod.length  ? tod.forEach((it,i) =>tL.appendChild(evalCard(it,"today",i)))   : empty(tL,"لا توجد تقييمات اليوم","📭");
  up.length   ? up.forEach((it,i)  =>uL.appendChild(evalCard(it,"upcoming",i))): empty(uL,"لا توجد تقييمات في هذه الفترة","📭");
}

/* ════════════════════════════════════════════════════
   EVENTS
   ════════════════════════════════════════════════════ */
function filtEvts(items,pageKey){
  const q=norm(searchInput.value),sel=dynamicFilter.value;
  return items.filter(it=>{
    const hay=[it.title,it.name,it.dept,it.type,it.cat,it.note].map(norm).join(" ");
    const tm=!q||hay.includes(q);
    if(!sel)return tm;
    return tm&&(pageKey==="generalEvents"?(it.cat===sel||it.type===sel):it.dept===sel);
  }).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function bucketsOf(items){
  const late=[],tod=[],up=[];
  items.forEach(it=>{
    const d=pd(it.date); if(!d)return;
    const n=dDiff(TODAY,d);
    if(n<0)late.push(it); else if(n===0)tod.push(it); else up.push(it);
  });
  return{late,tod,up};
}

function renderEvts(items,pageKey){
  const filt=filtEvts(items,pageKey);
  const{late,tod,up}=bucketsOf(filt);

  if(pageKey==="generalEvents")
    fillFilt([...new Set(items.flatMap(i=>[i.cat,i.type]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")),"كل الفئات");
  else
    fillFilt([...new Set(items.map(i=>i.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")),"كل الأقسام");
  dynBox.classList.remove("hidden"); winBox.classList.add("hidden");

  const isBday=pageKey==="birthdays";
  S.counts[S.page]={late:late.length,todayN:tod.length,upcoming:up.length,total:filt.length};
  updateNavCounts();

  statsSection.innerHTML=
    chip(isBday?"أعياد الميلاد":"إجمالي المناسبات", filt.length,  "sc-violet", isBday?"🎂":"📅")+
    chip("اليوم",   tod.length,  "sc-amber",  "📌")+
    chip("القادم",  up.length,   "sc-emerald","🗓️")+
    chip("المتأخر", late.length, "sc-red",    "⚠️");
  animateChips();

  const ico=isBday?"🎂":pageKey==="employeeEvents"?"🎉":"📅";
  pageContent.innerHTML=`<div class="panels col3">
    ${panel("⚠️","المتأخر",  "كل ما مضى تاريخه",     "lE","panel-red",   late.length)}
    ${panel("📌","اليوم",    "المستحق اليوم",          "tE","panel-amber", tod.length)}
    ${panel(ico,"القادم",   "مرتبة من الأقرب",        "uE","",            up.length)}
  </div>`;

  const lE=G("lE"),tE=G("tE"),uE=G("uE");
  const emL=isBday?"لا أعياد ميلاد متأخرة":"لا مناسبات متأخرة";
  late.length? late.forEach((it,i)=>lE.appendChild(evtCard(it,pageKey,i))): empty(lE,emL,"✅");
  tod.length ? tod.forEach((it,i) =>tE.appendChild(evtCard(it,pageKey,i))): empty(tE,"لا شيء اليوم","📭");
  up.length  ? up.forEach((it,i)  =>uE.appendChild(evtCard(it,pageKey,i))): empty(uE,"لا يوجد قادم حالياً","📭");
}

/* ════════════════════════════════════════════════════
   SIDEBAR NAV
   ════════════════════════════════════════════════════ */
function buildNav(){
  sidebarNav.innerHTML=Object.entries(window.APP_CONFIG.pages).map(([k,cfg])=>`
    <button class="nav-btn ${S.page===k?"active":""}" data-page="${k}">
      <span class="nav-icon">${PAGE_ICONS[k]||"📄"}</span>
      <span class="nav-label">${cfg.tabLabel}</span>
      <span class="nav-count" id="nc-${k}">${S.counts[k]?.late||""}</span>
    </button>`).join("");
  sidebarNav.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(S.page===btn.dataset.page)return;
      S.page=btn.dataset.page;
      dynamicFilter.value=""; searchInput.value="";
      render();
    });
  });
}
function updateNavCounts(){
  Object.entries(S.counts).forEach(([k,c])=>{
    const el=G(`nc-${k}`);
    if(!el)return;
    const n=c.late;
    el.textContent=n||"";
    el.style.background=n?"rgba(255,83,112,.15)":"";
    el.style.color=n?"#ff8a9a":"";
    el.style.borderColor=n?"rgba(255,83,112,.25)":"";
  });
}

/* ════════════════════════════════════════════════════
   MARK UPDATED
   ════════════════════════════════════════════════════ */
function markUpdated(){
  lastUpdated.textContent=new Intl.DateTimeFormat("ar-IQ",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date());
}

/* ════════════════════════════════════════════════════
   RENDER
   ════════════════════════════════════════════════════ */
async function render(force=false){
  const cfg=window.APP_CONFIG.pages[S.page];
  pageTitle.textContent   =cfg.title;
  pageSubtitle.textContent=cfg.subtitle;
  phBadge.textContent     =cfg.tabLabel;
  searchInput.placeholder =cfg.searchPlaceholder;
  buildNav();

  showSkel(3);
  refreshBtn.classList.add("loading");
  const data=await loadData(S.page,force);
  refreshBtn.classList.remove("loading");

  pageContent.style.animation="none";
  void pageContent.offsetHeight;
  pageContent.style.animation="";

  if(S.page==="evaluations") renderEvals(data);
  else renderEvts(data,S.page);
  buildNav(); // refresh counts
}

/* ════════════════════════════════════════════════════
   AUTO-REFRESH
   ════════════════════════════════════════════════════ */
function startAuto(){
  clearInterval(autoT);
  autoT=setInterval(()=>{
    S.cache={}; S.cacheAt={};
    render(true);
    toast("تم تحديث البيانات تلقائياً","info",2500);
  },S.TTL);
}

/* ════════════════════════════════════════════════════
   INIT
   ════════════════════════════════════════════════════ */
function init(){
  // Sidebar date
  sidebarDate.textContent=new Intl.DateTimeFormat("ar-IQ",{
    weekday:"long",month:"long",day:"numeric"
  }).format(TODAY);

  // Debounced search
  let dbt;
  [searchInput,dynamicFilter,windowFilter].forEach(el=>{
    el.addEventListener("input" ,()=>{clearTimeout(dbt);dbt=setTimeout(()=>render(),260);});
    el.addEventListener("change",()=>render());
  });

  refreshBtn.addEventListener("click",()=>{
    S.cache={}; S.cacheAt={};
    render(true);
    toast("جارٍ جلب البيانات من Google Sheets...","info",2200);
  });

  startAuto();
  render();
}

init();
