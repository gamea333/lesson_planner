import { extractTitleTerms } from "@/lib/metadata-extract";
import type {
  AnnexureBlock,
  GroundedLessonStructure,
  LessonPlanStructure,
} from "@/lib/types/knowledge-base";
import { emptyGroundedStructure } from "@/lib/types/knowledge-base";

type ContentKey = keyof Omit<
  GroundedLessonStructure,
  "annexures" | "sectionOrder" | "sectionLabels" | "keyTerms"
>;

interface SectionDef {
  key: ContentKey;
  label: string;
  patterns: RegExp[];
}

const SECTION_DEFS: SectionDef[] = [
  { key: "homeworkAssignment", label: "Homework / Assignment", patterns: [/homework/i, /assignment/i, /home\s*work/i] },
  { key: "preContentQuestions", label: "Pre-Content Questions", patterns: [/pre[\s-]*content/i] },
  { key: "contentIntroduction", label: "Content — Introduction", patterns: [/introduction/i] },
  { key: "contentComprehension", label: "Content — Comprehension", patterns: [/comprehension/i] },
  { key: "contentFlowChart", label: "Content — Flow Chart", patterns: [/flow\s*chart/i] },
  { key: "contentCharacterization", label: "Content — Characterization", patterns: [/characteri[sz]ation/i] },
  { key: "contentWriting", label: "Content — Writing", patterns: [/\bwriting\b/i, /written\s*work/i] },
  { key: "contentGeneral", label: "Content", patterns: [/^content$/im, /\bcontent\s*:/i] },
  { key: "postContent", label: "Post-Content", patterns: [/post[\s-]*content/i] },
  { key: "learningOutcomes", label: "Learning Outcomes", patterns: [/learning\s*outcomes?/i] },
  { key: "teachersActivity", label: "Teacher's Activity", patterns: [/teacher['']?s?\s*activit/i] },
  { key: "studentsActivity", label: "Student's Activity", patterns: [/student['']?s?\s*activit/i] },
  { key: "teachingAids", label: "Teaching Aids", patterns: [/teaching\s*aids?/i, /resources?\s*required/i] },
  { key: "methodology", label: "Methodology", patterns: [/methodology/i, /teaching\s*methodology/i] },
  { key: "interdisciplinaryLinks", label: "Interdisciplinary Links", patterns: [/inter[\s-]*disciplinary/i] },
  { key: "topic", label: "Topic", patterns: [/topic\s*:/i] },
  { key: "concept", label: "Concept", patterns: [/concept\s*:/i, /theme\s*:/i] },
];

const ANNEXURE_PATTERN = /(?:ANNEXURE|ANNEX)\s*([A-Z0-9]+)/gi;

const COMMON_WORDS = new Set([
  "The", "This", "That", "These", "Those", "Teacher", "Student", "Activity",
  "Activities", "Content", "Chapter", "Lesson", "Plan", "Subject", "Class",
  "Grade", "Topic", "Introduction", "Comprehension", "Writing", "Monday",
  "Tuesday", "Wednesday", "Thursday", "Friday", "Period", "Duration",
]);

interface SectionHit {
  key: ContentKey | "annexure";
  label: string;
  index: number;
  matchLength: number;
  annexureId?: string;
}

function findAllSectionHits(text: string): SectionHit[] {
  const hits: SectionHit[] = [];

  for (const def of SECTION_DEFS) {
    for (const pattern of def.patterns) {
      const regex = new RegExp(pattern.source, `${pattern.flags.includes("i") ? "i" : ""}m`);
      const match = regex.exec(text);
      if (match?.index !== undefined) {
        hits.push({
          key: def.key,
          label: def.label,
          index: match.index,
          matchLength: match[0].length,
        });
        break;
      }
    }
  }

  let annexureMatch: RegExpExecArray | null;
  const annexureRegex = new RegExp(ANNEXURE_PATTERN.source, ANNEXURE_PATTERN.flags);
  while ((annexureMatch = annexureRegex.exec(text)) !== null) {
    hits.push({
      key: "annexure",
      label: `Annexure ${annexureMatch[1]}`,
      index: annexureMatch.index,
      matchLength: annexureMatch[0].length,
      annexureId: annexureMatch[1],
    });
  }

  return hits.sort((a, b) => a.index - b.index);
}

function extractAnnexures(text: string): AnnexureBlock[] {
  const hits = findAllSectionHits(text).filter((h) => h.key === "annexure");
  const blocks: AnnexureBlock[] = [];

  hits.forEach((hit, i) => {
    const start = hit.index;
    const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    blocks.push({ label: hit.label, content });
  });

  return blocks;
}

export function extractKeyTermsFromText(text: string, chapter: string, concept: string): string[] {
  const terms = new Set<string>();

  extractTitleTerms(chapter, concept).forEach((t) => terms.add(t));

  const namePattern = /\b(?:Mr\.|Mrs\.|Ms\.|Dr\.)?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}\b/g;
  const names = text.match(namePattern) ?? [];
  for (const name of names) {
    const cleaned = name.trim();
    const firstWord = cleaned.split(/\s+/)[0];
    if (!COMMON_WORDS.has(firstWord) && cleaned.length > 2) {
      terms.add(cleaned);
      cleaned.split(/\s+/).forEach((part) => {
        if (part.length > 3 && !COMMON_WORDS.has(part)) terms.add(part);
      });
    }
  }

  const significant = text.match(/\b[A-Z][a-z]{4,}\b/g) ?? [];
  for (const word of significant) {
    if (!COMMON_WORDS.has(word)) terms.add(word);
  }

  return Array.from(terms).slice(0, 40);
}

export function parseLessonPlanStructure(rawText: string, chapter = "", concept = ""): GroundedLessonStructure {
  const structure = emptyGroundedStructure();
  const hits = findAllSectionHits(rawText).filter((h) => h.key !== "annexure");

  if (hits.length === 0) {
    structure.contentGeneral = rawText.trim().slice(0, 8000);
    structure.sectionOrder = ["contentGeneral"];
    structure.sectionLabels = ["Content (unparsed)"];
  } else {
    hits.forEach((hit, i) => {
      if (hit.key === "annexure") return;
      const start = hit.index + hit.matchLength;
      const end = i + 1 < hits.length ? hits[i + 1].index : rawText.length;
      const content = rawText.slice(start, end).replace(/^[\s:\-–—]+/, "").trim();
      structure[hit.key as ContentKey] = content;
      structure.sectionOrder.push(hit.key);
      structure.sectionLabels.push(hit.label);
    });
  }

  structure.annexures = extractAnnexures(rawText);
  structure.annexures.forEach((a) => {
    structure.sectionLabels.push(a.label);
    structure.sectionOrder.push(`annexure:${a.label}`);
  });

  structure.keyTerms = extractKeyTermsFromText(rawText, chapter, concept);

  console.log(
    `[Parser] Extracted sections: ${structure.sectionLabels.join(", ") || "(none)"}`
  );
  console.log(
    `[Parser] Key terms (${structure.keyTerms.length}): ${structure.keyTerms.slice(0, 12).join(", ")}${structure.keyTerms.length > 12 ? "…" : ""}`
  );

  return structure;
}

export function normalizeStoredStructure(
  raw: unknown,
  rawText = "",
  chapter = "",
  concept = ""
): GroundedLessonStructure {
  if (raw && typeof raw === "object" && "annexures" in raw && "keyTerms" in raw) {
    return raw as GroundedLessonStructure;
  }

  if (rawText) {
    return parseLessonPlanStructure(rawText, chapter, concept);
  }

  const legacy = raw as LessonPlanStructure;
  const migrated = emptyGroundedStructure();
  if (legacy?.learningOutcomes) migrated.learningOutcomes = legacy.learningOutcomes;
  if (legacy?.conceptBuilding) migrated.contentGeneral = legacy.conceptBuilding;
  if (legacy?.warmUp) migrated.contentIntroduction = legacy.warmUp;
  if (legacy?.extension) migrated.preContentQuestions = legacy.extension;
  if (legacy?.assessment) migrated.homeworkAssignment = legacy.assessment;
  migrated.sectionLabels = legacy?.sectionOrder ?? [];
  return migrated;
}

export function structureToGroqPayload(structure: GroundedLessonStructure): Record<string, unknown> {
  const sections: Record<string, string> = {};

  const fieldLabels: Record<string, string> = {
    topic: "Topic",
    concept: "Concept",
    homeworkAssignment: "Homework / Assignment",
    preContentQuestions: "Pre-Content Questions",
    contentIntroduction: "Content — Introduction",
    contentComprehension: "Content — Comprehension",
    contentFlowChart: "Content — Flow Chart",
    contentCharacterization: "Content — Characterization",
    contentWriting: "Content — Writing",
    contentGeneral: "Content",
    postContent: "Post-Content",
    learningOutcomes: "Learning Outcomes",
    teachersActivity: "Teacher's Activity",
    studentsActivity: "Student's Activity",
    teachingAids: "Teaching Aids",
    methodology: "Methodology",
    interdisciplinaryLinks: "Interdisciplinary Links",
  };

  for (const [key, label] of Object.entries(fieldLabels)) {
    const value = structure[key as ContentKey];
    if (typeof value === "string" && value.trim()) {
      sections[label] = value.trim();
    }
  }

  return {
    sectionLabelsFound: structure.sectionLabels,
    sections,
    annexures: structure.annexures.map((a) => ({
      label: a.label,
      content: a.content,
    })),
    keyTerms: structure.keyTerms,
  };
}

export function structureToStyleReference(structure: GroundedLessonStructure): string {
  const payload = structureToGroqPayload(structure);
  const parts: string[] = [];

  for (const [label, content] of Object.entries(payload.sections as Record<string, string>)) {
    parts.push(`## ${label}\n${content.slice(0, 500)}`);
  }

  for (const annexure of structure.annexures) {
    parts.push(`## ${annexure.label}\n${annexure.content.slice(0, 400)}`);
  }

  return parts.join("\n\n");
}

export function structureToGenerationContext(structure: GroundedLessonStructure): string {
  return JSON.stringify(structureToGroqPayload(structure), null, 2);
}
