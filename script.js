/* ════════════════════════════════════════════════
   AURORA DASHBOARD — script.js
   Multi-proxy sheet fetch · Skeleton loading
   Stat counters · Staggered cards · Toast system
   Auto-refresh · Arabic fuzzy column matching
   ════════════════════════════════════════════════ */

// ── DOM ──────────────────────────────────────────
const $ = id => document.getElementById(id);
const pageTitle        = $("pageTitle");
const pageSubtitle     = $("pageSubtitle");
const todayDateText    = $("todayDateText");
const lastUpdatedText  = $("lastUpdatedText");
const refreshBtn       = $("refreshBtn");
const tabsNav          = $("tabsNav");
const statsSection     = $("statsSection");
const pageContent      = $("pageContent");
const searchInput      = $("searchInput");
const dynamicFilter    = $("dynamicFilter");
const dynamicFilterBox = $("dynamicFilterBox");
const windowFilter     = $("windowFilter");
const windowFilterBox  = $("windowFilterBox");
const toastContainer   = $("toastContainer");
const evalTpl          = $("evaluationCardTemplate");
const eventTpl         = $("eventCardTemplate");

// ── TODAY ────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

// ── STATE ────────────────────────────────────────
const S = {
  current: window.APP_CONFIG?.defaultPage || "evaluations",
  cache: {},
  cacheTime: {},
  TTL: 5 * 60 * 1000
};
let autoTimer;

// ── TAB / STAT ICONS ─────────────────────────────
const TAB_ICONS = {
  evaluations:    "📋",
  generalEvents:  "📅",
  employeeEvents: "👤",
  birthdays:      "🎂"
};
const STAT_ICONS = {
  late:     "⚠️",
  today:    "📌",
  upcoming: "🗓️",
  total:    "👥",
  birthday: "🎂",
  event:    "📅"
};

// ════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════
function toast(msg, type = "info", ms = 4000) {
  const icons = { success:"✅", error:"❌", info:"ℹ️", warning:"⚠️" };
  const el = document.createElement("div");
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add("removing");
    el.addEventListener("animationend", () => el.remove(), { once: true });
  }, ms);
}

// ════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════
function norm(v) {
  return (v || "").toString().trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}
function hasVal(v) {
  const s = (v || "").toString().trim();
  return s !== "" && s !== "-" && s !== "—";
}
// Fuzzy Arabic column finder
function col(obj, keys) {
  for (const k of Object.keys(obj)) {
    const nk = norm(k);
    for (const c of keys) {
      if (nk === norm(c) || nk.includes(norm(c)) || norm(c).includes(nk))
        return obj[k];
    }
  }
  return "";
}

// ════════════════════════════════════════════════
// DATES
// ════════════════════════════════════════════════
function parseDate(v) {
  if (!v && v !== 0) return null;
  if (typeof v === "number") {
    const d = new Date(new Date(Date.UTC(1899,11,30)).getTime() + v * 86400000);
    d.setHours(0,0,0,0); return d;
  }
  const raw = String(v).trim(); if (!raw) return null;
  let m;
  if ((m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    const d = new Date(+m[1],+m[2]-1,+m[3]); d.setHours(0,0,0,0); return d;
  }
  if ((m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/))) {
    const yr = m[3].length===2 ? +`20${m[3]}` : +m[3];
    const d  = new Date(yr,+m[2]-1,+m[1]); d.setHours(0,0,0,0); return d;
  }
  const d = new Date(raw);
  if (!isNaN(d)) { d.setHours(0,0,0,0); return d; }
  return null;
}
function toIso(v) {
  const d = parseDate(v); if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function fmtAr(s) {
  const d = parseDate(s); if (!d) return "-";
  return new Intl.DateTimeFormat("ar-IQ",{year:"numeric",month:"long",day:"numeric"}).format(d);
}
function diff(from, to) {
  return Math.round((to - from) / 86400000);
}
function upcomingLabel(n) {
  if (n === 0) return "اليوم 🎉";
  if (n === 1) return "غداً";
  if (n === 2) return "بعد يومين";
  return `بعد ${n} أيام`;
}
function lateLabel(n) {
  const a = Math.abs(n);
  if (a === 1) return "متأخر يوم واحد";
  if (a === 2) return "متأخر يومين";
  return `متأخر ${a} أيام`;
}

// ════════════════════════════════════════════════
// CSV
// ════════════════════════════════════════════════
function parseLine(line) {
  const res=[]; let cur="",inQ=false;
  for (let i=0; i<line.length; i++) {
    const c=line[i], nx=line[i+1];
    if (c==='"') { if (inQ&&nx==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if (c===','&&!inQ) { res.push(cur); cur=""; }
    else cur+=c;
  }
  res.push(cur);
  return res.map(x=>x.trim());
}
function parseCsv(txt) {
  return txt.replace(/^\uFEFF/,"").split(/\r?\n/).filter(r=>r.trim()).map(parseLine);
}
function toObjs(rows) {
  if (!rows.length) return [];
  const heads = rows[0].map((h,i)=>h.trim()||`col_${i}`);
  return rows.slice(1).filter(r=>r.some(hasVal)).map(r=>{
    const o={}; heads.forEach((h,i)=>{ o[h]=r[i]??""; }); return o;
  });
}

// ════════════════════════════════════════════════
// FETCH WITH 3 PROXY FALLBACKS
// ════════════════════════════════════════════════
const PROXIES = [
  u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  u => u
];

async function fetchText(url) {
  let last;
  for (const px of PROXIES) {
    try {
      const r = await fetch(px(url), {
        cache: "no-store",
        signal: AbortSignal.timeout(10000)
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const t = await r.text();
      if (t.trim().length < 5) throw new Error("empty");
      return t;
    } catch(e) { last=e; }
  }
  throw last;
}

function csvUrl(sheetName) {
  const id = window.APP_CONFIG?.spreadsheetId;
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

// ════════════════════════════════════════════════
// DATA MAPPERS
// ════════════════════════════════════════════════
function mapEvals(rows) {
  return toObjs(rows).map(r => ({
    name:       col(r,["اسم الموظف","الاسم","name","الموظف"]),
    department: col(r,["القسم","department","الادارة","الوحدة"]) || "بدون قسم",
    hireDate:   toIso(col(r,["تاريخ المباشرة","تاريخ التعيين","hire date"])),
    evaluations: [
      {
        type:"التقييم الأول", key:"first",
        date:   toIso(col(r,["التقييم الاول","التقييم الأول","first evaluation","تاريخ التقييم الاول","تاريخ التقييم الأول"])),
        result: col(r,["نتيجة التقييم الاول","نتيجة الاول","نتيجة 1","النتيجة 1","result 1","نتيجة الأول","نتيجة التقييم الأول"])
      },
      {
        type:"التقييم الثاني", key:"second",
        date:   toIso(col(r,["التقييم الثاني","second evaluation","تاريخ التقييم الثاني"])),
        result: col(r,["نتيجة التقييم الثاني","نتيجة الثاني","نتيجة 2","النتيجة 2","result 2"])
      },
      {
        type:"التقييم الثالث", key:"third",
        date:   toIso(col(r,["التقييم الثالث","third evaluation","تاريخ التقييم الثالث"])),
        result: col(r,["نتيجة التقييم الثالث","نتيجة الثالث","نتيجة 3","النتيجة 3","result 3"])
      }
    ]
  })).filter(x=>hasVal(x.name));
}

function mapEvents(rows, pageKey) {
  const def = pageKey==="birthdays" ? "عيد ميلاد" :
              pageKey==="employeeEvents" ? "مناسبة موظف" : "مناسبة عامة";
  return toObjs(rows).map(r => ({
    title:      col(r,["عنوان المناسبة","المناسبة","العنوان","title","نوع المناسبة","event"]) || def,
    name:       col(r,["اسم الموظف","الاسم","name","الموظف"]),
    department: col(r,["القسم","department","الادارة","الوحدة"]),
    type:       col(r,["النوع","نوع المناسبة","type","التصنيف"]) || def,
    category:   col(r,["التصنيف","الفئة","category","الصنف"]),
    note:       col(r,["ملاحظة","ملاحظات","الملاحظات","note","notes","تعليق"]),
    date:       toIso(col(r,["التاريخ","تاريخ المناسبة","date","تاريخ الميلاد","birthday","تاريخ عيد الميلاد"]))
  })).filter(x=>hasVal(x.title)||hasVal(x.name));
}

// ════════════════════════════════════════════════
// LOAD (cache + fallback)
// ════════════════════════════════════════════════
async function load(pageKey, force=false) {
  const now = Date.now();
  if (!force && S.cache[pageKey] && (now - (S.cacheTime[pageKey]||0)) < S.TTL)
    return S.cache[pageKey];

  try {
    const cfg  = window.APP_CONFIG.pages[pageKey];
    const text = await fetchText(csvUrl(cfg.sheetName));
    const rows = parseCsv(text);
    const data = pageKey === "evaluations" ? mapEvals(rows) : mapEvents(rows, pageKey);
    if (data.length) {
      S.cache[pageKey] = data; S.cacheTime[pageKey] = now;
      updateUpdated(); return data;
    }
    throw new Error("empty data");
  } catch(e) {
    console.warn(`[${pageKey}]`, e.message);
    const fb = window.FALLBACK_DATA?.[pageKey] || [];
    if (fb.length) {
      toast("تم التحميل من البيانات الاحتياطية — تحقق من اتصالك أو صلاحيات الشيت", "warning", 6000);
      S.cache[pageKey] = fb; S.cacheTime[pageKey] = now; return fb;
    }
    toast("فشل تحميل البيانات ولا توجد بيانات احتياطية", "error");
    return [];
  }
}

// ════════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════════
function skelCard() {
  return `<div class="skel-card">
    <div class="skel" style="height:14px;width:60%;margin-bottom:8px"></div>
    <div class="skel" style="height:11px;width:40%"></div>
    <div class="skel" style="height:11px;width:30%;margin-top:14px"></div>
  </div>`;
}
function skelPanel() {
  return `<div class="skeleton-panel">
    <div class="skel" style="height:18px;width:50%;margin-bottom:18px"></div>
    ${skelCard()}${skelCard()}${skelCard()}
  </div>`;
}
function showSkeleton(cols=3) {
  statsSection.innerHTML = Array.from({length:4},()=>`
    <div class="skel-stat">
      <div class="skel" style="height:12px;width:35%;margin-bottom:14px"></div>
      <div class="skel" style="height:36px;width:55%"></div>
    </div>`).join("");
  pageContent.innerHTML = `
    <div class="skeleton-panels" style="grid-template-columns:repeat(${cols},1fr)">
      ${skelPanel()}${skelPanel()}${cols===3?skelPanel():""}
    </div>`;
}

// ════════════════════════════════════════════════
// STAT COUNTER ANIMATION
// ════════════════════════════════════════════════
function countUp(el, target, dur=700) {
  const t0 = performance.now();
  (function frame(now) {
    const p = Math.min((now-t0)/dur, 1);
    el.textContent = Math.round((1-Math.pow(1-p,3))*target);
    if (p < 1) requestAnimationFrame(frame);
    else el.textContent = target;
  })(t0);
}
function animStats() {
  statsSection.querySelectorAll("[data-n]").forEach(el =>
    countUp(el, parseInt(el.dataset.n,10)));
}

function mkStat(label, n, cls="", icon="") {
  return `<article class="stat-card ${cls}">
    ${icon ? `<span class="stat-icon">${icon}</span>` : ""}
    <span>${label}</span>
    <strong data-n="${n}">0</strong>
  </article>`;
}

// ════════════════════════════════════════════════
// PANELS
// ════════════════════════════════════════════════
function mkPanel(title, sub, id, cls="", count=null) {
  const badge = count!==null
    ? `<span class="panel-count">${count}</span>` : "";
  return `<section class="panel ${cls}">
    <div class="panel-head">
      <div class="panel-head-left"><h2>${title}</h2><p>${sub}</p></div>
      ${badge}
    </div>
    <div id="${id}" class="cards-list"></div>
  </section>`;
}
function empty(el, txt, icon="🔍") {
  el.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon}</span><span>${txt}</span></div>`;
}

// ════════════════════════════════════════════════
// EVAL CARD
// ════════════════════════════════════════════════
function evalBadge(k) { return k==="first"?"first":k==="second"?"second":"third"; }

function mkEvalCard(item, mode, i=0) {
  const n = evalTpl.content.cloneNode(true);
  const card = n.querySelector(".employee-card");
  card.style.animationDelay = `${i*55}ms`;
  n.querySelector(".employee-name").textContent = item.name || "-";
  n.querySelector(".employee-meta").textContent  = `${item.department} · ${item.type}`;
  const b = n.querySelector(".eval-type");
  b.textContent = item.type; b.classList.add(evalBadge(item.key));
  n.querySelector(".date-pill-text").textContent = fmtAr(item.date);
  const dl = n.querySelector(".days-left");
  if (mode==="late") {
    card.classList.add("is-late");
    dl.textContent = lateLabel(item.d); dl.classList.add("is-late");
  } else if (mode==="today") {
    dl.textContent = "مستحق اليوم ✔"; dl.classList.add("is-today");
  } else {
    dl.textContent = upcomingLabel(item.d);
  }
  return n;
}

// ════════════════════════════════════════════════
// EVENT CARD
// ════════════════════════════════════════════════
function mkEventCard(item, badgeCls, i=0) {
  const n = eventTpl.content.cloneNode(true);
  const card = n.querySelector(".event-card");
  card.style.animationDelay = `${i*55}ms`;
  const disp = item.title || item.name || "-";
  n.querySelector(".event-title").textContent = disp;
  const meta = [item.name, item.department, item.category, item.type]
    .filter(Boolean).filter(p=>p!==disp).join(" · ");
  n.querySelector(".event-meta").textContent = meta || "-";
  const b = n.querySelector(".event-badge");
  b.textContent = item.type||item.category||"مناسبة"; b.classList.add(badgeCls);
  const note = (item.note||"").trim();
  if (note) n.querySelector(".event-note").textContent = note;
  else n.querySelector(".event-body").style.display = "none";
  n.querySelector(".event-date").textContent = fmtAr(item.date);
  const df = diff(today, parseDate(item.date));
  const dl = n.querySelector(".event-days");
  if (df < 0) { card.classList.add("is-late"); dl.textContent=lateLabel(df); dl.classList.add("is-late"); }
  else if (df===0) { dl.textContent="اليوم 🎉"; dl.classList.add("is-today"); }
  else dl.textContent = upcomingLabel(df);
  return n;
}

// ════════════════════════════════════════════════
// FILTER DROPDOWN
// ════════════════════════════════════════════════
function fillFilter(opts, def) {
  const cur = dynamicFilter.value;
  dynamicFilter.innerHTML = `<option value="">${def}</option>`;
  opts.forEach(o => {
    const el = document.createElement("option");
    el.value = el.textContent = o;
    dynamicFilter.appendChild(el);
  });
  if ([...dynamicFilter.options].some(o=>o.value===cur)) dynamicFilter.value=cur;
}

// ════════════════════════════════════════════════
// EVALUATIONS PAGE
// ════════════════════════════════════════════════
function flatEvals(emps) {
  const items=[];
  emps.forEach(e=>{
    (e.evaluations||[]).forEach(ev=>{
      if (!ev.date) return;
      const dt = parseDate(ev.date); if (!dt) return;
      items.push({
        name: e.name, department: e.department||"بدون قسم",
        type: ev.type, key: ev.key,
        date: toIso(ev.date),
        completed: hasVal(ev.result),
        d: diff(today, dt)
      });
    });
  });
  return items.sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function renderEvals(emps) {
  const flat   = flatEvals(emps);
  const q      = norm(searchInput.value);
  const dept   = dynamicFilter.value;
  const maxD   = +windowFilter.value;
  const late=[],todayL=[],upcoming=[],names=new Set();

  flat.forEach(it=>{
    const tm = !q || norm(it.name).includes(q) || norm(it.department).includes(q);
    const dm = !dept || it.department===dept;
    if (!(tm&&dm)) return;
    names.add(it.name);
    if (it.completed) return;
    if      (it.d < 0)         late.push(it);
    else if (it.d === 0)       todayL.push(it);
    else if (it.d <= maxD)     upcoming.push(it);
  });

  const depts=[...new Set(emps.map(e=>e.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
  fillFilter(depts,"كل الأقسام");
  dynamicFilterBox.classList.remove("hidden");
  windowFilterBox.classList.remove("hidden");

  statsSection.innerHTML = [
    mkStat("التقييمات المتأخرة", late.length,    "stat-danger",  STAT_ICONS.late),
    mkStat("تقييمات اليوم",      todayL.length,  "stat-warning", STAT_ICONS.today),
    mkStat("التقييمات القادمة",  upcoming.length, "stat-blue",    STAT_ICONS.upcoming),
    mkStat("إجمالي الموظفين",    names.size||emps.length, "stat-green", STAT_ICONS.total)
  ].join("");
  animStats();

  pageContent.innerHTML = `<div class="panel-grid three-columns">
    ${mkPanel("⚠️ المتأخرة",   "تقييمات مضى وقتها ولم تُنجز",    "lL","late-panel",   late.length)}
    ${mkPanel("📌 اليوم",      "مستحق تقييمه اليوم",              "tL","urgent-panel", todayL.length)}
    ${mkPanel("🗓️ القادمة",   "مرتبة من الأقرب إلى الأبعد",      "uL","",             upcoming.length)}
  </div>`;

  const lL=$("lL"),tL=$("tL"),uL=$("uL");
  late.length    ? late.forEach((it,i)    =>lL.appendChild(mkEvalCard(it,"late",i)))    : empty(lL,"لا توجد تقييمات متأخرة — رائع! ✅","✅");
  todayL.length  ? todayL.forEach((it,i)  =>tL.appendChild(mkEvalCard(it,"today",i)))  : empty(tL,"لا توجد تقييمات اليوم","📭");
  upcoming.length? upcoming.forEach((it,i)=>uL.appendChild(mkEvalCard(it,"upcoming",i))): empty(uL,"لا توجد تقييمات في هذه الفترة","📭");
}

// ════════════════════════════════════════════════
// EVENTS PAGES
// ════════════════════════════════════════════════
function filterEvts(items, pageKey) {
  const q=norm(searchInput.value), sel=dynamicFilter.value;
  return items.filter(it=>{
    const hay=[it.title,it.name,it.department,it.type,it.category,it.note].map(norm).join(" ");
    const tm=!q||hay.includes(q);
    if (!sel) return tm;
    return tm && (pageKey==="generalEvents"
      ? (it.category===sel||it.type===sel)
      : it.department===sel);
  }).sort((a,b)=>new Date(a.date)-new Date(b.date));
}

function buckets(items) {
  const late=[],todayL=[],upcoming=[];
  items.forEach(it=>{
    const d=parseDate(it.date); if(!d) return;
    const n=diff(today,d);
    if (n<0) late.push(it); else if(n===0) todayL.push(it); else upcoming.push(it);
  });
  return {late,todayL,upcoming};
}

function renderEvents(items, pageKey) {
  const filtered = filterEvts(items, pageKey);
  const {late,todayL,upcoming} = buckets(filtered);

  if (pageKey==="generalEvents") {
    fillFilter([...new Set(items.flatMap(i=>[i.category,i.type]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")), "كل الفئات");
  } else {
    fillFilter([...new Set(items.map(i=>i.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar")), "كل الأقسام");
  }
  dynamicFilterBox.classList.remove("hidden");
  windowFilterBox.classList.add("hidden");

  const isBday = pageKey==="birthdays";
  const badge  = isBday ? "birthday" : pageKey==="employeeEvents" ? "employee" : "general";
  const stLbl  = isBday ? "إجمالي أعياد الميلاد" : "إجمالي المناسبات";
  const icon0  = isBday ? STAT_ICONS.birthday : STAT_ICONS.event;

  statsSection.innerHTML = [
    mkStat(stLbl,          filtered.length, "stat-blue",    icon0),
    mkStat("اليوم",        todayL.length,   "stat-warning", STAT_ICONS.today),
    mkStat("القادم",       upcoming.length, "stat-green",   STAT_ICONS.upcoming),
    mkStat("المتأخر",      late.length,     "stat-danger",  STAT_ICONS.late)
  ].join("");
  animStats();

  pageContent.innerHTML = `<div class="panel-grid three-columns">
    ${mkPanel("⚠️ المتأخر",  "كل ما مضى تاريخه",         "lE","late-panel",   late.length)}
    ${mkPanel("📌 اليوم",    "المستحق اليوم",              "tE","urgent-panel", todayL.length)}
    ${mkPanel("🗓️ القادم",  "مرتبة حسب الأقرب",          "uE","",             upcoming.length)}
  </div>`;

  const lE=$("lE"),tE=$("tE"),uE=$("uE");
  const emptyLate = isBday ? "لا توجد أعياد ميلاد متأخرة" : "لا توجد مناسبات متأخرة";
  late.length    ? late.forEach((it,i)    =>lE.appendChild(mkEventCard(it,badge,i)))    : empty(lE, emptyLate, "✅");
  todayL.length  ? todayL.forEach((it,i)  =>tE.appendChild(mkEventCard(it,badge,i)))  : empty(tE,"لا شيء اليوم","📭");
  upcoming.length? upcoming.forEach((it,i)=>uE.appendChild(mkEventCard(it,badge,i))): empty(uE,"لا توجد قادمات","📭");
}

// ════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════
function renderTabs() {
  tabsNav.innerHTML = Object.entries(window.APP_CONFIG.pages).map(([k,cfg])=>`
    <button class="tab-btn ${S.current===k?"active":""}" data-page="${k}">
      <span class="tab-icon">${TAB_ICONS[k]||"📄"}</span>${cfg.tabLabel}
    </button>`).join("");
  tabsNav.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
      if (S.current===btn.dataset.page) return;
      S.current=btn.dataset.page;
      dynamicFilter.value=""; searchInput.value="";
      renderPage();
    });
  });
}

// ════════════════════════════════════════════════
// LAST UPDATED
// ════════════════════════════════════════════════
function updateUpdated() {
  lastUpdatedText.textContent = new Intl.DateTimeFormat("ar-IQ",{
    hour:"2-digit", minute:"2-digit", second:"2-digit"
  }).format(new Date());
}

// ════════════════════════════════════════════════
// RENDER
// ════════════════════════════════════════════════
async function renderPage(force=false) {
  const cfg = window.APP_CONFIG.pages[S.current];
  pageTitle.textContent    = cfg.title;
  pageSubtitle.textContent = cfg.subtitle;
  searchInput.placeholder  = cfg.searchPlaceholder;
  renderTabs();

  const cols = S.current==="evaluations"||S.current!=="generalEvents" ? 3 : 2;
  showSkeleton(cols);
  refreshBtn.classList.add("loading");
  const data = await load(S.current, force);
  refreshBtn.classList.remove("loading");

  // Trigger re-animation
  pageContent.style.animation = "none";
  requestAnimationFrame(()=>{ pageContent.style.animation=""; });

  if (S.current==="evaluations") renderEvals(data);
  else renderEvents(data, S.current);
}

// ════════════════════════════════════════════════
// AUTO-REFRESH
// ════════════════════════════════════════════════
function startAutoRefresh() {
  clearInterval(autoTimer);
  autoTimer = setInterval(()=>{
    S.cache={}; S.cacheTime={};
    renderPage(true);
    toast("تم تحديث البيانات تلقائياً", "info", 2500);
  }, S.TTL);
}

// ════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════
function init() {
  todayDateText.textContent = new Intl.DateTimeFormat("ar-IQ",{
    weekday:"long", year:"numeric", month:"long", day:"numeric"
  }).format(today);

  let dbt;
  [searchInput, dynamicFilter, windowFilter].forEach(el=>{
    el.addEventListener("input",  ()=>{ clearTimeout(dbt); dbt=setTimeout(()=>renderPage(),280); });
    el.addEventListener("change", ()=>renderPage());
  });

  refreshBtn.addEventListener("click",()=>{
    S.cache={}; S.cacheTime={};
    renderPage(true);
    toast("جارٍ تحديث البيانات من Google Sheets...", "info", 2200);
  });

  startAutoRefresh();
  renderPage();
}

init();
