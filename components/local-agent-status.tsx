"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, EyeOff, HardDrive, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useLocale } from "@/lib/i18n/context";
import {
  checkStatus,
  clearToken,
  getToken,
  listRoots,
  setToken,
  type LocalAgentStatus,
} from "@/lib/local-agent-client";
import type { LocalProject } from "@/lib/types";

type Props = {
  /** Lets the page know whether to send a bridge id with the next message. */
  onStatusChange?: (status: LocalAgentStatus) => void;
};

const DOT_CLASS: Record<LocalAgentStatus["state"], string> = {
  connected: "bg-emerald-500",
  unpaired: "bg-amber-500",
  checking: "bg-muted-foreground animate-pulse",
  disconnected: "bg-muted-foreground",
};

export function LocalAgentStatusButton({ onStatusChange }: Props) {
  const { t } = useLocale();
  const l = t.localAgent;
  const [status, setStatus] = useState<LocalAgentStatus>({ state: "checking" });
  const [tokenInput, setTokenInput] = useState(() => {
    if (typeof window === "undefined") return "";
    return getToken() ?? "";
  });
  const [pairError, setPairError] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);
  /** undefined = not loaded yet, null = the agent refused to list them. */
  const [roots, setRoots] = useState<LocalProject[] | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const next = await checkStatus();
    setStatus(next);
    onStatusChange?.(next);
    // The folder list needs the token, so it is only fetched once paired.
    if (next.state !== "connected") {
      setRoots(undefined);
      return;
    }
    try {
      setRoots(await listRoots());
    } catch {
      setRoots(null);
    }
  }, [onStatusChange]);

  useEffect(() => {
    // refresh() only sets state after awaiting the network probe, so this is
    // not a synchronous cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    // Re-probe periodically so starting/stopping the agent is picked up
    // without a page reload.
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const label =
    status.state === "connected"
      ? l.statusConnected(status.roots)
      : status.state === "unpaired"
        ? l.statusUnpaired
        : status.state === "checking"
          ? l.statusChecking
          : l.statusDisconnected;

  const pair = async () => {
    setPairError(null);
    setToken(tokenInput);
    const next = await checkStatus();
    setStatus(next);
    onStatusChange?.(next);
    if (next.state === "unpaired") setPairError(l.errorInvalidToken);
    if (next.state === "disconnected") {
      setPairError(next.portsExhausted ? l.errorPortConflict : l.errorNotRunning);
    }
  };

  const disconnect = async () => {
    clearToken();
    setTokenInput("");
    setPairError(null);
    await refresh();
  };

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="ghost" size="sm" title={label} />}
        aria-label={l.connect}
      >
        <span className={`size-2 rounded-full ${DOT_CLASS[status.state]}`} aria-hidden />
        <HardDrive className="size-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{l.dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">{l.intro}</p>

          <div className="flex items-center gap-2">
            <span className={`size-2 rounded-full ${DOT_CLASS[status.state]}`} aria-hidden />
            <span>{label}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              title={l.recheck}
              onClick={() => {
                setStatus({ state: "checking" });
                void refresh();
              }}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>

          {status.state === "disconnected" && (
            <p className="text-amber-600 dark:text-amber-500">
              {status.portsExhausted ? l.errorPortConflict : l.errorNotRunning}
            </p>
          )}

          {status.state === "connected" && (
            <div className="space-y-2">
              <p className="font-medium">{l.rootsTitle}</p>
              {roots === null && <p className="text-amber-600 dark:text-amber-500">{l.rootsError}</p>}
              {roots?.length === 0 && <p className="text-muted-foreground">{l.rootsEmpty}</p>}
              {roots && roots.length > 0 && (
                <ul className="space-y-1">
                  {roots.map((r) => (
                    <li key={r.path} className="flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          r.mode === "rw"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {r.mode === "rw" ? l.rootWrite : l.rootRead}
                      </span>
                      <span className="truncate font-mono text-xs" title={r.path}>
                        {r.path}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {roots?.some((r) => r.mode === "rw") ? (
                <p className="text-amber-600 dark:text-amber-500">{l.writeWarning}</p>
              ) : (
                <p className="text-muted-foreground">{l.writeHint}</p>
              )}
            </div>
          )}

          <ol className="space-y-3">
            <li>
              <p className="font-medium">{l.step1Title}</p>
              <pre className="mt-1 bg-muted rounded-md p-2 text-xs overflow-x-auto">
                {l.step1Body}
              </pre>
            </li>
            <li>
              <p className="font-medium">{l.step2Title}</p>
              <pre className="mt-1 bg-muted rounded-md p-2 text-xs overflow-x-auto">
                {`orchestrator-agent allow /path/to/project
orchestrator-agent allow-origin ${typeof window === "undefined" ? "" : window.location.origin}`}
              </pre>
            </li>
            <li>
              <p className="font-medium">{l.step3Title}</p>
              <pre className="mt-1 bg-muted rounded-md p-2 text-xs overflow-x-auto">
                orchestrator-agent token
              </pre>
            </li>
          </ol>

          <div className="space-y-2">
            <label className="font-medium" htmlFor="local-agent-token">
              {l.tokenLabel}
            </label>
            <div className="relative">
              <input
                id="local-agent-token"
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder={l.tokenPlaceholder}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 pr-9 text-sm"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? l.hideToken : l.showToken}
                className="absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
            {pairError && <p className="text-destructive">{pairError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void pair()} disabled={!tokenInput.trim()}>
                {l.pair}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void disconnect()}>
                {l.disconnect}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
