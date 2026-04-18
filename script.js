/* ========================================================
   DASHBOARD — script.js (Enhanced)
   - Multi-proxy CORS fallback for Google Sheets
   - Skeleton loading screens
   - Toast notification system
   - Auto-refresh every 5 minutes
   - Animated stat counters
   - Staggered card animations
   - Smart Arabic column name matching
   ======================================================== */

// ─── DOM REFS ────────────────────────────────────────────
const pageTitle        = document.getElementById("pageTitle");
const pageSubtitle     = document.getElementById("pageSubtitle");
const todayDateText    = document.getElementById("todayDateText");
const lastUpdatedText  = document.getElementById("lastUpdatedText");
const refreshBtn       = document.getElementById("refreshBtn");
const tabsNav          = document.getElementById("tabsNav");
const statsSection     = document.getElementById("statsSection");
const pageContent      = document.getElementById("pageContent");
const searchInput      = document.getElementById("searchInput");
const dynamicFilter    = document.getElementById("dynamicFilter");
const dynamicFilterBox = document.getElementById("dynamicFilterBox");
const windowFilter     = document.getElementById("windowFilter");
const windowFilterBox  = document.getElementById("windowFilterBox");
const toastContainer   = document.getElementById("toastContainer");
const evalTpl          = document.getElementById("evaluationCardTemplate");
const eventTpl         = document.getElementById("eventCardTemplate");

// ─── TODAY ───────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

// ─── STATE ───────────────────────────────────────────────
const pageState = {
  current: window.APP_CONFIG?.defaultPage || "evaluations",
  cache: {},           // pageKey → data[]
  cacheTime: {},       // pageKey → timestamp
  CACHE_TTL: 5 * 60 * 1000  // 5 minutes
};

let autoRefreshTimer = null;

// ─── TAB CONFIG ICONS ───────────────────────────────────
const TAB_ICONS = {
  evaluations:    "📋",
  generalEvents:  "📅",
  employeeEvents: "👤",
  birthdays:      "🎂"
};

// ─── PANEL ICONS ─────────────────────────────────────────
const PANEL_ICONS = {
  late:     "⚠️",
  today:    "📌",
  upcoming: "🗓️"
};

// ═══════════════════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════════════════
function showToast(message, type = "info", duration = 3800) {
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type] || "ℹ️"}</span><span>${message}</span>`;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("removing");
    toast.addEventListener("animationend", () => toast.remove(), { once: true });
  }, duration);
}

// ═══════════════════════════════════════════════════════
// TEXT HELPERS
// ═══════════════════════════════════════════════════════
function normalizeText(value) {
  return (value || "").toString().trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/أ|إ|آ/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function hasValue(value) {
  const v = (value || "").toString().trim();
  return v !== "" && v !== "-" && v !== "—";
}

// ─── Fuzzy key lookup ────────────────────────────────────
function findCol(obj, candidates) {
  for (const key of Object.keys(obj)) {
    const nk = normalizeText(key);
    for (const c of candidates) {
      if (nk === normalizeText(c) || nk.includes(normalizeText(c)) || normalizeText(c).includes(nk)) {
        return obj[key];
      }
    }
  }
  return "";
}

// ═══════════════════════════════════════════════════════
// DATE HELPERS
// ═══════════════════════════════════════════════════════
function parseDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const raw = String(value).trim();
  if (!raw) return null;

  // ISO: 2026-01-25
  const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const d = new Date(+iso[1], +iso[2] - 1, +iso[3]);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const yr = dmy[3].length === 2 ? +`20${dmy[3]}` : +dmy[3];
    const d = new Date(yr, +dmy[2] - 1, +dmy[1]);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  // MM/DD/YYYY
  const mdy = raw.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/);
  if (mdy) {
    const d = new Date(+mdy[3], +mdy[1] - 1, +mdy[2]);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  const d = new Date(raw);
  if (!isNaN(d.getTime())) { d.setHours(0, 0, 0, 0); return d; }
  return null;
}

function toIsoDate(value) {
  const d = parseDateValue(value);
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function formatArabicDate(dateString) {
  const d = parseDateValue(dateString);
  if (!d) return "-";
  return new Intl.DateTimeFormat("ar-IQ", { year: "numeric", month: "long", day: "numeric" }).format(d);
}

function daysDiff(from, to) {
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function getUpcomingLabel(diff) {
  if (diff === 0) return "اليوم";
  if (diff === 1) return "غداً";
  if (diff === 2) return "بعد يومين";
  return `بعد ${diff} أيام`;
}

function getLateLabel(diff) {
  const n = Math.abs(diff);
  if (n === 1) return "متأخر يوم واحد";
  if (n === 2) return "متأخر يومين";
  return `متأخر ${n} أيام`;
}

// ═══════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════
function parseCsvLine(line) {
  const result = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i], nx = line[i+1];
    if (ch === '"') {
      if (inQ && nx === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (ch === ',' && !inQ) {
      result.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result.map(c => c.trim());
}

function parseCsv(csvText) {
  return csvText
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(r => r.trim() !== "")
    .map(parseCsvLine);
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h, i) => h.trim() || `col_${i}`);
  return rows.slice(1)
    .filter(row => row.some(hasValue))
    .map(row => {
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = row[idx] ?? ""; });
      return obj;
    });
}

// ═══════════════════════════════════════════════════════
// FETCH WITH MULTI-PROXY FALLBACK
// ═══════════════════════════════════════════════════════
const PROXIES = [
  url => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => url   // direct (may work in some environments)
];

async function fetchWithFallback(targetUrl) {
  let lastErr;
  for (const proxyFn of PROXIES) {
    const proxied = proxyFn(targetUrl);
    try {
      const res = await fetch(proxied, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.trim().length < 5) throw new Error("Empty response");
      return text;
    } catch (err) {
      lastErr = err;
      console.warn(`Proxy failed (${proxied}):`, err.message);
    }
  }
  throw lastErr;
}

function buildSheetCsvUrl(sheetName) {
  const id = window.APP_CONFIG?.spreadsheetId;
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
}

async function fetchSheetRows(pageKey) {
  const cfg = window.APP_CONFIG.pages[pageKey];
  const csvUrl = buildSheetCsvUrl(cfg.sheetName);
  const text = await fetchWithFallback(csvUrl);
  return parseCsv(text);
}

// ═══════════════════════════════════════════════════════
// DATA MAPPERS
// ═══════════════════════════════════════════════════════
function mapEvaluationRows(rows) {
  const objects = rowsToObjects(rows);
  return objects.map(row => {
    const name       = findCol(row, ["اسم الموظف","الاسم","name","الموظف"]);
    const department = findCol(row, ["القسم","department","الادارة","الوحدة"]) || "بدون قسم";
    const hireDate   = toIsoDate(findCol(row, ["تاريخ المباشرة","تاريخ التعيين","hire date","تاريخ الدخول"]));

    // Results — try every common column name
    const res1 = findCol(row, ["نتيجة التقييم الاول","نتيجة الاول","نتيجة 1","النتيجة 1","result 1","نتيجة الأول","نتيجة التقييم الأول"]);
    const res2 = findCol(row, ["نتيجة التقييم الثاني","نتيجة الثاني","نتيجة 2","النتيجة 2","result 2"]);
    const res3 = findCol(row, ["نتيجة التقييم الثالث","نتيجة الثالث","نتيجة 3","النتيجة 3","result 3"]);

    // Dates
    const d1 = toIsoDate(findCol(row, ["التقييم الاول","التقييم الأول","first evaluation","تاريخ التقييم الاول","تاريخ التقييم الأول"]));
    const d2 = toIsoDate(findCol(row, ["التقييم الثاني","second evaluation","تاريخ التقييم الثاني"]));
    const d3 = toIsoDate(findCol(row, ["التقييم الثالث","third evaluation","تاريخ التقييم الثالث"]));

    return {
      name, department, hireDate,
      evaluations: [
        { type: "التقييم الأول",  date: d1, result: res1, key: "first"  },
        { type: "التقييم الثاني", date: d2, result: res2, key: "second" },
        { type: "التقييم الثالث", date: d3, result: res3, key: "third"  }
      ]
    };
  }).filter(item => hasValue(item.name));
}

function mapEventRows(rows, pageKey) {
  const objects = rowsToObjects(rows);
  return objects.map(row => {
    const defaultType =
      pageKey === "birthdays"      ? "عيد ميلاد" :
      pageKey === "employeeEvents" ? "مناسبة موظف" : "مناسبة عامة";

    const title      = findCol(row, ["عنوان المناسبة","المناسبة","العنوان","title","نوع المناسبة","event"]) || defaultType;
    const name       = findCol(row, ["اسم الموظف","الاسم","name","الموظف"]);
    const department = findCol(row, ["القسم","department","الادارة","الوحدة"]);
    const type       = findCol(row, ["النوع","نوع المناسبة","type","التصنيف"]) || defaultType;
    const category   = findCol(row, ["التصنيف","الفئة","category","الصنف"]);
    const note       = findCol(row, ["ملاحظة","ملاحظات","الملاحظات","note","notes","تعليق"]);
    const rawDate    = findCol(row, ["التاريخ","تاريخ المناسبة","date","تاريخ الميلاد","birthday","تاريخ عيد الميلاد"]);

    return { title, name, department, type, category, note, date: toIsoDate(rawDate) };
  }).filter(item => hasValue(item.title) || hasValue(item.name));
}

// ═══════════════════════════════════════════════════════
// LOAD PAGE DATA (cache + fallback)
// ═══════════════════════════════════════════════════════
async function loadPageData(pageKey, force = false) {
  const now = Date.now();
  const cached = pageState.cache[pageKey];
  const cachedAt = pageState.cacheTime[pageKey] || 0;

  if (!force && cached && (now - cachedAt < pageState.CACHE_TTL)) {
    return cached;
  }

  try {
    const rows = await fetchSheetRows(pageKey);
    const mapped = pageKey === "evaluations" ? mapEvaluationRows(rows) : mapEventRows(rows, pageKey);

    if (mapped.length > 0) {
      pageState.cache[pageKey] = mapped;
      pageState.cacheTime[pageKey] = now;
      updateLastUpdated();
      return mapped;
    }
    throw new Error("البيانات فارغة أو الأعمدة غير معروفة");
  } catch (err) {
    console.warn(`[${pageKey}] فشل التحميل من الشيت:`, err.message);

    const fallback = window.FALLBACK_DATA?.[pageKey] || [];
    if (fallback.length) {
      showToast("⚠️ تم التحميل من البيانات الاحتياطية — تحقق من اتصالك أو إعدادات الشيت", "warning", 5000);
      pageState.cache[pageKey] = fallback;
      pageState.cacheTime[pageKey] = now;
      return fallback;
    }

    showToast("فشل التحميل ولا توجد بيانات احتياطية", "error");
    return [];
  }
}

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════
function buildSkeletonCard() {
  return `
    <div class="skeleton-card">
      <div class="skeleton-line wide"></div>
      <div class="skeleton-line med"></div>
      <div class="skeleton-line short" style="margin-top:14px"></div>
    </div>
  `;
}

function buildSkeletonPanel(title) {
  return `
    <div class="skeleton-panel">
      <div class="skeleton-line wide" style="height:18px;margin-bottom:16px"></div>
      ${buildSkeletonCard()}
      ${buildSkeletonCard()}
      ${buildSkeletonCard()}
    </div>
  `;
}

function showSkeletonLoading(cols = 3) {
  const grid = `panel-grid ${cols === 3 ? "three-columns" : "two-columns"}`;
  statsSection.innerHTML = Array.from({length:4}, () =>
    `<div class="stat-card"><div class="skeleton-line short"></div><div class="skeleton-line med" style="height:30px;margin-top:8px"></div></div>`
  ).join("");
  pageContent.innerHTML = `
    <div class="${grid}">
      ${buildSkeletonPanel("...")}
      ${buildSkeletonPanel("...")}
      ${cols === 3 ? buildSkeletonPanel("...") : ""}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// STAT COUNTER ANIMATION
// ═══════════════════════════════════════════════════════
function animateCounter(el, target, duration = 600) {
  const start = performance.now();
  const update = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target);
    if (progress < 1) requestAnimationFrame(update);
    else el.textContent = target;
  };
  requestAnimationFrame(update);
}

function createStatCard(label, value, extraClass = "") {
  return `
    <article class="stat-card ${extraClass}">
      <span>${label}</span>
      <strong data-count="${value}">0</strong>
    </article>
  `;
}

function activateCounters() {
  statsSection.querySelectorAll("[data-count]").forEach(el => {
    animateCounter(el, parseInt(el.dataset.count, 10));
  });
}

// ═══════════════════════════════════════════════════════
// PANEL BUILDER
// ═══════════════════════════════════════════════════════
function createPanel(title, subtitle, listId, classes = "", count = null) {
  const countBadge = count !== null ? `<span class="panel-count">${count}</span>` : "";
  return `
    <section class="panel ${classes}">
      <div class="panel-head">
        <div class="panel-head-left">
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        ${countBadge}
      </div>
      <div id="${listId}" class="cards-list"></div>
    </section>
  `;
}

function renderEmpty(target, text, icon = "🔍") {
  target.innerHTML = `<div class="empty-state"><span class="empty-icon">${icon}</span><span>${text}</span></div>`;
}

// ═══════════════════════════════════════════════════════
// EVALUATION CARD
// ═══════════════════════════════════════════════════════
function getEvalBadgeClass(key) {
  return key === "first" ? "first" : key === "second" ? "second" : "third";
}

function createEvaluationCard(item, mode = "upcoming", index = 0) {
  const node = evalTpl.content.cloneNode(true);
  const card = node.querySelector(".employee-card");
  card.style.animationDelay = `${index * 60}ms`;

  node.querySelector(".employee-name").textContent = item.name || "-";
  node.querySelector(".employee-meta").textContent = `${item.department} • ${item.type}`;

  const badge = node.querySelector(".eval-type");
  badge.textContent = item.type;
  badge.classList.add(getEvalBadgeClass(item.key));

  node.querySelector(".date-pill-text").textContent = formatArabicDate(item.date);
  const daysEl = node.querySelector(".days-left");

  if (mode === "late") {
    card.classList.add("is-late");
    daysEl.textContent = getLateLabel(item.diffDays);
    daysEl.classList.add("is-late");
  } else if (mode === "today") {
    daysEl.textContent = "مستحق اليوم ✔";
    daysEl.classList.add("is-today");
  } else {
    daysEl.textContent = getUpcomingLabel(item.diffDays);
  }
  return node;
}

// ═══════════════════════════════════════════════════════
// EVENT CARD
// ═══════════════════════════════════════════════════════
function createEventCard(item, badgeClass, index = 0) {
  const node = eventTpl.content.cloneNode(true);
  const card = node.querySelector(".event-card");
  card.style.animationDelay = `${index * 60}ms`;

  const displayTitle = item.title || item.name || "-";
  node.querySelector(".event-title").textContent = displayTitle;

  const metaParts = [item.name, item.department, item.category, item.type].filter(Boolean);
  // Avoid duplicating title
  const filteredMeta = metaParts.filter(p => p !== displayTitle);
  node.querySelector(".event-meta").textContent = filteredMeta.join(" • ") || "-";

  const badge = node.querySelector(".event-badge");
  badge.textContent = item.type || item.category || "مناسبة";
  badge.classList.add(badgeClass);

  const note = item.note?.trim();
  const noteEl = node.querySelector(".event-note");
  if (note) noteEl.textContent = note;
  else noteEl.closest(".event-body").style.display = "none";

  node.querySelector(".event-date").textContent = formatArabicDate(item.date);

  const diff = daysDiff(today, parseDateValue(item.date));
  const daysEl = node.querySelector(".event-days");

  if (diff < 0) {
    card.classList.add("is-late");
    daysEl.textContent = getLateLabel(diff);
    daysEl.classList.add("is-late");
  } else if (diff === 0) {
    daysEl.textContent = "اليوم 🎉";
    daysEl.classList.add("is-today");
  } else {
    daysEl.textContent = getUpcomingLabel(diff);
  }
  return node;
}

// ═══════════════════════════════════════════════════════
// DYNAMIC FILTER
// ═══════════════════════════════════════════════════════
function fillDynamicFilter(options, defaultLabel) {
  const cur = dynamicFilter.value;
  dynamicFilter.innerHTML = `<option value="">${defaultLabel}</option>`;
  options.forEach(opt => {
    const el = document.createElement("option");
    el.value = opt; el.textContent = opt;
    dynamicFilter.appendChild(el);
  });
  if ([...dynamicFilter.options].some(o => o.value === cur)) dynamicFilter.value = cur;
}

// ═══════════════════════════════════════════════════════
// EVALUATIONS PAGE
// ═══════════════════════════════════════════════════════
function flattenEvaluations(employees) {
  const items = [];
  employees.forEach(emp => {
    (emp.evaluations || []).forEach(ev => {
      if (!ev.date) return;
      const d = parseDateValue(ev.date);
      if (!d) return;
      items.push({
        name:       emp.name,
        department: emp.department || "بدون قسم",
        type:       ev.type,
        key:        ev.key,
        date:       toIsoDate(ev.date),
        result:     ev.result,
        completed:  hasValue(ev.result),
        diffDays:   daysDiff(today, d)
      });
    });
  });
  return items.sort((a, b) => new Date(a.date) - new Date(b.date));
}

function renderEvaluationPage(employees) {
  const flattened   = flattenEvaluations(employees);
  const q           = normalizeText(searchInput.value);
  const selDept     = dynamicFilter.value;
  const maxDays     = Number(windowFilter.value);
  const late = [], todayItems = [], upcoming = [];
  const matchNames  = new Set();

  flattened.forEach(item => {
    const textMatch = !q || normalizeText(item.name).includes(q) || normalizeText(item.department).includes(q);
    const deptMatch = !selDept || item.department === selDept;
    if (!(textMatch && deptMatch)) return;
    matchNames.add(item.name);
    if (item.completed) return;
    if      (item.diffDays < 0)           late.push(item);
    else if (item.diffDays === 0)         todayItems.push(item);
    else if (item.diffDays <= maxDays)    upcoming.push(item);
  });

  // Departments filter
  const depts = [...new Set(employees.map(e => e.department).filter(Boolean))].sort((a,b) => a.localeCompare(b,"ar"));
  fillDynamicFilter(depts, "كل الأقسام");
  dynamicFilterBox.classList.remove("hidden");
  windowFilterBox.classList.remove("hidden");

  // Stats
  statsSection.innerHTML = [
    createStatCard("التقييمات المتأخرة", late.length, "stat-danger"),
    createStatCard("تقييمات اليوم",       todayItems.length, "stat-warning"),
    createStatCard("التقييمات القادمة",   upcoming.length),
    createStatCard("إجمالي الموظفين",     matchNames.size || employees.length)
  ].join("");
  activateCounters();

  // Content
  pageContent.innerHTML = `
    <div class="panel-grid three-columns">
      ${createPanel(`${PANEL_ICONS.late} التقييمات المتأخرة`, "كل تقييم مضى وقته ولم تُسجَّل نتيجته", "lateList", "late-panel", late.length)}
      ${createPanel(`${PANEL_ICONS.today} مستحق اليوم`, "التقييمات المستحقة اليوم وغير المنجزة", "todayList", "urgent-panel", todayItems.length)}
      ${createPanel(`${PANEL_ICONS.upcoming} القادمة`, "مرتبة من الأقرب إلى الأبعد", "upcomingList", "", upcoming.length)}
    </div>
  `;

  const lateList     = document.getElementById("lateList");
  const todayList    = document.getElementById("todayList");
  const upcomingList = document.getElementById("upcomingList");

  if (late.length)       late.forEach((item,i)       => lateList.appendChild(createEvaluationCard(item,"late",i)));
  else renderEmpty(lateList, "ممتاز! لا توجد تقييمات متأخرة حالياً.", "✅");

  if (todayItems.length) todayItems.forEach((item,i) => todayList.appendChild(createEvaluationCard(item,"today",i)));
  else renderEmpty(todayList, "لا توجد تقييمات مستحقة اليوم.", "📭");

  if (upcoming.length)   upcoming.forEach((item,i)   => upcomingList.appendChild(createEvaluationCard(item,"upcoming",i)));
  else renderEmpty(upcomingList, "لا توجد تقييمات قادمة في الفترة المحددة.", "📭");
}

// ═══════════════════════════════════════════════════════
// EVENTS PAGES
// ═══════════════════════════════════════════════════════
function filterEvents(items, pageKey) {
  const q = normalizeText(searchInput.value);
  const sel = dynamicFilter.value;

  return items.filter(item => {
    const hay = [item.title, item.name, item.department, item.type, item.category, item.note]
      .map(normalizeText).join(" ");
    const textMatch = !q || hay.includes(q);
    if (!sel) return textMatch;
    if (pageKey === "generalEvents") return textMatch && (item.category === sel || item.type === sel);
    return textMatch && item.department === sel;
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function splitEventBuckets(items) {
  const late = [], todayItems = [], upcoming = [];
  items.forEach(item => {
    const d = parseDateValue(item.date);
    if (!d) return;
    const diff = daysDiff(today, d);
    if      (diff < 0)  late.push(item);
    else if (diff === 0) todayItems.push(item);
    else                upcoming.push(item);
  });
  return { late, todayItems, upcoming };
}

function renderEventPage(items, pageKey) {
  const filtered = filterEvents(items, pageKey);
  const { late, todayItems, upcoming } = splitEventBuckets(filtered);

  // Filter options
  if (pageKey === "generalEvents") {
    const opts = [...new Set(items.flatMap(i => [i.category, i.type]).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
    fillDynamicFilter(opts, "كل الفئات");
  } else {
    const opts = [...new Set(items.map(i=>i.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
    fillDynamicFilter(opts, "كل الأقسام");
  }
  dynamicFilterBox.classList.remove("hidden");
  windowFilterBox.classList.add("hidden");

  const statLabel = pageKey === "birthdays" ? "إجمالي أعياد الميلاد" : "إجمالي المناسبات";
  statsSection.innerHTML = [
    createStatCard(statLabel, filtered.length),
    createStatCard("اليوم",    todayItems.length, "stat-warning"),
    createStatCard("القادم",   upcoming.length),
    createStatCard("المتأخر",  late.length, "stat-danger")
  ].join("");
  activateCounters();

  const cols = pageKey === "generalEvents" ? "two-columns" : "three-columns";
  pageContent.innerHTML = `
    <div class="panel-grid ${cols}">
      ${createPanel(`${PANEL_ICONS.late} المتأخر`,  "كل ما مضى تاريخه", "lateEvents",     "late-panel",    late.length)}
      ${createPanel(`${PANEL_ICONS.today} اليوم`,   "المستحق اليوم",     "todayEvents",    "urgent-panel",  todayItems.length)}
      ${cols === "three-columns" ? createPanel(`${PANEL_ICONS.upcoming} القادم`, "مرتبة حسب الأقرب", "upcomingEvents", "", upcoming.length) : ""}
    </div>
    ${cols === "two-columns" ? `<div class="panel-grid two-columns" style="margin-top:18px">${createPanel(`${PANEL_ICONS.upcoming} القادم`, "مرتبة حسب الأقرب", "upcomingEvents", "", upcoming.length)}</div>` : ""}
  `;

  const lateList     = document.getElementById("lateEvents");
  const todayList    = document.getElementById("todayEvents");
  const upcomingList = document.getElementById("upcomingEvents");
  const badge = pageKey === "birthdays" ? "birthday" : pageKey === "employeeEvents" ? "employee" : "general";

  const lateIcon = pageKey === "birthdays" ? "🎂" : "📭";
  if (late.length)       late.forEach((item,i)       => lateList.appendChild(createEventCard(item,badge,i)));
  else renderEmpty(lateList, "لا توجد عناصر متأخرة حالياً.", "✅");

  if (todayItems.length) todayItems.forEach((item,i) => todayList.appendChild(createEventCard(item,badge,i)));
  else renderEmpty(todayList, "لا شيء اليوم.", "📭");

  if (upcoming.length)   upcoming.forEach((item,i)   => upcomingList.appendChild(createEventCard(item,badge,i)));
  else renderEmpty(upcomingList, "لا توجد عناصر قادمة.", "📭");
}

// ═══════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════
function renderTabs() {
  tabsNav.innerHTML = Object.entries(window.APP_CONFIG.pages).map(([key, cfg]) => `
    <button class="tab-btn ${pageState.current === key ? "active" : ""}" data-page="${key}">
      <span class="tab-icon">${TAB_ICONS[key] || "📄"}</span>
      ${cfg.tabLabel}
    </button>
  `).join("");

  tabsNav.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      if (pageState.current === btn.dataset.page) return;
      pageState.current = btn.dataset.page;
      dynamicFilter.value = "";
      searchInput.value = "";
      renderCurrentPage();
    });
  });
}

// ═══════════════════════════════════════════════════════
// LAST UPDATED
// ═══════════════════════════════════════════════════════
function updateLastUpdated() {
  const now = new Date();
  lastUpdatedText.textContent = new Intl.DateTimeFormat("ar-IQ", {
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  }).format(now);
}

// ═══════════════════════════════════════════════════════
// RENDER
// ═══════════════════════════════════════════════════════
async function renderCurrentPage(force = false) {
  const cfg = window.APP_CONFIG.pages[pageState.current];
  pageTitle.textContent    = cfg.title;
  pageSubtitle.textContent = cfg.subtitle;
  searchInput.placeholder  = cfg.searchPlaceholder;
  renderTabs();

  const cols = pageState.current === "evaluations" ? 3 :
               pageState.current === "generalEvents" ? 2 : 3;
  showSkeletonLoading(cols);

  refreshBtn.classList.add("loading");
  const data = await loadPageData(pageState.current, force);
  refreshBtn.classList.remove("loading");

  if (pageState.current === "evaluations") renderEvaluationPage(data);
  else renderEventPage(data, pageState.current);
}

// ═══════════════════════════════════════════════════════
// AUTO-REFRESH
// ═══════════════════════════════════════════════════════
function startAutoRefresh() {
  clearInterval(autoRefreshTimer);
  autoRefreshTimer = setInterval(() => {
    pageState.cache = {};
    pageState.cacheTime = {};
    renderCurrentPage(true);
    showToast("تم تحديث البيانات تلقائياً", "info", 2500);
  }, pageState.CACHE_TTL);
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
function init() {
  // Today date
  todayDateText.textContent = new Intl.DateTimeFormat("ar-IQ", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  }).format(today);

  // Search / filter listeners (debounced)
  let debounceTimer;
  [searchInput, dynamicFilter, windowFilter].forEach(el => {
    el.addEventListener("input",  () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => renderCurrentPage(), 250); });
    el.addEventListener("change", () => renderCurrentPage());
  });

  // Refresh button
  refreshBtn.addEventListener("click", () => {
    pageState.cache = {};
    pageState.cacheTime = {};
    renderCurrentPage(true);
    showToast("جارٍ تحديث البيانات من الشيت...", "info", 2000);
  });

  startAutoRefresh();
  renderCurrentPage();
}

init();
