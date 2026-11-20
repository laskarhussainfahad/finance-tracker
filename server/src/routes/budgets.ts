import { Router } from "express";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { budgets, categories, transactions } from "../db/schema.js";
import { AuthRequest } from "../middleware/auth.js";
import { currentMonth, isMonth, monthRange } from "../lib/defaults.js";

const router = Router();

// GET /api/budgets?month=2026-11 -> each budget plus how much has been spent so far
router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const month = isMonth(req.query.month) ? req.query.month : currentMonth();
    const { start, end } = monthRange(month);
    const spent = db
      .select({
        categoryId: transactions.categoryId,
        total: sql<string>`sum(${transactions.amount})`.as("total"),
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, req.userId!),
          eq(transactions.type, "EXPENSE"),
          gte(transactions.date, start),
          lt(transactions.date, end)
        )
      )
      .groupBy(transactions.categoryId)
      .as("spent");

    const rows = await db
      .select({
        id: budgets.id,
        month: budgets.month,
        monthlyLimit: budgets.monthlyLimit,
        categoryId: budgets.categoryId,
        categoryName: categories.name,
        spent: sql<string>`coalesce(${spent.total}, 0)`,
      })
      .from(budgets)
      .innerJoin(categories, eq(budgets.categoryId, categories.id))
      .leftJoin(spent, eq(spent.categoryId, budgets.categoryId))
      .where(and(eq(budgets.userId, req.userId!), eq(budgets.month, month)))
      .orderBy(categories.name);

    res.json(rows.map((r) => ({ ...r, spent: Number(r.spent) })));
  } catch (err) {
    next(err);
  }
});

// POST creates the budget for a category + month, or updates it if it already exists
router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const data = z
      .object({
        categoryId: z.coerce.number().int().positive(),
        month: z.string().refine(isMonth, "Month must look like 2026-11"),
        monthlyLimit: z.coerce.number().positive().max(1e10),
      })
      .parse(req.body);
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(
        and(eq(categories.id, data.categoryId), eq(categories.userId, req.userId!), eq(categories.type, "EXPENSE"))
      );
    if (!category) return res.status(400).json({ error: "Unknown expense category" });

    const [row] = await db
      .insert(budgets)
      .values({ ...data, userId: req.userId! })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { monthlyLimit: data.monthlyLimit },
      })
      .returning();
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const rows = await db
      .delete(budgets)
      .where(and(eq(budgets.id, Number(req.params.id)), eq(budgets.userId, req.userId!)))
      .returning({ id: budgets.id });
    if (rows.length === 0) return res.status(404).json({ error: "Budget not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
