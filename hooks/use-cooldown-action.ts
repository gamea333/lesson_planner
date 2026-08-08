"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const COOLDOWN_SECONDS = 5;

interface UseCooldownActionOptions {
  actionLabel: string;
}

export function useCooldownAction({ actionLabel }: UseCooldownActionOptions) {
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

  const run = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      if (inFlightRef.current) {
        console.warn(`[LessonPlanner] ${actionLabel} blocked — already in flight`);
        return null;
      }
      if (cooldown > 0) {
        console.warn(
          `[LessonPlanner] ${actionLabel} blocked — cooldown ${cooldown}s remaining`
        );
        return null;
      }

      inFlightRef.current = true;
      setIsLoading(true);
      try {
        return await fn();
      } finally {
        inFlightRef.current = false;
        setIsLoading(false);
        setCooldown(COOLDOWN_SECONDS);
      }
    },
    [actionLabel, cooldown]
  );

  const isDisabled = isLoading || cooldown > 0;
  const waitLabel = isLoading
    ? "Generating…"
    : cooldown > 0
      ? `Wait ${cooldown}s…`
      : null;

  return { run, isLoading, cooldown, isDisabled, waitLabel };
}
