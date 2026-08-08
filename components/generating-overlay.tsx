"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";

interface GeneratingOverlayProps {
  message?: string;
  submessage?: string;
}

export function GeneratingOverlay({
  message = "Building your lesson plan…",
  submessage = "Analyzing your question bank and structuring activities",
}: GeneratingOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md animate-in fade-in duration-300">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{message}</p>
              <p className="text-sm text-muted-foreground">{submessage}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              AI is drafting your plan
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
            <div className="pt-2">
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Skeleton className="h-16 rounded-xl" />
              <Skeleton className="h-16 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
