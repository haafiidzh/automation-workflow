"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ArrowUp, ChevronLeft, ChevronRight, Moon, RefreshCw, SquarePen, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Markdown } from "@/components/markdown";
import { OnboardingModal } from "@/components/onboarding-modal";
import { NotionTicketPreviewModal } from "@/components/notion-ticket-preview";
import { MissingFieldsPrompt } from "@/components/missing-fields-prompt";
import { SessionSidebar } from "@/components/session-sidebar";
import {
  parseNotionTickets,
  parseNeedsInput,
  stripNotionTicketBlock,
  splitStreamingText,
  type NotionTicket,
  type NotionNeedsInput,
} from "@/lib/notion-ticket";
import { useLocale } from "@/lib/i18n/context";
import type { ConfigResponse, NotionCreateStatus, ProjectScanResponse, SessionRecord } from "@/lib/types";

function lastAgentKey(projectId: string) {
  return `orchestrator:lastAgent:${projectId}`;
}

type ToolCall = { name: string; input: Record<string, unknown> };

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
  toolCalls?: ToolCall[];
  notionTickets?: NotionTicket[];
  notionStatuses?: NotionCreateStatus[];
  activeTicketIndex?: number;
  needsInput?: NotionNeedsInput;
  needsInputResolved?: boolean;
};

function describeToolCall(t: ToolCall): string {
  const target = (t.input.file_path as string) || (t.input.pattern as string) || "";
  return `${t.name}${target ? `: ${target}` : ""}`;
}

export default function Home() {
  const { t } = useLocale();
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [scan, setScan] = useState<ProjectScanResponse | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [selectedNotion, setSelectedNotion] = useState<string>("");

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLElement>(null);
  const stickToBottomRef = useRef(true);

  const sessionStarted = messages.length > 0 || sending;

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data: ConfigResponse) => setConfig(data))
      .catch(() => setConfigError(t.errors.configLoad));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch once on mount; error string just uses locale active at that time
  }, []);

  const loadProjectScan = (projectId: string) => {
    if (!projectId) {
      setScan(null);
      return;
    }
    setScanLoading(true);
    setScanError(null);
    fetch(`/api/projects/${projectId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? t.errors.scanProject);
        return data as ProjectScanResponse;
      })
      .then((data) => {
        setScan(data);
        if (data.agents.length === 1) {
          setSelectedAgent(data.agents[0].name);
        } else {
          const remembered =
            typeof window !== "undefined"
              ? window.localStorage.getItem(lastAgentKey(projectId))
              : null;
          const exists = remembered && data.agents.some((a) => a.name === remembered);
          setSelectedAgent(exists ? remembered! : "");
        }
      })
      .catch((err) => {
        setScan(null);
        setScanError(err.message);
      })
      .finally(() => setScanLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-driven state, not derived render state
    loadProjectScan(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (stickToBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  const handleProjectChange = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedAgent("");
  };

  const handleAgentChange = (agentName: string) => {
    setSelectedAgent(agentName);
    if (selectedProjectId && typeof window !== "undefined") {
      window.localStorage.setItem(lastAgentKey(selectedProjectId), agentName);
    }
  };

  const readyToChat = Boolean(selectedProjectId && selectedAgent && selectedNotion);

  const resetSession = () => {
    setMessages([]);
    setSessionId(undefined);
    setChatError(null);
    setInput("");
  };

  const handleSelectSession = async (id: string) => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.sidebar.loadError);
      const record = data as SessionRecord;
      setMessages(
        record.turns.map((turn) => {
          if (turn.role !== "assistant") {
            return { role: turn.role, text: turn.text };
          }
          const tickets = parseNotionTickets(turn.text);
          if (tickets) {
            return {
              role: turn.role,
              text: stripNotionTicketBlock(turn.text),
              toolCalls: turn.toolCalls,
              notionTickets: tickets,
              notionStatuses:
                turn.notionStatuses ?? tickets.map(() => ({ state: "idle" as const })),
              activeTicketIndex: 0,
            };
          }
          const needsInput = parseNeedsInput(turn.text);
          if (needsInput) {
            return {
              role: turn.role,
              text: stripNotionTicketBlock(turn.text),
              toolCalls: turn.toolCalls,
              needsInput,
            };
          }
          return { role: turn.role, text: turn.text, toolCalls: turn.toolCalls };
        })
      );
      setSessionId(record.sessionId);
      setSelectedAgent(record.agentName);
      setSelectedNotion(record.notionAccountId);
      setChatError(null);
      setInput("");
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
    }
  };

  const sendMessage = async (overrideText?: string) => {
    const userText = (overrideText ?? input).trim();
    if (!userText || !readyToChat || sending) return;
    if (overrideText === undefined) setInput("");
    setChatError(null);
    stickToBottomRef.current = true;
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setMessages((m) => [...m, { role: "assistant", text: "", toolCalls: [] }]);
    setSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: selectedProjectId,
          agentName: selectedAgent,
          notionAccountId: selectedNotion,
          message: userText,
          sessionId,
        }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: t.errors.chatFailed }));
        throw new Error(data.error ?? t.errors.chatFailed);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          const dataLine = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine.slice("data: ".length));

          if (payload.type === "text_delta") {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, text: last.text + payload.text };
              return next;
            });
          } else if (payload.type === "tool_call") {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              next[next.length - 1] = {
                ...last,
                toolCalls: [...(last.toolCalls ?? []), { name: payload.name, input: payload.input }],
              };
              return next;
            });
          } else if (payload.type === "result") {
            setSessionId(payload.sessionId);
            setSessionsRefreshKey((k) => k + 1);
            if (payload.isError) {
              setChatError(t.errors.sessionError);
            }
            const tickets = parseNotionTickets(payload.finalText ?? "");
            if (tickets) {
              setMessages((m) => {
                const next = [...m];
                const last = next[next.length - 1];
                next[next.length - 1] = {
                  ...last,
                  text: stripNotionTicketBlock(last.text),
                  notionTickets: tickets,
                  notionStatuses: tickets.map(() => ({ state: "idle" as const })),
                  activeTicketIndex: 0,
                };
                return next;
              });
            } else {
              const needsInput = parseNeedsInput(payload.finalText ?? "");
              if (needsInput) {
                setMessages((m) => {
                  const next = [...m];
                  const last = next[next.length - 1];
                  next[next.length - 1] = {
                    ...last,
                    text: stripNotionTicketBlock(last.text),
                    needsInput,
                  };
                  return next;
                });
              }
            }
          } else if (payload.type === "error") {
            setChatError(payload.message);
          }
        }
      }
    } catch (err) {
      setChatError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  };

  const submitFieldAnswers = (index: number, answerText: string) => {
    setMessages((m) => {
      const next = [...m];
      next[index] = { ...next[index], needsInputResolved: true };
      return next;
    });
    sendMessage(answerText);
  };

  const setMessageNotionStatus = (index: number, ticketIndex: number, status: NotionCreateStatus) => {
    setMessages((m) => {
      const next = [...m];
      const last = next[index];
      const statuses = [...(last.notionStatuses ?? [])];
      statuses[ticketIndex] = status;
      next[index] = { ...last, notionStatuses: statuses };
      return next;
    });
  };

  const setActiveTicketIndex = (index: number, ticketIndex: number) => {
    setMessages((m) => {
      const next = [...m];
      next[index] = { ...next[index], activeTicketIndex: ticketIndex };
      return next;
    });
  };

  const createNotionTicket = async (index: number, ticketIndex: number) => {
    const ticket = messages[index]?.notionTickets?.[ticketIndex];
    if (!ticket) return;
    setMessageNotionStatus(index, ticketIndex, { state: "creating" });
    try {
      const res = await fetch("/api/notion/create-ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notionAccountId: selectedNotion, ticket }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.errors.notionCreate);
      const status: NotionCreateStatus = { state: "done", url: data.url };
      setMessageNotionStatus(index, ticketIndex, status);
      persistNotionStatus(index, ticketIndex, status);
    } catch (err) {
      const status: NotionCreateStatus = {
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      };
      setMessageNotionStatus(index, ticketIndex, status);
      persistNotionStatus(index, ticketIndex, status);
    }
  };

  const persistNotionStatus = (turnIndex: number, ticketIndex: number, status: NotionCreateStatus) => {
    if (!sessionId) return;
    fetch(`/api/sessions/${sessionId}/notion-status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ turnIndex, ticketIndex, status }),
    }).catch(() => {
      // best-effort — local UI state already reflects the result
    });
  };

  return (
    <div className="h-screen flex flex-row bg-background text-foreground">
      <SessionSidebar
        projectId={selectedProjectId}
        activeSessionId={sessionId}
        refreshKey={sessionsRefreshKey}
        onSelect={handleSelectSession}
      />
      <div className="flex-1 flex flex-col min-w-0">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <span className="text-sm font-medium text-muted-foreground">{t.topBar.brand}</span>
        <div className="flex items-center gap-1">
          {sessionStarted && (
            <Button variant="ghost" size="sm" onClick={resetSession}>
              <SquarePen /> {t.topBar.newSession}
            </Button>
          )}
          <OnboardingModal />
          <LocaleToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Messages */}
      <main
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto"
      >
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col gap-6 min-h-full">
          {messages.length === 0 && (
            <div className="m-auto text-center">
              <h1 className="text-3xl font-semibold text-foreground/90">
                {readyToChat ? t.empty.ready : t.empty.notReady}
              </h1>
              {!readyToChat && (
                <p className="text-sm text-muted-foreground mt-2">{t.empty.notReadyHint}</p>
              )}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  m.role === "user"
                    ? "max-w-[75%] rounded-3xl bg-muted px-4 py-2.5 text-[15px] whitespace-pre-wrap"
                    : "max-w-full w-full text-[15px] leading-relaxed"
                }
              >
                {m.toolCalls?.map((t, ti) => (
                  <div key={ti} className="text-xs text-muted-foreground italic mb-1.5">
                    🔧 {describeToolCall(t)}...
                  </div>
                ))}
                {m.role === "assistant" ? (
                  (() => {
                    const { visible, generatingTicket } = splitStreamingText(m.text);
                    return (
                      <>
                        {visible ? (
                          <Markdown text={visible} />
                        ) : sending && i === messages.length - 1 && !generatingTicket ? (
                          <TypingDots />
                        ) : null}
                        {generatingTicket && !m.notionTickets && (
                          <GeneratingNotionTicket label={t.notionTicket.generating} />
                        )}
                      </>
                    );
                  })()
                ) : (
                  m.text
                )}
                {m.notionTickets && (
                  <NotionTicketCard
                    message={m}
                    onCreate={(ticketIndex) => createNotionTicket(i, ticketIndex)}
                    onNavigate={(ticketIndex) => setActiveTicketIndex(i, ticketIndex)}
                    t={t}
                  />
                )}
                {m.needsInput && !m.needsInputResolved && (
                  <MissingFieldsPrompt
                    fields={m.needsInput.fields}
                    onComplete={(text) => submitFieldAnswers(i, text)}
                  />
                )}
              </div>
            </div>
          ))}
          {chatError && <p className="text-destructive text-sm">{chatError}</p>}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Composer */}
      <div className="shrink-0 px-4 pb-4 pt-2">
        {configError && (
          <p className="max-w-3xl mx-auto text-destructive text-xs mb-2">{configError}</p>
        )}
        <div className="max-w-3xl mx-auto rounded-3xl border bg-card shadow-sm px-3 pt-3 pb-2 flex flex-col gap-2">
          {/* Dropdown row — the ChatGPT-diff: project/agent/notion pickers instead of tool pickers */}
          <div className="flex flex-wrap items-center gap-2 px-1">
            <Select
              value={selectedProjectId || undefined}
              disabled={sessionStarted}
              onValueChange={(v) => handleProjectChange(v ?? "")}
            >
              <SelectTrigger size="sm" className="rounded-full">
                <SelectValue placeholder={t.composer.projectPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {config?.projects.map((p) => (
                  <SelectItem
                    key={p.id}
                    value={p.id}
                    disabled={!p.valid}
                    title={p.valid ? undefined : `${t.composer.incompleteProject(p.missing.join(", "))}`}
                  >
                    {p.label}
                    {p.valid ? "" : ` ${t.composer.incompleteLabel}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedAgent || undefined}
              disabled={!selectedProjectId || scanLoading || !scan?.validation.valid || sessionStarted}
              onValueChange={(v) => handleAgentChange(v ?? "")}
            >
              <SelectTrigger size="sm" className="rounded-full">
                <SelectValue placeholder={scanLoading ? t.composer.agentLoading : t.composer.agentPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {scan?.agents.map((a) => (
                  <SelectItem key={a.name} value={a.name} title={a.description}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedNotion || undefined}
              disabled={sessionStarted}
              onValueChange={(v) => setSelectedNotion(v ?? "")}
            >
              <SelectTrigger size="sm" className="rounded-full">
                <SelectValue placeholder={t.composer.notionPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {config?.notionAccounts.map((n) => (
                  <SelectItem key={n.id} value={n.id} disabled={!n.available}>
                    {n.label} {n.available ? "" : t.composer.emptyLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedProjectId && !sessionStarted && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => loadProjectScan(selectedProjectId)}
                title={t.composer.rescanTitle}
              >
                <RefreshCw />
              </Button>
            )}
          </div>

          {(scanError || (scan && !scan.validation.valid)) && (
            <p className="text-amber-600 dark:text-amber-500 text-xs px-1">
              {scanError ?? t.composer.incompleteProject(scan?.validation.missing.join(", ") ?? "")}
            </p>
          )}

          {/* Input row */}
          <div className="flex items-end gap-2">
            <Textarea
              className="flex-1 resize-none border-none shadow-none bg-transparent focus-visible:ring-0 text-[15px] px-1 py-1.5 max-h-[200px] min-h-0 field-sizing-content"
              placeholder={readyToChat ? t.composer.inputPlaceholder : t.composer.inputPlaceholderNotReady}
              value={input}
              disabled={!readyToChat || sending}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button
              size="icon"
              className="rounded-full mb-1"
              onClick={() => sendMessage()}
              disabled={!readyToChat || sending || !input.trim()}
              title={t.composer.send}
            >
              {sending ? <span className="w-2 h-2 rounded-full bg-current" /> : <ArrowUp />}
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

function NotionTicketCard({
  message,
  onCreate,
  onNavigate,
  t,
}: {
  message: ChatMessage;
  onCreate: (ticketIndex: number) => void;
  onNavigate: (ticketIndex: number) => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const tickets = message.notionTickets ?? [];
  const activeIndex = message.activeTicketIndex ?? 0;
  const status = message.notionStatuses?.[activeIndex] ?? { state: "idle" as const };
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasMultiple = tickets.length > 1;

  return (
    <div className="mt-3 rounded-xl border bg-muted/40 px-3 py-2.5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {hasMultiple && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t.notionTicket.prevTicket}
              disabled={activeIndex === 0}
              onClick={() => onNavigate(activeIndex - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title={t.notionTicket.nextTicket}
              disabled={activeIndex === tickets.length - 1}
              onClick={() => onNavigate(activeIndex + 1)}
            >
              <ChevronRight />
            </Button>
          </>
        )}
        <span className="text-sm text-muted-foreground">
          {hasMultiple
            ? `${t.notionTicket.counter(activeIndex + 1, tickets.length)} — ${t.notionTicket.readyCount(tickets.length)}`
            : t.notionTicket.ready}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)}>
          {t.notionTicket.preview}
        </Button>
        {status.state === "idle" && (
          <Button size="sm" onClick={() => onCreate(activeIndex)}>
            {t.notionTicket.create}
          </Button>
        )}
        {status.state === "creating" && (
          <Button size="sm" disabled>
            {t.notionTicket.creating}
          </Button>
        )}
        {status.state === "done" && (
          <a
            href={status.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            {t.notionTicket.open}
          </a>
        )}
        {status.state === "error" && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-destructive">{status.message}</span>
            <Button size="sm" variant="outline" onClick={() => onCreate(activeIndex)}>
              {t.notionTicket.retry}
            </Button>
          </div>
        )}
      </div>
      {tickets.length > 0 && (
        <NotionTicketPreviewModal
          tickets={tickets}
          statuses={message.notionStatuses}
          initialIndex={activeIndex}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          onCreate={onCreate}
          title={t.notionTicket.previewTitle}
          emptyLabel={t.notionTicket.previewEmpty}
          counterLabel={t.notionTicket.counter}
          prevLabel={t.notionTicket.prevTicket}
          nextLabel={t.notionTicket.nextTicket}
          createLabel={t.notionTicket.create}
          creatingLabel={t.notionTicket.creating}
          openLabel={t.notionTicket.open}
          retryLabel={t.notionTicket.retry}
        />
      )}
    </div>
  );
}

function GeneratingNotionTicket({ label }: { label: string }) {
  return (
    <div className="mt-1 flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm text-muted-foreground w-fit">
      <span className="size-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
      {label}
    </div>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 h-4">
      <span className="size-1.5 rounded-full bg-current animate-typing-dot [animation-delay:0ms]" />
      <span className="size-1.5 rounded-full bg-current animate-typing-dot [animation-delay:150ms]" />
      <span className="size-1.5 rounded-full bg-current animate-typing-dot [animation-delay:300ms]" />
    </span>
  );
}

function ThemeToggle() {
  const { t } = useLocale();
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard next-themes hydration guard
    setMounted(true);
  }, []);

  if (!mounted) return <div className="size-8" />;

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      title={isDark ? t.topBar.themeToLight : t.topBar.themeToDark}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}

function LocaleToggle() {
  const { locale, setLocale, t } = useLocale();
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setLocale(locale === "id" ? "en" : "id")}
      title={t.topBar.langSwitch}
    >
      <span className="text-xs font-semibold">{locale === "id" ? "ID" : "EN"}</span>
    </Button>
  );
}
