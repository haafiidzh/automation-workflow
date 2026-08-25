"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { NeedsInputField } from "@/lib/notion-ticket";
import { useLocale } from "@/lib/i18n/context";

type Answer = { property: string; label: string };

export function MissingFieldsPrompt({
  fields,
  onComplete,
}: {
  fields: NeedsInputField[];
  onComplete: (answerText: string) => void;
}) {
  const { t } = useLocale();
  const mf = t.missingFields;
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [textDraft, setTextDraft] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);

  const step = answers.length;
  const current = fields[step];
  const done = step >= fields.length;

  const commit = (label: string) => {
    const next = [...answers, { property: current.property, label }];
    setAnswers(next);
    setTextDraft("");
    setDate(undefined);
    setTime("");
    if (next.length === fields.length) {
      onComplete(next.map((a) => `${a.property}: ${a.label}`).join("\n"));
    }
  };

  return (
    <div className="mt-3 rounded-xl border bg-muted/40 px-3 py-2.5 flex flex-col gap-2 w-fit max-w-full">
      {answers.map((a, i) => (
        <div key={i} className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Check className="size-3.5 text-primary" />
          <span className="font-medium text-foreground">{a.property}:</span> {a.label}
        </div>
      ))}

      {!done && current && (
        <div className="flex flex-col gap-2">
          <p className="text-sm">{current.prompt}</p>

          {(current.type === "people" || current.type === "select") && (
            <div className="flex flex-wrap gap-1.5">
              {(current.options ?? []).map((opt) => (
                <Button key={opt.id} size="sm" variant="outline" onClick={() => commit(opt.label)}>
                  {opt.label}
                </Button>
              ))}
            </div>
          )}

          {current.type === "date" && (
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger
                  render={
                    <Button variant="outline" size="sm">
                      {date ? date.toLocaleDateString() : mf.pickDate}
                    </Button>
                  }
                />
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setCalendarOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              />
              <Button
                size="sm"
                disabled={!date}
                onClick={() => commit(date ? `${date.toLocaleDateString()}${time ? " " + time : ""}` : "")}
              >
                {mf.confirm}
              </Button>
            </div>
          )}

          {current.type === "text" && (
            <div className="flex items-end gap-2">
              <Textarea
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                className="min-h-0 text-sm"
              />
              <Button size="sm" disabled={!textDraft.trim()} onClick={() => commit(textDraft.trim())}>
                {mf.confirm}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
