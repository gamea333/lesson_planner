import { callGroqJson } from "@/lib/groq-client";
import { truncateToTokenBudget } from "@/lib/groq-utils";
import { GROUNDING_SYSTEM_RULES } from "@/lib/grounding";
import {
  normalizeStoredStructure,
  structureToGenerationContext,
} from "@/lib/parse-lesson-structure";
import type { KnowledgeBaseEntry } from "@/lib/types/knowledge-base";
import type {
  DayHomework,
  GenerateHomeworkInput,
  GeneratedHomework,
  HomeworkQuestion,
  HomeworkResearchTopic,
} from "@/lib/types/homework";
import { DEFAULT_HOMEWORK_BLOOM_LEVELS } from "@/lib/types/homework";
import {
  formatBloomPromptBlock,
  normalizeBloomLevel,
  suggestBloomDistribution,
  type BloomLevel,
} from "@/lib/types/blooms-taxonomy";

const HOMEWORK_SCHEMA = `{
  "grade": "string",
  "subject": "string",
  "chapter": "string",
  "numberOfDays": number,
  "instructions": "string — brief student-facing homework instructions; mention Bloom-aligned tasks",
  "days": [
    {
      "day": 1,
      "title": "string",
      "focus": "string — what this day's homework covers from the chapter",
      "overview": "string — 1-2 sentences for students",
      "questions": [
        {
          "id": "d1-q1",
          "type": "short_answer | long_answer | practice",
          "bloomLevel": "remember | understand | apply | analyze | evaluate | create",
          "prompt": "string — specific question grounded in chapter content; cognitive demand matches bloomLevel",
          "hint": "string — optional scaffolding",
          "suggestedAnswer": "string — model answer / key points for teacher"
        }
      ],
      "researchTopics": [
        {
          "id": "d1-r1",
          "topic": "string — specific research theme from the chapter",
          "guidance": "string — what students should investigate / produce",
          "suggestedSources": ["string"],
          "bloomLevel": "analyze | evaluate | create"
        }
      ]
    }
  ]
}`;

function buildSystemPrompt(days: number): string {
  return `You are an expert teacher designing day-wise homework packs aligned to Bloom's Taxonomy and a chapter lesson plan.

${GROUNDING_SYSTEM_RULES}

BLOOM'S TAXONOMY (required):
Every question and research topic MUST include bloomLevel. Stems must match cognitive demand:
${formatBloomPromptBlock(DEFAULT_HOMEWORK_BLOOM_LEVELS)}

HOMEWORK RULES:
- Create exactly ${days} day pack(s). Each day must cover DIFFERENT chapter content (no repeated questions across days).
- If day focus hints are provided, align each day's homework to that day's focus/title from the lesson plan.
- Each day must include the requested number of practice/questions AND research topics.
- Questions can be short_answer, long_answer, or practice (application / problem-solving).
- Spread Bloom levels across the pack: lower-order (Remember/Understand) early in Day 1 is fine; include Apply/Analyze and at least some Evaluate/Create across days.
- Research topics should usually be Analyze, Evaluate, or Create — chapter-specific, not generic "read the chapter".
- Prefer adapting source Homework/Assignment, Annexure, and Pre/Post content when available.
- Write prompts for STUDENTS (clear, age-appropriate). suggestedAnswer is for the teacher key.
- Do NOT invent a different chapter.

Return ONLY valid JSON matching this schema:
${HOMEWORK_SCHEMA}`;
}

function buildUserPrompt(
  entry: KnowledgeBaseEntry,
  input: GenerateHomeworkInput,
  structure: ReturnType<typeof normalizeStoredStructure>
): string {
  const sourceJson = truncateToTokenBudget(
    structureToGenerationContext(structure),
    4000
  );

  const bloomLevels =
    input.bloomLevels && input.bloomLevels.length > 0
      ? input.bloomLevels
      : DEFAULT_HOMEWORK_BLOOM_LEVELS;

  const totalQuestions = input.numberOfDays * input.questionsPerDay;
  const bloomPlan = suggestBloomDistribution(totalQuestions, bloomLevels);

  const dayHints =
    input.dayFocusHints && input.dayFocusHints.length > 0
      ? input.dayFocusHints
          .map(
            (d) =>
              `Day ${d.day}: ${d.title || "(untitled)"}${d.focus ? ` — focus: ${d.focus}` : ""}`
          )
          .join("\n")
      : `No lesson-plan day hints — split the chapter progressively across ${input.numberOfDays} day(s).`;

  return `Create a ${input.numberOfDays}-day homework pack for students using Bloom's Taxonomy.

METADATA:
- Grade: ${entry.grade}
- Subject: ${entry.subject}
- Chapter: ${entry.chapter}
- Days: ${input.numberOfDays}
- Questions / practice items per day: ${input.questionsPerDay}
- Research topics per day: ${input.researchTopicsPerDay}
- Include suggested answers / hints for teachers: ${input.includeAnswerHints ? "yes" : "no (leave suggestedAnswer and hint empty)"}
- Bloom levels to cover: ${bloomLevels.join(", ")}
- Suggested bloomLevel sequence for questions (cycle across days): ${bloomPlan.join(", ")}
${input.customNotes.trim() ? `- Teacher notes: ${input.customNotes.trim()}` : ""}

Bloom level definitions:
${formatBloomPromptBlock(bloomLevels)}

LESSON PLAN DAY ALIGNMENT:
${dayHints}

KEY TERMS THAT MUST APPEAR: ${structure.keyTerms.slice(0, 20).join(", ") || "(derive from source)"}

SOURCE HOMEWORK / ASSIGNMENT BLOCK (prefer these):
---
${structure.homeworkAssignment || structure.preContentQuestions || structure.postContent || "(none labeled — use content sections)"}
---

FULL SOURCE CONTENT JSON (ground truth):
---
${sourceJson}
---

Ensure Day 1 homework does not repeat on Day 2+. Tag every question and research topic with bloomLevel.`;
}

function normalizeQuestion(
  q: HomeworkQuestion,
  day: number,
  index: number,
  fallbackBloom: BloomLevel
): HomeworkQuestion {
  const type =
    q.type === "long_answer" || q.type === "practice" ? q.type : "short_answer";
  return {
    id: q.id || `d${day}-q${index + 1}`,
    type,
    bloomLevel: normalizeBloomLevel(q.bloomLevel, fallbackBloom),
    prompt: q.prompt || "",
    hint: q.hint || "",
    suggestedAnswer: q.suggestedAnswer || "",
  };
}

function normalizeResearch(
  r: HomeworkResearchTopic,
  day: number,
  index: number
): HomeworkResearchTopic {
  return {
    id: r.id || `d${day}-r${index + 1}`,
    topic: r.topic || "",
    guidance: r.guidance || "",
    suggestedSources: Array.isArray(r.suggestedSources)
      ? r.suggestedSources.filter(Boolean)
      : [],
    bloomLevel: normalizeBloomLevel(r.bloomLevel, "analyze"),
  };
}

function normalizeDay(
  day: DayHomework,
  index: number,
  input: GenerateHomeworkInput,
  bloomPlan: BloomLevel[]
): DayHomework {
  const dayNum = day.day || index + 1;
  const hint = input.dayFocusHints?.find((h) => h.day === dayNum);
  const start = index * input.questionsPerDay;
  return {
    day: dayNum,
    title: day.title || hint?.title || `Day ${dayNum} Homework`,
    focus: day.focus || hint?.focus || "",
    overview: day.overview || "",
    questions: (day.questions ?? [])
      .slice(0, input.questionsPerDay)
      .map((q, i) =>
        normalizeQuestion(q, dayNum, i, bloomPlan[start + i] || "apply")
      ),
    researchTopics: (day.researchTopics ?? [])
      .slice(0, input.researchTopicsPerDay)
      .map((r, i) => normalizeResearch(r, dayNum, i)),
  };
}

function normalizeHomework(
  raw: GeneratedHomework,
  entry: KnowledgeBaseEntry,
  input: GenerateHomeworkInput
): GeneratedHomework {
  const bloomLevels =
    input.bloomLevels && input.bloomLevels.length > 0
      ? input.bloomLevels
      : DEFAULT_HOMEWORK_BLOOM_LEVELS;
  const bloomPlan = suggestBloomDistribution(
    input.numberOfDays * input.questionsPerDay,
    bloomLevels
  );

  const days = (raw.days ?? [])
    .slice(0, input.numberOfDays)
    .map((d, i) => normalizeDay(d, i, input, bloomPlan));

  while (days.length < input.numberOfDays) {
    const n = days.length + 1;
    const hint = input.dayFocusHints?.find((h) => h.day === n);
    days.push({
      day: n,
      title: hint?.title || `Day ${n} Homework`,
      focus: hint?.focus || "",
      overview: "",
      questions: [],
      researchTopics: [],
    });
  }

  return {
    grade: raw.grade || entry.grade,
    subject: raw.subject || entry.subject,
    chapter: raw.chapter || entry.chapter,
    numberOfDays: input.numberOfDays,
    instructions:
      raw.instructions ||
      "Complete today's homework neatly. Tasks follow Bloom's Taxonomy (Remember → Create). Use the chapter and class notes.",
    days,
  };
}

export async function generateHomeworkFromKnowledgeBase(
  entry: KnowledgeBaseEntry,
  input: GenerateHomeworkInput
): Promise<GeneratedHomework> {
  const days = Math.min(4, Math.max(1, Math.round(input.numberOfDays) || 1));
  const bloomLevels =
    input.bloomLevels && input.bloomLevels.length > 0
      ? input.bloomLevels
      : DEFAULT_HOMEWORK_BLOOM_LEVELS;

  const normalizedInput: GenerateHomeworkInput = {
    ...input,
    numberOfDays: days,
    questionsPerDay: Math.min(8, Math.max(1, input.questionsPerDay || 4)),
    researchTopicsPerDay: Math.min(3, Math.max(0, input.researchTopicsPerDay || 1)),
    bloomLevels,
  };

  const structure = normalizeStoredStructure(
    entry.structure_json,
    entry.raw_text,
    entry.chapter,
    entry.structure_json?.concept ?? ""
  );

  console.log(
    `[Homework] Generating ${days}-day Bloom-aligned pack for KB id=${entry.id} "${entry.chapter}"`
  );

  const result = await callGroqJson<GeneratedHomework>(
    buildSystemPrompt(days),
    buildUserPrompt(entry, normalizedInput, structure),
    `homework-kb-${entry.id}-${days}d`
  );

  return normalizeHomework(result, entry, normalizedInput);
}
