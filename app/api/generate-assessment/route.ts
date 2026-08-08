import { NextRequest, NextResponse } from "next/server";

import { generateAssessmentFromKnowledgeBase } from "@/lib/assessment-generate";
import { estimateTokenCount } from "@/lib/groq-utils";
import { getKnowledgeBaseEntry } from "@/lib/knowledge-base-store";
import {
  normalizeStoredStructure,
  structureToGenerationContext,
} from "@/lib/parse-lesson-structure";
import type { GenerateAssessmentInput } from "@/lib/types/assessment";
import { DEFAULT_BLOOM_LEVELS, DEFAULT_DIFFICULTY_MIX } from "@/lib/types/assessment";
import { isBloomLevel } from "@/lib/types/blooms-taxonomy";

export async function POST(request: NextRequest) {
  const clickId = request.headers.get("X-Click-Id") ?? "unknown";
  console.log(
    `[PracticeSheet] POST /api/generate-assessment received (clickId: ${clickId})`
  );

  try {
    const body = (await request.json()) as GenerateAssessmentInput;
    const {
      chapterId,
      questionCount,
      questionTypes,
      difficultyMix,
      bloomLevels,
      focusAreas,
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
        { error: "Practice sheet must use knowledge_base source." },
        { status: 400 }
      );
    }

    if (!questionTypes?.length) {
      return NextResponse.json(
        { error: "Select at least one question type." },
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
      `[Assessment] Using stored DB data for chapter id=${entry.id}: ${entry.grade} / ${entry.subject} / ${entry.chapter} — no fresh upload`
    );

    const structure = normalizeStoredStructure(
      entry.structure_json,
      entry.raw_text,
      entry.chapter,
      entry.structure_json?.concept ?? ""
    );
    const genContext = structureToGenerationContext(structure);
    console.log(
      `[Assessment] Token estimate for Groq grounded JSON: ~${estimateTokenCount(genContext)} tokens`
    );

    const selectedBloom =
      Array.isArray(bloomLevels) && bloomLevels.length > 0
        ? bloomLevels.filter(isBloomLevel)
        : DEFAULT_BLOOM_LEVELS;

    if (!selectedBloom.length) {
      return NextResponse.json(
        { error: "Select at least one Bloom's Taxonomy level." },
        { status: 400 }
      );
    }

    const assessment = await generateAssessmentFromKnowledgeBase(entry, {
      chapterId: entry.id,
      questionCount: ([5, 10, 15, 20].includes(Number(questionCount))
        ? Number(questionCount)
        : 10) as 5 | 10 | 15 | 20,
      questionTypes,
      difficultyMix: difficultyMix ?? DEFAULT_DIFFICULTY_MIX,
      bloomLevels: selectedBloom,
      focusAreas: focusAreas ?? "",
      source: "knowledge_base",
    });

    return NextResponse.json({
      success: true,
      assessment,
      chapterId: entry.id,
      metadata: {
        grade: entry.grade,
        subject: entry.subject,
        chapter: entry.chapter,
      },
    });
  } catch (error) {
    console.error("Practice sheet generate error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to generate practice sheet";
    const status = message.includes("GROQ_API_KEY")
      ? 500
      : message.includes("Missing") || message.includes("not found")
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
