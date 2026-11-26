import { useState } from "react";
import { useAuth } from "../context/AuthContext";

// Shown once, right after a recovery key is created. The app only keeps a hash of it,
// so if the user loses it, it can't be shown again (they can make a new one from Account).
export default function RecoveryKeyModal() {
  const { user, recoveryKey, dismissRecoveryKey } = useAuth();
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!recoveryKey) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the key is still selectable on screen */
    }
  };

  const download = () => {
    const text = `Finance Tracker recovery key\nAccount: ${user?.email ?? ""}\n\n${recoveryKey}\n\nUse it on the "Forgot password?" page to set a new password. It works once; you'll get a new key after using it.\n`;
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "finance-tracker-recovery-key.txt" });
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rk-title">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
        <h2 id="rk-title" className="text-lg font-semibold">Save your recovery key</h2>
        <p className="muted mt-1 text-sm">
          If you forget your password, this key is the only way to reset it. It's shown once, so keep it somewhere safe.
        </p>
        <div className="amount mt-4 select-all rounded-md border border-neutral-200 bg-neutral-50 px-4 py-3 text-center text-lg tracking-wider dark:border-neutral-800 dark:bg-black">
          {recoveryKey}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" className="rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button type="button" className="rounded-md border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900" onClick={download}>
            Download .txt
          </button>
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-black dark:accent-white" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I've saved my recovery key
        </label>
        <button className="btn mt-4 w-full" disabled={!saved} onClick={dismissRecoveryKey}>Continue</button>
      </div>
    </div>
  );
}
