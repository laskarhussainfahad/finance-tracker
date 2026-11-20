import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import transactionRoutes from "./routes/transactions.js";
import categoryRoutes from "./routes/categories.js";
import budgetRoutes from "./routes/budgets.js";
import statsRoutes from "./routes/stats.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/errorHandler.js";

export const app = express();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/transactions", requireAuth, transactionRoutes);
app.use("/api/categories", requireAuth, categoryRoutes);
app.use("/api/budgets", requireAuth, budgetRoutes);
app.use("/api/stats", requireAuth, statsRoutes);

app.use(errorHandler);
