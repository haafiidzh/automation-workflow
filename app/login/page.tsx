"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!username.trim() || busy) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(
          res.status === 501
            ? t.auth.passwordNotSupported
            : res.status === 401
              ? t.auth.unknownUser
              : body.error || t.auth.loginFailed
        );
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setError(t.auth.loginFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6 shadow-sm"
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{t.auth.loginTitle}</h1>
          <p className="text-sm text-muted-foreground">{t.auth.loginSubtitle}</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="username" className="text-sm font-medium">
            {t.auth.usernameLabel}
          </label>
          <input
            id="username"
            name="username"
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder={t.auth.usernamePlaceholder}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={busy || !username.trim()}>
          {busy ? t.auth.loggingIn : t.auth.loginButton}
        </Button>

        {/* Users deserve to know this is identification, not authentication. */}
        <p className="text-xs leading-relaxed text-muted-foreground">{t.auth.insecureNotice}</p>
      </form>
    </main>
  );
}
