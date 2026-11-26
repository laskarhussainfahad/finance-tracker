import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, Budget, currentMonth, formatINR, MonthlyPoint, monthLabel, Summary } from "../api/client";
import MonthPicker from "../components/MonthPicker";
import { useTheme } from "../context/ThemeContext";

// Category colours for the donut chart (no greens, so income green keeps its meaning).
const COLORS = ["#4f46e5", "#0ea5e9", "#f59e0b", "#e11d48", "#8b5cf6", "#64748b", "#f97316", "#06b6d4"];

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="card">
      <p className="muted text-sm">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{formatINR(value)}</p>
    </div>
  );
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyPoint[]>([]);
  const [overBudget, setOverBudget] = useState<Budget[]>([]);
  const { isDark } = useTheme();
  // Chart colours that read well on both backgrounds
  const axis = isDark ? "#94a3b8" : "#64748b";
  const grid = isDark ? "#1e293b" : "#e2e8f0";
  const tooltipStyle = {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    borderRadius: 8,
    color: isDark ? "#f1f5f9" : "#1e293b",
  };

  useEffect(() => {
    api<Summary>(`/stats/summary?month=${month}`).then(setSummary);
    api<Budget[]>(`/budgets?month=${month}`).then((b) => setOverBudget(b.filter((x) => x.spent > x.monthlyLimit)));
  }, [month]);

  useEffect(() => {
    api<MonthlyPoint[]>("/stats/monthly?months=6").then((rows) =>
      setMonthly(rows.map((r) => ({ ...r, month: monthLabel(r.month) })))
    );
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {overBudget.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          Over budget this month: {overBudget.map((b) => `${b.categoryName} (${formatINR(b.spent - b.monthlyLimit)} over)`).join(", ")}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Income" value={summary?.income ?? 0} tone="text-emerald-600 dark:text-emerald-400" />
        <StatCard label="Expenses" value={summary?.expense ?? 0} tone="text-rose-600 dark:text-rose-400" />
        <StatCard label="Balance" value={summary?.balance ?? 0} tone={(summary?.balance ?? 0) >= 0 ? "text-slate-800 dark:text-slate-100" : "text-rose-600 dark:text-rose-400"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-medium">Spending by category</h2>
          {summary && summary.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={summary.byCategory} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2} stroke={isDark ? "#0f172a" : "#ffffff"}>
                  {summary.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-slate-400 dark:text-slate-500">No expenses this month yet.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-medium">Last 6 months</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
              <XAxis dataKey="month" fontSize={12} tick={{ fill: axis }} stroke={grid} />
              <YAxis fontSize={12} tick={{ fill: axis }} stroke={grid} tickFormatter={(v) => (Number(v) >= 1000 ? `₹${Number(v) / 1000}k` : `₹${v}`)} />
              <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: isDark ? "#1e293b" : "#f1f5f9" }} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill="#e11d48" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
