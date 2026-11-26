import { ChangeEvent, DragEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Category, formatINR, Transaction, TxType } from "../api/client";
import {
  buildRows, columnLabel, directionUnknown, Grid, guessCategory, guessMapping, Mapping, readStatement,
} from "../lib/statement";

interface Row {
  key: number;
  raw: string;
  date: string;
  note: string;
  amount: number;
  type: TxType;
  categoryId: number;
  selected: boolean;
  duplicate: boolean;
}

const EMPTY_MAPPING: Mapping = { header: 0, date: -1, description: -1, mode: "split", debit: -1, credit: -1, amount: -1, type: -1 };

export default function Import() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [existing, setExisting] = useState<Transaction[]>([]);
  const [fileName, setFileName] = useState("");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAPPING);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    api<Category[]>("/categories").then(setCategories);
    api<Transaction[]>("/transactions").then(setExisting);
  }, []);

  // Rebuild the preview whenever the file or the column choices change.
  useEffect(() => {
    if (!grid) return;
    const seen = new Set(existing.map((t) => `${t.date.slice(0, 10)}|${t.amount}|${t.type}`));
    setRows(
      buildRows(grid, mapping).map((r, key) => {
        const duplicate = seen.has(`${r.date}|${r.amount}|${r.type}`);
        return { ...r, key, duplicate, selected: !duplicate, categoryId: guessCategory(r.raw, r.type, categories) };
      })
    );
  }, [grid, mapping, existing, categories]);

  const open = async (file: File) => {
    setError("");
    setDone(null);
    setGrid(null);
    setRows([]);
    setFileName(file.name);
    try {
      const data = await readStatement(file);
      const guess = guessMapping(data);
      if (!guess) {
        setMapping({ ...EMPTY_MAPPING, date: 0, description: 1, amount: 2, mode: "single" });
        setError("Couldn't find the columns automatically. Pick them below.");
      } else {
        setMapping(guess);
      }
      setGrid(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) open(file);
    e.target.value = "";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) open(file);
  };

  const trySample = async () => {
    const text = await fetch("./sample-statement.csv").then((r) => r.text());
    open(new File([text], "sample-statement.csv", { type: "text/csv" }));
  };

  const update = (key: number, change: Partial<Row>) =>
    setRows((all) =>
      all.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, ...change };
        if (change.type && change.type !== r.type) next.categoryId = guessCategory(r.raw, change.type, categories);
        return next;
      })
    );

  const selected = rows.filter((r) => r.selected);
  const totals = useMemo(
    () => ({
      out: selected.filter((r) => r.type === "EXPENSE").reduce((s, r) => s + r.amount, 0),
      in: selected.filter((r) => r.type === "INCOME").reduce((s, r) => s + r.amount, 0),
    }),
    [selected]
  );

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const items = selected.map((r) => ({
        amount: r.amount, type: r.type, categoryId: r.categoryId, note: r.note || undefined,
        date: new Date(`${r.date}T00:00:00Z`).toISOString(),
      }));
      const result = await api<{ imported: number }>("/transactions/import", { method: "POST", body: JSON.stringify({ items }) });
      setDone(result.imported);
      setGrid(null);
      setRows([]);
      api<Transaction[]>("/transactions").then(setExisting);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const columns = grid ? Array.from({ length: Math.max(0, ...grid.slice(0, 50).map((r) => r.length)) }, (_, i) => i) : [];
  const colSelect = (label: string, value: number, onChange: (v: number) => void, optional = false) => (
    <label className="text-sm">
      {label}
      <select className="input mt-1" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {optional && <option value={-1}>None</option>}
        {!optional && value === -1 && <option value={-1}>Choose a column</option>}
        {columns.map((i) => <option key={i} value={i}>{columnLabel(grid!, mapping.header, i)}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Import statement</h1>
        <p className="muted mt-1 text-sm">
          Upload a bank or UPI statement and your transactions are added automatically, with categories filled in.
        </p>
      </div>

      {done !== null && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-200">
          Imported {done} transaction{done === 1 ? "" : "s"}.{" "}
          <Link to="/transactions" className="font-medium underline">See them in Transactions</Link> or{" "}
          <Link to="/" className="font-medium underline">view the dashboard</Link>.
        </div>
      )}

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`card flex cursor-pointer flex-col items-center gap-2 border-2 border-dashed py-10 text-center transition-colors ${
          dragging ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30" : ""
        }`}
      >
        <input type="file" accept=".csv,.xlsx,.xls,.pdf,text/csv" className="hidden" onChange={onPick} />
        <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
        </svg>
        <span className="font-medium">{fileName && grid ? fileName : "Drop your statement here, or click to choose"}</span>
        <span className="muted text-xs">CSV or Excel (.xlsx). Your file is read on this device and never uploaded anywhere.</span>
      </label>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <button type="button" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400" onClick={trySample}>
          Try it with a sample statement
        </button>
        <a className="muted hover:underline" href="./sample-statement.csv" download>Download the sample file</a>
      </div>

      <details className="card text-sm">
        <summary className="cursor-pointer font-medium">How do I get my statement?</summary>
        <ol className="muted mt-3 list-decimal space-y-1 pl-5">
          <li>Open your bank's net banking or mobile app and go to <b>Account statement</b>.</li>
          <li>Pick a date range and download it as <b>Excel</b> or <b>CSV</b>.</li>
          <li>Got a PDF or an old .xls file? Open it in Excel or Google Sheets and save it as .xlsx or CSV.</li>
          <li>UPI payments show up in your bank statement too, so one statement covers them.</li>
        </ol>
      </details>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {grid && (
        <>
          <div className="card space-y-4">
            <div>
              <h2 className="font-medium">Columns</h2>
              <p className="muted text-sm">We guessed these from your file. Change them if something looks wrong.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm">
                Header row
                <select className="input mt-1" value={mapping.header} onChange={(e) => setMapping({ ...mapping, header: Number(e.target.value) })}>
                  {grid.slice(0, 40).map((r, i) => (
                    <option key={i} value={i}>Row {i + 1}: {r.filter(Boolean).slice(0, 3).map(String).join(", ").slice(0, 40)}</option>
                  ))}
                </select>
              </label>
              {colSelect("Date", mapping.date, (v) => setMapping({ ...mapping, date: v }))}
              {colSelect("Description", mapping.description, (v) => setMapping({ ...mapping, description: v }), true)}
              <label className="text-sm">
                Amounts are in
                <select className="input mt-1" value={mapping.mode} onChange={(e) => setMapping({ ...mapping, mode: e.target.value as Mapping["mode"] })}>
                  <option value="split">Separate debit and credit columns</option>
                  <option value="single">One amount column</option>
                </select>
              </label>
              {mapping.mode === "split" ? (
                <>
                  {colSelect("Money out (debit / withdrawal)", mapping.debit, (v) => setMapping({ ...mapping, debit: v }))}
                  {colSelect("Money in (credit / deposit)", mapping.credit, (v) => setMapping({ ...mapping, credit: v }))}
                </>
              ) : (
                <>
                  {colSelect("Amount", mapping.amount, (v) => setMapping({ ...mapping, amount: v }))}
                  {colSelect("Dr / Cr column", mapping.type, (v) => setMapping({ ...mapping, type: v }), true)}
                </>
              )}
            </div>
            {directionUnknown(grid, mapping) && (
              <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                This file doesn't say which amounts are money in, so every row is set to Expense. Switch any income rows below.
              </p>
            )}
          </div>

          <div className="card space-y-4 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
              <div>
                <h2 className="font-medium">{rows.length} transactions found</h2>
                <p className="muted text-sm">
                  {selected.length} selected · out {formatINR(totals.out)} · in {formatINR(totals.in)}
                  {rows.some((r) => r.duplicate) && ` · ${rows.filter((r) => r.duplicate).length} look already added (unticked)`}
                </p>
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => setRows(rows.map((r) => ({ ...r, selected: !rows.every((x) => x.selected) })))}>
                  {rows.every((r) => r.selected) ? "Select none" : "Select all"}
                </button>
                <button className="btn" disabled={busy || selected.length === 0} onClick={save}>
                  {busy ? "Importing…" : `Import ${selected.length}`}
                </button>
              </div>
            </div>
            <div className="max-h-[32rem] overflow-auto border-t border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white text-left text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                  <tr>
                    <th className="w-10 px-4 py-2" />
                    <th className="px-2 py-2 font-medium">Date</th>
                    <th className="px-2 py-2 font-medium">Description</th>
                    <th className="px-2 py-2 font-medium">Type</th>
                    <th className="px-2 py-2 font-medium">Category</th>
                    <th className="px-4 py-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key} className={`border-t border-slate-100 dark:border-slate-800 ${r.selected ? "" : "opacity-50"}`}>
                      <td className="px-4 py-2">
                        <input type="checkbox" aria-label="Include this row" checked={r.selected} onChange={(e) => update(r.key, { selected: e.target.checked })} className="h-4 w-4 accent-indigo-600" />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        {new Date(`${r.date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}
                      </td>
                      <td className="max-w-[16rem] px-2 py-2">
                        <span className="block truncate" title={r.note}>{r.note || "—"}</span>
                        {r.duplicate && <span className="text-xs text-amber-600 dark:text-amber-400">Possibly already added</span>}
                      </td>
                      <td className="px-2 py-2">
                        <select className="input py-1" value={r.type} onChange={(e) => update(r.key, { type: e.target.value as TxType })}>
                          <option value="EXPENSE">Expense</option>
                          <option value="INCOME">Income</option>
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select className="input py-1" value={r.categoryId} onChange={(e) => update(r.key, { categoryId: Number(e.target.value) })}>
                          {categories.filter((c) => c.type === r.type).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-2 text-right font-medium ${r.type === "INCOME" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {r.type === "INCOME" ? "+" : "−"}{formatINR(r.amount)}
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 dark:text-slate-500">No transactions found with these columns. Try changing them above.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
