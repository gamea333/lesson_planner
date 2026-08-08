import type { GroundedLessonStructure } from "@/lib/types/knowledge-base";
import type { LessonPlan } from "@/lib/types/lesson-plan";

const STOPWORDS = new Set([
  "the", "and", "for", "from", "with", "that", "this", "will", "students",
  "teacher", "lesson", "plan", "chapter", "activity", "activities", "class",
  "grade", "subject", "content", "introduction", "comprehension", "understand",
  "enhance", "provide", "questions", "teaching", "methodology", "aids",
  "how", "what", "when", "where", "which", "unit", "fiction", "pre", "post",
  "learning", "outcomes", "homework", "assignment", "materials", "duration",
  "objective", "objectives", "knowledge", "skills", "reading", "listening",
  "writing", "speaking", "english", "delhi", "public", "school", "ghaziabad",
  "transaction", "total", "periods", "approx", "notebook", "worksheets",
  "powerpoint", "presentation", "youtube", "ncert", "textbooks", "classroom",
  "practice", "independent", "guided", "closure", "resources", "assessment",
  "parameters", "marks", "average", "periodical", "submission", "evaluation",
  "brainstorming", "discussion", "questioning", "share", "peer", "self",
  "study", "revise", "pick", "active", "learner", "participation", "home",
  "work", "assignments", "critical", "thinking", "creative", "collaboration",
  "communication", "character", "citizenship", "pen", "paper", "test",
  "half", "yearly", "board", "examination", "internal", "enrichment",
  "without", "about", "through", "their", "them", "then", "than", "also",
]);

const PEDAGOGY_JARGON = new Set([
  "brain storming", "brainstorming", "independent practice", "guided practice",
  "group discussion", "think pair share", "peer assessment", "self study",
  "pen paper test", "paper pen test", "note book submission", "active learner",
  "teaching methodology", "teaching aids", "powerpoint presentation",
  "periodical test", "half yearly", "assessment parameters",
  "dramatic presentation", "digital content", "group discussion",
  "peer assessment", "questioning", "group discussion questioning",
]);

function isJunkTerm(term: string): boolean {
  const lower = term.toLowerCase().replace(/\s+/g, " ").trim();
  if (!lower || lower.length < 3 || lower.length > 45) return true;
  if (STOPWORDS.has(lower)) return true;
  if (PEDAGOGY_JARGON.has(lower)) return true;
  if (PEDAGOGY_JARGON.has(lower.replace(/\s+/g, ""))) return true;
  if (/[:;–—]$/.test(term.trim())) return true;
  if (/\d+\s*(periods?|min|marks)/i.test(lower)) return true;
  if (/^(she|he|they|mrs|mr|ms|miss|dr|sir|comment|feet|written)$/i.test(lower)) {
    return true;
  }
  if (
    /will be able to|previous knowledge|teaching methodology|teaching aids|value based|periodic test|suggestive|pedagogical|pre-?requisite|class transaction|lesson requires|assessment of|audio-visual|paper pen|critical thinking|creativity/i.test(
      lower
    )
  ) {
    return true;
  }
  // Prefer noun-like tokens — reject sentence fragments
  if (term.split(/\s+/).length > 4) return true;
  const parts = lower.split(/\s+/);
  if (parts.length >= 2 && parts.every((p) => STOPWORDS.has(p) || PEDAGOGY_JARGON.has(p))) {
    return true;
  }
  // Reject Cap Cap pedagogy compounds (Peer Assessment, Digital Content, …)
  if (
    parts.length >= 2 &&
    parts.some((p) =>
      /^(peer|group|digital|dramatic|presentation|assessment|discussion|questioning|content|methodology|aids|practice|brainstorming|independent|guided)$/i.test(
        p
      )
    )
  ) {
    return true;
  }
  return false;
}

const GENERIC_PHRASES = [
  "explore the chapter",
  "discuss the chapter",
  "introduce the concept of the chapter",
  "themes of the chapter",
  "chapter's content",
  "chapter's themes",
  "engage with the text",
  "understand the theme of the lesson",
];

export interface OverlapResult {
  matched: number;
  total: number;
  ratio: number;
  matchedTerms: string[];
  missingTerms: string[];
  genericPhraseHits: string[];
}

export function lessonPlanToText(plan: LessonPlan): string {
  return JSON.stringify(plan);
}

/** Prefer a real chapter title over a school header mistakenly stored as chapter. */
export function resolveChapterTitle(
  storedChapter: string,
  rawText: string,
  filename: string
): string {
  if (
    storedChapter &&
    !/delhi public school|ghaziabad|lesson plan/i.test(storedChapter) &&
    storedChapter.length > 4
  ) {
    return (
      storedChapter.replace(/^UNIT\/?CHAPTER\s*/i, "").trim() || storedChapter
    );
  }

  const fromFile = filename
    .replace(/\.pdf$/i, "")
    .replace(/^Chapter\s*\d+\s*[-–—_]?\s*/i, "")
    .trim();
  if (fromFile.length > 3) return fromFile;

  const lines = rawText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 20)) {
    if (/school|lesson plan|class\s*[-–]|subject\s*:/i.test(line)) continue;
    if (line.length >= 8 && line.length <= 80) return line;
  }

  return storedChapter || fromFile || "Untitled Chapter";
}

/** Extract high-signal proper nouns / character names from source text. */
export function extractSpecificityTerms(
  rawText: string,
  chapter: string,
  existingKeyTerms: string[] = []
): string[] {
  const priority: string[] = [];
  const secondary = new Set<string>();

  // Full chapter title first
  const cleanChapter = chapter.replace(/^UNIT\/?CHAPTER\s*/i, "").trim();
  if (cleanChapter && !isJunkTerm(cleanChapter) && cleanChapter.length <= 60) {
    priority.push(cleanChapter);
  }

  // Honorific + Name (highest signal for stories)
  const honorifics =
    rawText.match(
      /\b(?:Mr|Mrs|Ms|Miss|Dr|Madam|Lady|Sir)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?/g
    ) ?? [];
  for (const h of honorifics) {
    const clean = h.replace(/\s+/g, " ").trim();
    if (!isJunkTerm(clean)) priority.push(clean);
  }

  // Distinctive story names from assessment-style lines (Griffin, Tricki, etc.)
  const nameInQuestion =
    rawText.match(
      /\b(?:Griffin|Tricki|Pumphrey|Herriot|Horace|Danby|Ausable|Max|Anil|Hari|Matilda|Loisel|Bholi|Anne|Frank|Kitty|Keesing)\b/gi
    ) ?? [];
  for (const n of nameInQuestion) {
    priority.push(n[0].toUpperCase() + n.slice(1).toLowerCase());
  }

  // Also catch any capitalized token next to common story verbs in Qs
  const qNames =
    rawText.match(
      /(?:\b(?:describe|explain|who|why|how|what|comment|discuss)\b[^.?!\n]{0,80}\b)([A-Z][a-z]{3,})/g
    ) ?? [];
  for (const hit of qNames) {
    const m = hit.match(/\b([A-Z][a-z]{3,})\b$/);
    if (m && !isJunkTerm(m[1])) priority.push(m[1]);
  }

  // Multi-word Proper Nouns (Anne Frank, Secret Annexe) — same line only
  const multi = rawText.match(/\b[A-Z][a-z]+(?:[ \t]+[A-Z][a-z]+){1,2}\b/g) ?? [];
  for (const m of multi) {
    if (!isJunkTerm(m) && !/Delhi Public|Public School|Unit Fiction|Text Book|Problem Solving|Listening Skill/i.test(m)) {
      // Prefer person-like multi-words (contain lowercase connector already handled) —
      // skip skill/resource compounds
      if (
        /\b(Skill|Skills|Solving|Resources|Book|Content|Presentation|Assessment|Discussion|Methodology|Aids|Practice)\b/.test(
          m
        )
      ) {
        continue;
      }
      secondary.add(m);
    }
  }

  // Repeated character-like single names (5+ mentions; skip common lesson-plan vocabulary)
  const COMMON_CAPS = new Set([
    "Resources", "Text", "Book", "Listening", "Skill", "Problem", "Solving",
    "Infer", "Critically", "Dramatic", "Digital", "Group", "Peer", "Self",
    "Home", "Work", "Class", "Grade", "Subject", "Topic", "Concept", "Unit",
    "Fiction", "Content", "Introduction", "Comprehension", "Writing", "Reading",
    "Speaking", "English", "Students", "Teacher", "Activity", "Activities",
    "Learning", "Outcomes", "Homework", "Assignment", "Annexure", "Chapter",
    "Period", "Periods", "Materials", "Duration", "Objective", "Objectives",
    "Footprints", // title word handled via chapter title already
  ]);
  const singles = rawText.match(/\b[A-Z][a-z]{3,}\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const s of singles) {
    if (isJunkTerm(s) || COMMON_CAPS.has(s)) continue;
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  for (const [name, count] of Array.from(counts.entries())) {
    if (count >= 4) secondary.add(name);
  }

  // Meaningful words from chapter title only (skip stopwords like "without")
  for (const w of cleanChapter.split(/\W+/)) {
    if (
      w.length > 3 &&
      !isJunkTerm(w) &&
      !COMMON_CAPS.has(w) &&
      /^[A-Za-z]/.test(w)
    ) {
      secondary.add(w);
    }
  }

  for (const t of existingKeyTerms) {
    const clean = t.trim();
    if (!isJunkTerm(clean) && !COMMON_CAPS.has(clean)) secondary.add(clean);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const t of [...priority, ...Array.from(secondary)]) {
    const key = t.toLowerCase();
    if (seen.has(key) || isJunkTerm(t)) continue;
    seen.add(key);
    ordered.push(t);
    if (ordered.length >= 20) break;
  }

  return ordered;
}

export function computeTermOverlap(
  keyTerms: string[],
  outputText: string
): OverlapResult {
  const normalizedOutput = outputText.toLowerCase();
  const significantTerms = keyTerms.filter(
    (t) => t.length > 2 && !isJunkTerm(t)
  );

  const matchedTerms: string[] = [];
  const missingTerms: string[] = [];

  for (const term of significantTerms) {
    if (normalizedOutput.includes(term.toLowerCase())) {
      matchedTerms.push(term);
    } else {
      missingTerms.push(term);
    }
  }

  const genericPhraseHits = GENERIC_PHRASES.filter((p) =>
    normalizedOutput.includes(p)
  );

  const total = significantTerms.length;
  const matched = matchedTerms.length;
  const ratio = total > 0 ? matched / total : 1;

  return { matched, total, ratio, matchedTerms, missingTerms, genericPhraseHits };
}

export function logFaithfulnessCheck(
  metadata: { grade: string; subject: string; chapter: string },
  structure: GroundedLessonStructure,
  outputText: string,
  specificityTerms?: string[]
): OverlapResult {
  const terms =
    specificityTerms && specificityTerms.length > 0
      ? specificityTerms
      : structure.keyTerms;

  console.log(
    `[LessonPlanner] (a) Metadata: Grade="${metadata.grade}", Subject="${metadata.subject}", Chapter="${metadata.chapter}"`
  );
  console.log(
    `[LessonPlanner] (b) Source section labels: ${structure.sectionLabels.join(" | ") || "(none)"}`
  );
  console.log(
    `[LessonPlanner] (b2) Specificity key terms (${terms.length}): ${terms.slice(0, 15).join(", ")}${terms.length > 15 ? "…" : ""}`
  );

  const overlap = computeTermOverlap(terms, outputText);
  console.log(
    `[LessonPlanner] (c) Specificity overlap: ${overlap.matched}/${overlap.total} terms (${(overlap.ratio * 100).toFixed(0)}%) — matched: [${overlap.matchedTerms.slice(0, 10).join(", ")}]`
  );
  if (overlap.genericPhraseHits.length) {
    console.warn(
      `[LessonPlanner] Generic filler phrases detected: ${overlap.genericPhraseHits.join("; ")}`
    );
  }

  // Absolute minimum: at least 3 matched terms when we have enough candidates
  const tooGeneric =
    (overlap.total >= 3 && overlap.matched < 3) ||
    (overlap.total >= 2 && overlap.ratio < 0.2) ||
    overlap.genericPhraseHits.length >= 2;

  if (tooGeneric) {
    console.warn(
      "[LessonPlanner] possible hallucination / too generic - low specificity overlap with source"
    );
  }

  return overlap;
}

export function needsSpecificityRetry(overlap: OverlapResult): boolean {
  if (overlap.genericPhraseHits.length >= 2) return true;
  if (overlap.total >= 3 && overlap.matched < 3) return true;
  if (overlap.total >= 2 && overlap.ratio < 0.2) return true;
  return false;
}

export const GROUNDING_SYSTEM_RULES = `INSTRUCTION HIERARCHY (follow in order):

1. Below is the ACTUAL content of this specific chapter. Every activity, question, and example you generate must be derived from this content.

2. You must ONLY use facts, characters, events, questions, and activities that appear in the provided SOURCE CONTENT. Do NOT invent a different topic, theme, or chapter.

3. Do NOT write generic filler. Ban phrases like "explore the chapter's themes", "discuss the chapter's content", "introduce the concept of the chapter through discussion". Instead name the specific characters, events, or concepts from the source.

4. NEGATIVE EXAMPLE:
   BAD (too generic): "Introduce the concept of the chapter through discussion."
   GOOD (specific): "Introduce Anne Frank's confinement in the Secret Annexe and her relationship with Kitty, her diary." 
   GOOD (specific): "Discuss how Mrs. Pumphrey's overfeeding of Tricki leads Dr. Herriot to take the dog to the surgery."

5. For Extension: use the source Annexure questions/activities verbatim or with minimal rephrasing.
6. For Assessment and Model Key Answers: use source Homework/Assignment and Annexure questions — not invented discussion prompts.
7. Each Teaching Methodology sub-section MUST include a "sourceCitation" naming at least one proper noun/term from the source (character, place, event, or distinctive term).`;

export const STRONGER_GROUNDING_REMINDER = `RETRY — YOUR PREVIOUS OUTPUT WAS TOO GENERIC.
You MUST reference specific names, events, or terms from the source chapter provided above (e.g. character names like Tricki, Mrs. Pumphrey, Horace Danby, Griffin — whichever appear in THIS chapter's source).
Do NOT write vague lines like "discuss the chapter's themes".
Every Warm Up, Concept-Building, Extension, and Assessment item must name something concrete from the source.`;

export function buildAnnexureBlock(structure: GroundedLessonStructure): string {
  if (!structure.annexures.length) return "(No annexures found in source)";
  return structure.annexures
    .map((a) => `### ${a.label}\n${a.content}`)
    .join("\n\n");
}

export function buildHomeworkBlock(structure: GroundedLessonStructure): string {
  const parts = [
    structure.homeworkAssignment,
    structure.preContentQuestions,
    structure.postContent,
  ].filter(Boolean);
  return parts.length
    ? parts.join("\n\n")
    : "(No homework/assignment block found in source)";
}
