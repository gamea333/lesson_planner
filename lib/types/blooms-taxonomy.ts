/** Revised Bloom's Taxonomy (Anderson & Krathwohl) levels for question design. */
export type BloomLevel =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export const BLOOM_LEVELS: BloomLevel[] = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
];

export const BLOOM_LEVEL_LABELS: Record<BloomLevel, string> = {
  remember: "Remember",
  understand: "Understand",
  apply: "Apply",
  analyze: "Analyze",
  evaluate: "Evaluate",
  create: "Create",
};

/** Typical action verbs / task shapes for each level (for prompts). */
export const BLOOM_LEVEL_GUIDANCE: Record<BloomLevel, string> = {
  remember:
    "Recall facts, terms, definitions, names, dates — list, define, identify, name, match, state.",
  understand:
    "Explain ideas/concepts — summarize, describe, paraphrase, classify, explain why/how in own words.",
  apply:
    "Use information in a new situation — solve, demonstrate, illustrate, use, compute, apply to a scenario.",
  analyze:
    "Break into parts; find relationships — compare, contrast, differentiate, organize, attribute, examine motives/structure.",
  evaluate:
    "Justify a stand or decision — critique, judge, defend, argue, assess, recommend with reasons.",
  create:
    "Produce new work — design, construct, invent, compose, plan, propose an original product or alternative ending.",
};

export function isBloomLevel(value: unknown): value is BloomLevel {
  return typeof value === "string" && BLOOM_LEVELS.includes(value as BloomLevel);
}

export function normalizeBloomLevel(
  value: unknown,
  fallback: BloomLevel = "understand"
): BloomLevel {
  if (isBloomLevel(value)) return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (isBloomLevel(lower)) return lower;
  }
  return fallback;
}

/** Suggest a balanced mix of Bloom levels across N questions. */
export function suggestBloomDistribution(
  count: number,
  allowed: BloomLevel[] = BLOOM_LEVELS
): BloomLevel[] {
  const levels = allowed.length ? allowed : BLOOM_LEVELS;
  const out: BloomLevel[] = [];
  for (let i = 0; i < count; i++) {
    out.push(levels[i % levels.length]);
  }
  return out;
}

export function formatBloomPromptBlock(levels: BloomLevel[]): string {
  const selected = levels.length ? levels : BLOOM_LEVELS;
  return selected
    .map(
      (level) =>
        `- ${BLOOM_LEVEL_LABELS[level]} (${level}): ${BLOOM_LEVEL_GUIDANCE[level]}`
    )
    .join("\n");
}
