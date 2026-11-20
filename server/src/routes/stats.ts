import { Router } from "express";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { categories, transactions } from "../db/schema.js";
import { AuthRequest } from "../middleware/auth.js";
import { currentMonth, isMonth, monthRange } from "../lib/defaults.js";

const router = Router();

// GET /api/stats/summary?month=2026-11
router.get("/summary", async (req: AuthRequest, res, next) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : currentMonth();
    const { start, end } = monthRange(month);
    const inMonth = and(
      eq(transactions.userId, req.userId!),
      gte(transactions.date, start),
      lt(transactions.date, end)
    );

    const totals = await db
      .select({ type: transactions.type, total: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(inMonth)
      .groupBy(transactions.type);
    const income = Number(totals.find((t) => t.type === "INCOME")?.total ?? 0);
    const expense = Number(totals.find((t) => t.type === "EXPENSE")?.total ?? 0);

    const total = sql<string>`sum(${transactions.amount})`;
    const byCategory = await db
      .select({ category: categories.name, amount: total })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(and(inMonth, eq(transactions.type, "EXPENSE")))
      .groupBy(categories.name)
      .orderBy(desc(total));

    res.json({
      month,
      income,
      expense,
      balance: income - expense,
      byCategory: byCategory.map((c) => ({ category: c.category, amount: Number(c.amount) })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/stats/monthly?months=6 -> income vs expense for the last N months
router.get("/monthly", async (req: AuthRequest, res, next) => {
  try {
    const n = Math.min(Math.max(Number(req.query.months) || 6, 1), 24);
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (n - 1), 1));
    const monthExpr = sql<string>`to_char(${transactions.date}, 'YYYY-MM')`;
    const rows = await db
      .select({ month: monthExpr, type: transactions.type, total: sql<string>`sum(${transactions.amount})` })
      .from(transactions)
      .where(and(eq(transactions.userId, req.userId!), gte(transactions.date, start)))
      .groupBy(monthExpr, transactions.type);

    const result = Array.from({ length: n }, (_, i) => {
      const key = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)).toISOString().slice(0, 7);
      const pick = (type: string) => Number(rows.find((r) => r.month === key && r.type === type)?.total ?? 0);
      return { month: key, income: pick("INCOME"), expense: pick("EXPENSE") };
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
