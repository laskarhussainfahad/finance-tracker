import { FormEvent, useState } from "react";
import { Category, Transaction, TxType } from "../api/client";

export interface TxInput { amount: number; type: TxType; date: string; note: string; categoryId: number }

interface Props {
  categories: Category[];
  initial?: Transaction;
  onSubmit: (data: TxInput) => Promise<void>;
  onCancel: () => void;
}

export default function TransactionForm({ categories, initial, onSubmit, onCancel }: Props) {
  const [type, setType] = useState<TxType>(initial?.type ?? "EXPENSE");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial ? initial.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial?.note ?? "");
  const options = categories.filter((c) => c.type === type);
  const [categoryId, setCategoryId] = useState<number>(initial?.categoryId ?? options[0]?.id ?? 0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const changeType = (t: TxType) => {
    setType(t);
    setCategoryId(categories.find((c) => c.type === t)?.id ?? 0);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSubmit({ amount: Number(amount), type, date, note, categoryId });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(["EXPENSE", "INCOME"] as const).map((t) => (
          <button
            type="button"
            key={t}
            onClick={() => changeType(t)}
            className={`rounded-lg border px-3 py-2 text-sm font-medium ${
              type === t
                ? t === "EXPENSE" ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300" : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
            }`}
          >
            {t === "EXPENSE" ? "Expense" : "Income"}
          </button>
        ))}
      </div>
      <label className="block text-sm">
        Amount (₹)
        <input className="input mt-1" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="block text-sm">
        Category
        <select className="input mt-1" value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        Date
        <input className="input mt-1" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="block text-sm">
        Note (optional)
        <input className="input mt-1" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn" disabled={saving}>{saving ? "Saving…" : initial ? "Save changes" : "Add transaction"}</button>
      </div>
    </form>
  );
}
