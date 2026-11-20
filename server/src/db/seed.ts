// Creates a demo user (demo@example.com / demo12345) with 3 months of sample data.
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, pool } from "./index.js";
import { budgets, categories, transactions, users } from "./schema.js";

await db.delete(users).where(eq(users.email, "demo@example.com"));
const [user] = await db
  .insert(users)
  .values({ name: "Demo User", email: "demo@example.com", passwordHash: await bcrypt.hash("demo12345", 10) })
  .returning();

const names: [string, "INCOME" | "EXPENSE"][] = [
  ["Salary", "INCOME"], ["Freelance", "INCOME"], ["Food", "EXPENSE"], ["Rent", "EXPENSE"],
  ["Transport", "EXPENSE"], ["Shopping", "EXPENSE"], ["Bills", "EXPENSE"], ["Entertainment", "EXPENSE"],
];
const created = await db.insert(categories).values(names.map(([name, type]) => ({ name, type, userId: user.id }))).returning();
const cat = Object.fromEntries(created.map((c) => [c.name, c]));

const now = new Date();
for (let back = 2; back >= 0; back--) {
  const day = (d: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, d));
  const rows: [number, string, number, string][] = [
    [60000, "Salary", 1, "Monthly salary"],
    [8000 + back * 1500, "Freelance", 12, "Website project"],
    [15000, "Rent", 2, "Flat rent"],
    [2400, "Bills", 5, "Electricity + internet"],
    [3200 + back * 400, "Food", 8, "Groceries"],
    [1800, "Food", 11, "Swiggy orders"],
    [1500, "Transport", 10, "Metro card + Uber"],
    [4500 - back * 1000, "Shopping", 9, "Clothes"],
    [999, "Entertainment", 13, "Movie + OTT"],
  ];
  await db.insert(transactions).values(
    rows.map(([amount, c, d, note]) => ({
      amount, note, date: day(d), type: cat[c].type, categoryId: cat[c].id, userId: user.id,
    }))
  );
}

const month = now.toISOString().slice(0, 7);
await db.insert(budgets).values(
  ([["Food", 6000], ["Shopping", 4000], ["Entertainment", 1500]] as const).map(([c, limit]) => ({
    categoryId: cat[c].id, month, monthlyLimit: limit, userId: user.id,
  }))
);
console.log("Seeded demo user: demo@example.com / demo12345");
await pool.end();
