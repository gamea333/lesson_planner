import { inferMetadataFromText } from "@/lib/metadata-extract";
import { createKnowledgeBaseEntry } from "@/lib/knowledge-base-store";
import { parseLessonPlanStructure } from "@/lib/parse-lesson-structure";
import {
  extractPdfText,
  type PdfExtractionMethod,
} from "@/lib/pdf-text";
import type {
  GroundedLessonStructure,
  KnowledgeBaseEntry,
} from "@/lib/types/knowledge-base";

export interface ProcessedKnowledgeBasePdf {
  filename: string;
  grade: string;
  subject: string;
  chapter: string;
  raw_text: string;
  structure_json: GroundedLessonStructure;
  needsManualEntry: boolean;
  extractionMethod: PdfExtractionMethod;
  ocrPages: number;
}

export async function processPdfForKnowledgeBase(
  buffer: Buffer,
  filename: string,
  options?: { forceOcr?: boolean }
): Promise<ProcessedKnowledgeBasePdf> {
  const extraction = await extractPdfText(buffer, {
    forceOcr: options?.forceOcr,
  });
  const rawText = extraction.text?.trim() ?? "";

  if (!rawText) {
    throw new Error(
      "PDF contains no extractable text, and OCR could not read any content."
    );
  }

  console.log(
    `[LessonPlanner] Extracted "${filename}" via ${extraction.method}` +
      (extraction.ocrPages
        ? ` (${extraction.ocrPages} OCR page(s), ${rawText.length} chars)`
        : ` (${rawText.length} chars, ${extraction.pageCount} page(s))`)
  );

  const inferred = inferMetadataFromText(rawText, filename);
  const grade = inferred.grade;
  const subject = inferred.subject;
  const chapter = inferred.chapter;

  const structure = parseLessonPlanStructure(
    rawText,
    chapter || inferred.chapter,
    inferred.concept
  );
  if (inferred.concept) structure.concept = inferred.concept;
  if (chapter) structure.topic = chapter;

  const needsManualEntry = !grade || !subject || !chapter;

  return {
    filename,
    grade: grade || "",
    subject: subject || "",
    chapter: chapter || "",
    raw_text: rawText,
    structure_json: structure,
    needsManualEntry,
    extractionMethod: extraction.method,
    ocrPages: extraction.ocrPages,
  };
}

export async function insertProcessedPdf(
  processed: ProcessedKnowledgeBasePdf
): Promise<KnowledgeBaseEntry> {
  return createKnowledgeBaseEntry({
    grade: processed.grade,
    subject: processed.subject,
    chapter: processed.chapter,
    filename: processed.filename,
    raw_text: processed.raw_text,
    structure_json: processed.structure_json,
  });
}
