import { FormEvent, useCallback, useEffect, useState } from "react";
import { api, Budget, Category, currentMonth, formatINR } from "../api/client";
import MonthPicker from "../components/MonthPicker";

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState(0);
  const [limit, setLimit] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => { api<Budget[]>(`/budgets?month=${month}`).then(setBudgets); }, [month]);
  useEffect(load, [load]);
  useEffect(() => {
    api<Category[]>("/categories").then((all) => {
      const expense = all.filter((c) => c.type === "EXPENSE");
      setCategories(expense);
      setCategoryId(expense[0]?.id ?? 0);
    });
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api("/budgets", { method: "POST", body: JSON.stringify({ categoryId, month, monthlyLimit: Number(limit) }) });
      setLimit("");
      load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const remove = async (b: Budget) => {
    if (!confirm(`Remove the ${b.categoryName} budget?`)) return;
    await api(`/budgets/${b.id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Budgets</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      <form onSubmit={save} className="card flex flex-wrap items-end gap-3">
        <label className="text-sm">
          Category
          <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-sm">
          Monthly limit (₹)
          <input className="input mt-1" type="number" min="1" required value={limit} onChange={(e) => setLimit(e.target.value)} />
        </label>
        <button className="btn">Set budget</button>
        {error && <p className="w-full text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      </form>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {budgets.map((b) => {
          const pct = Math.round((b.spent / b.monthlyLimit) * 100);
          const tone = pct > 100 ? "bg-rose-500" : pct >= 80 ? "bg-amber-500" : "bg-indigo-500";
          return (
            <div key={b.id} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{b.categoryName}</h3>
                <button className="btn-ghost text-xs text-rose-600 dark:text-rose-400" onClick={() => remove(b)}>Remove</button>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className={`h-full ${tone}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {formatINR(b.spent)} of {formatINR(b.monthlyLimit)}{" "}
                <span className={pct > 100 ? "font-medium text-rose-600 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"}>({pct}%)</span>
              </p>
              {pct > 100 && <p className="text-xs text-rose-600 dark:text-rose-400">Over by {formatINR(b.spent - b.monthlyLimit)}</p>}
            </div>
          );
        })}
        {budgets.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No budgets set for this month yet.</p>}
      </div>
    </div>
  );
}
