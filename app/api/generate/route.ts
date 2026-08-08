import { NextRequest, NextResponse } from "next/server";

import { generateLessonPlanFromKnowledgeBase } from "@/lib/groq";
import { estimateTokenCount } from "@/lib/groq-utils";
import { getKnowledgeBaseEntry } from "@/lib/knowledge-base-store";
import {
  normalizeStoredStructure,
  structureToGenerationContext,
} from "@/lib/parse-lesson-structure";
import type { CustomizationOptions, GenerateFromKbInput } from "@/lib/types/knowledge-base";

export async function POST(request: NextRequest) {
  const clickId = request.headers.get("X-Click-Id") ?? "unknown";
  console.log(
    `[LessonPlanner] POST /api/generate received (clickId: ${clickId})`
  );

  try {
    const body = await request.json();
    const { chapterId, numberOfDays, customization, source } = body as GenerateFromKbInput;

    if (!chapterId) {
      return NextResponse.json(
        { error: "Missing chapterId — select a chapter from the knowledge base." },
        { status: 400 }
      );
    }

    if (source !== "knowledge_base") {
      return NextResponse.json(
        { error: "Generation must use knowledge_base source. Upload flow is deprecated." },
        { status: 400 }
      );
    }

    const entry = getKnowledgeBaseEntry(Number(chapterId));
    if (!entry) {
      return NextResponse.json(
        { error: "Chapter not found in knowledge base." },
        { status: 404 }
      );
    }

    console.log(
      `[LessonPlanner] Using stored DB data for chapter id=${entry.id}: ${entry.grade} / ${entry.subject} / ${entry.chapter} (${entry.filename}) — no fresh upload`
    );

    const structure = normalizeStoredStructure(
      entry.structure_json,
      entry.raw_text,
      entry.chapter,
      entry.structure_json?.concept ?? ""
    );

    console.log(
      `[LessonPlanner] (b) Extracted section labels in source: ${structure.sectionLabels.join(" | ")}`
    );
    console.log(
      `[LessonPlanner] (a) Metadata: Grade="${entry.grade}", Subject="${entry.subject}", Chapter="${entry.chapter}"`
    );

    const genContext = structureToGenerationContext(structure);
    console.log(
      `[LessonPlanner] Token estimate for Groq grounded JSON: ~${estimateTokenCount(genContext)} tokens`
    );

    const lessonPlan = await generateLessonPlanFromKnowledgeBase(entry, {
      chapterId: entry.id,
      numberOfDays: numberOfDays ?? "1",
      customization: customization ?? defaultCustomization(),
      source: "knowledge_base",
    });

    return NextResponse.json({
      success: true,
      lessonPlan,
      metadata: {
        grade: entry.grade,
        subject: entry.subject,
        chapter: entry.chapter,
        numberOfDays: numberOfDays ?? "1",
      },
      chapterId: entry.id,
    });
  } catch (error) {
    console.error("Generate error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to generate lesson plan";

    const status = message.includes("GROQ_API_KEY")
      ? 500
      : message.includes("Missing") || message.includes("not found")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

function defaultCustomization(): CustomizationOptions {
  return {
    shortenWarmUp: false,
    extraPractice: false,
    simplifyLanguage: false,
    realWorldExamples: false,
    customText: "",
  };
}
