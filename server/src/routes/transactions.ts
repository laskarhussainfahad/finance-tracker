import { Router } from "express";
import { and, desc, eq, gte, lt, SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { categories, transactions } from "../db/schema.js";
import { AuthRequest } from "../middleware/auth.js";
import { isMonth, monthRange } from "../lib/defaults.js";

const router = Router();

const txSchema = z.object({
  amount: z.coerce.number().positive().max(1e10),
  type: z.enum(["INCOME", "EXPENSE"]),
  date: z.coerce.date(),
  note: z.string().max(200).optional().nullable(),
  categoryId: z.coerce.number().int().positive(),
});

// The category must belong to this user and match the transaction type.
async function validCategory(userId: number, categoryId: number, type: "INCOME" | "EXPENSE") {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId), eq(categories.type, type)));
  return !!row;
}

function withCategory(id: number, userId: number) {
  return db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.userId, userId)),
    with: { category: { columns: { id: true, name: true } } },
  });
}

// GET /api/transactions?month=2026-11&type=EXPENSE
router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const { month, type } = req.query;
    const filters: SQL[] = [eq(transactions.userId, req.userId!)];
    if (isMonth(month)) {
      const { start, end } = monthRange(month);
      filters.push(gte(transactions.date, start), lt(transactions.date, end));
    }
    if (type === "INCOME" || type === "EXPENSE") filters.push(eq(transactions.type, type));

    const rows = await db.query.transactions.findMany({
      where: and(...filters),
      with: { category: { columns: { id: true, name: true } } },
      orderBy: [desc(transactions.date), desc(transactions.id)],
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const data = txSchema.parse(req.body);
    if (!(await validCategory(req.userId!, data.categoryId, data.type))) {
      return res.status(400).json({ error: "Category doesn't exist or doesn't match the type" });
    }
    const [row] = await db
      .insert(transactions)
      .values({ ...data, userId: req.userId! })
      .returning({ id: transactions.id });
    res.status(201).json(await withCategory(row.id, req.userId!));
  } catch (err) {
    next(err);
  }
});

router.put("/:id", async (req: AuthRequest, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = txSchema.parse(req.body);
    if (!(await validCategory(req.userId!, data.categoryId, data.type))) {
      return res.status(400).json({ error: "Category doesn't exist or doesn't match the type" });
    }
    const [row] = await db
      .update(transactions)
      .set({ ...data, note: data.note ?? null })
      .where(and(eq(transactions.id, id), eq(transactions.userId, req.userId!)))
      .returning({ id: transactions.id });
    if (!row) return res.status(404).json({ error: "Transaction not found" });
    res.json(await withCategory(row.id, req.userId!));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req: AuthRequest, res, next) => {
  try {
    const rows = await db
      .delete(transactions)
      .where(and(eq(transactions.id, Number(req.params.id)), eq(transactions.userId, req.userId!)))
      .returning({ id: transactions.id });
    if (rows.length === 0) return res.status(404).json({ error: "Transaction not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
