"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { GenerateFromKbInput } from "@/lib/types/knowledge-base";
import type { LessonPlan } from "@/lib/types/lesson-plan";

const COOLDOWN_SECONDS = 5;

export interface GenerateApiResult {
  success: boolean;
  lessonPlan: LessonPlan;
  metadata: {
    grade: string;
    subject: string;
    chapter: string;
    numberOfDays: string;
  };
  chapterId: number;
}

interface UseGenerateActionOptions {
  action: "generate" | "regenerate";
}

export function useGenerateAction({ action }: UseGenerateActionOptions) {
  const inFlightRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = window.setInterval(() => {
      setCooldown((current) => (current <= 1 ? 0 : current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [cooldown]);

  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
  }, []);

  const invokeGenerate = useCallback(
    async (body: GenerateFromKbInput): Promise<GenerateApiResult | null> => {
      if (inFlightRef.current) {
        console.warn(
          `[LessonPlanner] /api/generate blocked — request already in flight (action: ${action})`
        );
        return null;
      }

      if (cooldown > 0) {
        console.warn(
          `[LessonPlanner] /api/generate blocked — cooldown active (${cooldown}s remaining, action: ${action})`
        );
        return null;
      }

      inFlightRef.current = true;
      setIsLoading(true);

      const clickId = crypto.randomUUID();
      console.log(
        `[LessonPlanner] /api/generate button click (action: ${action}, clickId: ${clickId}, chapterId: ${body.chapterId}) — invoking fetch exactly once from knowledge base`
      );

      try {
        const response = await fetch("/api/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Click-Id": clickId,
          },
          body: JSON.stringify(body),
        });

        console.log(
          `[LessonPlanner] /api/generate fetch completed (action: ${action}, clickId: ${clickId}, status: ${response.status}) — total fetches for this click: 1`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to generate lesson plan");
        }

        return (await response.json()) as GenerateApiResult;
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
        startCooldown();
      }
    },
    [action, cooldown, startCooldown]
  );

  const isDisabled = isLoading || cooldown > 0;

  const waitLabel = isLoading
    ? action === "regenerate"
      ? "Regenerating…"
      : "Generating…"
    : cooldown > 0
      ? `Wait ${cooldown}s…`
      : null;

  return {
    invokeGenerate,
    isLoading,
    cooldown,
    isDisabled,
    waitLabel,
  };
}
