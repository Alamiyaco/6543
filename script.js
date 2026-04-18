/* ═══════════════════════════════════════════════════════
   PREMIUM DASHBOARD — script.js
   ═══════════════════════════════════════════════════════ */

const G = id => document.getElementById(id);
const pageTitle  = G("pageTitle");
const pageSub    = G("pageSub");
const pageTag    = G("pageTag");
const sbDate     = G("sbDate");
const lastUpd    = G("lastUpd");
const refreshBtn = G("refreshBtn");
const refreshIco = G("refreshIco");
const sbNav      = G("sbNav");
const statChips  = G("statChips");
const pageContent= G("pageContent");
const searchInp  = G("searchInput");
const dynFilt    = G("dynFilt");
const dynFiltBox = G("dynFiltBox");
const winFilt    = G("winFilt");
const winFiltBox = G("winFiltBox");
const toastZone  = G("toastZone");

const TODAY = new Date(); TODAY.setHours(0,0,0,0);

const S = {
  page: window.APP_CONFIG?.defaultPage || "evaluations",
  cache:{}, cacheAt:{}, TTL:5*60*1000, counts:{}
};
let autoT;

const NAV_ICO = {evaluations:"📋",generalEvents:"📅",employeeEvents:"👤",birthdays:"🎂"};
const AV_COLORS = ["","av-rose","av-amber","av-cyan","av-green"];

/* ═══════════════════════════════════════════════════════
   CANVAS BACKGROUND
   ═══════════════════════════════════════════════════════ */
(function bgCanvas(){
  const cv = G("bgCanvas");
  if(!cv) return;
  const ctx = cv.getContext("2d");
  let W,H;
  const resize = ()=>{ W=cv.width=innerWidth; H=cv.height=innerHeight; };
  resize(); addEventListener("resize",resize);

  /* Slow gradient orbs */
  const orbs = [
    {x:.15,y:.05,r:.45,c:[99,102,241],s:0},
    {x:.85,y:.85,r:.38,c:[168,85,247],s:2},
    {x:.7, y:.1, r:.3, c:[34,211,238],s:5}
  ];

  /* Particles */
  const pts=[];
  for(let i=0;i<70;i++) pts.push({
    x:Math.random(),y:Math.random(),
    vx:(Math.random()-.5)*.0003,vy:(Math.random()-.5)*.0003,
    r:Math.random()*.7+.2,a:Math.random()*.4+.08
  });

  let t=0;
  function frame(){
    t+=.004;
    ctx.clearRect(0,0,W,H);

    /* Draw orbs */
    orbs.forEach(o=>{
      const ox=W*(o.x+.04*Math.sin(t*.4+o.s));
      const oy=H*(o.y+.03*Math.cos(t*.35+o.s));
      const gr=ctx.createRadialGradient(ox,oy,0,ox,oy,Math.min(W,H)*o.r);
      gr.addColorStop(0,`rgba(${o.c},0.13)`);
      gr.addColorStop(1,`rgba(${o.c},0)`);
      ctx.fillStyle=gr; ctx.beginPath();
      ctx.arc(ox,oy,Math.min(W,H)*o.r,0,Math.PI*2); ctx.fill();
    });

    /* Draw particles + connectors */
    const ax=pts.map(p=>({x:p.x*W,y:p.y*H,a:p.a}));
    pts.forEach((p,i)=>{
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0||p.x>1)p.vx*=-1; if(p.y<0||p.y>1)p.vy*=-1;
      ctx.beginPath();
      ctx.arc(p.x*W,p.y*H,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(148,163,220,${p.a})`;ctx.fill();
      for(let j=i+1;j<pts.length;j++){
        const dx=ax[i].x-ax[j].x, dy=ax[i].y-ax[j].y;
        const d=Math.sqrt(dx*dx+dy*dy);
        if(d<90){
          ctx.beginPath();ctx.moveTo(ax[i].x,ax[i].y);ctx.lineTo(ax[j].x,ax[j].y);
          ctx.strokeStyle=`rgba(99,102,241,${.1*(1-d/90)})`;
          ctx.lineWidth=.5;ctx.stroke();
        }
      }
    });
    requestAnimationFrame(frame);
  }
  frame();
})();

/* ═══════════════════════════════════════════════════════
   TOAST
   ═══════════════════════════════════════════════════════ */
function toast(msg,type="info",ms=4000){
  const ico={success:"✅",error:"❌",info:"ℹ️",warn:"⚠️"};
  const el=document.createElement("div");
  el.className=`toast t-${type}`;
  el.innerHTML=`<span class="t-ico">${ico[type]||"ℹ️"}</span><span>${msg}</span>`;
  toastZone.appendChild(el);
  setTimeout(()=>{ el.classList.add("out"); el.addEventListener("animationend",()=>el.remove(),{once:true}); },ms);
}

/* ═══════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════ */
function norm(v){ return(v||"").toString().trim().toLowerCase().replace(/\s+/g," ").replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي"); }
function hasV(v){ const s=(v||"").toString().trim(); return s&&s!=="-"&&s!=="—"; }
function fcol(obj,keys){
  for(const k of Object.keys(obj)){
    const nk=norm(k);
    for(const c of keys) if(nk===norm(c)||nk.includes(norm(c))||norm(c).includes(nk)) return obj[k];
  } return "";
}

/* Smart initials from Arabic name */
function initials(name){
  const w=(name||"").trim().split(/\s+/).filter(Boolean);
  if(!w.length) return "?";
  return (w[0][0]+(w.length>1?w[1][0]:"")).toUpperCase();
}

/* Pick avatar color based on name hash */
function avColor(name){
  let h=0; for(const c of name) h=(h*31+c.charCodeAt(0))&0xffff;
  return AV_COLORS[h%AV_COLORS.length];
}

/* ═══════════════════════════════════════════════════════
   DATES
   ═══════════════════════════════════════════════════════ */
function pd(v){
  if(!v&&v!==0)return null;
  if(typeof v==="number"){const d=new Date(new Date(Date.UTC(1899,11,30)).getTime()+v*86400000);d.setHours(0,0,0,0);return d;}
  const raw=String(v).trim(); if(!raw)return null;
  let m;
  if((m=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)))
    {const d=new Date(+m[1],+m[2]-1,+m[3]);d.setHours(0,0,0,0);return d;}
  if((m=raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/)))
    {const yr=m[3].length===2?+`20${m[3]}`:+m[3];const d=new Date(yr,+m[2]-1,+m[1]);d.setHours(0,0,0,0);return d;}
  const d=new Date(raw); if(!isNaN(d)){d.setHours(0,0,0,0);return d;} return null;
}
function toIso(v){const d=pd(v);if(!d)return null;return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function fmtAr(s){const d=pd(s);if(!d)return "-";return new Intl.DateTimeFormat("ar-IQ",{year:"numeric",month:"long",day:"numeric"}).format(d);}
function diff(a,b){return Math.round((b-a)/86400000);}
function upLbl(n){if(n===0)return"اليوم 🎉";if(n===1)return"غداً";if(n===2)return"بعد يومين";return`بعد ${n} أيام`;}
function lateLbl(n){const a=Math.abs(n);if(a===1)return"متأخر يوم";if(a===2)return"متأخر يومين";return`متأخر ${a} أيام`;}

/* ═══════════════════════════════════════════════════════
   CSV
   ═══════════════════════════════════════════════════════ */
function parseLine(l){
  const r=[];let cur="",inQ=false;
  for(let i=0;i<l.length;i++){
    const c=l[i],nx=l[i+1];
    if(c==='"'){if(inQ&&nx==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){r.push(cur);cur="";}else cur+=c;
  }
  r.push(cur);return r.map(x=>x.trim());
}
function parseCsv(txt){return txt.replace(/^\uFEFF/,"").split(/\r?\n/).filter(r=>r.trim()).map(parseLine);}
function toObjs(rows){
  if(!rows.length)return[];
  const heads=rows[0].map((h,i)=>h.trim()||`c${i}`);
  return rows.slice(1).filter(r=>r.some(hasV)).map(r=>{const o={};heads.forEach((h,i)=>o[h]=r[i]??"");return o;});
}

/* ═══════════════════════════════════════════════════════
   FETCH
   ═══════════════════════════════════════════════════════ */
const PROXIES=[u=>`https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,u=>`https://corsproxy.io/?${encodeURIComponent(u)}`,u=>u];
async function fetchTxt(url){
  let last;
  for(const px of PROXIES){
    try{const r=await fetch(px(url),{cache:"no-store",signal:AbortSignal.timeout(10000)});if(!r.ok)throw new Error(`HTTP${r.status}`);const t=await r.text();if(t.trim().length<5)throw new Error("empty");return t;}
    catch(e){last=e;}
  }
  throw last;
}
function csvUrl(sheet){const id=window.APP_CONFIG?.spreadsheetId;return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;}

/* ═══════════════════════════════════════════════════════
   MAPPERS
   ═══════════════════════════════════════════════════════ */
function mapEvals(rows){
  return toObjs(rows).map(r=>({
    name:fcol(r,["اسم الموظف","الاسم","name","الموظف"]),
    dept:fcol(r,["القسم","department","الادارة","الوحدة"])||"بدون قسم",
    evals:[
      {type:"التقييم الأول",key:"first",
       date:toIso(fcol(r,["التقييم الاول","التقييم الأول","first evaluation","تاريخ التقييم الاول","تاريخ التقييم الأول"])),
       result:fcol(r,["نتيجة التقييم الاول","نتيجة الاول","نتيجة 1","النتيجة 1","result 1","نتيجة الأول"])},
      {type:"التقييم الثاني",key:"second",
       date:toIso(fcol(r,["التقييم الثاني","second evaluation","تاريخ التقييم الثاني"])),
       result:fcol(r,["نتيجة التقييم الثاني","نتيجة الثاني","نتيجة 2","النتيجة 2","result 2"])},
      {type:"التقييم الثالث",key:"third",
       date:toIso(fcol(r,["التقييم الثالث","third evaluation","تاريخ التقييم الثالث"])),
       result:fcol(r,["نتيجة التقييم الثالث","نتيجة الثالث","نتيجة 3","النتيجة 3","result 3"])}
    ]
  })).filter(x=>hasV(x.name));
}
function mapEvts(rows,pk){
  const def=pk==="birthdays"?"عيد ميلاد":pk==="employeeEvents"?"مناسبة موظف":"مناسبة عامة";
  return toObjs(rows).map(r=>({
    title:fcol(r,["عنوان المناسبة","المناسبة","العنوان","title","نوع المناسبة","event"])||def,
    name: fcol(r,["اسم الموظف","الاسم","name","الموظف"]),
    dept: fcol(r,["القسم","department","الادارة","الوحدة"]),
    type: fcol(r,["النوع","نوع المناسبة","type","التصنيف"])||def,
    cat:  fcol(r,["التصنيف","الفئة","category","الصنف"]),
    note: fcol(r,["ملاحظة","ملاحظات","الملاحظات","note","notes","تعليق"]),
    date: toIso(fcol(r,["التاريخ","تاريخ المناسبة","date","تاريخ الميلاد","birthday","تاريخ عيد الميلاد"]))
  })).filter(x=>hasV(x.title)||hasV(x.name));
}

/* ═══════════════════════════════════════════════════════
   LOAD
   ═══════════════════════════════════════════════════════ */
async function loadData(pk,force=false){
  const now=Date.now();
  if(!force&&S.cache[pk]&&(now-(S.cacheAt[pk]||0))<S.TTL) return S.cache[pk];
  try{
    const cfg=window.APP_CONFIG.pages[pk];
    const txt=await fetchTxt(csvUrl(cfg.sheetName));
    const rows=parseCsv(txt);
    const data=pk==="evaluations"?mapEvals(rows):mapEvts(rows,pk);
    if(data.length){S.cache[pk]=data;S.cacheAt[pk]=now;markUpd();return data;}
    throw new Error("empty");
  }catch(e){
    console.warn(`[${pk}]`,e.message);
    const fb=window.FALLBACK_DATA?.[pk]||[];
    if(fb.length){toast("تم التحميل من البيانات الاحتياطية — تحقق من إعدادات الشيت","warn",5500);S.cache[pk]=fb;S.cacheAt[pk]=Date.now();return fb;}
    toast("فشل تحميل البيانات","error");return[];
  }
}

/* ═══════════════════════════════════════════════════════
   SKELETON
   ═══════════════════════════════════════════════════════ */
function skelCard(){return `<div class="skel-card">
  <div style="display:flex;gap:13px;align-items:center">
    <div class="sk" style="width:52px;height:52px;border-radius:16px;flex-shrink:0"></div>
    <div style="flex:1"><div class="sk" style="height:19px;width:58%;margin-bottom:8px"></div><div class="sk" style="height:13px;width:38%"></div></div>
    <div class="sk" style="width:80px;height:30px;border-radius:10px;flex-shrink:0"></div>
  </div>
  <div class="sk" style="height:12px;width:32%;margin-top:16px"></div>
</div>`;}
function skelPanel(){return `<div class="skel-panel"><div class="sk" style="height:17px;width:40%;margin-bottom:20px"></div>${skelCard()}${skelCard()}${skelCard()}</div>`;}
function showSkel(){
  statChips.innerHTML=`<div class="skel-chips">${Array.from({length:4},()=>`<div class="skel-chip"><div class="sk" style="height:11px;width:40%;margin-bottom:10px"></div><div class="sk" style="height:34px;width:50%"></div></div>`).join("")}</div>`;
  pageContent.innerHTML=`<div class="skel-panels">${skelPanel()}${skelPanel()}${skelPanel()}</div>`;
}

/* ═══════════════════════════════════════════════════════
   COUNTER
   ═══════════════════════════════════════════════════════ */
function countUp(el,n,ms=700){
  const t0=performance.now();
  (function f(now){
    const p=Math.min((now-t0)/ms,1);
    el.textContent=Math.round((1-Math.pow(1-p,3))*n);
    if(p<1)requestAnimationFrame(f);else el.textContent=n;
  })(t0);
}
function animChips(){statChips.querySelectorAll("[data-n]").forEach(el=>countUp(el,+el.dataset.n));}

/* ═══════════════════════════════════════════════════════
   CHIP BUILDER
   ═══════════════════════════════════════════════════════ */
function chip(lbl,n,cls,ico,delay=0){
  return `<div class="chip ${cls}" style="animation-delay:${delay}s">
    <span class="chip-ico">${ico}</span>
    <span class="chip-lbl">${lbl}</span>
    <span class="chip-num" data-n="${n}">0</span>
  </div>`;
}

/* ═══════════════════════════════════════════════════════
   PANEL BUILDER
   ═══════════════════════════════════════════════════════ */
function panel(ico,title,desc,id,cls,count){
  return `<div class="panel ${cls}">
    <div class="pnl-hd">
      <div>
        <div class="pnl-title"><span class="pnl-icon">${ico}</span>${title}</div>
        <div class="pnl-desc">${desc}</div>
      </div>
      <span class="pnl-count">${count}</span>
    </div>
    <div id="${id}" class="card-list"></div>
  </div>`;
}
function empty(el,txt,ico="📭"){
  el.innerHTML=`<div class="empty"><span class="empty-ico">${ico}</span>${txt}</div>`;
}

/* ═══════════════════════════════════════════════════════
   EVAL CARD — big name, gradient avatar
   ═══════════════════════════════════════════════════════ */
function evalCard(item,mode,i){
  const avc=avColor(item.name);
  const typeClass=mode==="late"?"late":`type-${item.key}`;
  const badgeCls=item.key==="first"?"b-first":item.key==="second"?"b-second":"b-third";

  let daysPillCls="days-pill";
  let daysText="";
  if(mode==="late"){daysPillCls+=" is-late";daysText=lateLbl(item.d);}
  else if(mode==="today"){daysPillCls+=" is-today";daysText="اليوم ✔";}
  else daysText=upLbl(item.d);

  const div=document.createElement("div");
  div.className=`card ${typeClass}`;
  div.style.animationDelay=`${i*48}ms`;
  div.innerHTML=`<div class="card-inner">
    <div class="card-row1">
      <div class="av ${avc}">${initials(item.name)}</div>
      <div class="card-names">
        <div class="card-name">${item.name||"-"}</div>
        <div class="card-sub">
          <span>${item.dept}</span>
          <span class="card-sub-dot"></span>
          <span>${item.type}</span>
        </div>
      </div>
      <span class="badge ${badgeCls}">${item.type}</span>
    </div>
    <div class="card-footer">
      <div class="card-date">
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
          <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z"/>
        </svg>
        ${fmtAr(item.date)}
      </div>
      <span class="${daysPillCls}">${daysText}</span>
    </div>
  </div>`;
  return div;
}

/* ═══════════════════════════════════════════════════════
   EVENT CARD — emoji avatar, big name
   ═══════════════════════════════════════════════════════ */
const PKG_EMO={generalEvents:"📅",employeeEvents:"🎉",birthdays:"🎂"};

function evtCard(item,pk,i){
  const d=pd(item.date); const dn=d?diff(TODAY,d):0;
  const isLate=dn<0,isToday=dn===0;
  const cls=`card ${pk==="birthdays"?"type-birthday":pk==="employeeEvents"?"type-event":"type-event"}${isLate?" late":""}`;
  const badgeCls=pk==="birthdays"?"b-bday":pk==="employeeEvents"?"b-emp":"b-gen";
  const disp=item.title||item.name||"-";
  const meta=[item.name,item.dept,item.cat].filter(Boolean).filter(p=>p!==disp&&p!==item.type);

  let daysPillCls="days-pill",daysText="";
  if(isLate){daysPillCls+=" is-late";daysText=lateLbl(dn);}
  else if(isToday){daysPillCls+=" is-today";daysText="اليوم 🎉";}
  else daysText=upLbl(dn);

  const noteHtml=item.note?.trim()?`<div class="card-note-row">${item.note}</div>`:"";

  const div=document.createElement("div");
  div.className=cls;
  div.style.animationDelay=`${i*48}ms`;
  div.innerHTML=`<div class="card-inner">
    <div class="card-row1">
      <div class="av av-evt">${PKG_EMO[pk]||"📅"}</div>
      <div class="card-names">
        <div class="card-name">${disp}</div>
        <div class="card-sub">
          ${meta.length?`<span>${meta.join(" · ")}</span>`:`<span>${item.type||"-"}</span>`}
        </div>
      </div>
      <span class="badge ${badgeCls}">${item.type||item.cat||"مناسبة"}</span>
    </div>
    ${noteHtml}
    <div class="card-footer">
      <div class="card-date">
        <svg viewBox="0 0 20 20" fill="currentColor" width="13" height="13">
          <path d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z"/>
        </svg>
        ${fmtAr(item.date)}
      </div>
      <span class="${daysPillCls}">${daysText}</span>
    </div>
  </div>`;
  return div;
}

/* ═══════════════════════════════════════════════════════
   FILTER
   ═══════════════════════════════════════════════════════ */
function fillFilt(opts,def){
  const cur=dynFilt.value;
  dynFilt.innerHTML=`<option value="">${def}</option>`;
  opts.forEach(o=>{const el=document.createElement("option");el.value=el.textContent=o;dynFilt.appendChild(el);});
  if([...dynFilt.options].some(o=>o.value===cur))dynFilt.value=cur;
}

/* ═══════════════════════════════════════════════════════
   EVALUATIONS
   ═══════════════════════════════════════════════════════ */
function flatEvals(emps){
  const out=[];
  emps.forEach(e=>{ (e.evals||[]).forEach(ev=>{
    if(!ev.date)return; const dt=pd(ev.date); if(!dt)return;
    out.push({name:e.name,dept:e.dept||"بدون قسم",type:ev.type,key:ev.key,date:toIso(ev.date),done:hasV(ev.result),d:diff(TODAY,dt)});
  });});
  return out.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function renderEvals(emps){
  const flat=flatEvals(emps);
  const q=norm(searchInp.value),dept=dynFilt.value,maxD=+winFilt.value;
  const late=[],tod=[],up=[],names=new Set();
  flat.forEach(it=>{
    const tm=!q||norm(it.name).includes(q)||norm(it.dept).includes(q);
    const dm=!dept||it.dept===dept;
    if(!(tm&&dm))return;
    names.add(it.name);
    if(it.done)return;
    if(it.d<0)late.push(it);
    else if(it.d===0)tod.push(it);
    else if(it.d<=maxD)up.push(it);
  });
  fillFilt([...new Set(emps.map(e=>e.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")),"كل الأقسام");
  dynFiltBox.classList.remove("hidden");winFiltBox.classList.remove("hidden");
  S.counts[S.page]={late:late.length,todayN:tod.length,upcoming:up.length,total:names.size||emps.length};
  refreshNav();

  statChips.innerHTML=
    chip("التقييمات المتأخرة",late.length,"chip-red","⚠️",.0)+
    chip("مستحق اليوم",tod.length,"chip-amber","📌",.06)+
    chip("القادمة",up.length,"chip-cyan","🗓️",.12)+
    chip("إجمالي الموظفين",names.size||emps.length,"chip-purple","👥",.18);
  animChips();

  pageContent.innerHTML=`<div class="panels c3">
    ${panel("⚠️","المتأخرة","تقييمات لم تُنجز في وقتها","lL","panel-late",late.length)}
    ${panel("📌","اليوم","مستحق تقييمه اليوم","tL","panel-amber",tod.length)}
    ${panel("🗓️","القادمة","مرتبة من الأقرب للأبعد","uL","",up.length)}
  </div>`;

  const lL=G("lL"),tL=G("tL"),uL=G("uL");
  late.length?late.forEach((it,i)=>lL.appendChild(evalCard(it,"late",i))):empty(lL,"لا توجد تقييمات متأخرة ✅","✅");
  tod.length ?tod.forEach((it,i) =>tL.appendChild(evalCard(it,"today",i))):empty(tL,"لا توجد تقييمات اليوم");
  up.length  ?up.forEach((it,i)  =>uL.appendChild(evalCard(it,"upcoming",i))):empty(uL,"لا توجد تقييمات في هذه الفترة");
}

/* ═══════════════════════════════════════════════════════
   EVENTS
   ═══════════════════════════════════════════════════════ */
function filtEvts(items,pk){
  const q=norm(searchInp.value),sel=dynFilt.value;
  return items.filter(it=>{
    const hay=[it.title,it.name,it.dept,it.type,it.cat,it.note].map(norm).join(" ");
    const tm=!q||hay.includes(q);
    if(!sel)return tm;
    return tm&&(pk==="generalEvents"?(it.cat===sel||it.type===sel):it.dept===sel);
  }).sort((a,b)=>new Date(a.date)-new Date(b.date));
}
function buckets(items){
  const late=[],tod=[],up=[];
  items.forEach(it=>{const d=pd(it.date);if(!d)return;const n=diff(TODAY,d);if(n<0)late.push(it);else if(n===0)tod.push(it);else up.push(it);});
  return{late,tod,up};
}
function renderEvts(items,pk){
  const filt=filtEvts(items,pk);
  const{late,tod,up}=buckets(filt);
  if(pk==="generalEvents")
    fillFilt([...new Set(items.flatMap(i=>[i.cat,i.type]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")),"كل الفئات");
  else
    fillFilt([...new Set(items.map(i=>i.dept).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")),"كل الأقسام");
  dynFiltBox.classList.remove("hidden");winFiltBox.classList.add("hidden");

  const isBday=pk==="birthdays";
  S.counts[S.page]={late:late.length,todayN:tod.length,upcoming:up.length,total:filt.length};
  refreshNav();

  statChips.innerHTML=
    chip(isBday?"أعياد الميلاد":"إجمالي المناسبات",filt.length,"chip-purple",isBday?"🎂":"📅",.0)+
    chip("اليوم",tod.length,"chip-amber","📌",.06)+
    chip("القادم",up.length,"chip-green","🗓️",.12)+
    chip("المتأخر",late.length,"chip-red","⚠️",.18);
  animChips();

  const ico=isBday?"🎂":pk==="employeeEvents"?"🎉":"📅";
  pageContent.innerHTML=`<div class="panels c3">
    ${panel("⚠️","المتأخر","كل ما مضى تاريخه","lE","panel-late",late.length)}
    ${panel("📌","اليوم","المستحق اليوم","tE","panel-amber",tod.length)}
    ${panel(ico,"القادم","مرتبة من الأقرب","uE","",up.length)}
  </div>`;

  const lE=G("lE"),tE=G("tE"),uE=G("uE");
  late.length?late.forEach((it,i)=>lE.appendChild(evtCard(it,pk,i))):empty(lE,isBday?"لا أعياد ميلاد متأخرة":"لا مناسبات متأخرة","✅");
  tod.length ?tod.forEach((it,i) =>tE.appendChild(evtCard(it,pk,i))):empty(tE,"لا شيء اليوم");
  up.length  ?up.forEach((it,i)  =>uE.appendChild(evtCard(it,pk,i))):empty(uE,"لا يوجد قادم");
}

/* ═══════════════════════════════════════════════════════
   NAV
   ═══════════════════════════════════════════════════════ */
function buildNav(){
  sbNav.innerHTML=Object.entries(window.APP_CONFIG.pages).map(([k,cfg])=>{
    const c=S.counts[k]; const lateN=c?.late||0;
    return `<button class="nav-item ${S.page===k?"on":""}" data-page="${k}">
      <span class="ni">${NAV_ICO[k]||"📄"}</span>
      <span class="nl">${cfg.tabLabel}</span>
      <span class="nav-badge" id="nb-${k}" style="${lateN?"background:rgba(244,63,94,.15);color:#fb7185":""}">${lateN||""}</span>
    </button>`;
  }).join("");
  sbNav.querySelectorAll(".nav-item").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if(S.page===btn.dataset.page)return;
      S.page=btn.dataset.page;dynFilt.value="";searchInp.value="";render();
    });
  });
}
function refreshNav(){
  Object.entries(S.counts).forEach(([k,c])=>{
    const el=G(`nb-${k}`);if(!el)return;
    const n=c?.late||0;el.textContent=n||"";
    el.style.background=n?"rgba(244,63,94,.15)":"";
    el.style.color=n?"#fb7185":"";
  });
}

/* ═══════════════════════════════════════════════════════
   MARK UPDATED
   ═══════════════════════════════════════════════════════ */
function markUpd(){lastUpd.textContent=new Intl.DateTimeFormat("ar-IQ",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date());}

/* ═══════════════════════════════════════════════════════
   RENDER
   ═══════════════════════════════════════════════════════ */
async function render(force=false){
  const cfg=window.APP_CONFIG.pages[S.page];
  pageTitle.textContent=cfg.title;
  pageSub.textContent=cfg.subtitle;
  pageTag.textContent=cfg.tabLabel;
  searchInp.placeholder=cfg.searchPlaceholder;
  buildNav();showSkel();
  refreshBtn.classList.add("spin");
  const data=await loadData(S.page,force);
  refreshBtn.classList.remove("spin");
  pageContent.style.animation="none";void pageContent.offsetHeight;pageContent.style.animation="";
  if(S.page==="evaluations")renderEvals(data);
  else renderEvts(data,S.page);
  buildNav();
}

/* ═══════════════════════════════════════════════════════
   AUTO-REFRESH & INIT
   ═══════════════════════════════════════════════════════ */
function init(){
  sbDate.textContent=new Intl.DateTimeFormat("ar-IQ",{weekday:"long",month:"long",day:"numeric"}).format(TODAY);
  let dbt;
  [searchInp,dynFilt,winFilt].forEach(el=>{
    el.addEventListener("input",()=>{clearTimeout(dbt);dbt=setTimeout(()=>render(),260);});
    el.addEventListener("change",()=>render());
  });
  refreshBtn.addEventListener("click",()=>{S.cache={};S.cacheAt={};render(true);toast("جارٍ جلب البيانات...","info",2200);});
  clearInterval(autoT);
  autoT=setInterval(()=>{S.cache={};S.cacheAt={};render(true);toast("تم التحديث التلقائي","info",2200);},S.TTL);
  render();
}
init();
