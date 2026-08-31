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

export function OnboardingModal() {
  const { t } = useLocale();
  const o = t.onboarding;
  const [copied, setCopied] = useState(false);

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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{o.dialogTitle}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="guide" className="min-w-0">
          <TabsList className="w-full">
            <TabsTrigger value="guide" className="flex-1">
              {o.tabGuide}
            </TabsTrigger>
            <TabsTrigger value="prompt" className="flex-1">
              {o.tabPrompt}
            </TabsTrigger>
          </TabsList>

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
