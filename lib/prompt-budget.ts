import {
  estimateTokenCount,
  truncateToTokenBudget,
} from "@/lib/groq-utils";
import type { GroundedLessonStructure } from "@/lib/types/knowledge-base";

export type PromptBlockPriority = "critical" | "high" | "medium" | "low";

export interface PromptBlock {
  label: string;
  content: string;
  priority: PromptBlockPriority;
}

const PRIORITY_ORDER: PromptBlockPriority[] = [
  "critical",
  "high",
  "medium",
  "low",
];

/**
 * Pack labeled blocks under a token budget, keeping critical content first.
 * Never drops critical/high blocks entirely — truncates only within a block if needed.
 */
export function packPromptBlocks(
  blocks: PromptBlock[],
  maxTokens: number
): { text: string; included: string[]; truncated: string[]; dropped: string[] } {
  const included: string[] = [];
  const truncated: string[] = [];
  const dropped: string[] = [];
  const parts: string[] = [];
  let used = 0;

  const sorted = [...blocks].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
  );

  for (const block of sorted) {
    const content = block.content?.trim();
    if (!content) continue;

    const header = `### ${block.label}\n`;
    const headerTokens = estimateTokenCount(header);
    const remaining = maxTokens - used - headerTokens;

    if (remaining <= 20) {
      if (block.priority === "critical" || block.priority === "high") {
        // Force-include a hard-trimmed critical block
        const forced = truncateToTokenBudget(content, 200);
        parts.push(`${header}${forced}`);
        used += headerTokens + estimateTokenCount(forced);
        included.push(block.label);
        truncated.push(block.label);
      } else {
        dropped.push(block.label);
      }
      continue;
    }

    const contentTokens = estimateTokenCount(content);
    if (contentTokens <= remaining) {
      parts.push(`${header}${content}`);
      used += headerTokens + contentTokens;
      included.push(block.label);
    } else {
      const trimmed = truncateToTokenBudget(content, remaining);
      parts.push(`${header}${trimmed}`);
      used += headerTokens + estimateTokenCount(trimmed);
      included.push(block.label);
      truncated.push(block.label);
    }
  }

  return { text: parts.join("\n\n"), included, truncated, dropped };
}

/** Build prioritized source blocks from grounded structure + raw text excerpts. */
export function buildPrioritizedSourceBlocks(
  structure: GroundedLessonStructure,
  chapterTitle: string,
  keyTerms: string[]
): PromptBlock[] {
  const blocks: PromptBlock[] = [
    {
      label: "CHAPTER TITLE",
      content: chapterTitle,
      priority: "critical",
    },
    {
      label: "REQUIRED KEY TERMS (must appear in output)",
      content: keyTerms.slice(0, 25).join(", "),
      priority: "critical",
    },
  ];

  if (structure.annexures.length) {
    blocks.push({
      label: "ANNEXURES (use verbatim for Extension)",
      content: structure.annexures
        .map((a) => `${a.label}:\n${a.content}`)
        .join("\n\n"),
      priority: "critical",
    });
  }

  const homework = [
    structure.homeworkAssignment,
    structure.preContentQuestions,
    structure.postContent,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (homework) {
    blocks.push({
      label: "HOMEWORK / ASSIGNMENT / PRE-POST CONTENT (use for Assessment & Model Key Answers)",
      content: homework,
      priority: "critical",
    });
  }

  if (structure.teachersActivity) {
    blocks.push({
      label: "TEACHER'S ACTIVITY",
      content: structure.teachersActivity,
      priority: "critical",
    });
  }
  if (structure.studentsActivity) {
    blocks.push({
      label: "STUDENT'S ACTIVITY",
      content: structure.studentsActivity,
      priority: "critical",
    });
  }

  const contentCore = [
    ["CONTENT — INTRODUCTION", structure.contentIntroduction],
    ["CONTENT — COMPREHENSION", structure.contentComprehension],
    ["CONTENT — FLOW CHART", structure.contentFlowChart],
    ["CONTENT — CHARACTERIZATION", structure.contentCharacterization],
    ["CONTENT — WRITING", structure.contentWriting],
    ["CONTENT (GENERAL)", structure.contentGeneral],
    ["LEARNING OUTCOMES", structure.learningOutcomes],
  ] as const;

  for (const [label, content] of contentCore) {
    if (content?.trim()) {
      blocks.push({ label, content, priority: "high" });
    }
  }

  if (structure.topic || structure.concept) {
    blocks.push({
      label: "TOPIC / CONCEPT",
      content: [structure.topic, structure.concept].filter(Boolean).join("\n"),
      priority: "high",
    });
  }

  if (structure.methodology) {
    blocks.push({
      label: "METHODOLOGY",
      content: structure.methodology,
      priority: "medium",
    });
  }
  if (structure.teachingAids) {
    blocks.push({
      label: "TEACHING AIDS / RESOURCES",
      content: structure.teachingAids,
      priority: "low",
    });
  }
  if (structure.interdisciplinaryLinks) {
    blocks.push({
      label: "INTERDISCIPLINARY LINKS",
      content: structure.interdisciplinaryLinks,
      priority: "low",
    });
  }

  return blocks;
}
