// A tiny "backend" that runs inside the browser and saves everything in localStorage.
// It answers the same paths as the Express server, so the pages don't know the difference.
// Each visitor's data stays in their own browser.

type TxType = "INCOME" | "EXPENSE";
interface UserRow { id: number; name: string; email: string; passwordHash: string; recoveryHash?: string }
interface CategoryRow { id: number; name: string; type: TxType; userId: number }
interface TxRow { id: number; amount: number; type: TxType; date: string; note: string | null; categoryId: number; userId: number }
interface BudgetRow { id: number; monthlyLimit: number; month: string; categoryId: number; userId: number }
interface Db { nextId: number; users: UserRow[]; categories: CategoryRow[]; transactions: TxRow[]; budgets: BudgetRow[] }

const KEY = "finance-tracker-db";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function load(): Db {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return { nextId: 1, users: [], categories: [], transactions: [], budgets: [] };
}

function save(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

async function hash(password: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`finance-tracker:${password}`));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Recovery keys replace "reset by email" (there is no email server): 16 random characters
// shown once, like XXXX-XXXX-XXXX-XXXX. Only a hash is stored.
const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I, so it's easy to copy by hand
function newRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const raw = [...bytes].map((b) => KEY_CHARS[b % KEY_CHARS.length]).join("");
  return raw.match(/.{4}/g)!.join("-");
}
const normalizeKey = (k: unknown) => String(k ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const hashKey = (k: unknown) => hash(`recovery:${normalizeKey(k)}`);

const isMonth = (m: unknown): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
const currentMonth = () => new Date().toISOString().slice(0, 7);
const inMonth = (iso: string, month: string) => iso.slice(0, 7) === month;
const round = (n: number) => Math.round(n * 100) / 100;

const DEFAULT_CATEGORIES: [string, TxType][] = [
  ["Salary", "INCOME"], ["Freelance", "INCOME"], ["Other Income", "INCOME"],
  ["Food", "EXPENSE"], ["Rent", "EXPENSE"], ["Transport", "EXPENSE"], ["Shopping", "EXPENSE"],
  ["Bills", "EXPENSE"], ["Entertainment", "EXPENSE"], ["Health", "EXPENSE"], ["Other", "EXPENSE"],
];

function addCategories(db: Db, userId: number) {
  for (const [name, type] of DEFAULT_CATEGORIES) db.categories.push({ id: db.nextId++, name, type, userId });
}

// A demo account with 3 months of sample data, created the first time the app is opened.
export async function seedDemo() {
  const db = load();
  if (db.users.some((u) => u.email === "demo@example.com")) return;
  const user: UserRow = { id: db.nextId++, name: "Demo User", email: "demo@example.com", passwordHash: await hash("demo12345") };
  db.users.push(user);
  addCategories(db, user.id);
  const cat = (name: string) => db.categories.find((c) => c.userId === user.id && c.name === name)!;
  const now = new Date();
  for (let back = 2; back >= 0; back--) {
    const day = (d: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, d)).toISOString();
    const rows: [number, string, number, string][] = [
      [60000, "Salary", 1, "Monthly salary"], [8000 + back * 1500, "Freelance", 12, "Website project"],
      [15000, "Rent", 2, "Flat rent"], [2400, "Bills", 5, "Electricity + internet"],
      [3200 + back * 400, "Food", 8, "Groceries"], [1800, "Food", 11, "Swiggy orders"],
      [1500, "Transport", 10, "Metro card + Uber"], [4500 - back * 1000, "Shopping", 9, "Clothes"],
      [999, "Entertainment", 13, "Movie + OTT"],
    ];
    for (const [amount, c, d, note] of rows) {
      const category = cat(c);
      db.transactions.push({ id: db.nextId++, amount, type: category.type, date: day(d), note, categoryId: category.id, userId: user.id });
    }
  }
  const month = now.toISOString().slice(0, 7);
  for (const [c, limit] of [["Food", 6000], ["Shopping", 4000], ["Entertainment", 1500]] as const) {
    db.budgets.push({ id: db.nextId++, monthlyLimit: limit, month, categoryId: cat(c).id, userId: user.id });
  }
  save(db);
}

function withCategory(db: Db, t: TxRow) {
  const c = db.categories.find((x) => x.id === t.categoryId);
  return { ...t, category: { id: t.categoryId, name: c?.name ?? "Unknown" } };
}

function readTx(body: any) {
  const amount = Number(body?.amount);
  const type = body?.type;
  const date = new Date(body?.date);
  const categoryId = Number(body?.categoryId);
  if (!(amount > 0) || amount > 1e10) throw new ApiError(400, "Amount must be a positive number");
  if (type !== "INCOME" && type !== "EXPENSE") throw new ApiError(400, "Type must be income or expense");
  if (isNaN(date.getTime())) throw new ApiError(400, "Invalid date");
  const note = typeof body?.note === "string" && body.note.trim() ? body.note.slice(0, 200) : null;
  return { amount: round(amount), type: type as TxType, date: date.toISOString(), note, categoryId };
}

export async function localApi(method: string, path: string, body: any, token: string | null): Promise<unknown> {
  const db = load();
  const [route, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  const parts = route.split("/").filter(Boolean); // e.g. ["transactions", "12"]

  // ----- Auth (no token needed) -----
  if (parts[0] === "auth") {
    // Logged in: replace the recovery key (the old one stops working).
    if (parts[1] === "recovery-key") {
      const user = db.users.find((u) => u.id === Number(token));
      if (!user) throw new ApiError(401, "Please log in again");
      const recoveryKey = newRecoveryKey();
      user.recoveryHash = await hashKey(recoveryKey);
      save(db);
      return { recoveryKey };
    }
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new ApiError(400, "Enter a valid email");
    if (parts[1] === "register") {
      const name = String(body?.name ?? "").trim();
      if (!name) throw new ApiError(400, "Enter your name");
      if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
      if (db.users.some((u) => u.email === email)) throw new ApiError(409, "Email already registered");
      const recoveryKey = newRecoveryKey();
      const user: UserRow = { id: db.nextId++, name, email, passwordHash: await hash(password), recoveryHash: await hashKey(recoveryKey) };
      db.users.push(user);
      addCategories(db, user.id);
      save(db);
      return { token: String(user.id), user: { id: user.id, name, email }, recoveryKey };
    }
    // Forgot password: email + recovery key -> new password. The key is single-use: a new one is issued.
    if (parts[1] === "reset") {
      const user = db.users.find((u) => u.email === email);
      if (password.length < 8) throw new ApiError(400, "Password must be at least 8 characters");
      if (!user || !user.recoveryHash || user.recoveryHash !== (await hashKey(body?.recoveryKey))) {
        throw new ApiError(400, "That email and recovery key don't match");
      }
      const recoveryKey = newRecoveryKey();
      user.passwordHash = await hash(password);
      user.recoveryHash = await hashKey(recoveryKey);
      save(db);
      return { token: String(user.id), user: { id: user.id, name: user.name, email }, recoveryKey };
    }
    if (parts[1] === "login") {
      const user = db.users.find((u) => u.email === email);
      if (!user || user.passwordHash !== (await hash(password))) throw new ApiError(401, "Invalid email or password");
      return { token: String(user.id), user: { id: user.id, name: user.name, email } };
    }
  }

  // ----- Everything else needs a logged-in user -----
  const userId = Number(token);
  if (!db.users.some((u) => u.id === userId)) throw new ApiError(401, "Please log in again");
  const id = Number(parts[1]);

  if (parts[0] === "categories") {
    const mine = db.categories.filter((c) => c.userId === userId);
    if (method === "GET") return [...mine].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const name = String(body?.name ?? "").trim();
    if (!name || (body?.type !== "INCOME" && body?.type !== "EXPENSE")) throw new ApiError(400, "Name and type are required");
    if (mine.some((c) => c.name === name && c.type === body.type)) throw new ApiError(409, "Category already exists");
    const row: CategoryRow = { id: db.nextId++, name, type: body.type, userId };
    db.categories.push(row);
    save(db);
    return row;
  }

  if (parts[0] === "transactions") {
    const validCategory = (categoryId: number, type: TxType) =>
      db.categories.some((c) => c.id === categoryId && c.userId === userId && c.type === type);

    // Bulk import from a statement: all rows are checked first, then saved together.
    if (method === "POST" && parts[1] === "import") {
      const items = Array.isArray(body?.items) ? body.items : null;
      if (!items || items.length === 0) throw new ApiError(400, "Nothing to import");
      if (items.length > 5000) throw new ApiError(400, "Import at most 5000 rows at a time");
      const rows = items.map((item: unknown, i: number) => {
        try {
          const data = readTx(item);
          if (!validCategory(data.categoryId, data.type)) throw new ApiError(400, "Category doesn't match the type");
          return data;
        } catch (err) {
          throw new ApiError(400, `Row ${i + 1}: ${(err as Error).message}`);
        }
      });
      for (const data of rows) db.transactions.push({ id: db.nextId++, ...data, userId });
      save(db);
      return { imported: rows.length };
    }

    if (method === "GET") {
      const month = params.get("month");
      const type = params.get("type");
      return db.transactions
        .filter((t) => t.userId === userId && (!isMonth(month) || inMonth(t.date, month)) && (!type || t.type === type))
        .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id)
        .map((t) => withCategory(db, t));
    }
    if (method === "POST") {
      const data = readTx(body);
      if (!validCategory(data.categoryId, data.type)) throw new ApiError(400, "Category doesn't match the type");
      const row: TxRow = { id: db.nextId++, ...data, userId };
      db.transactions.push(row);
      save(db);
      return withCategory(db, row);
    }
    const row = db.transactions.find((t) => t.id === id && t.userId === userId);
    if (!row) throw new ApiError(404, "Transaction not found");
    if (method === "PUT") {
      const data = readTx(body);
      if (!validCategory(data.categoryId, data.type)) throw new ApiError(400, "Category doesn't match the type");
      Object.assign(row, data);
      save(db);
      return withCategory(db, row);
    }
    if (method === "DELETE") {
      db.transactions = db.transactions.filter((t) => t !== row);
      save(db);
      return undefined;
    }
  }

  if (parts[0] === "budgets") {
    if (method === "GET") {
      const month = isMonth(params.get("month")) ? params.get("month")! : currentMonth();
      return db.budgets
        .filter((b) => b.userId === userId && b.month === month)
        .map((b) => {
          const spent = db.transactions
            .filter((t) => t.userId === userId && t.type === "EXPENSE" && t.categoryId === b.categoryId && inMonth(t.date, month))
            .reduce((s, t) => s + t.amount, 0);
          const categoryName = db.categories.find((c) => c.id === b.categoryId)?.name ?? "Unknown";
          return { ...b, categoryName, spent: round(spent) };
        })
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    }
    if (method === "POST") {
      const categoryId = Number(body?.categoryId);
      const monthlyLimit = Number(body?.monthlyLimit);
      const month = body?.month;
      if (!isMonth(month)) throw new ApiError(400, "Month must look like 2026-11");
      if (!(monthlyLimit > 0)) throw new ApiError(400, "Limit must be a positive number");
      if (!db.categories.some((c) => c.id === categoryId && c.userId === userId && c.type === "EXPENSE")) {
        throw new ApiError(400, "Unknown expense category");
      }
      const existing = db.budgets.find((b) => b.userId === userId && b.categoryId === categoryId && b.month === month);
      if (existing) existing.monthlyLimit = round(monthlyLimit);
      else db.budgets.push({ id: db.nextId++, monthlyLimit: round(monthlyLimit), month, categoryId, userId });
      save(db);
      return existing ?? db.budgets.at(-1);
    }
    if (method === "DELETE") {
      const before = db.budgets.length;
      db.budgets = db.budgets.filter((b) => !(b.id === id && b.userId === userId));
      if (db.budgets.length === before) throw new ApiError(404, "Budget not found");
      save(db);
      return undefined;
    }
  }

  if (parts[0] === "stats") {
    const mine = db.transactions.filter((t) => t.userId === userId);
    if (parts[1] === "summary") {
      const month = isMonth(params.get("month")) ? params.get("month")! : currentMonth();
      const txs = mine.filter((t) => inMonth(t.date, month));
      const income = round(txs.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0));
      const expense = round(txs.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0));
      const byName = new Map<string, number>();
      for (const t of txs.filter((t) => t.type === "EXPENSE")) {
        const name = db.categories.find((c) => c.id === t.categoryId)?.name ?? "Unknown";
        byName.set(name, (byName.get(name) ?? 0) + t.amount);
      }
      const byCategory = [...byName].map(([category, amount]) => ({ category, amount: round(amount) })).sort((a, b) => b.amount - a.amount);
      return { month, income, expense, balance: round(income - expense), byCategory };
    }
    if (parts[1] === "monthly") {
      const n = Math.min(Math.max(Number(params.get("months")) || 6, 1), 24);
      const now = new Date();
      return Array.from({ length: n }, (_, i) => {
        const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1) + i, 1)).toISOString().slice(0, 7);
        const txs = mine.filter((t) => inMonth(t.date, key));
        const sum = (type: TxType) => round(txs.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0));
        return { month: key, income: sum("INCOME"), expense: sum("EXPENSE") };
      });
    }
  }

  throw new ApiError(404, "Not found");
}
