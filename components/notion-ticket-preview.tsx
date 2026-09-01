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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Markdown } from "@/components/markdown";
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

function PropertyRow({ prop, emptyLabel }: { prop: NotionPropertyDisplay; emptyLabel: string }) {
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
}: {
  ticket: NotionTicket;
  title: string;
  emptyLabel: string;
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
          <PropertyRow key={p.name} prop={p} emptyLabel={emptyLabel} />
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
  open,
  onOpenChange,
  initialIndex = 0,
  title,
  emptyLabel,
  counterLabel,
  prevLabel,
  nextLabel,
}: {
  tickets: NotionTicket[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialIndex?: number;
  title: string;
  emptyLabel: string;
  counterLabel: (current: number, total: number) => string;
  prevLabel: string;
  nextLabel: string;
}) {
  const [index, setIndex] = useState(initialIndex);
  const [lastInitialIndex, setLastInitialIndex] = useState(initialIndex);
  if (open && initialIndex !== lastInitialIndex) {
    setLastInitialIndex(initialIndex);
    setIndex(initialIndex);
  }

  const ticket = tickets[index];
  const hasMultiple = tickets.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {hasMultiple && (
          <div className="flex items-center justify-between gap-2 -mt-1 mb-1">
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
          </div>
        )}
        {ticket && <TicketBody ticket={ticket} title={title} emptyLabel={emptyLabel} />}
      </DialogContent>
    </Dialog>
  );
}
