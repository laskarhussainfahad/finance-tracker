import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { categories } from "../db/schema.js";
import { AuthRequest } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req: AuthRequest, res, next) => {
  try {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, req.userId!))
      .orderBy(asc(categories.type), asc(categories.name));
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req: AuthRequest, res, next) => {
  try {
    const data = z
      .object({ name: z.string().trim().min(1).max(50), type: z.enum(["INCOME", "EXPENSE"]) })
      .parse(req.body);
    const [row] = await db
      .insert(categories)
      .values({ ...data, userId: req.userId! })
      .onConflictDoNothing()
      .returning();
    if (!row) return res.status(409).json({ error: "Category already exists" });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
