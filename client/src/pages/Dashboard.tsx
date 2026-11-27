import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, Budget, currentMonth, formatINR, MonthlyPoint, monthLabel, Summary } from "../api/client";
import MonthPicker from "../components/MonthPicker";
import { useTheme } from "../context/ThemeContext";

// Category colours for the donut chart, in the spirit of Vercel's palette.
const COLORS = ["#0070f3", "#7928ca", "#eb367f", "#f5a623", "#8f8f8f", "#3291ff", "#d4d4d4", "#ff4d4d"];

function StatCard({ label, value, tone, className = "" }: { label: string; value: number; tone: string; className?: string }) {
  return (
    <div className={`card ${className}`}>
      <p className="muted text-sm">{label}</p>
      <p className={`amount mt-2 text-xl font-semibold sm:text-2xl tracking-tight ${tone}`}>{formatINR(value)}</p>
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
  const axis = isDark ? "#a3a3a3" : "#737373";
  const grid = isDark ? "#1f1f1f" : "#ededed";
  const tooltipStyle = {
    backgroundColor: isDark ? "#0a0a0a" : "#ffffff",
    border: `1px solid ${isDark ? "#262626" : "#e5e5e5"}`,
    borderRadius: 8,
    color: isDark ? "#fafafa" : "#171717",
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
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          Over budget this month: {overBudget.map((b) => `${b.categoryName} (${formatINR(b.spent - b.monthlyLimit)} over)`).join(", ")}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard label="Income" value={summary?.income ?? 0} tone="text-green-600 dark:text-green-500" />
        <StatCard label="Expenses" value={summary?.expense ?? 0} tone="text-red-600 dark:text-red-500" />
        <StatCard label="Balance" value={summary?.balance ?? 0} tone={(summary?.balance ?? 0) >= 0 ? "text-neutral-800 dark:text-neutral-100" : "text-red-600 dark:text-red-400"} className="col-span-2 sm:col-span-1" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-medium">Spending by category</h2>
          {summary && summary.byCategory.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={summary.byCategory} dataKey="amount" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2} stroke={isDark ? "#0a0a0a" : "#ffffff"}>
                  {summary.byCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={tooltipStyle} itemStyle={{ color: tooltipStyle.color }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">No expenses this month yet.</p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-3 font-medium">Last 6 months</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={grid} />
              <XAxis dataKey="month" fontSize={12} tick={{ fill: axis }} stroke={grid} />
              <YAxis fontSize={12} tick={{ fill: axis }} stroke={grid} tickFormatter={(v) => (Number(v) >= 1000 ? `₹${Number(v) / 1000}k` : `₹${v}`)} />
              <Tooltip formatter={(v) => formatINR(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: isDark ? "#171717" : "#f5f5f5" }} />
              <Legend />
              <Bar dataKey="income" name="Income" fill={isDark ? "#22c55e" : "#16a34a"} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Expense" fill={isDark ? "#ef4444" : "#dc2626"} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
