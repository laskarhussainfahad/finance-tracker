import { createContext, ReactNode, useContext, useState } from "react";
import { api, User } from "../api/client";

interface Session { token: string; user: User; recoveryKey?: string }

interface AuthState {
  user: User | null;
  /** A recovery key that was just created and must be shown to the user once. */
  recoveryKey: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string, recoveryKey: string, password: string) => Promise<void>;
  newRecoveryKey: () => Promise<void>;
  dismissRecoveryKey: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function loadUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem("user") ?? "null");
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(loadUser);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);

  const save = ({ token, user, recoveryKey }: Session) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));
    setUser(user);
    if (recoveryKey) setRecoveryKey(recoveryKey);
  };

  const post = (path: string, body: object) => api<Session>(path, { method: "POST", body: JSON.stringify(body) });

  const value: AuthState = {
    user,
    recoveryKey,
    login: async (email, password) => save(await post("/auth/login", { email, password })),
    register: async (name, email, password) => save(await post("/auth/register", { name, email, password })),
    resetPassword: async (email, key, password) => save(await post("/auth/reset", { email, recoveryKey: key, password })),
    newRecoveryKey: async () => setRecoveryKey((await api<{ recoveryKey: string }>("/auth/recovery-key", { method: "POST" })).recoveryKey),
    dismissRecoveryKey: () => setRecoveryKey(null),
    logout: () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      setUser(null);
      setRecoveryKey(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
