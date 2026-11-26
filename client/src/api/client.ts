// Every page calls api(). By default it uses the in-browser backend (localBackend.ts), so the app
// needs no server. Set VITE_BACKEND=server in client/.env to use the Express API instead.
import { ApiError, localApi } from "./localBackend";

const BASE = import.meta.env.VITE_API_URL ?? "";
export const USE_SERVER = import.meta.env.VITE_BACKEND === "server";

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

function logOut() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.hash = "#/login";
  window.location.reload();
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");
  if (!USE_SERVER) {
    try {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : undefined;
      return (await localApi(options.method ?? "GET", path, body, token)) as T;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && token) logOut();
      throw err;
    }
  }
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (res.status === 401 && token) logOut();
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
