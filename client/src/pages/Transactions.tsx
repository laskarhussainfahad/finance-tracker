import { useCallback, useEffect, useState } from "react";
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

  const load = useCallback(() => {
    const q = new URLSearchParams({ month, ...(filter ? { type: filter } : {}) });
    api<Transaction[]>(`/transactions?${q}`).then(setItems);
  }, [month, filter]);

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
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex flex-wrap gap-2">
          <select className="input w-auto" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="">All</option>
            <option value="INCOME">Income</option>
            <option value="EXPENSE">Expenses</option>
          </select>
          <MonthPicker value={month} onChange={setMonth} />
          <button className="btn" onClick={() => setEditing("new")}>+ Add</button>
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
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
            {items.map((tx) => (
              <tr key={tx.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50">
                <td className="px-5 py-3 whitespace-nowrap">
                  {new Date(tx.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}
                </td>
                <td className="px-5 py-3">{tx.category.name}</td>
                <td className="muted px-5 py-3">{tx.note}</td>
                <td className={`amount px-5 py-3 text-right font-medium ${tx.type === "INCOME" ? "text-neutral-900 dark:text-white" : "text-neutral-500 dark:text-neutral-400"}`}>
                  {tx.type === "INCOME" ? "+" : "−"}{formatINR(tx.amount)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button className="btn-ghost" onClick={() => setEditing(tx)}>Edit</button>
                  <button className="btn-ghost hover:text-red-600 dark:hover:text-red-400" onClick={() => remove(tx)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-neutral-400 dark:text-neutral-500">No transactions for this month.</td></tr>
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
        </Modal>
      )}
    </div>
  );
}
