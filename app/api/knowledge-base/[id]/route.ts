import { NextRequest, NextResponse } from "next/server";

import {
  processPdfForKnowledgeBase,
} from "@/lib/knowledge-base-import";
import {
  getKnowledgeBaseEntry,
  replaceKnowledgeBaseEntry,
} from "@/lib/knowledge-base-store";

/** Allow long OCR runs for scanned PDFs */
export const maxDuration = 300;

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    if (!id) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const entry = await getKnowledgeBaseEntry(id);
    if (!entry) {
      return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
    }

    console.log(
      `[LessonPlanner] Retrieved chapter from knowledge base: id=${entry.id}, grade=${entry.grade}, subject=${entry.subject}, chapter=${entry.chapter}, filename=${entry.filename}`
    );

    return NextResponse.json({
      id: entry.id,
      grade: entry.grade,
      subject: entry.subject,
      chapter: entry.chapter,
      filename: entry.filename,
      structure_json: entry.structure_json,
      updated_at: entry.updated_at,
      charCount: entry.raw_text?.length ?? 0,
      textPreview: (entry.raw_text ?? "").slice(0, 800),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to load chapter",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);
    const existing = await getKnowledgeBaseEntry(id);
    if (!existing) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file provided" },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 }
      );
    }

    const forceOcr = formData.get("forceOcr") === "true";
    const buffer = Buffer.from(await file.arrayBuffer());
    const processed = await processPdfForKnowledgeBase(buffer, file.name, {
      forceOcr,
    });

    const grade =
      (formData.get("grade") as string)?.trim() ||
      existing.grade ||
      processed.grade;
    const subject =
      (formData.get("subject") as string)?.trim() ||
      existing.subject ||
      processed.subject;
    const chapter =
      (formData.get("chapter") as string)?.trim() ||
      existing.chapter ||
      processed.chapter;

    if (chapter) processed.structure_json.topic = chapter;

    const entry = await replaceKnowledgeBaseEntry(id, {
      grade,
      subject,
      chapter,
      filename: file.name,
      raw_text: processed.raw_text,
      structure_json: processed.structure_json,
    });

    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    return NextResponse.json({
      entry,
      extractionMethod: processed.extractionMethod,
      ocrPages: processed.ocrPages,
      charCount: processed.raw_text.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Re-upload failed" },
      { status: 500 }
    );
  }
}
