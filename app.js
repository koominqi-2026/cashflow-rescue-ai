/* Cashflow Rescue AI — rubric-ready redesign
   - Smoother product price/cost inputs (local edit + blur commit)
   - Wider, clearer stock table inputs
   - Simple workflow + empty-state illustrations
   - Stronger validation and autonomous decision narrative
   - Live demo quality for WorkBuddy Dormathon Track 2 */

import React, { useState, useMemo, useEffect, useRef, useCallback } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";

const html = htm.bind(React.createElement);
const { Fragment } = React;

/* ---------- helpers ---------- */
const RM = (sen = 0) => "RM " + (Number(sen || 0) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (v, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const uid = (p) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (s) => (s ? s : "—");

/* smooth number input: edit raw text freely, commit on blur */
function SmoothNumberInput({ value, onCommit, placeholder = "0.00", step = "0.01", min = "0", width, ariaLabel, className = "" }) {
  const [raw, setRaw] = useState("");
  useEffect(() => { setRaw(value === 0 || value === "0" ? "" : String(value)); }, [value]);
  const commit = () => {
    const n = num(raw);
    if (raw.trim() !== "" || n > 0) onCommit(n);
  };
  return html`
    <input
      type="number"
      min=${min}
      step=${step}
      className=${"smooth-num " + className}
      style=${width ? { width } : {}}
      value=${raw}
      placeholder=${placeholder}
      aria-label=${ariaLabel}
      onChange=${(e) => setRaw(e.target.value)}
      onBlur=${commit}
      onKeyDown=${(e) => e.key === "Enter" && e.target.blur()}
    />
  `;
}

/* auto-calculate urgency from coverage ratio */
function autoUrgency(physical, demand) {
  if (demand <= 0) return "LOW";
  const ratio = physical / demand;
  if (ratio < 0.2) return "CRITICAL";
  if (ratio < 0.4) return "HIGH";
  if (ratio < 0.7) return "MEDIUM";
  if (ratio < 1.0) return "NORMAL";
  return "LOW";
}

/* parse CSV text → [{ name, quantityG }] */
function parseCSV(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return rows;
  // detect delimiter
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
  // find name and quantity columns
  let nameIdx = header.findIndex((h) => /name|ingredient|item|product|desc/.test(h));
  let qtyIdx = header.findIndex((h) => /qty|quantity|amount|stock|on.?hand|gram|weight|level/.test(h));
  if (nameIdx === -1) nameIdx = 0;
  if (qtyIdx === -1) qtyIdx = 1;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim().replace(/["']/g, ""));
    const name = cols[nameIdx];
    const qtyRaw = cols[qtyIdx] || "0";
    if (!name) continue;
    let qty = parseFloat(qtyRaw.replace(/[^0-9.]/g, "")) || 0;
    // detect kg suffix
    if (/kg/i.test(qtyRaw) && qty < 1000) qty *= 1000;
    rows.push({ name, quantityG: Math.round(qty) });
  }
  return rows;
}

/* parse POS CSV text → [{ name, quantity, priceSen, date }] */
function parsePOSCSV(text) {
  const rows = [];
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return rows;
  const delim = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(delim).map((h) => h.trim().toLowerCase().replace(/["']/g, ""));
  // find columns
  let nameIdx = header.findIndex((h) => /name|item|product|desc|menu/.test(h));
  let qtyIdx = header.findIndex((h) => /qty|quantity|count|units|sold/.test(h));
  let priceIdx = header.findIndex((h) => /price|amount|total|revenue|subtotal|sale/.test(h));
  let dateIdx = header.findIndex((h) => /date|time|datetime/.test(h));
  if (nameIdx === -1) nameIdx = 0;
  if (qtyIdx === -1) qtyIdx = 1;
  if (priceIdx === -1) priceIdx = -1; // optional
  if (dateIdx === -1) dateIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim().replace(/["']/g, ""));
    const name = cols[nameIdx];
    if (!name) continue;
    const qty = parseFloat((cols[qtyIdx] || "1").replace(/[^0-9.]/g, "")) || 1;
    let priceSen = 0;
    if (priceIdx >= 0 && cols[priceIdx]) {
      const pv = parseFloat(cols[priceIdx].replace(/[^0-9.]/g, "")) || 0;
      priceSen = Math.round(pv * 100);
    }
    const date = (dateIdx >= 0 && cols[dateIdx]) ? cols[dateIdx].slice(0, 10) : todayISO();
    rows.push({ name, quantity: qty, priceSen, date });
  }
  return rows;
}
const DEMO_PRODUCTS = {
  P001: { id: "P001", name: "Butter Croissant", icon: "🥐", recipe: { I001: 80, I002: 25, I003: 10, I005: 2 }, defaultPriceSen: 850, defaultCostSen: 260 },
  P002: { id: "P002", name: "Chocolate Bun", icon: "🍫", recipe: { I001: 70, I002: 15, I003: 12, I004: 20, I005: 2 }, defaultPriceSen: 750, defaultCostSen: 240 },
  P003: { id: "P003", name: "White Bread Loaf", icon: "🍞", recipe: { I001: 500, I002: 10, I003: 20, I005: 5 }, defaultPriceSen: 650, defaultCostSen: 210 },
  P004: { id: "P004", name: "Pandan Cake", icon: "🍰", recipe: { I001: 100, I003: 30, I006: 5 }, defaultPriceSen: 1200, defaultCostSen: 380 },
};
const DEMO_INGREDIENTS = [
  { id: "I001", name: "Bread Flour", icon: "🍞", unit: "g", packs: 1, packSizeG: 25000, packPriceRM: 65, urgency: "CRITICAL", supplier: "Sri Kaya Flour Mill", leadDays: 2, onHandG: 12000, demandG: 31470, unitCostSenPerG: 0.26 },
  { id: "I002", name: "Butter", icon: "🧈", unit: "g", packs: 1, packSizeG: 5000, packPriceRM: 90, urgency: "CRITICAL", supplier: "Leong Dairy Trading", leadDays: 3, onHandG: 1200, demandG: 3885, unitCostSenPerG: 0.62 },
  { id: "I003", name: "Sugar", icon: "🍚", unit: "g", packs: 1, packSizeG: 10000, packPriceRM: 48, urgency: "NORMAL", supplier: "Gula Pasir Wholesale", leadDays: 2, onHandG: 2000, demandG: 2504, unitCostSenPerG: 0.12 },
  { id: "I004", name: "Chocolate Filling", icon: "🍫", unit: "g", packs: 1, packSizeG: 2000, packPriceRM: 150, urgency: "CRITICAL", supplier: "Cocoa Supply Co", leadDays: 5, onHandG: 900, demandG: 1140, unitCostSenPerG: 2.3 },
  { id: "I005", name: "Yeast", icon: "🌾", unit: "g", packs: 1, packSizeG: 1000, packPriceRM: 120, urgency: "CRITICAL", supplier: "Yeast Direct", leadDays: 2, onHandG: 150, demandG: 516, unitCostSenPerG: 0.45 },
  { id: "I006", name: "Pandan Paste", icon: "🌿", unit: "g", packs: 0, packSizeG: 1000, packPriceRM: 80, urgency: "NORMAL", supplier: "Pandan Supply", leadDays: 3, onHandG: 800, demandG: 0, unitCostSenPerG: 1.1 },
];
const DEMO_INVENTORY = DEMO_INGREDIENTS.map((n) => ({ ingredientId: n.id, quantityG: n.onHandG, countedAt: "2026-10-08", source: "PHYSICAL_COUNT", autoDeduct: true }));
const DEMO_CASH = { cashOnHand: 1100, bills: 0, customersOwe: 0, collectionPct: 0, otherIn: 0, buffer: 200 };
const DEMO_EXPENSES = [
  { id: "exp-rent", name: "Shop rent", category: "rent", amountSen: 50000, incurredDate: "2026-10-05", dueDate: "2026-10-15", paidDate: "", paid: false, expenseClass: "OPERATING" },
  { id: "exp-power", name: "Electricity & water", category: "utilities", amountSen: 12000, incurredDate: "2026-10-05", dueDate: "2026-10-12", paidDate: "", paid: false, expenseClass: "OPERATING" },
  { id: "exp-material", name: "Packaging supplier", category: "materials", amountSen: 8000, incurredDate: "2026-10-06", dueDate: "2026-10-18", paidDate: "", paid: false, expenseClass: "OPERATING" },
];
const DEMO_OTHER_INCOME = [];
const DEMO_MANUAL_SALES = [];
const DEMO_SALES_MODE = "POS + Manual";

/* ---------- prompt parser ---------- */
function parsePrompt(text) {
  const out = { cash: null, buffer: null, otherIn: null, forecastDays: null, ingredients: [], products: [], expenses: [], notes: [] };
  if (!text || !text.trim()) return out;
  const t = text;
  const lower = t.toLowerCase();

  const money = (s) => {
    if (!s) return null;
    const n = parseFloat(s.replace(/,/g, ""));
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  const grabRM = (re) => {
    const m = t.match(re);
    return m ? money(m[1]) : null;
  };

  out.cash = grabRM(/(?:cash\s*(?:on\s*hand|in\s*hand)?|i\s*have|i've\s*got|i\s*hold)[^.\n]{0,30}?rm\s*([0-9][0-9,]*\.?[0-9]*)/i)
          || grabRM(/rm\s*([0-9][0-9,]*\.?[0-9]*)[^.\n]{0,30}?cash/i)
          || grabRM(/\bcash[^.\n]{0,30}?rm\s*([0-9][0-9,]*\.?[0-9]*)/i);
  out.buffer = grabRM(/(?:buffer|safety\s*net|never\s*drop\s*below|keep[^.\n]{0,15}?at)\s*rm\s*([0-9][0-9,]*\.?[0-9]*)/i)
             || grabRM(/rm\s*([0-9][0-9,]*\.?[0-9]*)[^.\n]{0,30}?buffer/i);
  out.otherIn = grabRM(/(?:other\s*income|expect(?:ing)?|grant|deposit|catering)[^.\n]{0,30}?rm\s*([0-9][0-9,]*\.?[0-9]*)/i);

  const fd = t.match(/forecast\s*(\d{1,3})\s*days?/i) || t.match(/(\d{1,3})\s*days?\s*forecast/i);
  if (fd) out.forecastDays = parseInt(fd[1], 10);

  const STOP = new Set(["i", "i've", "ive", "i'd", "we", "we've", "they", "today", "yesterday", "tomorrow", "left", "have", "had", "keep", "kept", "hold", "sold", "use", "used", "still", "only", "about", "around", "now", "still", "the", "a", "an", "my", "our"]);
  const looksLikeIngredient = (w) => w && w.length >= 2 && !STOP.has(w.toLowerCase()) && !/^(rm|cash|buffer|forecast|days|day)$/i.test(w);
  const ingPattern = /(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|ml|l|liter|litre|litres|liters)\s+([a-zA-Z][\w\s\-']{1,30}?)(?=\s*(?:,|\.|;|\n|have|left|in\s*stock|on\s*hand|sold|at\s*rm|=|used|\||$))/gi;
  let m;
  while ((m = ingPattern.exec(t)) !== null) {
    const amt = parseFloat(m[1]);
    const unit = m[2].toLowerCase();
    const name = m[3].trim();
    if (!looksLikeIngredient(name)) continue;
    const grams = unit === "kg" || unit === "l" || unit === "liter" || unit === "litre" || unit === "litres" || unit === "liters" ? amt * 1000 : amt;
    out.ingredients.push({ name, unit: "g", onHandG: Math.round(grams) });
  }
  const ingPattern2 = /\b([A-Za-z][\w\-']{2,30}(?:\s+[A-Za-z][\w\-']{1,30})?)\s+(\d+(?:\.\d+)?)\s*(kg|g|gram|grams|ml|l)\b/gi;
  while ((m = ingPattern2.exec(t)) !== null) {
    const name = m[1].trim();
    const lname = name.toLowerCase();
    if (out.ingredients.find((x) => x.name.toLowerCase() === lname)) continue;
    if (!looksLikeIngredient(name)) continue;
    if (/(croissant|bun|cake|bread|loaf|donut|tart|rent|cash|buffer|grant|income|keep|have|hold|net|days|forecast)/i.test(lname)) continue;
    const amt = parseFloat(m[2]);
    const unit = m[3].toLowerCase();
    const grams = unit === "kg" || unit === "l" || unit.startsWith("liter") || unit.startsWith("litre") ? amt * 1000 : amt;
    out.ingredients.push({ name, unit: "g", onHandG: Math.round(grams) });
  }

  const prodPattern = /(?:sold\s*)?(\d{1,4})\s+([a-zA-Z][\w\s\-']{2,30}?)\s+(?:at\s*rm\s*([0-9][0-9,]*\.?[0-9]*)|today)/gi;
  while ((m = prodPattern.exec(t)) !== null) {
    const qty = parseInt(m[1], 10);
    const name = m[2].trim();
    const price = m[3] ? money(m[3]) : null;
    if (!looksLikeIngredient(name)) continue;
    const known = Object.values(DEMO_PRODUCTS).find((p) => p.name.toLowerCase() === name.toLowerCase());
    out.products.push({ qty, name, priceSen: price, knownId: known ? known.id : null });
  }

  const expPattern = /\b([a-zA-Z][\w\s\-']{2,30}?)\s+rm\s*([0-9][0-9,]*\.?[0-9]*)(?:\s+due\s+(\d{1,2}\s*[a-z]+\s*\d{2,4}|\d{4}-\d{2}-\d{2}))?/gi;
  while ((m = expPattern.exec(t)) !== null) {
    const label = m[1].trim();
    const llabel = label.toLowerCase();
    if (!looksLikeIngredient(label)) continue;
    if (/(cash|buffer|keep|net|i\s*have|i've|ive|hold|grant|catering|income|forecast|days|day|today|sold|left)/i.test(llabel)) continue;
    if (/^\d/.test(label)) continue;
    const amt = money(m[2]);
    const due = m[3] || "";
    out.expenses.push({ name: label, amountSen: amt, dueDate: due, category: guessCategory(llabel) });
  }

  return out;
}
function guessCategory(label) {
  if (/rent/.test(label)) return "rent";
  if (/util|power|electric|water|internet|wifi/.test(label)) return "utilities";
  if (/wage|salary|staff|payroll/.test(label)) return "wages";
  if (/transport|fuel|petrol|gas|delivery/.test(label)) return "transport";
  if (/material|flour|butter|sugar|pack|ingredient|suppl/.test(label)) return "materials";
  return "other";
}

/* ---------- calculations ---------- */
function buildCalc({ cash, expenses, ingredients, products, manualSales, inventoryCounts, otherIncome, forecastDays, parsedFromPrompt, demandOverrides }) {
  const bufferSen = num(cash.buffer) * 100;
  const totalExpenseSen = expenses.reduce((s, e) => s + num(e.amountSen), 0);
  const unpaidExpenses = expenses.filter((e) => !e.paid);
  const reservedExpenseSen = unpaidExpenses.reduce((s, e) => s + num(e.amountSen), 0);
  const otherInSen = num(cash.otherIn) * 100;
  const spendableNow = Math.max(0, num(cash.cashOnHand) * 100 - reservedExpenseSen);

  const productRows = Object.values(products).map((p) => {
    const recent = num(manualSales.find((s) => s.productId === p.id)?.quantity) || defaultDailyUnits(p.id);
    const forecastUnits = Math.max(1, Math.round(recent * forecastDays));
    return { ...p, recentDaily: recent, forecastUnits };
  });
  const demandG = {};
  for (const p of productRows) {
    for (const [iid, qty] of Object.entries(p.recipe || {})) {
      demandG[iid] = (demandG[iid] || 0) + qty * p.forecastUnits;
    }
  }
  const lines = ingredients.map((ing) => {
    const physical = (inventoryCounts.find((c) => c.ingredientId === ing.id)?.quantityG) ?? ing.onHandG;
    const d = (demandOverrides && demandOverrides[ing.id] != null ? num(demandOverrides[ing.id]) : (demandG[ing.id] || 0));
    const gap = Math.max(0, d - physical);
    const packSize = num(ing.packSizeG);
    const packsNeeded = packSize > 0 ? Math.ceil(gap / packSize) : 0;
    const costRM = (packsNeeded * num(ing.packPriceRM));
    const autoUrg = autoUrgency(physical, d);
    const coverage = d > 0 ? Math.min(1, physical / d) : 1;
    return { ing, physical, demand: d, gap, packSize, packsNeeded, costRM, autoUrgency: autoUrg, coverage };
  });
  const totalRestockRM = lines.reduce((s, l) => s + l.costRM, 0);
  const totalRestockSen = Math.round(totalRestockRM * 100);
  const projectedAfterSen = num(cash.cashOnHand) * 100 - reservedExpenseSen - totalRestockSen;
  const aboveBufferSen = projectedAfterSen - bufferSen;

  let recommendation = "FULL";
  let heldLines = [];
  if (projectedAfterSen < bufferSen) {
    recommendation = "NONE";
  } else {
    const sorted = [...lines].sort((a, b) => prio(a.autoUrgency) - prio(b.autoUrgency));
    let running = projectedAfterSen;
    for (const ln of sorted) {
      if (running - Math.round(ln.costRM * 100) >= bufferSen) {
        running -= Math.round(ln.costRM * 100);
      } else {
        heldLines.push(ln);
      }
    }
    if (heldLines.length) recommendation = "PARTIAL";
  }
  function prio(u) {
    return { CRITICAL: 0, HIGH: 1, MEDIUM: 2, NORMAL: 3, LOW: 4 }[u] ?? 2;
  }

  const categoryTotalsSen = {};
  for (const e of expenses) categoryTotalsSen[e.category] = (categoryTotalsSen[e.category] || 0) + num(e.amountSen);

  const dailyBurnSen = Math.round(totalExpenseSen / 30);
  const runwayDays = dailyBurnSen > 0 ? Math.floor((num(cash.cashOnHand) * 100) / dailyBurnSen) : null;

  const unsettledSalesSen = manualSales.filter((s) => !s.settled).reduce((s, r) => s + num(r.amountSen || r.totalSen), 0);
  const unsettledRows = manualSales.filter((s) => !s.settled).map((s) => ({ txnId: s.id, date: s.date }));

  const weeklySalesSen = manualSales.reduce((s, r) => s + num(r.totalSen), 0);
  const weeklyProfitSen = weeklySalesSen - Math.round(totalExpenseSen / 4);

  const advice = [];
  if (recommendation === "NONE") {
    advice.push({ severity: "critical", title: "Protect cash before buying", detail: `Your current plan would leave less than the ${RM(bufferSen)} safety buffer.`, action: "Pause non-essential buying, collect overdue sales and review the next bill first." });
  } else if (aboveBufferSen < dailyBurnSen * 7) {
    advice.push({ severity: "watch", title: "Keep a closer cash watch this week", detail: `Only ${RM(Math.max(0, aboveBufferSen))} remains above your buffer after the recommended purchase.`, action: "Review the cash position again after the next 7 days of sales." });
  } else {
    advice.push({ severity: "good", title: "The purchase plan protects your safety net", detail: `${RM(Math.max(0, aboveBufferSen))} remains above your buffer after shopping.`, action: "Proceed with the recommended items, then update actual cash after payment." });
  }
  if (runwayDays !== null && runwayDays <= 7) {
    advice.push({ severity: "critical", title: "Cash runway is very short", detail: `At the current expense pace, the shop has about ${runwayDays} day${runwayDays === 1 ? "" : "s"} of runway.`, action: "Defer avoidable expenses, negotiate due dates and prioritise daily cash collection." });
  } else if (runwayDays !== null && runwayDays <= 14) {
    advice.push({ severity: "watch", title: "Review the next two weeks", detail: `Your estimated runway is ${runwayDays} days.`, action: "Check every upcoming bill and avoid stocking items that can wait." });
  }
  const topCat = Object.entries(categoryTotalsSen).sort((a, b) => b[1] - a[1])[0];
  if (topCat && totalExpenseSen > 0 && topCat[1] * 100 >= totalExpenseSen * 40) {
    advice.push({ severity: "watch", title: `${prettyCat(topCat[0])} is your largest cost area`, detail: `${RM(topCat[1])} is ${Math.round((topCat[1] * 100) / totalExpenseSen)}% of listed expenses.`, action: catAdvice(topCat[0]) });
  }
  if (unsettledSalesSen > 0) {
    advice.push({ severity: "action", title: "Follow up on unpaid sales", detail: `${RM(unsettledSalesSen)} is recorded but not yet collected.`, action: "Contact the oldest customer first. Do not count this money as available until it arrives." });
  }
  if (reservedExpenseSen > 0) {
    advice.push({ severity: "action", title: "Reserve money for committed expenses", detail: `${RM(reservedExpenseSen)} of unpaid expenses is inside the planning window.`, action: "Keep this amount separate from the buying budget and mark bills paid only after settlement." });
  }
  if (recommendation !== "FULL" && heldLines.length) {
    advice.push({ severity: "action", title: "Buy critical stock before extras", detail: `${heldLines.length} item${heldLines.length === 1 ? " is" : "s are"} being held back to protect cash.`, action: "Revisit the held items after more sales are collected or the buffer improves." });
  }

  return {
    cashOnHandSen: num(cash.cashOnHand) * 100,
    bufferSen, totalExpenseSen, reservedExpenseSen, otherInSen, spendableNow,
    productRows, demandG, lines, totalRestockRM, totalRestockSen, projectedAfterSen, aboveBufferSen,
    recommendation, heldLines, categoryTotalsSen, dailyBurnSen, runwayDays, unsettledSalesSen, unsettledRows,
    weeklySalesSen, weeklyProfitSen, advice, parsedFromPrompt,
  };
}
function prettyCat(c) { return { rent: "Rent", materials: "Materials", utilities: "Utilities", wages: "Wages", transport: "Transport", other: "Other" }[c] || "Other"; }
function catAdvice(c) {
  return ({
    rent: "Check renewal terms and ask whether the payment date can be split.",
    materials: "Compare suppliers, pack sizes and minimum order quantities before buying.",
    utilities: "Check for unusual usage and confirm the next meter reading or bill.",
    wages: "Protect payroll first and plan the payment date before discretionary buying.",
    transport: "Combine deliveries and avoid small urgent trips where possible.",
    other: "Review whether this expense can be delayed, reduced or cancelled.",
  })[c] || "Review this expense.";
}
function defaultDailyUnits(pid) {
  return ({ P001: 8, P002: 6, P003: 4, P004: 2 })[pid] || 1;
}

/* ---------- persistence ---------- */
const STORE_KEY = "kkr-state-v2";
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function saveState(s) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {}
}
function clearState() { try { localStorage.removeItem(STORE_KEY); } catch {} }

/* ---------- App ---------- */
function App() {
  const [cash, setCash] = useState(DEMO_CASH);
  const [expenses, setExpenses] = useState(DEMO_EXPENSES);
  const [products, setProducts] = useState(DEMO_PRODUCTS);
  const [ingredients, setIngredients] = useState(DEMO_INGREDIENTS);
  const [inventoryCounts, setInventoryCounts] = useState(DEMO_INVENTORY);
  const [otherIncome, setOtherIncome] = useState(DEMO_OTHER_INCOME);
  const [manualSales, setManualSales] = useState(DEMO_MANUAL_SALES);
  const [salesMode, setSalesMode] = useState(DEMO_SALES_MODE);
  const [forecastDays, setForecastDays] = useState(7);
  const [promptText, setPromptText] = useState("");
  const [appliedPrompt, setAppliedPrompt] = useState("");
  const [showReport, setShowReport] = useState(false);
  const [reportTab, setReportTab] = useState("decision");
  const [stockMode, setStockMode] = useState("count"); // "count" | "csv"
  const [csvFileName, setCsvFileName] = useState("");
  const [demandOverrides, setDemandOverrides] = useState({});
  const [toast, setToast] = useState("");
  const [showAddIng, setShowAddIng] = useState(false);
  const [showAddExp, setShowAddExp] = useState(false);
  const [showAddProd, setShowAddProd] = useState(false);
  const [showAddInc, setShowAddInc] = useState(false);

  useEffect(() => {
    const s = loadState();
    if (!s) return;
    if (s.cash) setCash(s.cash);
    if (s.expenses) setExpenses(s.expenses);
    if (s.products) setProducts(s.products);
    if (s.ingredients) setIngredients(s.ingredients);
    if (s.inventoryCounts) setInventoryCounts(s.inventoryCounts);
    if (s.otherIncome) setOtherIncome(s.otherIncome);
    if (s.manualSales) setManualSales(s.manualSales);
    if (s.salesMode) setSalesMode(s.salesMode);
    if (s.forecastDays) setForecastDays(s.forecastDays);
    if (typeof s.promptText === "string") setPromptText(s.promptText);
    if (typeof s.appliedPrompt === "string") setAppliedPrompt(s.appliedPrompt);
    if (s.stockMode) setStockMode(s.stockMode);
    if (s.csvFileName) setCsvFileName(s.csvFileName);
    if (s.demandOverrides) setDemandOverrides(s.demandOverrides);
  }, []);

  useEffect(() => {
    saveState({ cash, expenses, products, ingredients, inventoryCounts, otherIncome, manualSales, salesMode, forecastDays, promptText, appliedPrompt, stockMode, csvFileName, demandOverrides });
  }, [cash, expenses, products, ingredients, inventoryCounts, otherIncome, manualSales, salesMode, forecastDays, promptText, appliedPrompt, stockMode, csvFileName, demandOverrides]);

  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 3200); };

  const calc = useMemo(() => buildCalc({ cash, expenses, ingredients, products, manualSales, inventoryCounts, otherIncome, forecastDays, parsedFromPrompt: appliedPrompt, demandOverrides }), [cash, expenses, ingredients, products, manualSales, inventoryCounts, otherIncome, forecastDays, appliedPrompt, demandOverrides]);

  const parsed = useMemo(() => parsePrompt(promptText), [promptText]);

  /* ---- actions ---- */
  const updateIng = (id, field, value) => setIngredients((arr) => arr.map((x) => x.id === id ? { ...x, [field]: value } : x));
  const removeIng = (id) => {
    setIngredients((arr) => arr.filter((x) => x.id !== id));
    setInventoryCounts((arr) => arr.filter((c) => c.ingredientId !== id));
    flash("Ingredient removed.");
  };
  const addIng = (data) => {
    const id = uid("I");
    const newIng = {
      id, name: data.name.trim(), icon: "🧺", unit: data.unit || "g",
      packs: 0, packSizeG: num(data.packSizeG, 1000), packPriceRM: num(data.packPriceRM, 0),
      urgency: "NORMAL", supplier: data.supplier || "", leadDays: num(data.leadDays, 2),
      onHandG: num(data.onHandG, 0), demandG: 0, unitCostSenPerG: num(data.unitCostSenPerG, 0),
    };
    setIngredients((arr) => [...arr, newIng]);
    setInventoryCounts((arr) => [...arr, { ingredientId: id, quantityG: newIng.onHandG, countedAt: todayISO(), source: "PHYSICAL_COUNT", autoDeduct: true }]);
    setShowAddIng(false);
    flash(`Added "${newIng.name}".`);
  };

  const updateExp = (id, field, value) => setExpenses((arr) => arr.map((x) => x.id === id ? { ...x, [field]: value } : x));
  const removeExp = (id) => { setExpenses((arr) => arr.filter((x) => x.id !== id)); flash("Expense removed."); };
  const addExp = (data) => {
    if (!data.name || !data.name.trim()) return;
    if (!num(data.amountRM)) return;
    setExpenses((arr) => [...arr, { id: uid("exp"), name: data.name.trim(), category: data.category, amountSen: Math.round(num(data.amountRM, 0) * 100), incurredDate: data.incurredDate || todayISO(), dueDate: data.dueDate || "", paidDate: "", paid: false, expenseClass: "OPERATING" }]);
    setShowAddExp(false);
    flash(`Added expense "${data.name.trim()}".`);
  };

  const updateProd = (id, field, value) => setProducts((arr) => {
    const next = { ...arr };
    next[id] = { ...next[id], [field]: value };
    return next;
  });
  const removeProd = (id) => { setProducts((arr) => { const n = { ...arr }; delete n[id]; return n; }); flash("Product removed."); };
  const addProd = (data) => {
    if (!data.name || !data.name.trim()) return;
    setProducts((arr) => ({ ...arr, [uid("P")]: { id: uid("P"), name: data.name.trim(), icon: data.icon || "🍞", recipe: {}, defaultPriceSen: Math.round(num(data.priceRM, 0) * 100), defaultCostSen: Math.round(num(data.costRM, 0) * 100) } }));
    setShowAddProd(false);
    flash(`Added product "${data.name.trim()}".`);
  };

  const addIncome = (data) => {
    if (!data.description || !data.description.trim()) return;
    if (!num(data.amountRM)) return;
    setOtherIncome((arr) => [...arr, { id: uid("inc"), date: data.date || todayISO(), description: data.description.trim(), amountSen: Math.round(num(data.amountRM, 0) * 100) }]);
    setShowAddInc(false);
    flash(`Added income "${data.description.trim()}".`);
  };
  const removeIncome = (id) => { setOtherIncome((arr) => arr.filter((x) => x.id !== id)); flash("Income row removed."); };

  const addSale = (data) => {
    if (!data.productId) return;
    const prod = Object.values(products).find((p) => p.id === data.productId);
    if (!prod) return;
    const qty = num(data.quantity, 1);
    const priceSen = data.priceSen ? num(data.priceSen) : num(prod.defaultPriceSen);
    setManualSales((arr) => [...arr, { id: uid("sale"), productId: data.productId, productName: prod.name, quantity: qty, totalSen: Math.round(priceSen * qty), date: data.date || todayISO(), settled: data.settled ?? false }]);
    flash(`Added sale: ${qty} × ${prod.name}.`);
  };
  const removeSale = (id) => { setManualSales((arr) => arr.filter((x) => x.id !== id)); flash("Sale removed."); };

  const handlePOSCSVImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parsePOSCSV(text);
      if (rows.length === 0) { flash("No valid rows found in POS CSV."); return; }
      const prodList = Object.values(products);
      let matched = 0, unmatched = 0;
      const newSales = [];
      for (const row of rows) {
        const prod = prodList.find((p) => p.name.toLowerCase() === row.name.toLowerCase());
        if (prod) {
          const priceSen = row.priceSen || num(prod.defaultPriceSen);
          newSales.push({ id: uid("sale"), productId: prod.id, productName: prod.name, quantity: row.quantity, totalSen: Math.round(priceSen * row.quantity), date: row.date, settled: true });
          matched++;
        } else {
          unmatched++;
        }
      }
      if (newSales.length > 0) {
        setManualSales((arr) => [...arr, ...newSales]);
        flash(`POS import: ${matched} sales matched${unmatched > 0 ? `, ${unmatched} items unmatched` : ""}.`);
      } else {
        flash("No products matched. Add products first or check CSV format.");
      }
    };
    reader.readAsText(file);
  };

  const setDemandOverride = (ingId, val) => {
    const n = num(val);
    setDemandOverrides((obj) => {
      const next = { ...obj };
      if (n > 0) next[ingId] = n;
      else delete next[ingId];
      return next;
    });
  };

  const updateInv = (id, val) => setInventoryCounts((arr) => arr.map((c) => c.ingredientId === id ? { ...c, quantityG: Math.max(0, num(val)), source: "PHYSICAL_COUNT", countedAt: todayISO() } : c));

  const handleCSVImport = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = parseCSV(text);
      if (rows.length === 0) { flash("No valid rows found in CSV. Expected columns: Name, Quantity."); return; }
      // Work with copies of current state
      const newIngredients = ingredients.map((i) => ({ ...i }));
      const newCounts = inventoryCounts.map((c) => ({ ...c }));
      let matched = 0, added = 0;
      for (const row of rows) {
        const ex = newIngredients.find((x) => x.name.toLowerCase() === row.name.toLowerCase());
        if (ex) {
          ex.onHandG = row.quantityG;
          const cnt = newCounts.find((c) => c.ingredientId === ex.id);
          if (cnt) { cnt.quantityG = row.quantityG; cnt.source = "CSV_IMPORT"; cnt.countedAt = todayISO(); }
          else { newCounts.push({ ingredientId: ex.id, quantityG: row.quantityG, countedAt: todayISO(), source: "CSV_IMPORT", autoDeduct: true }); }
          matched++;
        } else {
          const id = uid("I");
          newIngredients.push({ id, name: row.name, icon: "🧺", unit: "g", packs: 0, packSizeG: 1000, packPriceRM: 0, urgency: "NORMAL", supplier: "", leadDays: 2, onHandG: row.quantityG, demandG: 0, unitCostSenPerG: 0 });
          newCounts.push({ ingredientId: id, quantityG: row.quantityG, countedAt: todayISO(), source: "CSV_IMPORT", autoDeduct: true });
          added++;
        }
      }
      setIngredients(newIngredients);
      setInventoryCounts(newCounts);
      setCsvFileName(file.name);
      flash(`CSV imported: ${matched} matched, ${added} new ingredients added.`);
    };
    reader.readAsText(file);
  };

  const savePrompt = () => {
    const p = parsePrompt(promptText);
    let applied = [];
    if (p.cash != null) { setCash((c) => ({ ...c, cashOnHand: p.cash / 100 })); applied.push(`cash -> ${RM(p.cash)}`); }
    if (p.buffer != null) { setCash((c) => ({ ...c, buffer: p.buffer / 100 })); applied.push(`buffer -> ${RM(p.buffer)}`); }
    if (p.otherIn != null) { setCash((c) => ({ ...c, otherIn: p.otherIn / 100 })); applied.push(`other income -> ${RM(p.otherIn)}`); }
    if (p.forecastDays) { setForecastDays(p.forecastDays); applied.push(`forecast -> ${p.forecastDays} days`); }
    if (p.ingredients.length) {
      setIngredients((arr) => {
        const next = [...arr];
        for (const pi of p.ingredients) {
          const ex = next.find((x) => x.name.toLowerCase() === pi.name.toLowerCase());
          if (ex) {
            ex.onHandG = pi.onHandG;
            setInventoryCounts((cc) => cc.map((c) => c.ingredientId === ex.id ? { ...c, quantityG: pi.onHandG, source: "PHYSICAL_COUNT", countedAt: todayISO() } : c));
            applied.push(`stock ${ex.name} -> ${pi.onHandG} g`);
          } else {
            const id = uid("I");
            const fresh = { id, name: pi.name, icon: "🧺", unit: "g", packs: 0, packSizeG: 1000, packPriceRM: 0, urgency: "NORMAL", supplier: "", leadDays: 2, onHandG: pi.onHandG, demandG: 0, unitCostSenPerG: 0 };
            next.push(fresh);
            setInventoryCounts((cc) => [...cc, { ingredientId: id, quantityG: pi.onHandG, countedAt: todayISO(), source: "PHYSICAL_COUNT", autoDeduct: true }]);
            applied.push(`new ingredient ${pi.name} ${pi.onHandG} g`);
          }
        }
        return next;
      });
    }
    if (p.expenses.length) {
      setExpenses((arr) => [
        ...arr,
        ...p.expenses.map((e) => ({ id: uid("exp"), name: e.name, category: e.category, amountSen: e.amountSen || 0, incurredDate: todayISO(), dueDate: e.dueDate || "", paidDate: "", paid: false, expenseClass: "OPERATING" })),
      ]);
      applied.push(`expenses ${p.expenses.length} added`);
    }
    setAppliedPrompt(promptText.trim());
    flash(applied.length ? "Prompt applied: " + applied.join(" | ") : "Prompt saved (no values detected).");
  };

  const resetDemo = () => {
    if (!confirm("Reset everything to the demo bakery?")) return;
    setCash(DEMO_CASH); setExpenses(DEMO_EXPENSES); setProducts(DEMO_PRODUCTS); setIngredients(DEMO_INGREDIENTS);
    setInventoryCounts(DEMO_INVENTORY); setOtherIncome(DEMO_OTHER_INCOME); setManualSales(DEMO_MANUAL_SALES);
    setSalesMode(DEMO_SALES_MODE); setForecastDays(7); setPromptText(""); setAppliedPrompt("");
    flash("Demo bakery restored.");
  };
  const clearAll = () => {
    if (!confirm("Clear all data from this browser?")) return;
    clearState();
    location.reload();
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // ---- style presets ----
    const FONT = "Times New Roman";
    const thin = { style: "thin", color: { rgb: "E2E8F0" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };
    const sTitle = { font: { name: FONT, sz: 16, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "0D9488" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    const sSub = { font: { name: FONT, sz: 10, italic: true, color: { rgb: "8B9BB0" } }, alignment: { horizontal: "center" }, border };
    const sHdr = { font: { name: FONT, sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "0D9488" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    const sHdrAlt = { font: { name: FONT, sz: 12, bold: true, color: { rgb: "FFFFFF" } }, fill: { patternType: "solid", fgColor: { rgb: "0A7C72" } }, alignment: { horizontal: "center", vertical: "center" }, border };
    const sBody = { font: { name: FONT, sz: 11 }, alignment: { vertical: "center" }, border };
    const sBodyR = { font: { name: FONT, sz: 11 }, alignment: { horizontal: "right", vertical: "center" }, border };
    const sBodyC = { font: { name: FONT, sz: 11 }, alignment: { horizontal: "center", vertical: "center" }, border };
    const sProfit = { font: { name: FONT, sz: 12, bold: true, color: { rgb: "10B981" } }, fill: { patternType: "solid", fgColor: { rgb: "ECFDF5" } }, alignment: { horizontal: "right", vertical: "center" }, border };
    const sLoss = { font: { name: FONT, sz: 12, bold: true, color: { rgb: "EF4444" } }, fill: { patternType: "solid", fgColor: { rgb: "FEF2F2" } }, alignment: { horizontal: "right", vertical: "center" }, border };
    const sLabel = { font: { name: FONT, sz: 11, bold: true }, alignment: { vertical: "center" }, border };

    // helper: apply style to a range
    const styleRange = (ws, r1, c1, r2, c2, s) => {
      for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { v: "" };
        ws[addr].s = s;
      }
    };

    // ---- Sheet 1: Summary ----
    const summaryData = [
      ["Cashflow Rescue AI — Weekly Management Report", ""],
      [`Generated: ${new Date().toLocaleString("en-MY")}`, ""],
      ["", ""],
      ["Metric", "Value"],
      ["Cash on hand", RM(num(cash.cashOnHand) * 100)],
      ["Safety buffer", RM(num(cash.buffer) * 100)],
      ["Other income expected", RM(num(cash.otherIn) * 100)],
      ["Total expenses (30d)", RM(calc.totalExpenseSen)],
      ["Reserved for unpaid bills", RM(calc.reservedExpenseSen)],
      ["Restock plan cost", RM(calc.totalRestockSen)],
      ["Projected cash after shopping", RM(calc.projectedAfterSen)],
      ["Net position vs safety buffer", (calc.aboveBufferSen >= 0 ? "+" : "") + RM(calc.aboveBufferSen)],
      ["Runway days", String(calc.runwayDays ?? "-")],
      ["Recommendation", calc.recommendation],
      ["", ""],
      ["User prompt (applied):", appliedPrompt || "—"],
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1["!cols"] = [{ wpx: 280 }, { wpx: 280 }];
    ws1["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
      { s: { r: 14, c: 0 }, e: { r: 14, c: 1 } },
    ];
    ws1["!rows"] = [{ hpx: 30 }, { hpx: 20 }, {}, { hpx: 24 }];
    styleRange(ws1, 0, 0, 0, 1, sTitle);
    styleRange(ws1, 1, 0, 1, 1, sSub);
    styleRange(ws1, 3, 0, 3, 1, sHdr);
    for (let r = 4; r <= 12; r++) {
      ws1[XLSX.utils.encode_cell({ r, c: 0 })].s = sLabel;
      const isProjected = (r === 10);
      const isNet = (r === 11);
      if (isNet) {
        ws1[XLSX.utils.encode_cell({ r, c: 1 })].s = calc.aboveBufferSen >= 0 ? sProfit : sLoss;
      } else {
        ws1[XLSX.utils.encode_cell({ r, c: 1 })].s = sBodyR;
      }
    }
    styleRange(ws1, 14, 0, 14, 1, { font: { name: FONT, sz: 11, bold: true }, alignment: { vertical: "center", wrapText: true }, border });
    XLSX.utils.book_append_sheet(wb, ws1, "Summary");

    // ---- Sheet 2: Expenses ----
    const expData = [["Name", "Category", "Amount (RM)", "Incurred", "Due", "Paid"]];
    expenses.forEach((e) => expData.push([e.name, e.category, (num(e.amountSen) / 100).toFixed(2), e.incurredDate || "—", e.dueDate || "—", e.paid ? "Yes" : "No"]));
    const ws2 = XLSX.utils.aoa_to_sheet(expData);
    ws2["!cols"] = [{ wpx: 200 }, { wpx: 130 }, { wpx: 110 }, { wpx: 100 }, { wpx: 100 }, { wpx: 70 }];
    ws2["!rows"] = [{ hpx: 24 }];
    styleRange(ws2, 0, 0, 0, 5, sHdr);
    for (let r = 1; r < expData.length; r++) {
      styleRange(ws2, r, 0, r, 1, sBody);
      ws2[XLSX.utils.encode_cell({ r, c: 2 })].s = sBodyR;
      ws2[XLSX.utils.encode_cell({ r, c: 3 })].s = sBodyC;
      ws2[XLSX.utils.encode_cell({ r, c: 4 })].s = sBodyC;
      ws2[XLSX.utils.encode_cell({ r, c: 5 })].s = sBodyC;
    }
    XLSX.utils.book_append_sheet(wb, ws2, "Expenses");

    // ---- Sheet 3: Restock Plan ----
    const invData = [["Ingredient", "On hand (g)", "Demand (g)", "Pack size", "Pack price (RM)", "Packs needed", "Cost (RM)", "Supplier", "Lead days", "Urgency"]];
    calc.lines.forEach((l) => invData.push([l.ing.name, l.physical, l.demand, l.packSize, num(l.ing.packPriceRM), l.packsNeeded, l.costRM.toFixed(2), l.ing.supplier || "—", l.ing.leadDays, l.autoUrgency]));
    const ws3 = XLSX.utils.aoa_to_sheet(invData);
    ws3["!cols"] = [{ wpx: 160 }, { wpx: 100 }, { wpx: 100 }, { wpx: 90 }, { wpx: 110 }, { wpx: 90 }, { wpx: 100 }, { wpx: 130 }, { wpx: 80 }, { wpx: 90 }];
    ws3["!rows"] = [{ hpx: 24 }];
    styleRange(ws3, 0, 0, 0, 9, sHdrAlt);
    const urgColors = { CRITICAL: "EF4444", HIGH: "F97316", MEDIUM: "F59E0B", NORMAL: "10B981", LOW: "8B9BB0" };
    for (let r = 1; r < invData.length; r++) {
      styleRange(ws3, r, 0, r, 8, sBody);
      ws3[XLSX.utils.encode_cell({ r, c: 9 })].s = { font: { name: FONT, sz: 11, bold: true, color: { rgb: urgColors[invData[r][9]] || "8B9BB0" } }, alignment: { horizontal: "center", vertical: "center" }, border };
      ws3[XLSX.utils.encode_cell({ r, c: 1 })].s = sBodyR;
      ws3[XLSX.utils.encode_cell({ r, c: 2 })].s = sBodyR;
      ws3[XLSX.utils.encode_cell({ r, c: 4 })].s = sBodyR;
      ws3[XLSX.utils.encode_cell({ r, c: 5 })].s = sBodyC;
      ws3[XLSX.utils.encode_cell({ r, c: 6 })].s = sBodyR;
      ws3[XLSX.utils.encode_cell({ r, c: 8 })].s = sBodyC;
    }
    XLSX.utils.book_append_sheet(wb, ws3, "Restock Plan");

    // ---- Sheet 4: Products ----
    const prodData = [["Product", "Recent daily", "Forecast units", "Price (RM)", "Cost (RM)", "Margin %"]];
    calc.productRows.forEach((p) => {
      const price = num(p.defaultPriceSen);
      const cost = num(p.defaultCostSen);
      const margin = price > 0 ? ((price - cost) / price * 100).toFixed(0) : "0";
      prodData.push([p.name, p.recentDaily, p.forecastUnits, (price / 100).toFixed(2), (cost / 100).toFixed(2), margin]);
    });
    const ws4 = XLSX.utils.aoa_to_sheet(prodData);
    ws4["!cols"] = [{ wpx: 180 }, { wpx: 100 }, { wpx: 110 }, { wpx: 100 }, { wpx: 100 }, { wpx: 90 }];
    ws4["!rows"] = [{ hpx: 24 }];
    styleRange(ws4, 0, 0, 0, 5, sHdr);
    for (let r = 1; r < prodData.length; r++) {
      styleRange(ws4, r, 0, r, 0, sBody);
      ws4[XLSX.utils.encode_cell({ r, c: 1 })].s = sBodyR;
      ws4[XLSX.utils.encode_cell({ r, c: 2 })].s = sBodyR;
      ws4[XLSX.utils.encode_cell({ r, c: 3 })].s = sBodyR;
      ws4[XLSX.utils.encode_cell({ r, c: 4 })].s = sBodyR;
      const marginVal = parseFloat(prodData[r][5]);
      const marginStyle = marginVal >= 40 ? sProfit : marginVal < 20 ? sLoss : sBodyC;
      ws4[XLSX.utils.encode_cell({ r, c: 5 })].s = marginStyle;
    }
    XLSX.utils.book_append_sheet(wb, ws4, "Products");

    XLSX.writeFile(wb, "cashflow-rescue-report.xlsx", { cellStyles: true });
    flash("Excel report downloaded with formatting.");
  };

  return html`
    <div className="app">
      <header className="hero">
        <div className="hero-inner">
          <div className="logo">🍞</div>
          <div>
            <h1>Cashflow Rescue AI</h1>
            <p>One prompt → one clear restocking decision that protects your cash.</p>
          </div>
          <div className="pill">🔒 Private · Autonomous · Live</div>
        </div>
      </header>

      <${DashboardBar} calc=${calc} cash=${cash} />

      ${toast && html`<div className="notice" role="status"><span>✓</span> ${toast}<button onClick=${() => setToast("")} aria-label="Dismiss">x</button></div>`}

      <main className="content">
        <${PromptCard}
          promptText=${promptText} setPromptText=${setPromptText}
          parsed=${parsed} onApply=${savePrompt} appliedPrompt=${appliedPrompt}
        />

        <${CashCard} cash=${cash} setCash=${setCash} totalSales=${calc.weeklySalesSen} unpaid=${calc.unsettledSalesSen} entries=${manualSales.length} manualSales=${manualSales} products=${products} onAddSale=${addSale} onRemoveSale=${removeSale} onPOSImport=${handlePOSCSVImport} />

        <${ExpensesCard} expenses=${expenses}
          onUpdate=${updateExp} onRemove=${removeExp}
          onAddClick=${() => setShowAddExp(true)} showAdd=${showAddExp}
          onAdd=${addExp} onClose=${() => setShowAddExp(false)}
          total=${calc.totalExpenseSen} reserved=${calc.reservedExpenseSen}
        />

        <${StockCard}
          ingredients=${ingredients} inventoryCounts=${inventoryCounts}
          lines=${calc.lines} forecastDays=${forecastDays}
          setForecastDays=${setForecastDays} totalRestockRM=${calc.totalRestockRM}
          onUpdateIng=${updateIng} onRemoveIng=${removeIng} onUpdateInv=${updateInv}
          onAddClick=${() => setShowAddIng(true)} showAdd=${showAddIng}
          onAdd=${addIng} onClose=${() => setShowAddIng(false)}
          stockMode=${stockMode} setStockMode=${setStockMode}
          csvFileName=${csvFileName} onCSVImport=${handleCSVImport}
          productRows=${calc.productRows} demandG=${calc.demandG}
          demandOverrides=${demandOverrides} onSetDemandOverride=${setDemandOverride}
        />

        <${OtherIncomeCard} items=${otherIncome} onAddClick=${() => setShowAddInc(true)} onAdd=${addIncome} onClose=${() => setShowAddInc(false)} showAdd=${showAddInc} onRemove=${removeIncome} />

        <${ProductsCard} products=${products} onUpdate=${updateProd} onRemove=${removeProd} onAddClick=${() => setShowAddProd(true)} onAdd=${addProd} onClose=${() => setShowAddProd(false)} showAdd=${showAddProd} />

        <div className="toolbar">
          <div className="left">
            <button className="btn btn-lg" onClick=${() => { setShowReport(true); setReportTab("decision"); }}>✦ View Full Report</button>
            <button className="btn accent btn-lg" onClick=${exportExcel}>⇩ Download Excel</button>
          </div>
          <div className="right">
            <button className="btn ghost" onClick=${resetDemo}>↺ Reset demo</button>
            <button className="btn ghost" onClick=${clearAll}>Clear data</button>
          </div>
        </div>
      </main>

      ${showReport && html`<${ReportModal} calc=${calc} onClose=${() => setShowReport(false)} tab=${reportTab} setTab=${setReportTab} promptText=${appliedPrompt} cash=${cash} expenses=${expenses} onExportExcel=${exportExcel} />`}

      <footer className="foot">
        <p><strong>Cashflow Rescue AI</strong> — your cash, stock, and profit decision in one place. <span className="foot-private">Powered by WorkBuddy · Your data stays in this browser.</span></p>
      </footer>
    </div>
  `;
}

/* ---------- Dashboard Bar ---------- */
function DashboardBar({ calc, cash }) {
  const recoClass = calc.recommendation === "FULL" ? "full" : calc.recommendation === "PARTIAL" ? "partial" : "none";
  const recoIcon = calc.recommendation === "FULL" ? "✅" : calc.recommendation === "PARTIAL" ? "⚠️" : "🛑";
  const recoTitle = calc.recommendation === "FULL" ? "Buy the full restock plan" : calc.recommendation === "PARTIAL" ? "Buy critical items only" : "Hold all buying";
  const recoDetail = `Projected cash after shopping: ${RM(calc.projectedAfterSen)} (${calc.aboveBufferSen >= 0 ? "+" : ""}${RM(calc.aboveBufferSen)} vs your safety buffer)`;

  return html`
    <${Fragment}>
      <div className="dashboard">
        <div className="dash-card brand">
          <div className="dash-icon">💵</div>
          <div className="dash-label">Cash Available</div>
          <div className="dash-value">${RM(calc.spendableNow)}</div>
          <div className="dash-hint">After reserving unpaid bills</div>
        </div>
        <div className="dash-card ${calc.reservedExpenseSen > 0 ? "watch" : ""}">
          <div className="dash-icon">📋</div>
          <div className="dash-label">Bills Due</div>
          <div className="dash-value">${RM(calc.reservedExpenseSen)}</div>
          <div className="dash-hint">${calc.heldLines.length} held back from buying</div>
        </div>
        <div className="dash-card ${calc.totalRestockSen > 0 ? "" : ""}">
          <div className="dash-icon">📦</div>
          <div className="dash-label">Restock Cost</div>
          <div className="dash-value">${RM(calc.totalRestockSen)}</div>
          <div className="dash-hint">${calc.lines.filter(l => l.packsNeeded > 0).length} items to buy</div>
        </div>
        <div className="dash-card ${calc.aboveBufferSen >= 0 ? "good" : "crit"}">
          <div className="dash-icon">${calc.aboveBufferSen >= 0 ? "📈" : "📉"}</div>
          <div className="dash-label">Net Position</div>
          <div className="dash-value">${calc.aboveBufferSen >= 0 ? "+" : ""}${RM(calc.aboveBufferSen)}</div>
          <div className="dash-hint">vs your ${RM(calc.bufferSen)} safety buffer</div>
        </div>
      </div>
      <div className=${"reco-banner " + recoClass}>
        <div className="reco-icon">${recoIcon}</div>
        <div className="reco-text">
          <div className="reco-title">${recoTitle}</div>
          <div className="reco-detail">${recoDetail}</div>
        </div>
      </div>
    <//>
  `;
}

/* ---------- Prompt card ---------- */
function PromptCard({ promptText, setPromptText, parsed, onApply, appliedPrompt }) {
  const placeholder = "Example: I have RM 1,100 cash. I want to keep RM 200 as a buffer. RM 500 rent is due. I sold 10 croissants today and I have 1.2 kg flour left, 500 g butter, 300 g sugar. Forecast 7 days.";
  const example = placeholder;
  const detected = [];
  if (parsed.cash != null) detected.push(`Cash on hand -> ${RM(parsed.cash)}`);
  if (parsed.buffer != null) detected.push(`Safety buffer -> ${RM(parsed.buffer)}`);
  if (parsed.otherIn != null) detected.push(`Other income -> ${RM(parsed.otherIn)}`);
  if (parsed.forecastDays) detected.push(`Forecast -> ${parsed.forecastDays} days`);
  parsed.ingredients.forEach((i) => detected.push(`Ingredient "${i.name}" -> ${i.onHandG} g`));
  parsed.expenses.forEach((e) => detected.push(`Expense "${e.name}" -> ${RM(e.amountSen)}`));
  parsed.products.forEach((p) => detected.push(`Sale: ${p.qty} x ${p.name}${p.priceSen ? " @ " + RM(p.priceSen) : ""}`));

  return html`
    <section className="card">
      <div className="card-head">
        <span className="step-num">✦</span>
        <div style=${{ flex: 1 }}>
          <span className="pill-mini">ONE PROMPT · ONE GOAL · END-TO-END EXECUTION</span>
          <h2 style=${{ marginTop: 6 }}>Tell us what is happening in your business</h2>
          <p className="card-sub">Describe your cash, bills, sales and stock in plain words. The agent detects values, fills the forms, runs the forecast, and recommends what to buy.</p>
        </div>
      </div>

      <div className="workflow">
        <div className="workflow-step"><span className="workflow-dot">1</span><span>Read prompt</span></div>
        <div className="workflow-arrow">→</div>
        <div className="workflow-step"><span className="workflow-dot">2</span><span>Detect values</span></div>
        <div className="workflow-arrow">→</div>
        <div className="workflow-step"><span className="workflow-dot">3</span><span>Fill forms</span></div>
        <div className="workflow-arrow">→</div>
        <div className="workflow-step"><span className="workflow-dot">4</span><span>Forecast demand</span></div>
        <div className="workflow-arrow">→</div>
        <div className="workflow-step"><span className="workflow-dot">5</span><span>Recommend decision</span></div>
      </div>

      <textarea
        placeholder=${placeholder}
        value=${promptText}
        onChange=${(e) => setPromptText(e.target.value)}
        aria-label="Describe your business situation"
      />
      <details>
        <summary>Show example prompt</summary>
        <div className="hint" style=${{ whiteSpace: "pre-wrap", marginTop: 6 }}>${example}</div>
      </details>
      <div className="actions-row">
        <div className="btn-row">
          <button className="btn btn-lg" onClick=${onApply}>Apply to inputs</button>
          <button className="btn ghost" onClick=${() => setPromptText(example)}>Insert example</button>
          <button className="btn ghost" onClick=${() => setPromptText("")}>Clear</button>
        </div>
        <div className="hint">🔒 Your prompt stays in this browser.</div>
      </div>
      ${detected.length > 0 && html`
        <div className="parsed-card">
          <h4>Detected from your prompt ${html`<span className="badge">click Apply to update</span>`}</h4>
          <ul>${detected.map((d) => html`<li key=${d}>${d}</li>`)}</ul>
        </div>
      `}
      ${appliedPrompt && html`
        <div className="parsed-card" style=${{ background: "var(--good-light)", borderColor: "var(--good-soft)" }}>
          <h4>Currently applied prompt</h4>
          <blockquote style=${{ margin: 0, fontStyle: "italic" }}>${appliedPrompt}</blockquote>
        </div>
      `}
    </section>
  `;
}

/* ---------- Cash ---------- */
function CashCard({ cash, setCash, totalSales, unpaid, entries, manualSales, products, onAddSale, onRemoveSale, onPOSImport }) {
  const [showSales, setShowSales] = useState(false);
  const [salesMode, setSalesMode] = useState("manual"); // "manual" | "pos"
  const [showAddSale, setShowAddSale] = useState(false);
  const prodList = products ? Object.values(products) : [];

  const handlePOSFile = (e) => {
    const file = e.target.files[0];
    if (file) onPOSImport(file);
  };

  return html`
    <section className="card">
      <div className="card-head">
        <span className="step-num">1</span>
        <div style=${{ flex: 1 }}>
          <h2>Your shop's money today</h2>
          <p className="card-sub">Use actual cash on hand. Unpaid sales are income but never spendable cash.</p>
        </div>
      </div>
      <div className="row">
        <div className="col">
          <label className="label">💵 Cash in hand (RM)</label>
          <input type="number" min="0" step="0.01" value=${cash.cashOnHand} onChange=${(e) => setCash({ ...cash, cashOnHand: num(e.target.value) })} />
          <div className="hint">Drawer + bank right now</div>
        </div>
        <div className="col">
          <label className="label">🛡️ Safety buffer (RM)</label>
          <input type="number" min="0" step="0.01" value=${cash.buffer} onChange=${(e) => setCash({ ...cash, buffer: num(e.target.value) })} />
          <div className="hint">Cash you never want to drop below</div>
        </div>
        <div className="col">
          <label className="label">🎁 Other money expected (RM)</label>
          <input type="number" min="0" step="0.01" value=${cash.otherIn} onChange=${(e) => setCash({ ...cash, otherIn: num(e.target.value) })} />
          <div className="hint">Forecast only, not today's budget</div>
        </div>
      </div>

      <div className="actions-row" style=${{ marginTop: 14 }}>
        <div className="hint">📌 Sales recorded: <strong>${RM(totalSales)}</strong> · Unpaid: ${RM(unpaid)} · ${entries} entries</div>
        <button className="btn ghost" onClick=${() => setShowSales(!showSales)}>${showSales ? "▾ Hide" : "▸ Show"} today's sales</button>
      </div>

      ${showSales && html`
        <div style=${{ marginTop: 14 }}>
          <div className="stock-mode-toggle" style=${{ marginBottom: 12 }}>
            <button className=${salesMode === "manual" ? "active" : ""} onClick=${() => setSalesMode("manual")}>✍️ Manual input</button>
            <button className=${salesMode === "pos" ? "active" : ""} onClick=${() => setSalesMode("pos")}>📁 POS CSV import</button>
          </div>

          ${salesMode === "pos" ? html`
            <div className="csv-zone" onClick=${() => document.getElementById("pos-csv-input").click()}>
              <div className="csv-icon">🧾</div>
              <div className="csv-title">Upload your POS sales CSV</div>
              <div className="csv-desc">Export today's sales from your POS system. We'll match product names automatically.</div>
              <input type="file" accept=".csv,.txt" id="pos-csv-input" style=${{ display: "none" }} onChange=${handlePOSFile} />
            </div>
            <div className="csv-format-hint">{"Expected format:\nProduct,Quantity,Price,Date\nButter Croissant,5,8.50,2026-10-10\nChocolate Bun,3,7.50,2026-10-10"}</div>
          ` : html`
            ${manualSales && manualSales.length > 0 ? html`
              <div className="scroll-x">
                <table className="stock-table">
                  <thead><tr><th className="stock-col-name">Product</th><th className="stock-col-hand">Qty</th><th className="stock-col-price">Total (RM)</th><th className="stock-col-status">Paid</th><th className="stock-col-remove"></th></tr></thead>
                  <tbody>
                    ${manualSales.map((s) => html`
                      <tr key=${s.id}>
                        <td className="stock-col-name">${s.productName || "—"}</td>
                        <td className="stock-col-hand" style=${{ textAlign: "center" }}>${s.quantity}</td>
                        <td className="stock-col-price" style=${{ textAlign: "right" }}>${(num(s.totalSen) / 100).toFixed(2)}</td>
                        <td className="stock-col-status" style=${{ textAlign: "center" }}>${s.settled ? "✓" : "—"}</td>
                        <td className="stock-col-remove"><button className="btn danger small" onClick=${() => onRemoveSale(s.id)}>Remove</button></td>
                      </tr>
                    `)}
                  </tbody>
                </table>
              </div>
            ` : html`
              <div className="empty-state">
                <div className="empty-icon">🧾</div>
                <div className="empty-title">No sales recorded today</div>
                <div className="empty-desc">Add sales manually or import from your POS system. Sales feed the demand forecast automatically.</div>
              </div>
            `}
            <div className="actions-row" style=${{ marginTop: 10 }}>
              <div className="hint">${prodList.length} products available for matching</div>
              <button className="btn add-btn" onClick=${() => setShowAddSale(true)}>＋ Add sale</button>
            </div>
          `}

          ${showAddSale && html`<${AddSaleModal} products=${prodList} onClose=${() => setShowAddSale(false)} onAdd=${(data) => { onAddSale(data); setShowAddSale(false); }} />`}
        </div>
      `}
    </section>
  `;
}

function AddSaleModal({ products, onClose, onAdd }) {
  const [productId, setProductId] = useState(products[0]?.id || "");
  const [quantity, setQuantity] = useState("1");
  const [priceRM, setPriceRM] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    setErr("");
    if (!productId) { setErr("Please select a product."); return; }
    if (!num(quantity)) { setErr("Please enter a quantity."); return; }
    const prod = products.find((p) => p.id === productId);
    const priceSen = priceRM ? Math.round(num(priceRM) * 100) : num(prod.defaultPriceSen);
    onAdd({ productId, quantity: num(quantity), priceSen });
  };
  return html`
    <div className="modal-bg" onClick=${(e) => e.target.classList.contains("modal-bg") && onClose()}>
      <div className="modal" role="dialog" aria-label="Add sale">
        <h3>Record a sale</h3>
        <p>Select the product and quantity sold today.</p>
        <label className="label">Product</label>
        <select value=${productId} onChange=${(e) => setProductId(e.target.value)}>
          ${products.map((p) => html`<option key=${p.id} value=${p.id}>${p.icon} ${p.name}</option>`)}
        </select>
        <div className="grid-2" style=${{ marginTop: 10 }}>
          <div>
            <label className="label">Quantity sold</label>
            <input type="number" min="1" step="1" value=${quantity} onChange=${(e) => setQuantity(e.target.value)} />
          </div>
          <div>
            <label className="label">Price per unit (RM) — optional</label>
            <input type="number" min="0" step="0.01" value=${priceRM} onChange=${(e) => setPriceRM(e.target.value)} placeholder="Use product default" />
          </div>
        </div>
        ${err && html`<div className="err">${err}</div>`}
        <div className="actions">
          <button className="btn ghost" onClick=${onClose}>Cancel</button>
          <button className="btn" onClick=${submit}>Add sale</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Expenses ---------- */
function ExpensesCard({ expenses, onUpdate, onRemove, onAddClick, showAdd, onAdd, onClose, total, reserved }) {
  const [open, setOpen] = useState(true);
  const dueSoon = expenses.filter((e) => !e.paid).reduce((s, e) => s + num(e.amountSen), 0);
  return html`
    <section className=${"card" + (open ? "" : " collapsed")}>
      <div className="card-head">
        <span className="step-num">2</span>
        <div style=${{ flex: 1 }}>
          <h2>Expenses & bills</h2>
          <p className="card-sub">Rent, materials, utilities, wages and anything else. Edit any field.</p>
        </div>
        <div style=${{ textAlign: "right" }}>
          <div className="pill-mini">${RM(reserved)} reserved · ${RM(dueSoon)} due soon</div>
        </div>
        <button className="collapse-btn" onClick=${() => setOpen(!open)} aria-label=${open ? "Collapse section" : "Expand section"}>${open ? "▾" : "▸"}</button>
      </div>
      <div className="card-body">
      <div className="scroll-x">
        <table>
          <thead><tr><th>Name</th><th>Category</th><th>Amount (RM)</th><th>Due</th><th>Paid</th><th></th></tr></thead>
          <tbody>
            ${expenses.map((e) => html`
              <tr key=${e.id}>
                <td><input type="text" value=${e.name} onChange=${(ev) => onUpdate(e.id, "name", ev.target.value)} aria-label=${"Expense name " + e.name} /></td>
                <td>
                  <select value=${e.category} onChange=${(ev) => onUpdate(e.id, "category", ev.target.value)}>
                    <option value="rent">Rent</option><option value="utilities">Utilities</option>
                    <option value="materials">Materials</option><option value="wages">Wages</option>
                    <option value="transport">Transport</option><option value="other">Other</option>
                  </select>
                </td>
                <td><input type="number" min="0" step="0.01" value=${(num(e.amountSen) / 100).toFixed(2)} onChange=${(ev) => onUpdate(e.id, "amountSen", Math.round(num(ev.target.value) * 100))} /></td>
                <td><input type="date" value=${e.dueDate} onChange=${(ev) => onUpdate(e.id, "dueDate", ev.target.value)} /></td>
                <td><input type="checkbox" checked=${!!e.paid} onChange=${(ev) => onUpdate(e.id, "paid", ev.target.checked)} aria-label=${"Paid " + e.name} /></td>
                <td><button className="btn danger small" onClick=${() => onRemove(e.id)} aria-label=${"Remove " + e.name}>Remove</button></td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
      <div className="actions-row">
        <div className="hint">Total 30-day: <strong>${RM(total)}</strong></div>
        <button className="btn add-btn" onClick=${onAddClick}>＋ Add expense</button>
      </div>
      ${showAdd && html`<${AddExpenseModal} onClose=${onClose} onAdd=${onAdd} />`}
      </div>
    </section>
  `;
}

function AddExpenseModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [amountRM, setAmountRM] = useState("");
  const [category, setCategory] = useState("other");
  const [dueDate, setDueDate] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    setErr("");
    if (!name.trim()) { setErr("Please give the expense a name."); return; }
    if (!num(amountRM)) { setErr("Please enter an amount in RM."); return; }
    onAdd({ name: name.trim(), amountRM, category, dueDate });
  };
  return html`
    <div className="modal-bg" onClick=${(e) => e.target.classList.contains("modal-bg") && onClose()}>
      <div className="modal" role="dialog" aria-label="Add expense">
        <h3>Add an expense</h3>
        <p>Name it however you like. You can rename it any time after adding.</p>
        <label className="label">Name</label>
        <input type="text" value=${name} onChange=${(e) => setName(e.target.value)} placeholder="e.g. Shop rent" autoFocus />
        <div className="grid-2" style=${{ marginTop: 10 }}>
          <div>
            <label className="label">Amount (RM)</label>
            <input type="number" min="0" step="0.01" value=${amountRM} onChange=${(e) => setAmountRM(e.target.value)} placeholder="0.00" />
          </div>
          <div>
            <label className="label">Category</label>
            <select value=${category} onChange=${(e) => setCategory(e.target.value)}>
              <option value="rent">Rent</option><option value="utilities">Utilities</option>
              <option value="materials">Materials</option><option value="wages">Wages</option>
              <option value="transport">Transport</option><option value="other">Other</option>
            </select>
          </div>
        </div>
        <label className="label" style=${{ marginTop: 10 }}>Due date (optional)</label>
        <input type="date" value=${dueDate} onChange=${(e) => setDueDate(e.target.value)} />
        ${err && html`<div className="err">${err}</div>`}
        <div className="actions">
          <button className="btn ghost" onClick=${onClose}>Cancel</button>
          <button className="btn" onClick=${submit}>Add expense</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Stock (SIMPLIFIED & CLEAR) ---------- */
function StockCard({ ingredients, inventoryCounts, lines, forecastDays, setForecastDays, totalRestockRM, onUpdateIng, onRemoveIng, onUpdateInv, onAddClick, showAdd, onAdd, onClose, stockMode, setStockMode, csvFileName, onCSVImport, productRows, demandG, demandOverrides, onSetDemandOverride }) {
  const [open, setOpen] = useState(true);
  const observed = ingredients.length;
  const needToBuy = lines.filter(l => l.packsNeeded > 0).length;
  const totalProducts = productRows ? productRows.length : 0;
  const totalDemandG = demandG ? Object.values(demandG).reduce((s, v) => s + num(v), 0) : 0;

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (file) onCSVImport(file);
  };

  return html`
    <section className=${"card" + (open ? "" : " collapsed")}>
      <div className="card-head">
        <span className="step-num">3</span>
        <div style=${{ flex: 1 }}>
          <h2>Stock & sales forecast</h2>
          <p className="card-sub">Enter what you have on hand — demand is auto-calculated from your product sales × recipes.</p>
        </div>
        <div style=${{ display: "flex", gap: 8, alignItems: "center" }}>
          <label className="label" style=${{ margin: 0 }}>Forecast</label>
          <input type="number" min="1" max="60" value=${forecastDays} onChange=${(e) => setForecastDays(num(e.target.value, 1))} style=${{ width: 70 }} />
          <span className="hint" style=${{ margin: 0 }}>days</span>
        </div>
        <button className="collapse-btn" onClick=${() => setOpen(!open)} aria-label=${open ? "Collapse section" : "Expand section"}>${open ? "▾" : "▸"}</button>
      </div>

      <div className="card-body">
      ${observed > 0 && html`
        <div className="demand-source">
          <span className="ds-label">📊 Demand source:</span>
          <span>${totalProducts} products × ${forecastDays} days forecast = <strong>${totalDemandG} g</strong> total ingredient demand, calculated from product recipes & sales rate.</span>
        </div>
      `}

      <div className="stock-mode-toggle" style=${{ marginBottom: 14 }}>
        <button className=${stockMode === "count" ? "active" : ""} onClick=${() => setStockMode("count")}>✍️ Monthly count</button>
        <button className=${stockMode === "csv" ? "active" : ""} onClick=${() => setStockMode("csv")}>📁 CSV import</button>
      </div>

      ${stockMode === "csv" && html`
        <div className="csv-zone" onClick=${() => document.getElementById("csv-input").click()}>
          <div className="csv-icon">📂</div>
          <div className="csv-title">${csvFileName ? "Loaded: " + csvFileName : "Click to upload your stock CSV"}</div>
          <div className="csv-desc">${csvFileName ? "Switch to Monthly count to edit values, or upload a new file." : "Export from your stock system and upload here. We'll match ingredient names automatically."}</div>
          <input type="file" accept=".csv,.txt" id="csv-input" style=${{ display: "none" }} onChange=${handleFile} />
        </div>
        <div className="csv-format-hint">{"Expected format:\nIngredient,Quantity\nBread Flour,12000\nButter,1200\nSugar,3000"}</div>
      `}

      ${stockMode === "count" && (observed === 0 ? html`
        <div className="empty-state">
          <div className="empty-icon">🧺</div>
          <div className="empty-title">No ingredients yet</div>
          <div className="empty-desc">Add your first ingredient to start forecasting what to restock. Or switch to CSV import to load from your stock system.</div>
        </div>
      ` : html`
        <div className="scroll-x">
          <table className="stock-table">
            <thead>
              <tr>
                <th className="stock-col-name">Ingredient</th>
                <th className="stock-col-hand">On hand (g)</th>
                <th className="stock-col-size">Pack size (g)</th>
                <th className="stock-col-price">Pack price (RM)</th>
                <th className="stock-col-packs">Packs to buy</th>
                <th className="stock-col-status">Status</th>
                <th className="stock-col-remove"></th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((l) => html`<${StockRow} key=${l.ing.id} l=${l} cnt=${inventoryCounts.find((c) => c.ingredientId === l.ing.id)} onUpdateIng=${onUpdateIng} onRemoveIng=${onRemoveIng} onUpdateInv=${onUpdateInv} demandOverrides=${demandOverrides} onSetDemandOverride=${onSetDemandOverride} />`)}
            </tbody>
          </table>
        </div>
      `)}

      ${stockMode === "csv" && observed > 0 && html`
        <div className="scroll-x" style=${{ marginTop: 14 }}>
          <table className="stock-table">
            <thead>
              <tr>
                <th className="stock-col-name">Ingredient</th>
                <th className="stock-col-hand">On hand (g)</th>
                <th className="stock-col-size">Pack size (g)</th>
                <th className="stock-col-price">Pack price (RM)</th>
                <th className="stock-col-packs">Packs to buy</th>
                <th className="stock-col-status">Status</th>
                <th className="stock-col-remove"></th>
              </tr>
            </thead>
            <tbody>
              ${lines.map((l) => html`<${StockRow} key=${l.ing.id} l=${l} cnt=${inventoryCounts.find((c) => c.ingredientId === l.ing.id)} onUpdateIng=${onUpdateIng} onRemoveIng=${onRemoveIng} onUpdateInv=${onUpdateInv} demandOverrides=${demandOverrides} onSetDemandOverride=${onSetDemandOverride} />`)}
            </tbody>
          </table>
        </div>
      `}

      <div className="actions-row">
        <div className="hint">
          <strong>${RM(Math.round(totalRestockRM * 100))}</strong> total restock · ${needToBuy} items to buy · ${observed} ingredients tracked
        </div>
        <button className="btn add-btn" onClick=${onAddClick}>＋ Add ingredient</button>
      </div>
      ${showAdd && html`<${AddIngredientModal} onClose=${onClose} onAdd=${onAdd} />`}
      </div>
    </section>
  `;
}

function StockRow({ l, cnt, onUpdateIng, onRemoveIng, onUpdateInv, demandOverrides, onSetDemandOverride }) {
  const e = l.ing;
  const covPct = Math.round(l.coverage * 100);
  const covClass = l.coverage < 0.4 ? "crit" : l.coverage < 0.7 ? "watch" : "good";
  const isOverridden = demandOverrides && demandOverrides[e.id] != null;
  const demandVal = isOverridden ? demandOverrides[e.id] : l.demand;
  const [demandEdit, setDemandEdit] = useState(String(demandVal));
  useEffect(() => { setDemandEdit(String(demandVal)); }, [demandVal]);
  const commitDemand = () => {
    const n = num(demandEdit);
    if (!n || n === 0) { onSetDemandOverride(e.id, 0); }
    else { onSetDemandOverride(e.id, n); }
  };
  return html`
    <tr className="inv-row">
      <td className="stock-col-name">
        <div className="stock-name-cell">
          <span className="ing-icon">${e.icon || "🧺"}</span>
          <input type="text" value=${e.name} onChange=${(ev) => onUpdateIng(e.id, "name", ev.target.value)} placeholder="Ingredient name" aria-label=${"Ingredient name " + e.name} />
        </div>
        <div className="stock-demand-hint">
          Demand: <input type="number" min="0" step="1" className=${"demand-edit" + (isOverridden ? " overridden" : "")} value=${demandEdit} onChange=${(ev) => setDemandEdit(ev.target.value)} onBlur=${commitDemand} onKeyDown=${(ev) => ev.key === "Enter" && ev.target.blur()} aria-label=${"Edit demand for " + e.name} /> g · ${covPct}% covered${isOverridden ? " ✏️" : ""}
        </div>
      </td>
      <td className="stock-col-hand">
        <${SmoothNumberInput}
          value=${cnt ? cnt.quantityG : e.onHandG}
          onCommit=${(n) => onUpdateInv(e.id, n)}
          placeholder="0"
          step="1"
          min="0"
          ariaLabel=${"Current " + e.name + " stock"}
        />
        <div className="cov-bar">
          <div className=${"cov-fill " + covClass} style=${{ width: covPct + "%" }}></div>
        </div>
      </td>
      <td className="stock-col-size">
        <input type="number" min="0" value=${e.packSizeG} onChange=${(ev) => onUpdateIng(e.id, "packSizeG", num(ev.target.value))} />
      </td>
      <td className="stock-col-price">
        <${SmoothNumberInput}
          value=${num(e.packPriceRM).toFixed(2)}
          onCommit=${(n) => onUpdateIng(e.id, "packPriceRM", n)}
          ariaLabel=${"Pack price for " + e.name}
        />
      </td>
      <td className="stock-col-packs stock-packs-cell">
        ${l.packsNeeded > 0 ? html`
          <div className="packs-num">${l.packsNeeded}</div>
          <div className="packs-cost">${RM(Math.round(l.costRM * 100))}</div>
        ` : html`<div className="packs-ok">✓ In stock</div>`}
      </td>
      <td className="stock-col-status">
        <span className=${"urgency urg-" + l.autoUrgency}>${l.autoUrgency}</span>
      </td>
      <td className="stock-col-remove">
        <button className="btn danger small" onClick=${() => onRemoveIng(e.id)} aria-label=${"Remove " + e.name}>Remove</button>
      </td>
    </tr>
  `;
}

function AddIngredientModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [onHandG, setOnHandG] = useState("");
  const [packSizeG, setPackSizeG] = useState("1000");
  const [packPriceRM, setPackPriceRM] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    setErr("");
    if (!name.trim()) { setErr("Please give the ingredient a name. (e.g. Bread Flour)"); return; }
    onAdd({ name, unit: "g", onHandG, packSizeG, packPriceRM, supplier: "", leadDays: "2", urgency: "NORMAL" });
  };
  return html`
    <div className="modal-bg" onClick=${(e) => e.target.classList.contains("modal-bg") && onClose()}>
      <div className="modal" role="dialog" aria-label="Add ingredient">
        <h3>Add a new ingredient</h3>
        <p>Just the essentials. Demand and urgency are calculated automatically.</p>
        <label className="label">Ingredient name <span style=${{ color: "var(--crit)" }}>*</span></label>
        <input type="text" value=${name} onChange=${(e) => setName(e.target.value)} placeholder="e.g. Bread Flour" autoFocus />
        <div className="grid-2" style=${{ marginTop: 10 }}>
          <div>
            <label className="label">Current stock (g)</label>
            <input type="number" min="0" value=${onHandG} onChange=${(e) => setOnHandG(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="label">Pack size (g)</label>
            <input type="number" min="0" value=${packSizeG} onChange=${(e) => setPackSizeG(e.target.value)} />
          </div>
        </div>
        <label className="label" style=${{ marginTop: 10 }}>Pack price (RM)</label>
        <input type="number" min="0" step="0.01" value=${packPriceRM} onChange=${(e) => setPackPriceRM(e.target.value)} />
        ${err && html`<div className="err">${err}</div>`}
        <div className="actions">
          <button className="btn ghost" onClick=${onClose}>Cancel</button>
          <button className="btn" onClick=${submit}>Add ingredient</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Other income ---------- */
function OtherIncomeCard({ items, onAddClick, onAdd, onClose, showAdd, onRemove }) {
  const [open, setOpen] = useState(true);
  const total = items.reduce((s, i) => s + num(i.amountSen), 0);
  return html`
    <section className=${"card" + (open ? "" : " collapsed")}>
      <div className="card-head">
        <span className="step-num">4</span>
        <div style=${{ flex: 1 }}>
          <h2>Other income</h2>
          <p className="card-sub">Catering, grants, deposits or income outside product sales.</p>
        </div>
        <div className="pill-mini">${items.length} rows · ${RM(total)}</div>
        <button className="collapse-btn" onClick=${() => setOpen(!open)} aria-label=${open ? "Collapse section" : "Expand section"}>${open ? "▾" : "▸"}</button>
      </div>
      <div className="card-body">
      ${items.length === 0 ? html`
        <div className="empty-state">
          <div className="empty-icon">🎁</div>
          <div className="empty-title">No other income yet</div>
          <div className="empty-desc">Add catering, grants or deposits that are not from daily product sales.</div>
        </div>
      ` : html`
        <div className="scroll-x">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Amount (RM)</th><th></th></tr></thead>
            <tbody>
              ${items.map((i) => html`
                <tr key=${i.id}>
                  <td>${fmtDate(i.date)}</td>
                  <td>${i.description}</td>
                  <td>${(num(i.amountSen) / 100).toFixed(2)}</td>
                  <td><button className="btn danger small" onClick=${() => onRemove(i.id)}>Remove</button></td>
                </tr>
              `)}
            </tbody>
          </table>
        </div>
      `}
      <div className="actions-row">
        <div className="hint">${items.length === 0 ? "No entries yet." : "All entries are editable above."}</div>
        <button className="btn add-btn" onClick=${onAddClick}>＋ Add income</button>
      </div>
      ${showAdd && html`<${AddIncomeModal} onClose=${onClose} onAdd=${onAdd} />`}
      </div>
    </section>
  `;
}

function AddIncomeModal({ onClose, onAdd }) {
  const [description, setDescription] = useState("");
  const [amountRM, setAmountRM] = useState("");
  const [date, setDate] = useState(todayISO());
  const [err, setErr] = useState("");
  const submit = () => {
    setErr("");
    if (!description.trim()) { setErr("Please describe this income."); return; }
    if (!num(amountRM)) { setErr("Please enter an amount in RM."); return; }
    onAdd({ description: description.trim(), amountRM, date });
  };
  return html`
    <div className="modal-bg" onClick=${(e) => e.target.classList.contains("modal-bg") && onClose()}>
      <div className="modal" role="dialog" aria-label="Add other income">
        <h3>Add other income</h3>
        <p>Describe the source. You can edit or remove it after adding.</p>
        <label className="label">Description</label>
        <input type="text" value=${description} onChange=${(e) => setDescription(e.target.value)} placeholder="e.g. Saturday catering order" autoFocus />
        <div className="grid-2" style=${{ marginTop: 10 }}>
          <div>
            <label className="label">Amount (RM)</label>
            <input type="number" min="0" step="0.01" value=${amountRM} onChange=${(e) => setAmountRM(e.target.value)} />
          </div>
          <div>
            <label className="label">Date</label>
            <input type="date" value=${date} onChange=${(e) => setDate(e.target.value)} />
          </div>
        </div>
        ${err && html`<div className="err">${err}</div>`}
        <div className="actions">
          <button className="btn ghost" onClick=${onClose}>Cancel</button>
          <button className="btn" onClick=${submit}>Add income</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Products ---------- */
function ProductsCard({ products, onUpdate, onRemove, onAddClick, onAdd, onClose, showAdd }) {
  const [open, setOpen] = useState(true);
  const list = Object.values(products);
  const missing = list.filter((p) => !num(p.defaultPriceSen)).length;
  return html`
    <section className=${"card" + (open ? "" : " collapsed")}>
      <div className="card-head">
        <span className="step-num">5</span>
        <div style=${{ flex: 1 }}>
          <h2>Products & costs</h2>
          <p className="card-sub">Your product catalog with selling price and cost. Used to forecast ingredient demand.</p>
        </div>
        <div className="pill-mini">${list.length} products${missing ? " · " + missing + " missing costs" : ""}</div>
        <button className="collapse-btn" onClick=${() => setOpen(!open)} aria-label=${open ? "Collapse section" : "Expand section"}>${open ? "▾" : "▸"}</button>
      </div>
      <div className="card-body">
      ${list.length === 0 ? html`
        <div className="empty-state">
          <div className="empty-icon">🍞</div>
          <div className="empty-title">No products yet</div>
          <div className="empty-desc">Add your baked goods and set their price & cost so the forecast knows what ingredients you need.</div>
        </div>
      ` : html`
        <div className="scroll-x">
          <table className="products-table">
            <thead><tr><th className="prod-col-name">Name</th><th className="prod-col-price">Price (RM)</th><th className="prod-col-cost">Cost (RM)</th><th className="prod-col-margin">Margin</th><th className="prod-col-remove"></th></tr></thead>
            <tbody>
              ${list.map((p) => html`<${ProductRow} key=${p.id} p=${p} onUpdate=${onUpdate} onRemove=${onRemove} />`)}
            </tbody>
          </table>
        </div>
      `}
      <div className="actions-row">
        <div className="hint">Recipes link products to ingredients for demand forecasting.</div>
        <button className="btn add-btn" onClick=${onAddClick}>＋ Add product</button>
      </div>
      ${showAdd && html`<${AddProductModal} onClose=${onClose} onAdd=${onAdd} />`}
      </div>
    </section>
  `;
}

function ProductRow({ p, onUpdate, onRemove }) {
  const priceRM = num(p.defaultPriceSen) / 100;
  const costRM = num(p.defaultCostSen) / 100;
  const margin = priceRM > 0 ? ((priceRM - costRM) / priceRM * 100).toFixed(0) : "—";
  return html`
    <tr>
      <td className="prod-col-name"><input type="text" value=${p.name} onChange=${(e) => onUpdate(p.id, "name", e.target.value)} aria-label=${"Product " + p.name} /></td>
      <td className="prod-col-price">
        <${SmoothNumberInput}
          value=${priceRM.toFixed(2)}
          onCommit=${(n) => onUpdate(p.id, "defaultPriceSen", Math.round(n * 100))}
          ariaLabel=${"Price for " + p.name}
        />
      </td>
      <td className="prod-col-cost">
        <${SmoothNumberInput}
          value=${costRM.toFixed(2)}
          onCommit=${(n) => onUpdate(p.id, "defaultCostSen", Math.round(n * 100))}
          ariaLabel=${"Cost for " + p.name}
        />
      </td>
      <td className="prod-col-margin"><span className="badge">${margin}${margin !== "—" ? "%" : ""}</span></td>
      <td className="prod-col-remove"><button className="btn danger small" onClick=${() => onRemove(p.id)}>Remove</button></td>
    </tr>
  `;
}

function AddProductModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🍞");
  const [priceRM, setPriceRM] = useState("");
  const [costRM, setCostRM] = useState("");
  const [err, setErr] = useState("");
  const submit = () => {
    setErr("");
    if (!name.trim()) { setErr("Please give the product a name."); return; }
    onAdd({ name: name.trim(), icon, priceRM, costRM });
  };
  return html`
    <div className="modal-bg" onClick=${(e) => e.target.classList.contains("modal-bg") && onClose()}>
      <div className="modal" role="dialog" aria-label="Add product">
        <h3>Add a product</h3>
        <p>Name the product and set its selling price & cost.</p>
        <label className="label">Product name</label>
        <input type="text" value=${name} onChange=${(e) => setName(e.target.value)} placeholder="e.g. Almond Croissant" autoFocus />
        <div className="grid-2" style=${{ marginTop: 10 }}>
          <div>
            <label className="label">Icon (emoji)</label>
            <input type="text" value=${icon} onChange=${(e) => setIcon(e.target.value)} maxLength=${2} />
          </div>
          <div>
            <label className="label">Default price (RM)</label>
            <input type="number" min="0" step="0.01" value=${priceRM} onChange=${(e) => setPriceRM(e.target.value)} />
          </div>
        </div>
        <label className="label" style=${{ marginTop: 10 }}>Default cost (RM)</label>
        <input type="number" min="0" step="0.01" value=${costRM} onChange=${(e) => setCostRM(e.target.value)} />
        ${err && html`<div className="err">${err}</div>`}
        <div className="actions">
          <button className="btn ghost" onClick=${onClose}>Cancel</button>
          <button className="btn" onClick=${submit}>Add product</button>
        </div>
      </div>
    </div>
  `;
}

/* ---------- Full-screen report ---------- */
function ReportModal({ calc, onClose, tab, setTab, promptText, cash, expenses, onExportExcel }) {
  const c = calc;
  const recoClass = c.recommendation === "FULL" ? "full" : c.recommendation === "PARTIAL" ? "partial" : "none";
  const recoIcon = c.recommendation === "FULL" ? "✅" : c.recommendation === "PARTIAL" ? "⚠️" : "🛑";
  const recoTitle = c.recommendation === "FULL" ? "Buy the full restock plan" : c.recommendation === "PARTIAL" ? "Buy critical items only" : "Hold all buying";
  const isProfit = c.aboveBufferSen >= 0;

  return html`
    <div className="report-overlay" role="dialog" aria-label="Full management report">
      <div className="report-inner">
        <div className="report-header">
          <div>
            <h2>Cashflow Rescue AI — Management Report</h2>
            <div className="report-meta">Generated ${new Date().toLocaleString("en-MY")} · All figures live-validated against form inputs</div>
          </div>
          <div className="report-actions">
            <button className="btn accent" onClick=${onExportExcel}>⇩ Excel</button>
            <button className="btn ghost" style=${{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick=${() => window.print()}>🖨️ Print</button>
            <button className="btn ghost" style=${{ color: "#fff", borderColor: "rgba(255,255,255,.3)" }} onClick=${onClose}>✕ Close</button>
          </div>
        </div>

        <div className="report-body">
          ${promptText && html`
            <div className="report-section">
              <h3>📋 Applied Prompt</h3>
              <div style=${{ fontStyle: "italic", color: "var(--ink-soft)", background: "var(--bg)", padding: 12, borderRadius: 8 }}>${promptText}</div>
            </div>
          `}

          <div className="report-section">
            <h3>🎯 Decision Summary</h3>
            <div className=${"report-banner " + recoClass}>
              <div className="rb-icon">${recoIcon}</div>
              <div>
                <div className="rb-title">${recoTitle}</div>
                <div className="rb-detail">Projected cash after shopping: ${RM(c.projectedAfterSen)} (${isProfit ? "+" : ""}${RM(c.aboveBufferSen)} vs your ${RM(c.bufferSen)} safety buffer)</div>
              </div>
            </div>
            <div className="report-kpi-grid">
              <div className="report-kpi">
                <div className="k">Cash on hand</div>
                <div className="v">${RM(c.cashOnHandSen)}</div>
              </div>
              <div className="report-kpi">
                <div className="k">Safety buffer</div>
                <div className="v">${RM(c.bufferSen)}</div>
              </div>
              <div className="report-kpi">
                <div className="k">Bills reserved</div>
                <div className="v">${RM(c.reservedExpenseSen)}</div>
              </div>
              <div className="report-kpi">
                <div className="k">Runway</div>
                <div className="v">${c.runwayDays ?? "—"} days</div>
              </div>
            </div>
          </div>

          <div className="report-section">
            <h3>💰 Cash & Profitability</h3>
            <table className="report-table">
              <tbody>
                <tr><td><strong>Cash on hand</strong></td><td style=${{ textAlign: "right" }}>${RM(c.cashOnHandSen)}</td></tr>
                <tr><td><strong>Other income expected</strong></td><td style=${{ textAlign: "right" }}>${RM(c.otherInSen)}</td></tr>
                <tr><td><strong>Total expenses (30d)</strong></td><td style=${{ textAlign: "right" }}>${RM(c.totalExpenseSen)}</td></tr>
                <tr><td><strong>Reserved for unpaid bills</strong></td><td style=${{ textAlign: "right" }}>${RM(c.reservedExpenseSen)}</td></tr>
                <tr><td><strong>Restock plan cost</strong></td><td style=${{ textAlign: "right" }}>${RM(c.totalRestockSen)}</td></tr>
                <tr><td><strong>Projected cash after shopping</strong></td><td style=${{ textAlign: "right" }}>${RM(c.projectedAfterSen)}</td></tr>
                <tr><td><strong>Net position vs safety buffer</strong></td><td style=${{ textAlign: "right" }}><span className=${isProfit ? "report-profit" : "report-loss"}>${isProfit ? "+" : ""}${RM(c.aboveBufferSen)}</span></td></tr>
                <tr><td><strong>Weekly sales</strong></td><td style=${{ textAlign: "right" }}>${RM(c.weeklySalesSen)}</td></tr>
                <tr><td><strong>Weekly P&L</strong></td><td style=${{ textAlign: "right" }}><span className=${c.weeklyProfitSen >= 0 ? "report-profit" : "report-loss"}>${RM(c.weeklyProfitSen)}</span></td></tr>
                <tr><td><strong>Daily burn rate</strong></td><td style=${{ textAlign: "right" }}>${RM(c.dailyBurnSen)}/day</td></tr>
              </tbody>
            </table>
          </div>

          <div className="report-section">
            <h3>📦 Restock Plan</h3>
            <table className="report-table">
              <thead>
                <tr>
                  <th>Ingredient</th><th style=${{ textAlign: "right" }}>On hand (g)</th><th style=${{ textAlign: "right" }}>Demand (g)</th><th style=${{ textAlign: "center" }}>Coverage</th><th style=${{ textAlign: "center" }}>Urgency</th><th style=${{ textAlign: "center" }}>Packs</th><th style=${{ textAlign: "right" }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                ${c.lines.map((l) => html`
                  <tr key=${l.ing.id}>
                    <td>${l.ing.icon} ${l.ing.name}</td>
                    <td style=${{ textAlign: "right" }}>${l.physical}</td>
                    <td style=${{ textAlign: "right" }}>${l.demand}</td>
                    <td style=${{ textAlign: "center" }}>${Math.round(l.coverage * 100)}%</td>
                    <td style=${{ textAlign: "center" }}><span className=${"urgency urg-" + l.autoUrgency}>${l.autoUrgency}</span></td>
                    <td style=${{ textAlign: "center" }}>${l.packsNeeded > 0 ? l.packsNeeded : "✓"}</td>
                    <td style=${{ textAlign: "right" }}>${l.packsNeeded > 0 ? RM(Math.round(l.costRM * 100)) : "—"}</td>
                  </tr>
                `)}
              </tbody>
              <tfoot>
                <tr><th colSpan=${6} style=${{ textAlign: "right" }}>Total restock cost</th><th style=${{ textAlign: "right" }}>${RM(c.totalRestockSen)}</th></tr>
              </tfoot>
            </table>
          </div>

          ${expenses && expenses.length > 0 && html`
            <div className="report-section">
              <h3>📋 Expenses Detail</h3>
              <table className="report-table">
                <thead><tr><th>Name</th><th>Category</th><th style=${{ textAlign: "right" }}>Amount</th><th>Due</th><th style=${{ textAlign: "center" }}>Paid</th></tr></thead>
                <tbody>
                  ${expenses.map((e) => html`
                    <tr key=${e.id}>
                      <td>${e.name}</td>
                      <td>${e.category}</td>
                      <td style=${{ textAlign: "right" }}>${RM(e.amountSen)}</td>
                      <td>${e.dueDate || "—"}</td>
                      <td style=${{ textAlign: "center" }}>${e.paid ? "✓" : "—"}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          `}

          <div className="report-section">
            <h3>🧁 Products & Margins</h3>
            <table className="report-table">
              <thead><tr><th>Product</th><th style=${{ textAlign: "right" }}>Price</th><th style=${{ textAlign: "right" }}>Cost</th><th style=${{ textAlign: "right" }}>Margin %</th></tr></thead>
              <tbody>
                ${c.productRows.map((p) => {
                  const price = num(p.defaultPriceSen);
                  const cost = num(p.defaultCostSen);
                  const margin = price > 0 ? ((price - cost) / price * 100) : 0;
                  return html`<tr key=${p.id}>
                    <td>${p.name}</td>
                    <td style=${{ textAlign: "right" }}>${RM(price)}</td>
                    <td style=${{ textAlign: "right" }}>${RM(cost)}</td>
                    <td style=${{ textAlign: "right" }}><span className=${margin >= 40 ? "report-profit" : margin < 20 ? "report-loss" : ""}>${margin.toFixed(0)}%</span></td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>

          <div className="report-section">
            <h3>💡 Advice & Actions</h3>
            <div style=${{ display: "flex", flexDirection: "column", gap: 6 }}>
              ${c.advice.map((a, i) => html`
                <div key=${i} className=${"report-advice-item " + (a.severity || "")}>
                  <div className="ai">${a.severity === "critical" ? "🛑" : a.severity === "watch" ? "⚠️" : a.severity === "action" ? "✉️" : a.severity === "good" ? "✅" : "ℹ️"}</div>
                  <div>
                    <div className="at">${a.title}</div>
                    <div className="ad">${a.detail}</div>
                    ${a.action && html`<div className="ad" style=${{ marginTop: 2 }}><strong>Action:</strong> ${a.action}</div>`}
                  </div>
                </div>
              `)}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

createRoot(document.getElementById("root")).render(html`<${App} />`);
