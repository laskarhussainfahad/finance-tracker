// Reads a bank or UPI statement (CSV or Excel) in the browser and turns it into transactions.
// Nothing here talks to a server: the file never leaves the user's computer.
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import type { Category, TxType } from "../api/client";

export type Cell = string | number | boolean | Date | null;
export type Grid = Cell[][];

export interface Mapping {
  header: number; // index of the header row
  date: number;
  description: number;
  mode: "split" | "single";
  debit: number; // split mode: money out
  credit: number; // split mode: money in
  amount: number; // single mode
  type: number; // single mode, optional (-1): a column saying Dr/Cr or Debit/Credit
}

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  note: string;
  raw: string; // the original description, used for picking a category
  amount: number;
  type: TxType;
}

// ---------- reading the file ----------

export async function readStatement(file: File): Promise<Grid> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) return (await readSheet(file)) as Grid;
  if (name.endsWith(".csv") || name.endsWith(".txt") || file.type === "text/csv") {
    const text = await file.text();
    const result = Papa.parse<string[]>(text.replace(/^﻿/, ""), { skipEmptyLines: true });
    return result.data;
  }
  if (name.endsWith(".xls")) {
    throw new Error("Old .xls files aren't supported. Open it in Excel or Google Sheets and save it as .xlsx or CSV.");
  }
  if (name.endsWith(".pdf")) {
    throw new Error("PDF statements can't be read. Download the statement as Excel or CSV instead (most banks offer both).");
  }
  throw new Error("Please choose a CSV or Excel (.xlsx) file.");
}

// ---------- finding the columns ----------

const text = (c: Cell) => (c instanceof Date ? "" : String(c ?? "")).trim();
const norm = (c: Cell) => text(c).toLowerCase().replace(/[^a-z/ ]/g, " ").replace(/\s+/g, " ").trim();

function findColumn(headers: string[], tests: ((h: string) => boolean)[]) {
  for (const test of tests) {
    const i = headers.findIndex(test);
    if (i !== -1) return i;
  }
  return -1;
}

function guessFromHeader(row: Cell[]): Omit<Mapping, "header"> | null {
  const h = row.map(norm);
  const has = (s: string, ...words: string[]) => words.some((w) => s.includes(w));
  const notMeta = (s: string) => !has(s, "balance", "ref", "chq", "cheque", "value date");

  const date = findColumn(h, [(s) => /^(txn |transaction |tran )?date$/.test(s), (s) => s.includes("date") && !s.includes("value")]);
  const description = findColumn(h, [
    (s) => has(s, "narration", "description", "particulars", "remarks", "transaction details", "details"),
    (s) => has(s, "merchant", "payee", "paid to", "beneficiary", "name"),
  ]);
  const debit = findColumn(h, [(s) => notMeta(s) && has(s, "debit", "withdrawal", "money out", "paid out") && !has(s, "credit")]);
  const credit = findColumn(h, [(s) => notMeta(s) && has(s, "credit", "deposit", "money in", "received") && !has(s, "debit")]);
  const amount = findColumn(h, [(s) => notMeta(s) && has(s, "amount") && !has(s, "debit", "credit", "withdrawal", "deposit")]);
  const type = findColumn(h, [
    (s) => /^(dr ?\/ ?cr|cr ?\/ ?dr|debit ?\/ ?credit|credit ?\/ ?debit)$/.test(s),
    (s) => has(s, "type") && !has(s, "account"),
  ]);

  if (date === -1) return null;
  if (debit !== -1 && credit !== -1) {
    return { date, description, mode: "split", debit, credit, amount: -1, type: -1 };
  }
  if (amount !== -1) return { date, description, mode: "single", debit: -1, credit: -1, amount, type };
  return null;
}

// Statements often start with a few lines of account details, so look for the real header row.
export function guessMapping(grid: Grid): Mapping | null {
  for (let i = 0; i < Math.min(grid.length, 40); i++) {
    const guess = guessFromHeader(grid[i]);
    if (guess) return { header: i, ...guess };
  }
  return null;
}

// ---------- reading dates and amounts ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function toIso(y: number, m: number, d: number) {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

export function parseDate(cell: Cell): string | null {
  if (cell instanceof Date) {
    return isNaN(cell.getTime()) ? null : toIso(cell.getUTCFullYear(), cell.getUTCMonth() + 1, cell.getUTCDate());
  }
  const s = text(cell);
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/); // 2026-11-26
  if (m) return toIso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/); // 26/11/2026 (Indian day-first)
  if (m) {
    let [d, mo] = [+m[1], +m[2]];
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // clearly month-first, like 11/26/2026
    return toIso(+m[3], mo, d);
  }
  m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3,9})[-\s/,]*'?(\d{2,4})\b/); // 26-Nov-2026, 26 Nov 26
  if (m) {
    const mo = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
    return mo ? toIso(+m[3], mo, +m[1]) : null;
  }
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/); // Nov 26, 2026
  if (m) {
    const mo = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase()) + 1;
    return mo ? toIso(+m[3], mo, +m[2]) : null;
  }
  return null;
}

// Returns the amount and, when the cell says so, its direction ("-500", "500 Dr", "(500)").
export function parseAmount(cell: Cell): { value: number; sign: -1 | 0 | 1 } | null {
  if (typeof cell === "number") return cell === 0 ? null : { value: Math.abs(cell), sign: cell < 0 ? -1 : 0 };
  let s = text(cell);
  if (!s) return null;
  let sign: -1 | 0 | 1 = 0;
  if (/\bdr\.?$/i.test(s)) sign = -1;
  if (/\bcr\.?$/i.test(s)) sign = 1;
  if (/^\(.*\)$/.test(s) || /^-/.test(s.replace(/^(₹|rs\.?|inr)\s*/i, ""))) sign = -1;
  s = s.replace(/(₹|rs\.?|inr|dr\.?|cr\.?|[,()\s+-])/gi, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const value = Number(s);
  return value > 0 ? { value: Math.round(value * 100) / 100, sign } : null;
}

// ---------- making notes readable ----------

const NOISE = new Set(["upi", "dr", "cr", "p2m", "p2a", "imps", "neft", "rtgs", "pos", "ach", "by", "to", "from", "transfer", "txn", "payment", "pay"]);

const tidy = (part: string) => {
  const words = part.split(/\s+/).filter((w) => w && !/\d/.test(w)); // drop card and reference numbers
  while (words.length && NOISE.has(words[0].toLowerCase())) words.shift(); // drop "POS", "NEFT CR", ...
  const out = words.join(" ");
  // SHOUTING CAPS -> Title Case; keep names that already have their own casing (DMart, BookMyShow)
  return out === out.toUpperCase() ? out.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()) : out;
};

// "UPI/DR/412345678901/SWIGGY/YESB/swiggy@ybl/Pay" -> "Swiggy"; "POS 4123XXXX AMAZON PAY INDIA" -> "Amazon Pay India"
export function cleanNote(raw: string) {
  const s = raw.replace(/\s+/g, " ").trim();
  const at = s.search(/\b(upi|imps|neft|rtgs|pos|ach)\b/i);
  if (at !== -1) {
    const part = s
      .slice(at)
      .split(/[/:|*-]/)
      .map((p) => p.trim())
      .filter((p) => !p.includes("@") && !/^[A-Z]{4}\d*$/.test(p)) // UPI handles and bank codes like YESB
      .map(tidy)
      .find((p) => /[a-z]{3,}/i.test(p));
    if (part) return part.slice(0, 200);
  }
  return s.slice(0, 200);
}

// ---------- building the rows ----------

function readType(cell: Cell): TxType | null {
  const s = norm(cell);
  if (/^(dr|d|debit|withdrawal|paid|sent|debited)$/.test(s)) return "EXPENSE";
  if (/^(cr|c|credit|deposit|received|credited)$/.test(s)) return "INCOME";
  return null;
}

export function buildRows(grid: Grid, map: Mapping): ParsedRow[] {
  const rows: ParsedRow[] = [];
  const body = grid.slice(map.header + 1);
  // In a single amount column with minus signs, the positive amounts are money in.
  const hasNegatives = map.mode === "single" && body.some((r) => parseAmount(r[map.amount] ?? null)?.sign === -1);
  for (const row of body) {
    const date = parseDate(row[map.date] ?? null);
    if (!date) continue; // totals, footers, blank lines
    const raw = map.description >= 0 ? text(row[map.description] ?? "") : "";
    const note = cleanNote(raw);

    if (map.mode === "split") {
      const out = parseAmount(row[map.debit] ?? null);
      const inn = parseAmount(row[map.credit] ?? null);
      if (out) rows.push({ date, note, raw, amount: out.value, type: "EXPENSE" });
      else if (inn) rows.push({ date, note, raw, amount: inn.value, type: "INCOME" });
      continue;
    }

    const amt = parseAmount(row[map.amount] ?? null);
    if (!amt) continue;
    const typed = map.type >= 0 ? readType(row[map.type] ?? null) : null;
    const type: TxType = typed ?? (amt.sign === 1 ? "INCOME" : amt.sign === -1 ? "EXPENSE" : hasNegatives ? "INCOME" : "EXPENSE");
    rows.push({ date, note, raw, amount: amt.value, type });
  }
  return rows;
}

// When a single amount column has no Dr/Cr and no minus signs, we can't tell money in from out.
export function directionUnknown(grid: Grid, map: Mapping) {
  if (map.mode !== "single" || map.type >= 0) return false;
  return !grid.slice(map.header + 1).some((r) => {
    const a = parseAmount(r[map.amount] ?? null);
    return a && a.sign !== 0;
  });
}

// ---------- automatic categories ----------

const RULES: [RegExp, string][] = [
  [/salary|payroll|sal cr/i, "Salary"],
  [/freelance|upwork|fiverr|invoice/i, "Freelance"],
  [/swiggy|zomato|blinkit|zepto|instamart|bigbasket|dominos|domino's|pizza|cafe|restaurant|starbucks|mcdonald|kfc|food|grocer|dmart|eatsure/i, "Food"],
  [/rent|landlord|nobroker|housing/i, "Rent"],
  [/uber|ola|rapido|metro|irctc|railway|redbus|petrol|fuel|indian oil|hpcl|bpcl|fastag|indigo|air ?india|makemytrip|parking/i, "Transport"],
  [/amazon|flipkart|myntra|ajio|meesho|nykaa|decathlon|croma|reliance digital|shopping|mall/i, "Shopping"],
  [/electricity|bescom|tneb|msedcl|water|gas|broadband|wifi|jio|airtel|\bvi\b|vodafone|bsnl|recharge|dth|tata ?play|bill|insurance|emi|loan/i, "Bills"],
  [/netflix|spotify|hotstar|prime video|youtube|bookmyshow|pvr|inox|steam|playstation|movie/i, "Entertainment"],
  [/pharma|pharmacy|apollo|medplus|1mg|netmeds|hospital|clinic|doctor|diagnostic|lab|health/i, "Health"],
];

export function guessCategory(note: string, type: TxType, categories: Category[]): number {
  const mine = categories.filter((c) => c.type === type);
  for (const [re, name] of RULES) {
    if (!re.test(note)) continue;
    const hit = mine.find((c) => c.name === name);
    if (hit) return hit.id;
  }
  const fallback = mine.find((c) => c.name === (type === "INCOME" ? "Other Income" : "Other"));
  return (fallback ?? mine[0])?.id ?? 0;
}

export const columnLabel = (grid: Grid, header: number, i: number) => {
  const name = text(grid[header]?.[i] ?? null);
  return name || `Column ${i + 1}`;
};
