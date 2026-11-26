import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const isLogin = mode === "login";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (isLogin) await login(email, password);
      else await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="card w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-white">Finance Tracker</h1>
          <p className="muted text-sm">{isLogin ? "Log in to your account" : "Create your account"}</p>
        </div>
        {!isLogin && (
          <input className="input" placeholder="Name" required value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input className="input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input" type="password" placeholder="Password" required minLength={isLogin ? 1 : 8}
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        {isLogin && (
          <div className="-mt-2 text-right">
            <Link className="muted text-xs hover:text-neutral-900 hover:underline dark:hover:text-white" to="/forgot">Forgot password?</Link>
          </div>
        )}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : isLogin ? "Log in" : "Sign up"}</button>
        <p className="muted text-center text-sm">
          {isLogin ? "No account? " : "Already have an account? "}
          <Link className="font-medium text-neutral-900 underline underline-offset-4 dark:text-white" to={isLogin ? "/register" : "/login"}>
            {isLogin ? "Sign up" : "Log in"}
          </Link>
        </p>
        {isLogin && <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">Demo: demo@example.com / demo12345</p>}
      </form>
    </div>
  );
}
