import { NextRequest, NextResponse } from "next/server";

import { debugBuildLessonPlanPayload } from "@/lib/groq";
import { getKnowledgeBaseEntry } from "@/lib/knowledge-base-store";
import type { GenerateFromKbInput } from "@/lib/types/knowledge-base";

/**
 * GET /api/debug/prompt?chapterId=10&days=1
 * Builds and returns the FULL Groq payload without calling Groq.
 * Also logs the full system + user prompts to the server console.
 */
export async function GET(request: NextRequest) {
  const chapterId = Number(request.nextUrl.searchParams.get("chapterId"));
  const days = request.nextUrl.searchParams.get("days") || "1";

  if (!chapterId) {
    return NextResponse.json(
      { error: "Pass ?chapterId=<id> (optional &days=1-4)" },
      { status: 400 }
    );
  }

  const entry = getKnowledgeBaseEntry(chapterId);
  if (!entry) {
    return NextResponse.json({ error: "Chapter not found" }, { status: 404 });
  }

  const input: GenerateFromKbInput = {
    chapterId,
    numberOfDays: days,
    customization: {
      shortenWarmUp: false,
      extraPractice: false,
      simplifyLanguage: false,
      realWorldExamples: false,
      customText: "",
    },
    source: "knowledge_base",
  };

  const built = debugBuildLessonPlanPayload(entry, input);

  return NextResponse.json({
    chapterId: entry.id,
    chapter: entry.chapter,
    grade: entry.grade,
    subject: entry.subject,
    specificityTerms: built.specificityTerms,
    packStats: built.packStats,
    systemPrompt: built.systemPrompt,
    userPrompt: built.userPrompt,
  });
}
