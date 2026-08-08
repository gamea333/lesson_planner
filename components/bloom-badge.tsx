import { cn } from "@/lib/utils";
import {
  BLOOM_LEVEL_LABELS,
  type BloomLevel,
} from "@/lib/types/blooms-taxonomy";

const BLOOM_COLORS: Record<BloomLevel, string> = {
  remember: "bg-slate-100 text-slate-700 border-slate-200",
  understand: "bg-sky-50 text-sky-800 border-sky-200",
  apply: "bg-emerald-50 text-emerald-800 border-emerald-200",
  analyze: "bg-amber-50 text-amber-900 border-amber-200",
  evaluate: "bg-violet-50 text-violet-800 border-violet-200",
  create: "bg-rose-50 text-rose-800 border-rose-200",
};

export function BloomBadge({
  level,
  className,
}: {
  level?: BloomLevel | string | null;
  className?: string;
}) {
  if (!level) return null;
  const key = level.toLowerCase() as BloomLevel;
  const label = BLOOM_LEVEL_LABELS[key] || level;
  const colors = BLOOM_COLORS[key] || BLOOM_COLORS.understand;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        colors,
        className
      )}
      title={`Bloom's Taxonomy: ${label}`}
    >
      Bloom · {label}
    </span>
  );
}
