import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Category, currentMonth, formatINR, Transaction } from "../api/client";
import Modal from "../components/Modal";
import MonthPicker from "../components/MonthPicker";
import TransactionForm, { TxInput } from "../components/TransactionForm";

export default function Transactions() {
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<"" | "INCOME" | "EXPENSE">("");
  const [items, setItems] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);
  // Search by name (note or category), e.g. "Ifthikar" -> every payment to/from them.
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "month">("all");
  const searching = query.trim().length > 0;
  const allTime = searching && scope === "all";

  const load = useCallback(() => {
    const q = new URLSearchParams({ ...(allTime ? {} : { month }), ...(filter ? { type: filter } : {}) });
    api<Transaction[]>(`/transactions?${q}`).then(setItems);
  }, [month, filter, allTime]);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) return items;
    return items.filter((tx) => {
      const text = `${tx.note ?? ""} ${tx.category.name}`.toLowerCase();
      return words.every((w) => text.includes(w));
    });
  }, [items, query]);

  const totals = useMemo(() => {
    const sum = (type: "INCOME" | "EXPENSE") => shown.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
    const count = (type: "INCOME" | "EXPENSE") => shown.filter((t) => t.type === type).length;
    const received = sum("INCOME"), sent = sum("EXPENSE");
    return { received, sent, net: received - sent, inCount: count("INCOME"), outCount: count("EXPENSE") };
  }, [shown]);

  useEffect(load, [load]);
  useEffect(() => { api<Category[]>("/categories").then(setCategories); }, []);

  const save = async (data: TxInput) => {
    const body = JSON.stringify({ ...data, date: new Date(`${data.date}T00:00:00Z`).toISOString() });
    if (editing && editing !== "new") await api(`/transactions/${editing.id}`, { method: "PUT", body });
    else await api("/transactions", { method: "POST", body });
    setEditing(null);
    load();
  };

  const remove = async (tx: Transaction) => {
    if (!confirm(`Delete "${tx.note || tx.category.name}" (${formatINR(tx.amount)})?`)) return;
    await api(`/transactions/${tx.id}`, { method: "DELETE" });
    setEditing(null);
    load();
  };

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(allTime ? { year: "numeric" } : {}), timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          <div className="relative w-full sm:w-auto">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              className="input w-full pl-9 sm:w-56"
              type="search"
              placeholder="Search a name, e.g. Swiggy"
              aria-label="Search transactions by name"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching && (
            <select className="input w-auto" value={scope} onChange={(e) => setScope(e.target.value as typeof scope)} aria-label="Search period">
              <option value="all">All time</option>
              <option value="month">This month</option>
            </select>
          )}
          <select className="input w-auto" aria-label="Type" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expenses</option>
          </select>
          {!allTime && <MonthPicker value={month} onChange={setMonth} />}
          <button className="btn ml-auto sm:ml-0" onClick={() => setEditing("new")}>+ Add</button>
        </div>
      </div>

      {searching && (
        <div className="card">
          <p className="muted text-sm">
            {shown.length} transaction{shown.length === 1 ? "" : "s"} matching <span className="font-medium text-neutral-900 dark:text-white">"{query.trim()}"</span>
            {allTime ? " · all time" : " · this month"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="muted text-sm">Received</p>
              <p className="amount mt-1 text-xl font-semibold text-green-600 dark:text-green-500">{formatINR(totals.received)}</p>
              <p className="muted text-xs">{totals.inCount} payment{totals.inCount === 1 ? "" : "s"} in</p>
            </div>
            <div>
              <p className="muted text-sm">Sent</p>
              <p className="amount mt-1 text-xl font-semibold text-red-600 dark:text-red-500">{formatINR(totals.sent)}</p>
              <p className="muted text-xs">{totals.outCount} payment{totals.outCount === 1 ? "" : "s"} out</p>
            </div>
            <div>
              <p className="muted text-sm">Net</p>
              <p className="amount mt-1 text-xl font-semibold">{totals.net < 0 ? "−" : totals.net > 0 ? "+" : ""}{formatINR(Math.abs(totals.net))}</p>
              <p className="muted text-xs">{totals.net > 0 ? "more received than sent" : totals.net < 0 ? "more sent than received" : "even"}</p>
            </div>
          </div>
        </div>
      )}

      {/* phone: compact rows, tap one to edit */}
      <ul className="card divide-y divide-neutral-100 p-0 sm:hidden dark:divide-neutral-800">
        {shown.map((tx) => (
          <li key={tx.id}>
            <button className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-neutral-50 dark:active:bg-neutral-900" onClick={() => setEditing(tx)}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{tx.note || tx.category.name}</span>
                <span className="muted block truncate text-xs">{tx.category.name} · {day(tx.date)}</span>
              </span>
              <span className={`amount shrink-0 font-medium ${tx.type === "INCOME" ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                {tx.type === "INCOME" ? "+" : "−"}{formatINR(tx.amount)}
              </span>
            </button>
          </li>
        ))}
        {shown.length === 0 && (
          <li className="px-4 py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
            {searching ? `Nothing matches "${query.trim()}".` : "No transactions for this month."}
          </li>
        )}
      </ul>

      <div className="card hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 text-left text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <tr>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Category</th>
              <th className="px-5 py-3 font-medium">Note</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {shown.map((tx) => (
              <tr key={tx.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                <td className="px-5 py-3 whitespace-nowrap">{day(tx.date)}</td>
                <td className="px-5 py-3">{tx.category.name}</td>
                <td className="muted px-5 py-3">{tx.note}</td>
                <td className={`amount px-5 py-3 text-right font-medium ${tx.type === "INCOME" ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`}>
                  {tx.type === "INCOME" ? "+" : "−"}{formatINR(tx.amount)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button className="btn-ghost" onClick={() => setEditing(tx)}>Edit</button>
                  <button className="btn-ghost hover:text-red-600 dark:hover:text-red-400" onClick={() => remove(tx)}>Delete</button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-neutral-400 dark:text-neutral-500">
                {searching ? `Nothing matches "${query.trim()}".` : "No transactions for this month."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal title={editing === "new" ? "Add transaction" : "Edit transaction"} onClose={() => setEditing(null)}>
          <TransactionForm
            categories={categories}
            initial={editing === "new" ? undefined : editing}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
          {editing !== "new" && (
            <button
              className="mt-4 w-full rounded-md border border-neutral-200 py-2.5 text-sm font-medium text-red-600 sm:hidden dark:border-neutral-800 dark:text-red-500"
              onClick={() => remove(editing)}
            >
              Delete transaction
            </button>
          )}
        </Modal>
      )}
    </div>
  );
}
