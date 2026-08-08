import { callGroqJson, logFullGroqPayload } from "@/lib/groq-client";
import { estimateTokenCount } from "@/lib/groq-utils";
import {
  extractSpecificityTerms,
  GROUNDING_SYSTEM_RULES,
  lessonPlanToText,
  logFaithfulnessCheck,
  needsSpecificityRetry,
  resolveChapterTitle,
  STRONGER_GROUNDING_REMINDER,
} from "@/lib/grounding";
import { normalizeStoredStructure } from "@/lib/parse-lesson-structure";
import {
  buildPrioritizedSourceBlocks,
  packPromptBlocks,
} from "@/lib/prompt-budget";
import type { KnowledgeBaseEntry } from "@/lib/types/knowledge-base";
import {
  CUSTOMIZATION_PRESETS,
  type CustomizationOptions,
  type GenerateFromKbInput,
} from "@/lib/types/knowledge-base";
import type {
  DayPlan,
  LessonPlan,
  TeachingMethodology,
} from "@/lib/types/lesson-plan";

/** Soft budget for user prompt body (leaves room for TPM headroom) */
const USER_PROMPT_TOKEN_BUDGET = 4200;
const SYSTEM_PROMPT_TOKEN_BUDGET = 1800;

const METHODOLOGY_WITH_CITATIONS = `{
    "warmUp": "string — MUST name a specific character/event/term from source",
    "warmUpCitation": "string — one proper noun/term from source used above",
    "conceptBuilding": "string — MUST name specific source content",
    "conceptBuildingCitation": "string — one proper noun/term from source",
    "extension": ["string — from source Annexure/homework; name specifics"],
    "extensionCitation": "string — one proper noun/term from source",
    "assessment": ["string — from source homework/annexure"],
    "assessmentCitation": "string — one proper noun/term from source",
    "modelKeyAnswers": [{ "question": "string", "answer": "string", "explanation": "string" }],
    "sourceCitation": "string — overall chapter-specific term verifying grounding"
  }`;

const SINGLE_DAY_SCHEMA = `{
  "grade": "string",
  "subject": "string",
  "chapter": "string (MUST match source chapter title exactly)",
  "numberOfDays": "1",
  "learningOutcomes": ["string — grounded in THIS chapter"],
  "resourcesRequired": ["string"],
  "objectives": { "warmUp": "string", "conceptBuilding": "string", "extension": "string", "assessment": "string" },
  "teachingMethodology": ${METHODOLOGY_WITH_CITATIONS},
  "skillsAndAttitude": ["string"],
  "competencies": ["string"],
  "noteForFacilitator": "string"
}`;

const MULTI_DAY_SCHEMA = `{
  "grade": "string",
  "subject": "string",
  "chapter": "string (MUST match source chapter title exactly)",
  "numberOfDays": "string",
  "learningOutcomes": ["string"],
  "resourcesRequired": ["string"],
  "skillsAndAttitude": ["string"],
  "competencies": ["string"],
  "noteForFacilitator": "string",
  "days": [
    {
      "day": 1,
      "title": "string",
      "focus": "string — name specific source content covered this day",
      "objectives": { "warmUp": "string", "conceptBuilding": "string", "extension": "string", "assessment": "string" },
      "teachingMethodology": ${METHODOLOGY_WITH_CITATIONS}
    }
  ],
  "objectives": { "warmUp": "string", "conceptBuilding": "string", "extension": "string", "assessment": "string" },
  "teachingMethodology": ${METHODOLOGY_WITH_CITATIONS}
}`;

const DAY_SPLIT_GUIDANCE: Record<number, string> = {
  2: `Day 1: Introduction + Comprehension / Pre-Content. Day 2: Characterization/Writing + Assessment + remaining Extension.`,
  3: `Day 1: Introduction + Comprehension. Day 2: Flow Chart / Characterization. Day 3: Writing activity + Review + Assessment.`,
  4: `Day 1: Introduction + Pre-Content. Day 2: Comprehension + Flow Chart. Day 3: Characterization + Writing. Day 4: Review + Extension wrap-up + Assessment.`,
};

function buildCustomizationInstructions(customization: CustomizationOptions): string {
  const instructions: string[] = [];
  if (customization.shortenWarmUp) instructions.push(CUSTOMIZATION_PRESETS.shortenWarmUp);
  if (customization.extraPractice) instructions.push(CUSTOMIZATION_PRESETS.extraPractice);
  if (customization.simplifyLanguage) instructions.push(CUSTOMIZATION_PRESETS.simplifyLanguage);
  if (customization.realWorldExamples) instructions.push(CUSTOMIZATION_PRESETS.realWorldExamples);
  if (customization.customText.trim()) instructions.push(customization.customText.trim());
  return instructions.length
    ? instructions.map((line, i) => `${i + 1}. ${line}`).join("\n")
    : "No additional customizations — stay maximally faithful to the source.";
}

function emptyMethodology(): TeachingMethodology {
  return {
    warmUp: "",
    conceptBuilding: "",
    extension: [],
    assessment: [],
    modelKeyAnswers: [],
  };
}

function isValidDayPlan(value: unknown): value is DayPlan {
  if (!value || typeof value !== "object") return false;
  const d = value as DayPlan;
  return (
    typeof d.day === "number" &&
    typeof d.teachingMethodology?.warmUp === "string" &&
    Array.isArray(d.teachingMethodology?.extension)
  );
}

function isLessonPlan(value: unknown): value is LessonPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as LessonPlan;
  if (typeof plan.grade !== "string" || !Array.isArray(plan.learningOutcomes)) {
    return false;
  }
  if (plan.days && plan.days.length > 0) {
    return plan.days.every(isValidDayPlan);
  }
  return (
    typeof plan.teachingMethodology?.warmUp === "string" &&
    Array.isArray(plan.teachingMethodology?.extension)
  );
}

function normalizeLessonPlan(
  plan: LessonPlan,
  entry: KnowledgeBaseEntry,
  daysRequested: number,
  resolvedChapter?: string
): LessonPlan {
  const chapterTitle =
    resolvedChapter ||
    resolveChapterTitle(entry.chapter, entry.raw_text, entry.filename);
  const base: LessonPlan = {
    ...plan,
    grade: plan.grade || entry.grade,
    subject: plan.subject || entry.subject,
    chapter: chapterTitle,
    numberOfDays: String(daysRequested),
    learningOutcomes: plan.learningOutcomes ?? [],
    resourcesRequired: plan.resourcesRequired ?? [],
    skillsAndAttitude: plan.skillsAndAttitude ?? [],
    competencies: plan.competencies ?? [],
    noteForFacilitator: plan.noteForFacilitator ?? "",
    objectives: plan.objectives ?? {
      warmUp: "",
      conceptBuilding: "",
      extension: "",
      assessment: "",
    },
    teachingMethodology: plan.teachingMethodology ?? emptyMethodology(),
  };

  if (daysRequested > 1 && plan.days?.length) {
    base.days = plan.days.slice(0, daysRequested).map((d, i) => ({
      ...d,
      day: d.day || i + 1,
      title: d.title || `Day ${i + 1}`,
      focus: d.focus || "",
      objectives: d.objectives ?? base.objectives,
      teachingMethodology: d.teachingMethodology ?? emptyMethodology(),
    }));
    const day1 = base.days[0];
    if (day1) {
      base.objectives = day1.objectives;
      base.teachingMethodology = day1.teachingMethodology;
    }
  } else {
    delete base.days;
  }

  return base;
}

function logDayNonRepetition(plan: LessonPlan): void {
  if (!plan.days || plan.days.length < 2) return;
  console.log(
    `[LessonPlanner] Multi-day split (${plan.days.length} days): ${plan.days
      .map((d) => `Day ${d.day}: ${d.title || d.focus || "(untitled)"}`)
      .join(" | ")}`
  );
}

function buildSystemPrompt(days: number): string {
  const multi =
    days > 1
      ? `
MULTI-DAY RULES:
- Split the chapter content logically across ${days} days, ensuring no repetition of the same activity across days, and that content builds progressively (Day 2 should assume Day 1 was already covered).
- Day 1 needs a full Warm Up; later days should use a short recap instead of a full warm-up.
- Each day's Extension and Assessment must relate ONLY to that day's content and still cite source-specific names.
- Suggested split: ${DAY_SPLIT_GUIDANCE[days] || DAY_SPLIT_GUIDANCE[3]}
`
      : "";

  const schema = days > 1 ? MULTI_DAY_SCHEMA : SINGLE_DAY_SCHEMA;

  const prompt = `You are an expert instructional designer adapting an existing chapter lesson plan.

${GROUNDING_SYSTEM_RULES}
${multi}
Return ONLY valid JSON matching this schema:
${schema}`;

  // Soft-cap system prompt if somehow oversized
  if (estimateTokenCount(prompt) > SYSTEM_PROMPT_TOKEN_BUDGET) {
    console.warn(
      `[LessonPlanner] System prompt ${estimateTokenCount(prompt)} tokens exceeds soft budget ${SYSTEM_PROMPT_TOKEN_BUDGET}`
    );
  }
  return prompt;
}

export interface BuiltLessonPlanPrompt {
  systemPrompt: string;
  userPrompt: string;
  specificityTerms: string[];
  packStats: {
    included: string[];
    truncated: string[];
    dropped: string[];
    userTokens: number;
  };
}

export function buildLessonPlanPrompts(
  entry: KnowledgeBaseEntry,
  input: GenerateFromKbInput,
  extraReminder = ""
): BuiltLessonPlanPrompt {
  const days = Math.min(4, Math.max(1, parseInt(input.numberOfDays, 10) || 1));
  const chapterTitle = resolveChapterTitle(
    entry.chapter,
    entry.raw_text,
    entry.filename
  );
  const structure = normalizeStoredStructure(
    entry.structure_json,
    entry.raw_text,
    chapterTitle,
    (entry.structure_json as { concept?: string })?.concept ?? ""
  );

  const specificityTerms = extractSpecificityTerms(
    entry.raw_text,
    chapterTitle,
    [] // ignore stored keyTerms — often polluted with pedagogy labels
  );

  // Persist cleaned terms onto structure for logging
  structure.keyTerms = specificityTerms;

  const blocks = buildPrioritizedSourceBlocks(
    structure,
    chapterTitle,
    specificityTerms
  );
  const packed = packPromptBlocks(blocks, USER_PROMPT_TOKEN_BUDGET - 400);

  console.log(
    `[LessonPlanner] Priority pack — included: [${packed.included.join(", ")}]`
  );
  if (packed.truncated.length) {
    console.log(
      `[LessonPlanner] Priority pack — truncated: [${packed.truncated.join(", ")}]`
    );
  }
  if (packed.dropped.length) {
    console.log(
      `[LessonPlanner] Priority pack — dropped (low priority): [${packed.dropped.join(", ")}]`
    );
  }

  const multiDayNote =
    days > 1
      ? `\nSplit into exactly ${days} days. Progressive build — no repeated activities.\nSuggested: ${DAY_SPLIT_GUIDANCE[days] || DAY_SPLIT_GUIDANCE[3]}\n`
      : "";

  const userPrompt = `${extraReminder ? `${extraReminder}\n\n` : ""}Create a lesson plan for THIS exact chapter — not a generic template.

METADATA (fixed):
- Grade: ${entry.grade}
- Subject: ${entry.subject}
- Chapter / Topic: ${chapterTitle}
- Number of Days: ${days}
${multiDayNote}
ACTUAL CHAPTER SOURCE CONTENT (priority-packed; critical sections kept first):
${packed.text}

TEACHER CUSTOMIZATIONS:
${buildCustomizationInstructions(input.customization)}

REMINDER: Ban generic filler. Every Teaching Methodology field must include a sourceCitation naming a term from the REQUIRED KEY TERMS list above.`;

  return {
    systemPrompt: buildSystemPrompt(days),
    userPrompt,
    specificityTerms,
    packStats: {
      included: packed.included,
      truncated: packed.truncated,
      dropped: packed.dropped,
      userTokens: estimateTokenCount(userPrompt),
    },
  };
}

async function generateOnce(
  entry: KnowledgeBaseEntry,
  input: GenerateFromKbInput,
  days: number,
  extraReminder = ""
): Promise<{ plan: LessonPlan; specificityTerms: string[] }> {
  const built = buildLessonPlanPrompts(entry, input, extraReminder);

  const lessonPlan = await callGroqJson<LessonPlan>(
    built.systemPrompt,
    built.userPrompt,
    `kb-chapter-${entry.id}-${days}d${extraReminder ? "-retry" : ""}`
  );

  if (!isLessonPlan(lessonPlan)) {
    throw new Error("AI response did not match the expected lesson plan structure.");
  }

  return {
    plan: normalizeLessonPlan(
      lessonPlan,
      entry,
      days,
      resolveChapterTitle(entry.chapter, entry.raw_text, entry.filename)
    ),
    specificityTerms: built.specificityTerms,
  };
}

export async function generateLessonPlanFromKnowledgeBase(
  entry: KnowledgeBaseEntry,
  input: GenerateFromKbInput
): Promise<LessonPlan> {
  const days = Math.min(4, Math.max(1, parseInt(input.numberOfDays, 10) || 1));
  const chapterTitle = resolveChapterTitle(
    entry.chapter,
    entry.raw_text,
    entry.filename
  );
  const structure = normalizeStoredStructure(
    entry.structure_json,
    entry.raw_text,
    chapterTitle,
    (entry.structure_json as { concept?: string })?.concept ?? ""
  );

  console.log(
    `[LessonPlanner] Generating from KB id=${entry.id} — Chapter="${chapterTitle}" (stored="${entry.chapter}"), Subject="${entry.subject}", Grade="${entry.grade}", Days=${days}`
  );
  console.log(
    `[LessonPlanner] Source grounded sections: ${structure.sectionLabels.join(" | ")}`
  );

  let { plan: lessonPlan, specificityTerms } = await generateOnce(
    entry,
    input,
    days
  );
  logDayNonRepetition(lessonPlan);

  const beforeOverlap = logFaithfulnessCheck(
    { grade: entry.grade, subject: entry.subject, chapter: chapterTitle },
    structure,
    lessonPlanToText(lessonPlan),
    specificityTerms
  );
  console.log(
    `[LessonPlanner] Specificity score BEFORE retry: ${beforeOverlap.matched}/${beforeOverlap.total} (${(beforeOverlap.ratio * 100).toFixed(0)}%)`
  );

  if (needsSpecificityRetry(beforeOverlap)) {
    console.warn(
      "[LessonPlanner] Too generic — retrying once with stronger specificity reminder"
    );
    const retry = await generateOnce(
      entry,
      input,
      days,
      STRONGER_GROUNDING_REMINDER
    );
    lessonPlan = retry.plan;
    specificityTerms = retry.specificityTerms;
    logDayNonRepetition(lessonPlan);

    const afterOverlap = logFaithfulnessCheck(
      { grade: entry.grade, subject: entry.subject, chapter: chapterTitle },
      structure,
      lessonPlanToText(lessonPlan),
      specificityTerms
    );
    console.log(
      `[LessonPlanner] Specificity score AFTER retry: ${afterOverlap.matched}/${afterOverlap.total} (${(afterOverlap.ratio * 100).toFixed(0)}%) — was ${beforeOverlap.matched}/${beforeOverlap.total}`
    );
  }

  return lessonPlan;
}

/** Debug helper: build prompts without calling Groq */
export function debugBuildLessonPlanPayload(
  entry: KnowledgeBaseEntry,
  input: GenerateFromKbInput
): BuiltLessonPlanPrompt {
  const built = buildLessonPlanPrompts(entry, input);
  logFullGroqPayload(
    `debug-kb-${entry.id}`,
    built.systemPrompt,
    built.userPrompt
  );
  return built;
}

export async function generateLessonPlan(): Promise<LessonPlan> {
  throw new Error(
    "Question-bank generation is deprecated. Select a chapter from the knowledge base."
  );
}
