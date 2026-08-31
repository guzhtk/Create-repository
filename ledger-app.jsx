import { useState, useEffect, useMemo, useRef } from "react";
import { Plus, X, Trash2, Pencil, ChevronRight, ChevronLeft, TrendingUp, TrendingDown, Download } from "lucide-react";

const EXPENSE_CATEGORIES = ["דיור", "מזון", "תחבורה", "בילויים ופנאי", "בריאות", "קניות", "חשבונות ותקשורת", "חינוך", "אחר"];
const INCOME_CATEGORIES = ["משכורת", "פרילנס", "השקעות", "מתנות", "אחר"];
const HEBREW_MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
const HEBREW_MONTHS_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const STORAGE_KEY = "ledger-transactions";
const EXPENSE_SHADES = ["#7a2a20", "#a1382c", "#c15544", "#d97a63", "#e9a08d", "#f0bfae", "#f6dcd2", "#8f5236", "#b97a4f"];
const INCOME_SHADES = ["#20452f", "#3f7d5c", "#5b9c76", "#7bb794", "#a3d0b3", "#c6e3d1"];

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n) {
  return Math.round(n).toLocaleString("he-IL");
}
function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}
function buildGradient(entries, shades) {
  const total = entries.reduce((s, e) => s + e.amount, 0);
  if (!total) return "var(--paper-deep)";
  let acc = 0;
  const parts = entries.map((e, i) => {
    const start = acc;
    const share = (e.amount / total) * 100;
    acc += share;
    return `${shades[i % shades.length]} ${start}% ${acc}%`;
  });
  return `conic-gradient(${parts.join(",")})`;
}
function getMonthsRange(base, count) {
  const arr = [];
  for (let i = count - 1; i >= 0; i--) {
    arr.push(new Date(base.getFullYear(), base.getMonth() - i, 1));
  }
  return arr;
}

export default function LedgerApp() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const [listFilter, setListFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [formType, setFormType] = useState("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formDate, setFormDate] = useState(todayISO());
  const [formNote, setFormNote] = useState("");
  const [formError, setFormError] = useState("");
  const firstFieldRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        if (!alive) return;
        if (result && result.value) {
          const parsed = JSON.parse(result.value);
          setTransactions(Array.isArray(parsed.transactions) ? parsed.transactions : []);
        }
      } catch (e) {
        // no saved data yet — start empty
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function persist(next) {
    try {
      const result = await window.storage.set(STORAGE_KEY, JSON.stringify({ transactions: next }), false);
      if (!result) setSaveError("השמירה נכשלה — הנתונים לא נשמרו בפנקס.");
      else setSaveError("");
    } catch (e) {
      setSaveError("השמירה נכשלה — הנתונים לא נשמרו בפנקס.");
    }
  }

  useEffect(() => {
    if (showForm && firstFieldRef.current) firstFieldRef.current.focus();
  }, [showForm]);

  const monthKey = monthKeyOf(monthDate);
  const monthLabel = `${HEBREW_MONTHS[monthDate.getMonth()]} ${monthDate.getFullYear()}`;
  const isCurrentRealMonth = monthKey === monthKeyOf(new Date());

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date && t.date.startsWith(monthKey)),
    [transactions, monthKey]
  );

  const totalIncome = useMemo(() => monthTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0), [monthTx]);
  const totalExpense = useMemo(() => monthTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0), [monthTx]);
  const balance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.round((balance / totalIncome) * 100) : null;

  function getCategoryTotals(type) {
    const map = {};
    monthTx.filter((t) => t.type === type).forEach((t) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return entries.map(([category, amount]) => ({ category, amount, pct: total ? Math.round((amount / total) * 100) : 0 }));
  }

  const expenseCategoryTotals = useMemo(() => getCategoryTotals("expense"), [monthTx]);
  const incomeCategoryTotals = useMemo(() => getCategoryTotals("income"), [monthTx]);

  const trendMonths = useMemo(() => {
    const months = getMonthsRange(monthDate, 6);
    return months.map((d) => {
      const key = monthKeyOf(d);
      const txs = transactions.filter((t) => t.date && t.date.startsWith(key));
      const inc = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const exp = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      return { key, label: HEBREW_MONTHS_SHORT[d.getMonth()], inc, exp };
    });
  }, [monthDate, transactions]);
  const trendMax = Math.max(1, ...trendMonths.flatMap((m) => [m.inc, m.exp]));

  const groupedTx = useMemo(() => {
    const filtered = listFilter === "all" ? monthTx : monthTx.filter((t) => t.type === listFilter);
    const sorted = [...filtered].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    const groups = {};
    sorted.forEach((t) => {
      if (!groups[t.date]) groups[t.date] = [];
      groups[t.date].push(t);
    });
    return Object.entries(groups);
  }, [monthTx, listFilter]);

  function changeMonth(delta) {
    setMonthDate((d) => {
      const nd = new Date(d);
      nd.setMonth(nd.getMonth() + delta);
      return nd;
    });
  }

  function openAddForm() {
    setEditingTx(null);
    setFormType("expense");
    setFormAmount("");
    setFormCategory(EXPENSE_CATEGORIES[0]);
    setFormDate(isCurrentRealMonth ? todayISO() : `${monthKey}-01`);
    setFormNote("");
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(tx) {
    setEditingTx(tx);
    setFormType(tx.type);
    setFormAmount(String(tx.amount));
    setFormCategory(tx.category);
    setFormDate(tx.date);
    setFormNote(tx.note || "");
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingTx(null);
  }

  function handleTypeChange(type) {
    setFormType(type);
    setFormCategory(type === "expense" ? EXPENSE_CATEGORIES[0] : INCOME_CATEGORIES[0]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const amountNum = parseFloat(formAmount);
    if (!amountNum || amountNum <= 0) {
      setFormError("יש להזין סכום גדול מאפס.");
      return;
    }
    if (!formDate) {
      setFormError("יש לבחור תאריך.");
      return;
    }
    const tx = {
      id: editingTx ? editingTx.id : genId(),
      type: formType,
      amount: amountNum,
      category: formCategory,
      date: formDate,
      note: formNote.trim(),
      createdAt: editingTx ? editingTx.createdAt : Date.now(),
    };
    const next = editingTx ? transactions.map((t) => (t.id === tx.id ? tx : t)) : [...transactions, tx];
    setTransactions(next);
    persist(next);
    closeForm();
  }

  function handleDelete(id) {
    const next = transactions.filter((t) => t.id !== id);
    setTransactions(next);
    persist(next);
  }

  function exportCSV() {
    const header = "תאריך,סוג,קטגוריה,סכום,הערה";
    const rows = [...transactions]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((t) => {
        const type = t.type === "income" ? "הכנסה" : "הוצאה";
        const note = (t.note || "").replace(/"/g, '""');
        return `${t.date},${type},${t.category},${t.amount},"${note}"`;
      });
    const csv = "\uFEFF" + [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "פנקס-חשבונות.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatDateLabel(iso) {
    const d = new Date(iso + "T00:00:00");
    const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
    return `יום ${days[d.getDay()]}, ${d.getDate()} ב${HEBREW_MONTHS[d.getMonth()]}`;
  }

  const stampText = balance > 0 ? "בעודף" : balance < 0 ? "בגירעון" : "מאוזן";
  const stampClass = balance > 0 ? "positive" : balance < 0 ? "negative" : "neutral";

  function renderBreakdown(title, narrative, entries, shades, total, emptyText) {
    return (
      <div className="card">
        <div className="section-title">{title}</div>
        {entries.length === 0 ? (
          <div className="breakdown-empty">{emptyText}</div>
        ) : (
          <div className="donut-wrap">
            <div className="donut" style={{ background: buildGradient(entries, shades) }}>
              <div className="donut-center">
                <div className="amt">{fmt(total)} ₪</div>
                <div className="lbl">{narrative}</div>
              </div>
            </div>
            <div className="legend">
              {entries.map((e, i) => (
                <div className="legend-item" key={e.category}>
                  <span className="legend-dot" style={{ background: shades[i % shades.length] }} />
                  <span className="legend-label">{e.category}</span>
                  <span className="legend-dots" />
                  <span className="legend-value">
                    {fmt(e.amount)} ₪ <span className="legend-pct">({e.pct}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ledger-app" dir="rtl">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&family=Heebo:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');

        .ledger-app {
          --paper: #efe8d8;
          --paper-deep: #e6ddc7;
          --surface: #fbf8ee;
          --line: #d3c7a4;
          --ink: #22302a;
          --ink-soft: #5b6a5f;
          --brass: #a1791f;
          --brass-soft: #cba54c;
          --income: #3f7d5c;
          --income-soft: #e4efe6;
          --expense: #a1382c;
          --expense-soft: #f4e6e0;
          --shadow: rgba(34, 48, 42, 0.14);
          --radius: 10px;
          font-family: 'Heebo', sans-serif;
          color: var(--ink);
          background: var(--paper);
          background-image: linear-gradient(var(--paper-deep) 1px, transparent 1px);
          background-size: 100% 2.1em;
          max-width: 640px;
          margin: 0 auto;
          padding: 20px 16px 100px;
          min-height: 100vh;
          box-sizing: border-box;
          position: relative;
        }
        .ledger-app *, .ledger-app *::before, .ledger-app *::after { box-sizing: border-box; }
        @media (prefers-reduced-motion: reduce) {
          .ledger-app * { animation: none !important; transition: none !important; }
        }

        .header { text-align: center; margin-bottom: 10px; padding-top: 6px; position: relative; }
        .header .eyebrow {
          font-family: 'IBM Plex Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.18em;
          color: var(--brass);
          text-transform: uppercase;
        }
        .header h1 {
          font-family: 'Frank Ruhl Libre', serif;
          font-weight: 700;
          font-size: 30px;
          margin: 4px 0 2px;
        }
        .header p { margin: 0; color: var(--ink-soft); font-size: 13px; }

        .export-row { display: flex; justify-content: center; margin-bottom: 14px; }
        .export-btn {
          display: flex; align-items: center; gap: 6px;
          background: none; border: 1px dashed var(--brass);
          color: var(--brass); font-family: 'Heebo', sans-serif;
          font-size: 12px; padding: 5px 12px; border-radius: 999px; cursor: pointer;
        }
        .export-btn:hover { background: rgba(161, 121, 31, 0.08); }
        .export-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .month-nav { display: flex; align-items: center; justify-content: center; gap: 14px; margin-bottom: 16px; }
        .month-nav .label { font-family: 'Frank Ruhl Libre', serif; font-size: 17px; min-width: 130px; text-align: center; }
        .icon-btn {
          background: var(--surface); border: 1px solid var(--line); border-radius: 999px;
          width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: var(--ink); transition: background 0.15s, transform 0.15s;
        }
        .icon-btn:hover { background: var(--paper-deep); }
        .icon-btn:active { transform: scale(0.94); }
        .icon-btn:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid var(--brass); outline-offset: 2px;
        }

        .card {
          background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
          box-shadow: 0 2px 10px var(--shadow); padding: 18px; margin-bottom: 16px;
        }

        .balance-hero { text-align: center; position: relative; }
        .balance-hero .balance-label { font-size: 12px; color: var(--ink-soft); letter-spacing: 0.06em; }
        .balance-hero .balance-value { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 40px; margin: 4px 0 10px; }
        .balance-hero .balance-value.negative { color: var(--expense); }
        .balance-hero .balance-value.positive { color: var(--income); }

        .stamp {
          display: inline-block; font-family: 'Frank Ruhl Libre', serif; font-weight: 700; font-size: 12px;
          letter-spacing: 0.08em; padding: 4px 14px; border: 2px solid currentColor; border-radius: 4px;
          transform: rotate(-4deg); margin-bottom: 10px;
        }
        .stamp.positive { color: var(--income); }
        .stamp.negative { color: var(--expense); }
        .stamp.neutral { color: var(--brass); }

        .savings-note { font-size: 12px; color: var(--ink-soft); margin-top: -2px; }

        .summary-row { display: flex; gap: 10px; margin-top: 14px; }
        .summary-pill { flex: 1; border-radius: 8px; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .summary-pill.income { background: var(--income-soft); color: var(--income); }
        .summary-pill.expense { background: var(--expense-soft); color: var(--expense); }
        .summary-pill .pill-label { font-size: 12px; display: flex; align-items: center; gap: 5px; }
        .summary-pill .pill-value { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 15px; }

        .section-title {
          font-family: 'Frank Ruhl Libre', serif; font-size: 15px; font-weight: 700; margin: 0 0 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .section-title::after { content: ""; flex: 1; border-bottom: 1px dashed var(--line); }

        .breakdown-empty { font-size: 13px; color: var(--ink-soft); text-align: center; padding: 10px 0; }

        .donut-wrap { display: flex; align-items: center; gap: 18px; }
        .donut { width: 108px; height: 108px; border-radius: 50%; position: relative; flex-shrink: 0; }
        .donut-center {
          position: absolute; inset: 15px; border-radius: 50%; background: var(--surface);
          display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
        }
        .donut-center .amt { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 12.5px; }
        .donut-center .lbl { font-size: 9px; color: var(--ink-soft); margin-top: 1px; }

        .legend { flex: 1; min-width: 0; }
        .legend-item { display: flex; align-items: baseline; gap: 6px; margin-bottom: 7px; font-size: 12.5px; }
        .legend-item:last-child { margin-bottom: 0; }
        .legend-dot { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; transform: translateY(1px); }
        .legend-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }
        .legend-dots { flex: 1; border-bottom: 2px dotted var(--line); height: 1px; margin-bottom: 3px; }
        .legend-value { font-family: 'IBM Plex Mono', monospace; white-space: nowrap; }
        .legend-pct { color: var(--ink-soft); }

        .trend-chart { display: flex; align-items: flex-end; gap: 8px; height: 110px; padding-top: 6px; border-bottom: 1px dashed var(--line); }
        .trend-month { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .trend-bars { display: flex; gap: 3px; align-items: flex-end; height: 92px; }
        .trend-bar { width: 10px; border-radius: 2px 2px 0 0; min-height: 2px; }
        .trend-bar.income { background: var(--income); }
        .trend-bar.expense { background: var(--expense); }
        .trend-label { font-size: 10px; color: var(--ink-soft); font-family: 'IBM Plex Mono', monospace; }
        .trend-legend { display: flex; justify-content: center; gap: 16px; margin-top: 10px; font-size: 11.5px; color: var(--ink-soft); }
        .trend-legend span { display: flex; align-items: center; gap: 5px; }
        .trend-legend .dot { width: 8px; height: 8px; border-radius: 2px; }

        .filter-tabs { display: flex; gap: 6px; margin-bottom: 14px; }
        .filter-tabs button {
          font-family: 'Heebo', sans-serif; font-size: 12.5px; border: 1px solid var(--line); background: var(--surface);
          border-radius: 999px; padding: 5px 13px; cursor: pointer; color: var(--ink-soft);
        }
        .filter-tabs button.active { background: var(--ink); color: var(--surface); border-color: var(--ink); }

        .tx-date-group { margin-bottom: 16px; }
        .tx-date-group:last-child { margin-bottom: 0; }
        .tx-date-heading { font-size: 11.5px; color: var(--brass); font-family: 'IBM Plex Mono', monospace; letter-spacing: 0.04em; margin-bottom: 6px; }
        .tx-row { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--paper-deep); }
        .tx-row:last-child { border-bottom: none; }
        .tx-row .tx-main { flex: 1; min-width: 0; }
        .tx-row .tx-cat { font-size: 13.5px; font-weight: 500; }
        .tx-row .tx-note { font-size: 12px; color: var(--ink-soft); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tx-row .tx-amount { font-family: 'IBM Plex Mono', monospace; font-weight: 600; font-size: 14px; white-space: nowrap; }
        .tx-row .tx-amount.income { color: var(--income); }
        .tx-row .tx-amount.expense { color: var(--expense); }
        .tx-row .tx-actions { display: flex; gap: 4px; opacity: 0.55; }
        .tx-row .tx-actions button {
          background: none; border: none; cursor: pointer; color: var(--ink-soft);
          width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: 6px;
        }
        .tx-row .tx-actions button:hover { background: var(--paper-deep); opacity: 1; color: var(--ink); }

        .empty-state { text-align: center; padding: 30px 16px; color: var(--ink-soft); font-size: 13.5px; }
        .empty-state .empty-title { font-family: 'Frank Ruhl Libre', serif; font-size: 16px; color: var(--ink); margin-bottom: 4px; }

        .loading-state { text-align: center; padding: 60px 0; color: var(--ink-soft); font-size: 14px; }

        .error-banner {
          background: var(--expense-soft); color: var(--expense); border: 1px solid var(--expense);
          border-radius: 8px; padding: 8px 12px; font-size: 12.5px; margin-bottom: 14px; text-align: center;
        }

        .fab {
          position: fixed; bottom: 22px; left: 50%; transform: translateX(-50%);
          background: var(--ink); color: var(--paper); border: none; border-radius: 999px;
          padding: 12px 22px; display: flex; align-items: center; gap: 8px;
          font-family: 'Heebo', sans-serif; font-size: 14px; font-weight: 600; cursor: pointer;
          box-shadow: 0 4px 16px var(--shadow); transition: transform 0.15s;
        }
        .fab:active { transform: translateX(-50%) scale(0.96); }

        .overlay { position: fixed; inset: 0; background: rgba(34, 48, 42, 0.45); display: flex; align-items: flex-end; justify-content: center; padding: 0; z-index: 50; }
        @media (min-width: 480px) { .overlay { align-items: center; padding: 20px; } }

        .form-card {
          background: var(--surface); width: 100%; max-width: 420px; border-radius: 16px 16px 0 0;
          padding: 26px 20px 20px; position: relative; box-shadow: 0 -6px 24px var(--shadow);
          max-height: 88vh; overflow-y: auto;
        }
        @media (min-width: 480px) { .form-card { border-radius: 12px; } }
        .form-card::before {
          content: ""; position: absolute; top: -10px; right: 50%; transform: translateX(50%) rotate(-2deg);
          width: 54px; height: 20px; background: linear-gradient(180deg, var(--brass-soft), var(--brass));
          border-radius: 3px; box-shadow: 0 2px 4px var(--shadow);
        }
        .form-title { font-family: 'Frank Ruhl Libre', serif; font-size: 19px; margin: 4px 0 16px; text-align: center; }

        .type-toggle { display: flex; gap: 8px; margin-bottom: 14px; }
        .type-btn {
          flex: 1; padding: 9px; border-radius: 8px; border: 1.5px solid var(--line); background: var(--paper);
          font-family: 'Heebo', sans-serif; font-size: 13.5px; font-weight: 600; cursor: pointer; color: var(--ink-soft);
        }
        .type-btn.active.expense { background: var(--expense-soft); border-color: var(--expense); color: var(--expense); }
        .type-btn.active.income { background: var(--income-soft); border-color: var(--income); color: var(--income); }

        .field { margin-bottom: 13px; }
        .field label { display: block; font-size: 12.5px; color: var(--ink-soft); margin-bottom: 5px; }
        .field input, .field select, .field textarea {
          width: 100%; font-family: 'Heebo', sans-serif; font-size: 14px; padding: 9px 10px;
          border-radius: 7px; border: 1.5px solid var(--line); background: var(--paper); color: var(--ink);
        }
        .field .amount-input { font-family: 'IBM Plex Mono', monospace; font-size: 17px; font-weight: 600; }
        .field textarea { resize: none; font-family: 'Heebo', sans-serif; min-height: 44px; }

        .form-error { font-size: 12.5px; color: var(--expense); margin-bottom: 10px; }

        .form-actions { display: flex; gap: 10px; margin-top: 6px; }
        .btn-primary, .btn-secondary {
          flex: 1; padding: 11px; border-radius: 8px; font-family: 'Heebo', sans-serif;
          font-size: 14px; font-weight: 600; cursor: pointer; border: none;
        }
        .btn-primary { background: var(--ink); color: var(--paper); }
        .btn-secondary { background: var(--paper); color: var(--ink-soft); border: 1.5px solid var(--line); }

        .close-btn {
          position: absolute; top: 14px; left: 14px; background: none; border: none; cursor: pointer;
          color: var(--ink-soft); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px;
        }
        .close-btn:hover { background: var(--paper-deep); }

        @media (max-width: 380px) {
          .donut-wrap { flex-direction: column; align-items: stretch; }
          .legend-label { max-width: none; }
        }
      `}</style>

      <div className="header">
        <div className="eyebrow">מעקב חודשי</div>
        <h1>פנקס החשבונות שלי</h1>
        <p>הכנסות והוצאות, שורה אחר שורה</p>
      </div>

      <div className="export-row">
        <button className="export-btn" onClick={exportCSV} disabled={transactions.length === 0}>
          <Download size={13} /> ייצוא כל הנתונים ל-CSV
        </button>
      </div>

      {saveError && <div className="error-banner">{saveError}</div>}

      <div className="month-nav">
        <button className="icon-btn" onClick={() => changeMonth(1)} aria-label="החודש הבא">
          <ChevronRight size={18} />
        </button>
        <div className="label">{monthLabel}</div>
        <button className="icon-btn" onClick={() => changeMonth(-1)} aria-label="החודש הקודם">
          <ChevronLeft size={18} />
        </button>
      </div>

      {loading ? (
        <div className="loading-state">טוען את הפנקס…</div>
      ) : (
        <>
          <div className="card balance-hero">
            <span className={`stamp ${stampClass}`}>{stampText}</span>
            <div className="balance-label">יתרת החודש</div>
            <div className={`balance-value ${balance < 0 ? "negative" : balance > 0 ? "positive" : ""}`}>
              {balance < 0 ? "−" : ""}
              {fmt(Math.abs(balance))} ₪
            </div>
            {savingsRate !== null && balance !== 0 && (
              <div className="savings-note">
                {balance > 0 ? `נחסכו ${savingsRate}% מההכנסה החודשית` : `החריגה שווה ל-${Math.abs(savingsRate)}% מההכנסה`}
              </div>
            )}
            <div className="summary-row">
              <div className="summary-pill income">
                <span className="pill-label"><TrendingUp size={13} /> הכנסות</span>
                <span className="pill-value">{fmt(totalIncome)} ₪</span>
              </div>
              <div className="summary-pill expense">
                <span className="pill-label"><TrendingDown size={13} /> הוצאות</span>
                <span className="pill-value">{fmt(totalExpense)} ₪</span>
              </div>
            </div>
          </div>

          {renderBreakdown("לאן הלך הכסף", "סה״כ הוצאות", expenseCategoryTotals, EXPENSE_SHADES, totalExpense, "עדיין לא נרשמו הוצאות החודש.")}
          {renderBreakdown("מאיפה הגיע הכסף", "סה״כ הכנסות", incomeCategoryTotals, INCOME_SHADES, totalIncome, "עדיין לא נרשמו הכנסות החודש.")}

          <div className="card">
            <div className="section-title">מגמה חצי־שנתית</div>
            <div className="trend-chart">
              {trendMonths.map((m) => (
                <div className="trend-month" key={m.key}>
                  <div className="trend-bars">
                    <div className="trend-bar income" style={{ height: `${(m.inc / trendMax) * 100}%` }} title={`הכנסות: ${fmt(m.inc)} ₪`} />
                    <div className="trend-bar expense" style={{ height: `${(m.exp / trendMax) * 100}%` }} title={`הוצאות: ${fmt(m.exp)} ₪`} />
                  </div>
                  <div className="trend-label">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="trend-legend">
              <span><span className="dot" style={{ background: "var(--income)" }} /> הכנסות</span>
              <span><span className="dot" style={{ background: "var(--expense)" }} /> הוצאות</span>
            </div>
          </div>

          <div className="card">
            <div className="section-title">תנועות בחודש זה</div>
            <div className="filter-tabs">
              <button className={listFilter === "all" ? "active" : ""} onClick={() => setListFilter("all")}>הכל</button>
              <button className={listFilter === "income" ? "active" : ""} onClick={() => setListFilter("income")}>הכנסות</button>
              <button className={listFilter === "expense" ? "active" : ""} onClick={() => setListFilter("expense")}>הוצאות</button>
            </div>

            {groupedTx.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">הדף הזה עדיין ריק</div>
                <div>הוסיפו את הרשומה הראשונה לחודש כדי להתחיל לעקוב.</div>
              </div>
            ) : (
              groupedTx.map(([date, txs]) => (
                <div className="tx-date-group" key={date}>
                  <div className="tx-date-heading">{formatDateLabel(date)}</div>
                  {txs.map((t) => (
                    <div className="tx-row" key={t.id}>
                      <div className="tx-main">
                        <div className="tx-cat">{t.category}</div>
                        {t.note && <div className="tx-note">{t.note}</div>}
                      </div>
                      <div className={`tx-amount ${t.type}`}>
                        {t.type === "expense" ? "−" : "+"}
                        {fmt(t.amount)} ₪
                      </div>
                      <div className="tx-actions">
                        <button onClick={() => openEditForm(t)} aria-label="עריכת רשומה"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(t.id)} aria-label="מחיקת רשומה"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}

      <button className="fab" onClick={openAddForm}>
        <Plus size={17} /> הוספת רשומה
      </button>

      {showForm && (
        <div className="overlay" onClick={closeForm}>
          <form className="form-card" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <button type="button" className="close-btn" onClick={closeForm} aria-label="סגירה"><X size={18} /></button>
            <div className="form-title">{editingTx ? "עריכת רשומה" : "רשומה חדשה"}</div>

            <div className="type-toggle">
              <button type="button" className={`type-btn expense ${formType === "expense" ? "active expense" : ""}`} onClick={() => handleTypeChange("expense")}>הוצאה</button>
              <button type="button" className={`type-btn income ${formType === "income" ? "active income" : ""}`} onClick={() => handleTypeChange("income")}>הכנסה</button>
            </div>

            <div className="field">
              <label htmlFor="amount">סכום (₪)</label>
              <input ref={firstFieldRef} id="amount" className="amount-input" type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="category">קטגוריה</label>
              <select id="category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)}>
                {(formType === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="date">תאריך</label>
              <input id="date" type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>

            <div className="field">
              <label htmlFor="note">הערה (אופציונלי)</label>
              <textarea id="note" placeholder="לדוגמה: קניות סופר" value={formNote} onChange={(e) => setFormNote(e.target.value)} />
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <div className="form-actions">
              <button type="submit" className="btn-primary">{editingTx ? "שמירת שינויים" : "הוספה לפנקס"}</button>
              <button type="button" className="btn-secondary" onClick={closeForm}>ביטול</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
