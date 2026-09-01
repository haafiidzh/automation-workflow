"use client";

import { useEffect, useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/i18n/context";
import type { SessionSummary } from "@/lib/types";

const COLLAPSE_KEY = "orchestrator:sidebarCollapsed";

function formatTimestamp(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "id" ? "id-ID" : "en-US", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SessionSidebar({
  projectId,
  activeSessionId,
  refreshKey,
  onSelect,
}: {
  projectId: string;
  activeSessionId: string | undefined;
  refreshKey: number;
  onSelect: (sessionId: string) => void;
}) {
  const { t, locale } = useLocale();
  const [collapsed, setCollapsed] = useState(false);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage hydration guard
    setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  };

  useEffect(() => {
    if (!projectId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-driven state, not derived render state
      setSessions([]);
      return;
    }
    setError(null);
    fetch(`/api/sessions?projectId=${encodeURIComponent(projectId)}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? t.sidebar.loadError);
        return data as SessionSummary[];
      })
      .then(setSessions)
      .catch(() => {
        setSessions([]);
        setError(t.sidebar.loadError);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- error string just uses locale active at fetch time
  }, [projectId, refreshKey]);

  return (
    <aside
      className={`shrink-0 border-r bg-muted/20 flex flex-col transition-[width] duration-150 ${
        collapsed ? "w-12" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between px-2 py-3">
        {!collapsed && (
          <span className="text-xs font-medium text-muted-foreground px-1">
            {t.topBar.brand}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleCollapsed}
          title={collapsed ? t.sidebar.expand : t.sidebar.collapse}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
      </div>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto px-2 pb-3 flex flex-col gap-1">
          {!projectId && (
            <p className="text-xs text-muted-foreground px-2 py-4">{t.sidebar.selectProject}</p>
          )}
          {projectId && error && (
            <p className="text-xs text-destructive px-2 py-4">{error}</p>
          )}
          {projectId && !error && sessions.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-4">{t.sidebar.empty}</p>
          )}
          {sessions.map((s) => (
            <button
              key={s.sessionId}
              onClick={() => onSelect(s.sessionId)}
              className={`text-left rounded-lg px-2.5 py-2 text-xs transition-colors ${
                s.sessionId === activeSessionId
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium truncate">{s.agentName}</span>
                <span className="shrink-0 opacity-70">{formatTimestamp(s.updatedAt, locale)}</span>
              </div>
              {s.preview && <div className="truncate mt-0.5 opacity-80">{s.preview}</div>}
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
