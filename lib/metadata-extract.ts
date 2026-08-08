import type {
  MetadataConfidence,
  MetadataExtractionResult,
} from "@/lib/types/knowledge-base";

const STOPWORDS = new Set([
  "the", "and", "for", "from", "with", "that", "this", "chapter", "lesson",
  "plan", "topic", "subject", "class", "grade", "unit", "part", "section",
]);

const ROMAN_MAP: Record<string, string> = {
  I: "1", II: "2", III: "3", IV: "4", V: "5",
  VI: "6", VII: "7", VIII: "8", IX: "9", X: "10",
  XI: "11", XII: "12",
};

function cleanLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (lower === "of" || lower === "the" || lower === "and" || lower === "a") {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\b(Of|The|And|A)\b/g, (m) => m.toLowerCase())
    .replace(/^./, (c) => c.toUpperCase());
}

function normalizeGrade(raw: string): string {
  const cleaned = cleanLine(raw);
  const roman = cleaned.toUpperCase().replace(/[^IVXLC]/g, "");
  if (roman && ROMAN_MAP[roman]) {
    return `Grade ${ROMAN_MAP[roman]}`;
  }
  const num = cleaned.match(/(\d{1,2})/);
  if (num) return `Grade ${num[1]}`;
  return "";
}

function extractLabeledField(
  text: string,
  patterns: RegExp[]
): { value: string; confidence: "high" | "low" | "none" } {
  const lines = text.split(/\n/).slice(0, 80);

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) {
        const value = cleanLine(match[1]);
        if (value.length >= 2 && value.length <= 120) {
          return { value, confidence: "high" };
        }
      }
    }
  }

  for (const pattern of patterns) {
    const match = text.slice(0, 2500).match(pattern);
    if (match?.[1]) {
      const value = cleanLine(match[1].split(/\n/)[0]);
      if (value.length >= 2 && value.length <= 120) {
        return { value, confidence: "low" };
      }
    }
  }

  return { value: "", confidence: "none" };
}

function extractTopicFromTitle(text: string): { value: string; confidence: "high" | "low" | "none" } {
  const topic = extractLabeledField(text, [
    /TOPIC\s*:\s*(.+)/i,
    /TOPIC\s+[-–—]\s*(.+)/i,
    /UNIT\s*:\s*(.+)/i,
    /LESSON\s*TITLE\s*:\s*(.+)/i,
    /CHAPTER\s*TITLE\s*:\s*(.+)/i,
  ]);
  if (topic.value) return topic;

  const chapterLine = extractLabeledField(text, [
    /CHAPTER\s*:\s*(.+)/i,
    /CHAPTER\s+[-–—]\s*(.+)/i,
    /\bCHAPTER\s+(\d+[\s:.\-–—]+[A-Za-z].{3,80})/i,
  ]);
  if (chapterLine.value) {
  const stripped = chapterLine.value.replace(/^chapter\s*\d+[\s:.\-–—]*/i, "").trim();
    if (stripped.length >= 4) {
      return { value: titleCase(stripped), confidence: chapterLine.confidence };
    }
  }

  const headerLines = text.split(/\n/).slice(0, 15).map(cleanLine).filter(Boolean);
  for (const line of headerLines) {
    if (/lesson\s*plan/i.test(line)) continue;
    if (/^(subject|class|grade|topic|date|period|time)\b/i.test(line)) continue;
    if (line.length >= 8 && line.length <= 100 && /[a-zA-Z]{4,}/.test(line)) {
      return { value: titleCase(line), confidence: "low" };
    }
  }

  return { value: "", confidence: "none" };
}

function extractConcept(text: string, chapter: string): { value: string; confidence: "high" | "low" | "none" } {
  const concept = extractLabeledField(text, [
    /CONCEPT\s*:\s*(.+)/i,
    /THEME\s*:\s*(.+)/i,
  ]);
  if (concept.value) return concept;
  if (chapter) return { value: chapter, confidence: "low" };
  return { value: "", confidence: "none" };
}

function extractFromFilename(filename: string): Partial<MetadataExtractionResult> {
  const base = filename.replace(/\.pdf$/i, "").replace(/[_]+/g, " ");
  const result: Partial<MetadataExtractionResult> = {};

  const gradeMatch = base.match(/\b(?:grade|class|g)[\s-]*(\d{1,2}|viii|vii|vi|ix|x)\b/i);
  if (gradeMatch) {
    result.grade = normalizeGrade(gradeMatch[1]);
  }

  const knownSubjects = ["english", "hindi", "science", "mathematics", "maths", "social"];
  for (const subj of knownSubjects) {
    if (base.toLowerCase().includes(subj)) {
      result.subject = titleCase(subj === "maths" ? "Mathematics" : subj);
      break;
    }
  }

  const anneFrank = base.match(/anne\s*frank/i);
  if (anneFrank) {
    result.chapter = "From The Diary Of Anne Frank";
  }

  return result;
}

export function inferMetadataFromText(
  rawText: string,
  filename: string
): MetadataExtractionResult {
  const header = rawText.slice(0, 3000);
  const fromFilename = extractFromFilename(filename);

  const subjectField = extractLabeledField(header, [
    /SUBJECT\s*:\s*(.+)/i,
    /SUBJECT\s+[-–—]\s*(.+)/i,
  ]);

  const classField = extractLabeledField(header, [
    /CLASS\s*:\s*(.+)/i,
    /CLASS\s+[-–—]\s*(.+)/i,
    /GRADE\s*:\s*(.+)/i,
  ]);

  const topicField = extractTopicFromTitle(header);
  const gradeValue =
    classField.value ? normalizeGrade(classField.value) : fromFilename.grade ?? "";
  const subjectValue = subjectField.value
    ? titleCase(subjectField.value)
    : fromFilename.subject ?? "";
  const chapterValue = topicField.value
    ? titleCase(topicField.value)
    : fromFilename.chapter ?? "";

  const conceptField = extractConcept(header, chapterValue);

  const confidence: MetadataConfidence = {
    grade: classField.confidence !== "none" ? classField.confidence : gradeValue ? "low" : "none",
    subject: subjectField.confidence,
    chapter: topicField.confidence,
    concept: conceptField.confidence,
  };

  const needsManualEntry =
    !chapterValue || confidence.chapter === "none" ||
    (!subjectValue && confidence.subject === "none") ||
    (!gradeValue && confidence.grade === "none");

  console.log(
    `[Metadata] Extracted from "${filename}": grade="${gradeValue}", subject="${subjectValue}", chapter="${chapterValue}", concept="${conceptField.value}", needsManual=${needsManualEntry}`
  );

  return {
    grade: gradeValue,
    subject: subjectValue,
    chapter: chapterValue,
    concept: conceptField.value,
    confidence,
    needsManualEntry,
  };
}

export function inferMetadataFromFilename(filename: string): MetadataExtractionResult {
  return inferMetadataFromText("", filename);
}

export function extractTitleTerms(chapter: string, concept: string): string[] {
  const text = `${chapter} ${concept}`;
  return text
    .split(/\W+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !STOPWORDS.has(w.toLowerCase()))
    .map((w) => w.toLowerCase());
}
