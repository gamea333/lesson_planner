import { callGroqJson } from "@/lib/groq-client";
import { truncateToTokenBudget } from "@/lib/groq-utils";
import { GROUNDING_SYSTEM_RULES } from "@/lib/grounding";
import {
  normalizeStoredStructure,
  structureToGenerationContext,
} from "@/lib/parse-lesson-structure";
import type { KnowledgeBaseEntry } from "@/lib/types/knowledge-base";
import type {
  AssessmentQuestion,
  GenerateAssessmentInput,
  GeneratedAssessment,
  QuestionType,
} from "@/lib/types/assessment";
import {
  DEFAULT_BLOOM_LEVELS,
  QUESTION_TYPE_LABELS,
} from "@/lib/types/assessment";
import {
  formatBloomPromptBlock,
  normalizeBloomLevel,
  suggestBloomDistribution,
  type BloomLevel,
} from "@/lib/types/blooms-taxonomy";

const ASSESSMENT_SCHEMA = `{
  "grade": "string",
  "subject": "string",
  "chapter": "string",
  "instructions": "string (brief practice sheet instructions for students; mention Bloom-aligned practice)",
  "questions": [
    {
      "id": "string (q1, q2, ...)",
      "type": "mcq | short_answer | long_answer | fill_blank | true_false",
      "difficulty": "easy | medium | hard",
      "bloomLevel": "remember | understand | apply | analyze | evaluate | create",
      "questionText": "string — stem must match the bloomLevel cognitive demand",
      "options": ["string"],
      "correctAnswer": "string",
      "explanation": "string — briefly note why this fits the Bloom level"
    }
  ]
}`;

function buildSystemPrompt(): string {
  return `You are an expert instructional designer creating chapter-based practice sheets for students using Bloom's Taxonomy.

${GROUNDING_SYSTEM_RULES}

BLOOM'S TAXONOMY (required):
Every question MUST target exactly one cognitive level and the stem must use appropriate demand:
${formatBloomPromptBlock(DEFAULT_BLOOM_LEVELS)}

Mapping tips:
- Remember / Understand → often MCQ, true_false, fill_blank, short_answer (easy–medium)
- Apply / Analyze → short_answer, long_answer, MCQ scenario (medium–hard)
- Evaluate / Create → long_answer, open response (hard); Create asks for original product, not recall

ADDITIONAL RULES:
- Generate exactly the requested number of questions.
- Cover the requested Bloom levels as evenly as possible across the set (do not cluster only on Remember).
- Match the requested question types and difficulty distribution as closely as possible.
- For MCQ: include exactly 4 options; correctAnswer must match one option.
- For true_false: options should be ["True", "False"].
- For fill_blank, short_answer, long_answer: omit options or use an empty array.
- Questions must be grounded in the chapter's characters, events, concepts, and annexure content.
- Do NOT invent a different chapter topic.
- Frame the output as a student practice sheet (not a formal board exam paper).

Return ONLY valid JSON matching this schema:
${ASSESSMENT_SCHEMA}`;
}

function buildUserPrompt(
  entry: KnowledgeBaseEntry,
  input: GenerateAssessmentInput,
  structure: ReturnType<typeof normalizeStoredStructure>
): string {
  const sourceJson = truncateToTokenBudget(
    structureToGenerationContext(structure),
    4000
  );
  const typeLabels = input.questionTypes
    .map((t) => QUESTION_TYPE_LABELS[t])
    .join(", ");
  const mix = input.difficultyMix;
  const total = mix.easy + mix.medium + mix.hard || 100;
  const bloomLevels =
    input.bloomLevels && input.bloomLevels.length > 0
      ? input.bloomLevels
      : DEFAULT_BLOOM_LEVELS;
  const bloomPlan = suggestBloomDistribution(input.questionCount, bloomLevels);

  return `Create a chapter practice sheet for students using Bloom's Taxonomy.

METADATA:
- Grade: ${entry.grade}
- Subject: ${entry.subject}
- Chapter: ${entry.chapter}
- Number of questions: ${input.questionCount}
- Question types to include: ${typeLabels}
- Difficulty mix: Easy ${mix.easy}%, Medium ${mix.medium}%, Hard ${mix.hard}% (of ${total}% total — normalize if needed)
- Bloom levels to cover: ${bloomLevels.join(", ")}
- Suggested bloomLevel per question (follow closely): ${bloomPlan.map((b, i) => `q${i + 1}=${b}`).join(", ")}
${input.focusAreas.trim() ? `- Focus areas: ${input.focusAreas.trim()}` : ""}

Bloom level definitions:
${formatBloomPromptBlock(bloomLevels)}

KEY TERMS THAT MUST APPEAR: ${structure.keyTerms.slice(0, 20).join(", ")}

SOURCE CONTENT JSON (ground truth):
---
${sourceJson}
---

Distribute question types roughly evenly. Assign bloomLevel on every question. Stems must match the cognitive demand of that level.`;
}

function normalizeQuestions(
  questions: AssessmentQuestion[],
  count: number,
  bloomPlan: BloomLevel[]
): AssessmentQuestion[] {
  return questions.slice(0, count).map((q, i) => ({
    id: q.id || `q${i + 1}`,
    type: (q.type as QuestionType) || "short_answer",
    difficulty: q.difficulty || "medium",
    bloomLevel: normalizeBloomLevel(q.bloomLevel, bloomPlan[i] || "understand"),
    questionText: q.questionText || "",
    options: Array.isArray(q.options) ? q.options : undefined,
    correctAnswer: q.correctAnswer || "",
    explanation: q.explanation || "",
  }));
}

export async function generateAssessmentFromKnowledgeBase(
  entry: KnowledgeBaseEntry,
  input: GenerateAssessmentInput
): Promise<GeneratedAssessment> {
  const structure = normalizeStoredStructure(
    entry.structure_json,
    entry.raw_text,
    entry.chapter,
    (entry.structure_json as { concept?: string })?.concept ?? ""
  );

  const bloomLevels =
    input.bloomLevels && input.bloomLevels.length > 0
      ? input.bloomLevels
      : DEFAULT_BLOOM_LEVELS;
  const bloomPlan = suggestBloomDistribution(input.questionCount, bloomLevels);

  console.log(
    `[PracticeSheet] Generating from KB id=${entry.id} — Chapter="${entry.chapter}" with Bloom levels=[${bloomLevels.join(",")}]`
  );

  const result = await callGroqJson<GeneratedAssessment>(
    buildSystemPrompt(),
    buildUserPrompt(entry, { ...input, bloomLevels }, structure),
    `practice-sheet-chapter-${entry.id}`
  );

  if (!result.questions || !Array.isArray(result.questions)) {
    throw new Error("AI response did not include a questions array.");
  }

  const assessment: GeneratedAssessment = {
    grade: result.grade || entry.grade,
    subject: result.subject || entry.subject,
    chapter: entry.chapter,
    instructions:
      result.instructions ||
      "Answer all questions. Items span Bloom's Taxonomy levels from Remember through Create — read each carefully.",
    questions: normalizeQuestions(result.questions, input.questionCount, bloomPlan),
  };

  console.log(
    `[PracticeSheet] Generated ${assessment.questions.length} Bloom-aligned questions for "${assessment.chapter}"`
  );

  return assessment;
}
