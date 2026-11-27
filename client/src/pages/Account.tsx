import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Account() {
  const { user, newRecoveryKey, logout } = useAuth();
  const [error, setError] = useState("");

  const create = async () => {
    if (!confirm("Create a new recovery key? Your old key will stop working.")) return;
    setError("");
    try {
      await newRecoveryKey();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Account</h1>
      <div className="card space-y-1">
        <p className="muted text-sm">Name</p>
        <p className="font-medium">{user?.name}</p>
        <p className="muted pt-3 text-sm">Email</p>
        <p className="font-medium">{user?.email}</p>
      </div>
      <div className="card space-y-3">
        <div>
          <h2 className="font-medium">Recovery key</h2>
          <p className="muted text-sm">
            You need it to reset your password if you forget it. Lost it, or never got one? Create a new key; the old one stops working.
          </p>
        </div>
        <button className="btn" onClick={create}>Create new recovery key</button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
      <button className="w-full rounded-md border border-neutral-200 py-2.5 text-sm font-medium text-red-600 md:hidden dark:border-neutral-800 dark:text-red-500" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
