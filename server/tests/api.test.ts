import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { eq } from "drizzle-orm";
import { db, pool } from "../src/db/index.js";
import { users } from "../src/db/schema.js";

const email = `test-${Date.now()}@example.com`;
let token = "";
let foodId = 0;

beforeAll(() => {
  process.env.JWT_SECRET ||= "test-secret";
});

afterAll(async () => {
  await db.delete(users).where(eq(users.email, email));
  await pool.end();
});

describe("auth", () => {
  it("registers a user and creates default categories", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Test", email, password: "password123" });
    expect(res.status).toBe(201);
    token = res.body.token;
    const cats = await request(app).get("/api/categories").set("Authorization", `Bearer ${token}`);
    expect(cats.body.length).toBeGreaterThan(5);
    foodId = cats.body.find((c: { name: string }) => c.name === "Food").id;
  });

  it("rejects a wrong password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("blocks requests without a token", async () => {
    const res = await request(app).get("/api/transactions");
    expect(res.status).toBe(401);
  });
});

describe("transactions, stats and budgets", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const month = new Date().toISOString().slice(0, 7);

  it("creates, updates and lists transactions", async () => {
    const created = await request(app).post("/api/transactions").set(auth())
      .send({ amount: 250, type: "EXPENSE", date: new Date().toISOString(), categoryId: foodId, note: "Lunch" });
    expect(created.status).toBe(201);

    const updated = await request(app).put(`/api/transactions/${created.body.id}`).set(auth())
      .send({ amount: 300, type: "EXPENSE", date: new Date().toISOString(), categoryId: foodId });
    expect(Number(updated.body.amount)).toBe(300);

    const list = await request(app).get(`/api/transactions?month=${month}`).set(auth());
    expect(list.body).toHaveLength(1);
  });

  it("rejects invalid input", async () => {
    const res = await request(app).post("/api/transactions").set(auth()).send({ amount: -5 });
    expect(res.status).toBe(400);
  });

  it("summarises the month", async () => {
    const res = await request(app).get(`/api/stats/summary?month=${month}`).set(auth());
    expect(res.body.expense).toBe(300);
    expect(res.body.byCategory[0]).toEqual({ category: "Food", amount: 300 });
  });

  it("tracks budget spending", async () => {
    await request(app).post("/api/budgets").set(auth()).send({ categoryId: foodId, month, monthlyLimit: 1000 });
    const res = await request(app).get(`/api/budgets?month=${month}`).set(auth());
    expect(res.body[0]).toMatchObject({ monthlyLimit: 1000, spent: 300 });
  });
});

describe("forgot password", () => {
  it("resets the password with the recovery key, and the key only works once", async () => {
    const mail = `reset-${email}`;
    const reg = await request(app).post("/api/auth/register").send({ name: "R", email: mail, password: "password123" });
    const key = reg.body.recoveryKey as string;
    expect(key).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);

    const wrong = await request(app).post("/api/auth/reset").send({ email: mail, recoveryKey: "AAAA-AAAA-AAAA-AAAA", password: "newpass123" });
    expect(wrong.status).toBe(400);

    const ok = await request(app).post("/api/auth/reset").send({ email: mail, recoveryKey: key.toLowerCase(), password: "newpass123" });
    expect(ok.status).toBe(200);
    expect(ok.body.recoveryKey).not.toBe(key);

    const login = await request(app).post("/api/auth/login").send({ email: mail, password: "newpass123" });
    expect(login.status).toBe(200);
    const reuse = await request(app).post("/api/auth/reset").send({ email: mail, recoveryKey: key, password: "another123" });
    expect(reuse.status).toBe(400);

    await db.delete(users).where(eq(users.email, mail));
  });
});

describe("statement import", () => {
  it("imports many transactions at once and rejects another user's category", async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const date = new Date().toISOString();
    const ok = await request(app).post("/api/transactions/import").set(auth).send({
      items: [
        { amount: 120, type: "EXPENSE", date, categoryId: foodId, note: "Swiggy" },
        { amount: 80, type: "EXPENSE", date, categoryId: foodId, note: "Zomato" },
      ],
    });
    expect(ok.status).toBe(201);
    expect(ok.body.imported).toBe(2);

    const bad = await request(app).post("/api/transactions/import").set(auth)
      .send({ items: [{ amount: 10, type: "INCOME", date, categoryId: foodId }] });
    expect(bad.status).toBe(400);
  });
});

describe("data isolation", () => {
  it("does not let one user touch another user's transactions", async () => {
    const other = await request(app).post("/api/auth/register")
      .send({ name: "Other", email: `other-${email}`, password: "password123" });
    const mine = await request(app).get("/api/transactions").set({ Authorization: `Bearer ${token}` });
    const res = await request(app).delete(`/api/transactions/${mine.body[0].id}`)
      .set({ Authorization: `Bearer ${other.body.token}` });
    expect(res.status).toBe(404);
    await db.delete(users).where(eq(users.email, `other-${email}`));
  });
});
