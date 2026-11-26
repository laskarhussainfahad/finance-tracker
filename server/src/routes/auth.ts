import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { randomInt } from "node:crypto";
import { createDefaultCategories } from "../lib/defaults.js";
import { AuthRequest, requireAuth } from "../middleware/auth.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

// Recovery keys stand in for "reset by email": 16 random characters shown once (XXXX-XXXX-XXXX-XXXX).
const KEY_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newRecoveryKey() {
  const raw = Array.from({ length: 16 }, () => KEY_CHARS[randomInt(KEY_CHARS.length)]).join("");
  return raw.match(/.{4}/g)!.join("-");
}
const normalizeKey = (k: string) => k.toUpperCase().replace(/[^A-Z0-9]/g, "");

function signToken(userId: number) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET!, { expiresIn: "7d" });
}

router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = registerSchema.parse(req.body);
    const [existing] = await db.select().from(users).where(eq(users.email, email));
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const recoveryKey = newRecoveryKey();
    const [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash: await bcrypt.hash(password, 10),
        recoveryHash: await bcrypt.hash(normalizeKey(recoveryKey), 10),
      })
      .returning();
    await createDefaultCategories(user.id);
    res.status(201).json({ token: signToken(user.id), user: { id: user.id, name, email }, recoveryKey });
  } catch (err) {
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset { email, recoveryKey, password } -> sets a new password and issues a new key
router.post("/reset", async (req, res, next) => {
  try {
    const { email, recoveryKey, password } = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        recoveryKey: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      })
      .parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, email));
    const ok = user?.recoveryHash && (await bcrypt.compare(normalizeKey(recoveryKey), user.recoveryHash));
    if (!user || !ok) return res.status(400).json({ error: "That email and recovery key don't match" });

    const newKey = newRecoveryKey();
    await db
      .update(users)
      .set({ passwordHash: await bcrypt.hash(password, 10), recoveryHash: await bcrypt.hash(normalizeKey(newKey), 10) })
      .where(eq(users.id, user.id));
    res.json({ token: signToken(user.id), user: { id: user.id, name: user.name, email }, recoveryKey: newKey });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/recovery-key (logged in) -> replaces the recovery key
router.post("/recovery-key", requireAuth, async (req: AuthRequest, res, next) => {
  try {
    const recoveryKey = newRecoveryKey();
    await db
      .update(users)
      .set({ recoveryHash: await bcrypt.hash(normalizeKey(recoveryKey), 10) })
      .where(eq(users.id, req.userId!));
    res.json({ recoveryKey });
  } catch (err) {
    next(err);
  }
});

export default router;
