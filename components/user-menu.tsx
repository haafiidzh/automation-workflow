"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";

type Me = { id: string; username: string; label: string };

/**
 * Shows who is signed in and handles session loss globally: a session can
 * expire or be deleted at any moment, so window.fetch is wrapped once here to
 * send the user to /login on any 401 instead of leaving a half-broken page.
 */
export function UserMenu() {
  const router = useRouter();
  const { t } = useLocale();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      if (res.status === 401 && window.location.pathname !== "/login") {
        router.replace("/login");
      }
      return res;
    };
    return () => {
      window.fetch = original;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Me | null) => {
        if (!cancelled) setMe(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };

  if (!me) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground" title={t.auth.loggedInAs(me.label)}>
        {me.label}
      </span>
      <Button variant="ghost" size="sm" onClick={logout} title={t.auth.logout}>
        <LogOut />
      </Button>
    </div>
  );
}
