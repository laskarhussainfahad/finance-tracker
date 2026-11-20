// Small wrapper around fetch that adds the JWT and turns API errors into exceptions.
const BASE = import.meta.env.VITE_API_URL ?? "";

export type TxType = "INCOME" | "EXPENSE";
export interface Category { id: number; name: string; type: TxType }
export interface Transaction {
  id: number; amount: number; type: TxType; date: string; note: string | null;
  categoryId: number; category: { id: number; name: string };
}
export interface Budget {
  id: number; month: string; monthlyLimit: number; categoryId: number; categoryName: string; spent: number;
}
export interface Summary {
  month: string; income: number; expense: number; balance: number;
  byCategory: { category: string; amount: number }[];
}
export interface MonthlyPoint { month: string; income: number; expense: number }
export interface User { id: number; name: string; email: string }

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && token) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
