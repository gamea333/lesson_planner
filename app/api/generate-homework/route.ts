import { NextRequest, NextResponse } from "next/server";

import { estimateTokenCount } from "@/lib/groq-utils";
import { generateHomeworkFromKnowledgeBase } from "@/lib/homework-generate";
import { getKnowledgeBaseEntry } from "@/lib/knowledge-base-store";
import {
  normalizeStoredStructure,
  structureToGenerationContext,
} from "@/lib/parse-lesson-structure";
import { isBloomLevel } from "@/lib/types/blooms-taxonomy";
import type { GenerateHomeworkInput } from "@/lib/types/homework";
import { DEFAULT_HOMEWORK_BLOOM_LEVELS } from "@/lib/types/homework";

export async function POST(request: NextRequest) {
  const clickId = request.headers.get("X-Click-Id") ?? "unknown";
  console.log(
    `[Homework] POST /api/generate-homework received (clickId: ${clickId})`
  );

  try {
    const body = (await request.json()) as GenerateHomeworkInput;
    const {
      chapterId,
      numberOfDays,
      questionsPerDay,
      researchTopicsPerDay,
      includeAnswerHints,
      customNotes,
      dayFocusHints,
      bloomLevels,
      source,
    } = body;

    if (!chapterId) {
      return NextResponse.json(
        { error: "Missing chapterId — select a chapter from the knowledge base." },
        { status: 400 }
      );
    }

    if (source !== "knowledge_base") {
      return NextResponse.json(
        { error: "Homework must use knowledge_base source." },
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

    const structure = normalizeStoredStructure(
      entry.structure_json,
      entry.raw_text,
      entry.chapter,
      entry.structure_json?.concept ?? ""
    );
    console.log(
      `[Homework] Using KB id=${entry.id}: ${entry.grade} / ${entry.subject} / ${entry.chapter}`
    );
    console.log(
      `[Homework] Grounded context ~${estimateTokenCount(structureToGenerationContext(structure))} tokens`
    );

    const selectedBloom =
      Array.isArray(bloomLevels) && bloomLevels.length > 0
        ? bloomLevels.filter(isBloomLevel)
        : DEFAULT_HOMEWORK_BLOOM_LEVELS;

    const input: GenerateHomeworkInput = {
      chapterId: entry.id,
      numberOfDays: Math.min(4, Math.max(1, Number(numberOfDays) || 1)),
      questionsPerDay: Math.min(8, Math.max(1, Number(questionsPerDay) || 4)),
      researchTopicsPerDay: Math.min(
        3,
        Math.max(0, Number(researchTopicsPerDay) || 1)
      ),
      includeAnswerHints: includeAnswerHints !== false,
      customNotes: customNotes ?? "",
      dayFocusHints: Array.isArray(dayFocusHints) ? dayFocusHints : undefined,
      bloomLevels: selectedBloom.length ? selectedBloom : DEFAULT_HOMEWORK_BLOOM_LEVELS,
      source: "knowledge_base",
    };

    const homework = await generateHomeworkFromKnowledgeBase(entry, input);

    return NextResponse.json({
      success: true,
      homework,
      chapterId: entry.id,
      metadata: {
        grade: entry.grade,
        subject: entry.subject,
        chapter: entry.chapter,
      },
    });
  } catch (error) {
    console.error("[Homework] generation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate homework",
      },
      { status: 500 }
    );
  }
}
