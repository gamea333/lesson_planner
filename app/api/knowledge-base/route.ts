import { NextRequest, NextResponse } from "next/server";

import {
  insertProcessedPdf,
  processPdfForKnowledgeBase,
} from "@/lib/knowledge-base-import";
import {
  deleteKnowledgeBaseEntry,
  getKnowledgeBaseFilters,
  listKnowledgeBaseEntries,
  updateKnowledgeBaseEntry,
} from "@/lib/knowledge-base-store";

/** Allow long OCR runs for scanned PDFs */
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const grade = searchParams.get("grade") ?? undefined;
  const subject = searchParams.get("subject") ?? undefined;
  const search = searchParams.get("search") ?? undefined;
  const filtersOnly = searchParams.get("filters") === "true";

  if (filtersOnly) {
    return NextResponse.json(getKnowledgeBaseFilters(grade, subject));
  }

  const entries = listKnowledgeBaseEntries({ grade, subject, search });
  return NextResponse.json({
    entries: entries.map((e) => ({
      id: e.id,
      grade: e.grade,
      subject: e.subject,
      chapter: e.chapter,
      filename: e.filename,
      created_at: e.created_at,
      updated_at: e.updated_at,
      metadataComplete: Boolean(e.grade && e.subject && e.chapter),
      sectionLabels: e.structure_json?.sectionLabels ?? [],
    })),
  });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files").filter((f): f is File => f instanceof File);

    if (!files.length) {
      return NextResponse.json({ error: "No PDF files provided." }, { status: 400 });
    }

    const forceOcr = formData.get("forceOcr") === "true";
    const results = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith(".pdf")) {
        results.push({ filename: file.name, error: "Only PDF files are supported." });
        continue;
      }

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const processed = await processPdfForKnowledgeBase(buffer, file.name, {
          forceOcr,
        });

        const grade =
          (formData.get(`grade_${file.name}`) as string)?.trim() || processed.grade;
        const subject =
          (formData.get(`subject_${file.name}`) as string)?.trim() || processed.subject;
        const chapter =
          (formData.get(`chapter_${file.name}`) as string)?.trim() || processed.chapter;

        const entry = insertProcessedPdf({
          ...processed,
          grade: grade || "",
          subject: subject || "",
          chapter: chapter || "",
        });

        results.push({
          id: entry.id,
          filename: file.name,
          grade: entry.grade,
          subject: entry.subject,
          chapter: entry.chapter,
          needsManualEntry: !entry.grade || !entry.subject || !entry.chapter,
          sectionLabels: entry.structure_json.sectionLabels,
          keyTerms: entry.structure_json.keyTerms.slice(0, 10),
          extractionMethod: processed.extractionMethod,
          ocrPages: processed.ocrPages,
          charCount: processed.raw_text.length,
          success: true,
        });
      } catch (fileError) {
        results.push({
          filename: file.name,
          error:
            fileError instanceof Error ? fileError.message : "Failed to process PDF",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Knowledge base upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, grade, subject, chapter } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing entry id" }, { status: 400 });
    }

    if (!grade?.trim() || !subject?.trim() || !chapter?.trim()) {
      return NextResponse.json(
        { error: "Grade, Subject, and Chapter are all required." },
        { status: 400 }
      );
    }

    const updated = updateKnowledgeBaseEntry(Number(id), {
      grade: grade.trim(),
      subject: subject.trim(),
      chapter: chapter.trim(),
    });
    if (!updated) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({ entry: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = Number(searchParams.get("id"));

  if (!id) {
    return NextResponse.json({ error: "Missing entry id" }, { status: 400 });
  }

  const deleted = deleteKnowledgeBaseEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
