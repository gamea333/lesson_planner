import { truncateToTokenBudget } from "@/lib/groq-utils";

export interface QuestionItem {
  question: string;
  options?: string;
  correctAnswer?: string;
  explanation?: string;
}

interface QuestionBankData {
  dataType: "text" | "structured";
  text?: string;
  questions?: QuestionItem[];
}

const CHUNK_SIZE = 10;
const SAMPLE_SIZE = 9;

export function normalizeQuestions(
  questionData: QuestionBankData
): QuestionItem[] {
  if (questionData.dataType === "structured" && questionData.questions?.length) {
    return questionData.questions.filter((q: QuestionItem) => q.question.trim());
  }

  const text = questionData.text?.trim() ?? "";
  if (!text) return [];

  const numberedBlocks = text
    .split(/\n(?=(?:Q(?:uestion)?\s*)?\d+[\.\):\-]|\d+[\.\)]\s)/i)
    .map((block: string) => block.trim())
    .filter((block: string) => block.length > 15);

  if (numberedBlocks.length > 1) {
    return numberedBlocks.map((block: string) => ({ question: block }));
  }

  const paragraphBlocks = text
    .split(/\n{2,}/)
    .map((block: string) => block.trim())
    .filter((block: string) => block.length > 15);

  if (paragraphBlocks.length > 1) {
    return paragraphBlocks.map((block: string) => ({ question: block }));
  }

  return chunkTextByLength(text, 600).map((block: string) => ({ question: block }));
}

function chunkTextByLength(text: string, maxLen: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxLen, text.length);
    if (end < text.length) {
      const breakAt = text.lastIndexOf("\n", end);
      if (breakAt > start + maxLen * 0.5) end = breakAt;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }

  return chunks.filter(Boolean);
}

export function chunkQuestions(
  questions: QuestionItem[],
  size = CHUNK_SIZE
): QuestionItem[][] {
  if (!questions.length) return [];
  const chunks: QuestionItem[][] = [];
  for (let i = 0; i < questions.length; i += size) {
    chunks.push(questions.slice(i, i + size));
  }
  return chunks;
}

/** Round-robin across chunks so the sample spans the full bank. */
export function representativeSample(
  chunks: QuestionItem[][],
  size = SAMPLE_SIZE
): QuestionItem[] {
  if (!chunks.length) return [];

  const flat = chunks.flat();
  if (flat.length <= size) return flat;

  const sample: QuestionItem[] = [];
  const seen = new Set<string>();
  let round = 0;

  while (sample.length < size) {
    let added = false;
    for (const chunk of chunks) {
      const item = chunk[round];
      if (!item) continue;
      const key = item.question.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        sample.push(item);
        added = true;
        if (sample.length >= size) break;
      }
    }
    if (!added) break;
    round++;
  }

  if (sample.length < size) {
    for (const item of flat) {
      const key = item.question.slice(0, 120);
      if (!seen.has(key)) {
        seen.add(key);
        sample.push(item);
        if (sample.length >= size) break;
      }
    }
  }

  return sample;
}

export function formatQuestionForPrompt(q: QuestionItem, index: number): string {
  const parts = [`Q${index + 1}. ${q.question}`];
  if (q.options) parts.push(`Options: ${q.options}`);
  if (q.correctAnswer) parts.push(`Correct Answer: ${q.correctAnswer}`);
  if (q.explanation) parts.push(`Explanation: ${q.explanation}`);
  return parts.join("\n");
}

export function formatQuestionsForPrompt(questions: QuestionItem[]): string {
  return truncateToTokenBudget(
    questions.map((q, i) => formatQuestionForPrompt(q, i)).join("\n\n")
  );
}

export function buildConceptSummary(
  metadata: { chapter?: string; subject?: string },
  concepts: string[]
): string {
  const unique = Array.from(new Set(concepts.map((c) => c.trim()).filter(Boolean)));
  const chapter = metadata.chapter || "Not specified";
  const subject = metadata.subject || "Not specified";

  return [
    `Chapter: ${chapter}`,
    `Subject: ${subject}`,
    `Concepts covered (${unique.length}): ${unique.join("; ") || "General chapter topics"}`,
  ].join("\n");
}

export function dedupeConcepts(concepts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const concept of concepts) {
    const normalized = concept.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(concept.trim());
  }

  return result;
}

export { CHUNK_SIZE, SAMPLE_SIZE };
