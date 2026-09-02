"use client";

import { useState } from "react";
import {
  AlignLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleDot,
  Hash,
  Link2,
  List,
  Mail,
  Phone,
  Square,
  SquareCheck,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown";
import { useLocale } from "@/lib/i18n/context";
import type { NotionCreateStatus } from "@/lib/types";
import {
  extractLeadingHeading,
  extractNotionTitle,
  formatNotionProperties,
  type NotionPropertyDisplay,
  type NotionTicket,
} from "@/lib/notion-ticket";

const PROPERTY_ICON: Record<string, typeof Circle> = {
  rich_text: AlignLeft,
  select: Circle,
  status: CircleDot,
  multi_select: List,
  people: Users,
  date: Calendar,
  number: Hash,
  url: Link2,
  email: Mail,
  phone_number: Phone,
  relation: Link2,
  unknown: Circle,
};

/** Formats a Notion date-property value (raw ISO, optionally a "start → end" range) into a locale-aware long date. */
function formatDueDate(value: string, locale: string): string {
  const intlLocale = locale === "id" ? "id-ID" : "en-US";
  const formatPart = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const datePart = new Intl.DateTimeFormat(intlLocale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
    if (!iso.includes("T")) return datePart;
    const timePart = new Intl.DateTimeFormat(intlLocale, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
    return `${datePart} - ${timePart}`;
  };
  return value
    .split(" → ")
    .map(formatPart)
    .join(" → ");
}

function PropertyRow({
  prop,
  emptyLabel,
  locale,
}: {
  prop: NotionPropertyDisplay;
  emptyLabel: string;
  locale: string;
}) {
  const Icon = PROPERTY_ICON[prop.type] ?? Circle;
  return (
    <div className="flex items-start gap-3 py-1.5 text-sm">
      <div className="flex w-36 shrink-0 items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="truncate">{prop.name}</span>
      </div>
      <div className="min-w-0 flex-1">
        {prop.type === "checkbox" ? (
          prop.checked ? (
            <SquareCheck className="size-4 text-foreground" />
          ) : (
            <Square className="size-4 text-muted-foreground" />
          )
        ) : prop.empty ? (
          <span className="text-muted-foreground/60">{emptyLabel}</span>
        ) : prop.type === "select" || prop.type === "status" ? (
          <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{prop.value}</span>
        ) : prop.type === "multi_select" ? (
          <div className="flex flex-wrap gap-1">
            {prop.value.split(", ").map((v) => (
              <span key={v} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                {v}
              </span>
            ))}
          </div>
        ) : prop.type === "date" ? (
          <span className="break-words">{formatDueDate(prop.value, locale)}</span>
        ) : (
          <span className="break-words">{prop.value}</span>
        )}
      </div>
    </div>
  );
}

function TicketBody({
  ticket,
  title,
  emptyLabel,
  locale,
}: {
  ticket: NotionTicket;
  title: string;
  emptyLabel: string;
  locale: string;
}) {
  const ticketName = extractNotionTitle(ticket.properties);
  const leading = extractLeadingHeading(ticket.content_markdown);
  const pageTitle = leading?.heading || ticketName || title;
  const bodyMarkdown = leading ? leading.rest : ticket.content_markdown;
  const properties = formatNotionProperties(ticket.properties, ticket.people_names);

  return (
    <>
      {leading && ticketName && ticketName !== pageTitle && (
        <span className="text-xs font-medium text-muted-foreground">{ticketName}</span>
      )}
      <h1 className="text-2xl font-bold leading-tight break-words">{pageTitle}</h1>
      <div className="flex flex-col divide-y divide-border/60">
        {properties.map((p) => (
          <PropertyRow key={p.name} prop={p} emptyLabel={emptyLabel} locale={locale} />
        ))}
      </div>
      {bodyMarkdown && (
        <div className="border-t pt-3">
          <Markdown text={bodyMarkdown} />
        </div>
      )}
    </>
  );
}

export function NotionTicketPreviewModal({
  tickets,
  statuses,
  open,
  onOpenChange,
  onCreate,
  initialIndex = 0,
  title,
  emptyLabel,
  counterLabel,
  prevLabel,
  nextLabel,
  createLabel,
  creatingLabel,
  openLabel,
  retryLabel,
}: {
  tickets: NotionTicket[];
  statuses?: NotionCreateStatus[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (ticketIndex: number) => void;
  initialIndex?: number;
  title: string;
  emptyLabel: string;
  counterLabel: (current: number, total: number) => string;
  prevLabel: string;
  nextLabel: string;
  createLabel: string;
  creatingLabel: string;
  openLabel: string;
  retryLabel: string;
}) {
  const { locale } = useLocale();
  const [index, setIndex] = useState(initialIndex);
  const [lastInitialIndex, setLastInitialIndex] = useState(initialIndex);
  if (open && initialIndex !== lastInitialIndex) {
    setLastInitialIndex(initialIndex);
    setIndex(initialIndex);
  }

  const ticket = tickets[index];
  const hasMultiple = tickets.length > 1;
  const status = statuses?.[index] ?? { state: "idle" as const };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>

        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b bg-popover px-4 py-3">
          {hasMultiple ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                title={prevLabel}
                disabled={index === 0}
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
              >
                <ChevronLeft />
              </Button>
              <span className="text-xs font-medium text-muted-foreground">
                {counterLabel(index + 1, tickets.length)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                title={nextLabel}
                disabled={index === tickets.length - 1}
                onClick={() => setIndex((i) => Math.min(tickets.length - 1, i + 1))}
              >
                <ChevronRight />
              </Button>
            </>
          ) : (
            <span className="mx-auto text-xs font-medium text-muted-foreground">{title}</span>
          )}
        </div>

        <DialogClose
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2 z-20 rounded-full"
            />
          }
        >
          <X className="size-4" />
          <span className="sr-only">Close</span>
        </DialogClose>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex min-w-0 flex-col gap-3 px-4 pb-4 pt-3">
            {ticket && <TicketBody ticket={ticket} title={title} emptyLabel={emptyLabel} locale={locale} />}
          </div>
        </div>

        <div className="flex shrink-0 justify-end gap-2 rounded-b-xl border-t bg-popover px-4 py-3">
          {status.state === "idle" && (
            <Button size="sm" onClick={() => onCreate(index)}>
              {createLabel}
            </Button>
          )}
          {status.state === "creating" && (
            <Button size="sm" disabled>
              {creatingLabel}
            </Button>
          )}
          {status.state === "done" && (
            <a
              href={status.url}
              target="_blank"
              rel="noreferrer"
              className="self-center text-sm text-primary underline underline-offset-2"
            >
              {openLabel}
            </a>
          )}
          {status.state === "error" && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-destructive">{status.message}</span>
              <Button size="sm" variant="outline" onClick={() => onCreate(index)}>
                {retryLabel}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
