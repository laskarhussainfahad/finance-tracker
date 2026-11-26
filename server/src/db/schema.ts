import { relations } from "drizzle-orm";
import { index, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, integer } from "drizzle-orm/pg-core";

export const txType = pgEnum("tx_type", ["INCOME", "EXPENSE"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  recoveryHash: text("recovery_hash"), // bcrypt hash of the one-time recovery key
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    type: txType("type").notNull(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("categories_user_name_type").on(t.userId, t.name, t.type)]
);

export const transactions = pgTable(
  "transactions",
  {
    id: serial("id").primaryKey(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    type: txType("type").notNull(),
    date: timestamp("date").notNull(),
    note: text("note"),
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "restrict" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("transactions_user_date").on(t.userId, t.date)]
);

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    monthlyLimit: numeric("monthly_limit", { precision: 12, scale: 2, mode: "number" }).notNull(),
    month: text("month").notNull(), // "YYYY-MM"
    categoryId: integer("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("budgets_user_category_month").on(t.userId, t.categoryId, t.month)]
);

export const transactionsRelations = relations(transactions, ({ one }) => ({
  category: one(categories, { fields: [transactions.categoryId], references: [categories.id] }),
}));
export const budgetsRelations = relations(budgets, ({ one }) => ({
  category: one(categories, { fields: [budgets.categoryId], references: [categories.id] }),
}));
