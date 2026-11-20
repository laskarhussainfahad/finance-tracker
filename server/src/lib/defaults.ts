import { db } from "../db/index.js";
import { categories } from "../db/schema.js";

const DEFAULT_CATEGORIES: { name: string; type: "INCOME" | "EXPENSE" }[] = [
  { name: "Salary", type: "INCOME" },
  { name: "Freelance", type: "INCOME" },
  { name: "Other Income", type: "INCOME" },
  { name: "Food", type: "EXPENSE" },
  { name: "Rent", type: "EXPENSE" },
  { name: "Transport", type: "EXPENSE" },
  { name: "Shopping", type: "EXPENSE" },
  { name: "Bills", type: "EXPENSE" },
  { name: "Entertainment", type: "EXPENSE" },
  { name: "Health", type: "EXPENSE" },
  { name: "Other", type: "EXPENSE" },
];

export async function createDefaultCategories(userId: number) {
  await db.insert(categories).values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
}

export function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}

export function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}
