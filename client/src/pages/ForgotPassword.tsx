import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) return setError("The two passwords don't match");
    setBusy(true);
    try {
      await resetPassword(email, key, password);
      navigate("/"); // logged in; the new recovery key pops up on the dashboard
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
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="muted text-sm">Use the recovery key you saved when you signed up.</p>
        </div>
        <input className="input" type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="input amount uppercase tracking-wider" placeholder="Recovery key (XXXX-XXXX-XXXX-XXXX)" required
          autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)}
        />
        <input className="input" type="password" placeholder="New password (8+ characters)" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <input className="input" type="password" placeholder="Confirm new password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button className="btn w-full" disabled={busy}>{busy ? "Please wait…" : "Reset password"}</button>
        <p className="muted text-xs">
          Lost your recovery key too? Your data is stored only in this browser, so the password can't be recovered without it.
        </p>
        <p className="muted text-center text-sm">
          <Link className="font-medium text-neutral-900 underline underline-offset-4 dark:text-white" to="/login">Back to log in</Link>
        </p>
      </form>
    </div>
  );
}
