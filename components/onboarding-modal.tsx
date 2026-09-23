"use client";

import { useState } from "react";
import { CircleHelp, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocale } from "@/lib/i18n/context";
import type { SetupStep } from "@/lib/i18n/dictionaries";

/**
 * A command block with a copy button. Every command in this modal is meant to
 * be pasted into a terminal, and a command retyped by hand is a command typed
 * wrong.
 */
function CopyBlock({ code, title }: { code: string; title: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-1.5">
      <pre className="max-w-full bg-muted rounded-md p-2.5 pr-10 text-xs overflow-x-auto whitespace-pre-wrap">
        {code}
      </pre>
      <Button
        size="icon-sm"
        variant="outline"
        className="absolute top-1.5 right-1.5"
        title={title}
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? <Check /> : <Copy />}
      </Button>
    </div>
  );
}

function SetupSteps({
  steps,
  copyTitle,
  footer,
}: {
  steps: SetupStep[];
  copyTitle: string;
  footer?: string;
}) {
  return (
    <div className="min-w-0 text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-1">
      <ol className="min-w-0 space-y-3">
        {steps.map((step) => (
          <li key={step.title} className="min-w-0">
            <p className="font-medium">{step.title}</p>
            {step.body && <p className="mt-1 text-muted-foreground">{step.body}</p>}
            {step.code && <CopyBlock code={step.code} title={copyTitle} />}
            {step.note && <p className="mt-1.5 text-muted-foreground text-xs">{step.note}</p>}
          </li>
        ))}
      </ol>
      {footer && <p className="text-muted-foreground text-xs">{footer}</p>}
    </div>
  );
}

export function OnboardingModal() {
  const { t } = useLocale();
  const o = t.onboarding;
  const [copied, setCopied] = useState(false);

  // Filled in from the page itself so the allow-origin command is correct
  // without the user having to work out what to type.
  const origin = typeof window === "undefined" ? "<origin-orchestrator>" : window.location.origin;
  const withOrigin = (steps: SetupStep[]): SetupStep[] =>
    steps.map((step) =>
      step.code?.includes("__ORIGIN__")
        ? { ...step, code: step.code.replaceAll("__ORIGIN__", origin) }
        : step
    );

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(o.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" title={o.triggerTitle} />}>
        <CircleHelp />
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{o.dialogTitle}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="agent" className="min-w-0">
          <TabsList className="w-full">
            <TabsTrigger value="agent" className="flex-1">
              {o.tabAgent}
            </TabsTrigger>
            <TabsTrigger value="folders" className="flex-1">
              {o.tabFolders}
            </TabsTrigger>
            <TabsTrigger value="notion" className="flex-1">
              {o.tabNotion}
            </TabsTrigger>
            <TabsTrigger value="guide" className="flex-1">
              {o.tabGuide}
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex-1">
              {o.tabPrompt}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agent" className="min-w-0">
            <SetupSteps
              steps={withOrigin(o.agentSteps)}
              copyTitle={o.copyTitle}
              footer={`${o.platformNote} — ${o.setupDocLink}`}
            />
          </TabsContent>

          <TabsContent value="folders" className="min-w-0">
            <SetupSteps steps={o.folderSteps} copyTitle={o.copyTitle} footer={o.setupDocLink} />
          </TabsContent>

          <TabsContent value="notion" className="min-w-0">
            <SetupSteps steps={o.notionSteps} copyTitle={o.copyTitle} footer={o.setupDocLink} />
          </TabsContent>

          <TabsContent
            value="guide"
            className="min-w-0 text-sm space-y-4 max-h-[60vh] overflow-y-auto pr-1"
          >
            <ol className="min-w-0 list-decimal list-inside space-y-3">
              <li>
                {o.guideStep1Title}
                <code className="bg-muted px-1 rounded">.claude/</code>
                {o.guideStep1Rest}
                <pre className="mt-1.5 max-w-full bg-muted rounded-md p-2.5 text-xs overflow-x-auto">
                  {o.guideStep1Code}
                </pre>
              </li>
              <li>
                {o.guideStep2[0]}
                <code className="bg-muted px-1 rounded">{o.guideStep2[1]}</code>
                {o.guideStep2[2]}
                <code className="bg-muted px-1 rounded">{o.guideStep2[3]}</code>
                {o.guideStep2[4]}
              </li>
              <li>
                {o.guideStepRequiredTitle}
                <pre className="mt-1.5 max-w-full bg-muted rounded-md p-2.5 text-xs overflow-x-auto">
                  {o.guideStepRequiredCode}
                </pre>
                <p className="mt-1.5 text-muted-foreground">{o.guideStepRequiredNote}</p>
              </li>
              <li>
                {o.guideStepPeopleTitle}
                <pre className="mt-1.5 max-w-full bg-muted rounded-md p-2.5 text-xs overflow-x-auto">
                  {o.guideStepPeopleCode}
                </pre>
                <p className="mt-1.5 text-muted-foreground">{o.guideStepPeopleNote}</p>
              </li>
              <li>
                {o.guideStepSettingsTitle}
                <pre className="mt-1.5 max-w-full bg-muted rounded-md p-2.5 text-xs overflow-x-auto">
                  {o.guideStepSettingsCode}
                </pre>
                <p className="mt-1.5 text-muted-foreground">{o.guideStepSettingsNote}</p>
              </li>
              <li>{o.guideStep3[0]}</li>
              <li>
                {o.guideStep4Title}
                <code className="bg-muted px-1 rounded">workflow/projects.md</code>
                {o.guideStep4Rest}
                <pre className="mt-1.5 max-w-full bg-muted rounded-md p-2.5 text-xs overflow-x-auto">
                  {o.guideStep4Code}
                </pre>
                {o.guideStep4Note1}
                <code className="bg-muted px-1 rounded">ALLOWED_PROJECT_ROOT</code>
                {o.guideStep4Note2}
              </li>
            </ol>
            <p className="text-muted-foreground text-xs">{o.guideExample}</p>
          </TabsContent>

          <TabsContent value="prompt" className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">{o.promptIntro}</p>
            <div className="relative">
              <pre className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap max-h-[45vh] overflow-y-auto">
                {o.prompt}
              </pre>
              <Button
                size="icon-sm"
                variant="outline"
                className="absolute top-2 right-2"
                onClick={copyPrompt}
                title={o.copyTitle}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
