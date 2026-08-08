"use client";

import { ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { GeneratingOverlay } from "@/components/generating-overlay";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useChapterFilters } from "@/hooks/use-chapter-filters";
import { useCooldownAction } from "@/hooks/use-cooldown-action";
import { saveAssessmentSession } from "@/lib/session";
import type {
  DifficultyMix,
  GenerateAssessmentInput,
  QuestionType,
} from "@/lib/types/assessment";
import {
  DEFAULT_BLOOM_LEVELS,
  DEFAULT_DIFFICULTY_MIX,
  QUESTION_TYPE_LABELS,
} from "@/lib/types/assessment";
import {
  BLOOM_LEVELS,
  BLOOM_LEVEL_LABELS,
  type BloomLevel,
} from "@/lib/types/blooms-taxonomy";

const ALL_TYPES = Object.keys(QUESTION_TYPE_LABELS) as QuestionType[];

export default function PracticeSheetPage() {
  const router = useRouter();
  const {
    grades,
    subjects,
    chapters,
    selectedGrade,
    setSelectedGrade,
    selectedSubject,
    setSelectedSubject,
    selectedChapterId,
    setSelectedChapterId,
    selectedChapter,
    isEmpty,
    allChapters,
    incompleteCount,
    totalEntries,
  } = useChapterFilters();

  const [questionCount, setQuestionCount] = useState<5 | 10 | 15 | 20>(10);
  const [questionTypes, setQuestionTypes] = useState<QuestionType[]>([
    "mcq",
    "short_answer",
  ]);
  const [difficultyMix, setDifficultyMix] =
    useState<DifficultyMix>(DEFAULT_DIFFICULTY_MIX);
  const [bloomLevels, setBloomLevels] =
    useState<BloomLevel[]>(DEFAULT_BLOOM_LEVELS);
  const [focusAreas, setFocusAreas] = useState("");

  const { run, isLoading, isDisabled, waitLabel } = useCooldownAction({
    actionLabel: "generate-practice-sheet",
  });

  const canGenerate =
    Boolean(selectedChapterId) &&
    questionTypes.length > 0 &&
    bloomLevels.length > 0 &&
    !isDisabled;

  function toggleType(type: QuestionType) {
    setQuestionTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function toggleBloom(level: BloomLevel) {
    setBloomLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  function updateMix(key: keyof DifficultyMix, value: number) {
    setDifficultyMix((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    if (!selectedChapterId || !canGenerate) return;

    const input: GenerateAssessmentInput = {
      chapterId: selectedChapterId,
      questionCount,
      questionTypes,
      difficultyMix,
      bloomLevels,
      focusAreas,
      source: "knowledge_base",
    };

    try {
      const result = await run(async () => {
        const clickId = crypto.randomUUID();
        console.log(
          `[PracticeSheet] button click (clickId: ${clickId}, chapterId: ${selectedChapterId})`
        );

        const response = await fetch("/api/generate-assessment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Click-Id": clickId,
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to generate practice sheet");
        }

        return response.json();
      });

      if (!result) return;

      saveAssessmentSession({
        assessment: result.assessment,
        generateInput: input,
        chapterId: result.chapterId,
      });

      toast.success("Practice sheet ready!", {
        description: `${result.assessment.questions.length} questions for ${result.assessment.chapter}`,
      });
      router.push("/practice-sheet/result");
    } catch (err) {
      toast.error("Practice sheet generation failed", {
        description: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  return (
    <>
      {isLoading && (
        <GeneratingOverlay
          message="Building your practice sheet…"
          submessage="Bloom’s Taxonomy–aligned questions grounded in the chapter"
        />
      )}

      <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <header className="mb-8 text-center sm:mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <ClipboardList className="h-4 w-4" />
              Practice sheet
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Generate a practice sheet
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">
              Pull Bloom&apos;s Taxonomy–aligned questions from a knowledge base
              chapter — grounded in the real content.
            </p>
          </header>

          {isEmpty ? (
            <Card className="text-center">
              <CardHeader>
                <CardTitle>Knowledge base is empty</CardTitle>
                <CardDescription>
                  Upload chapter PDFs first, then generate practice sheets.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <Link href="/knowledge-base">Go to Knowledge Base</Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-5 sm:gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Select chapter</CardTitle>
                  <CardDescription>
                    Pick any stored chapter immediately — Grade / Subject filters
                    are optional.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {incompleteCount > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {incompleteCount} of {totalEntries} chapter(s) still need
                      metadata in Knowledge Base. They still appear in the list.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label>Chapter</Label>
                    <select
                      value={selectedChapterId ?? ""}
                      onChange={(e) =>
                        setSelectedChapterId(Number(e.target.value) || null)
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={isLoading}
                    >
                      <option value="">Select chapter…</option>
                      {(selectedGrade || selectedSubject
                        ? chapters
                        : allChapters
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.chapter}
                          {c.grade === "Unspecified"
                            ? " (metadata not set)"
                            : ` · ${c.grade} · ${c.subject}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Filter by grade (optional)</Label>
                      <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        disabled={isLoading}
                      >
                        <option value="">All grades</option>
                        {grades.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Filter by subject (optional)</Label>
                      <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                        disabled={isLoading}
                      >
                        <option value="">All subjects</option>
                        {subjects.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {selectedChapter && (
                    <p className="rounded-lg bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
                      Using stored data for{" "}
                      <strong>{selectedChapter.chapter}</strong>
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Practice sheet options</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label>Number of questions</Label>
                    <select
                      value={questionCount}
                      onChange={(e) =>
                        setQuestionCount(Number(e.target.value) as 5 | 10 | 15 | 20)
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={isLoading}
                    >
                      {[5, 10, 15, 20].map((n) => (
                        <option key={n} value={n}>
                          {n} questions
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Question types</Label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ALL_TYPES.map((type) => (
                        <label
                          key={type}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent/30"
                        >
                          <input
                            type="checkbox"
                            checked={questionTypes.includes(type)}
                            onChange={() => toggleType(type)}
                            disabled={isLoading}
                            className="h-4 w-4 accent-primary"
                          />
                          {QUESTION_TYPE_LABELS[type]}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Bloom&apos;s Taxonomy levels</Label>
                    <p className="text-xs text-muted-foreground">
                      Questions will be distributed across the levels you select
                      (Remember → Create).
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {BLOOM_LEVELS.map((level) => (
                        <label
                          key={level}
                          className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent/30"
                        >
                          <input
                            type="checkbox"
                            checked={bloomLevels.includes(level)}
                            onChange={() => toggleBloom(level)}
                            disabled={isLoading}
                            className="h-4 w-4 accent-primary"
                          />
                          {BLOOM_LEVEL_LABELS[level]}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Difficulty mix (%)</Label>
                    {(
                      [
                        ["easy", "Easy"],
                        ["medium", "Medium"],
                        ["hard", "Hard"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="w-16 text-sm text-muted-foreground">{label}</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={difficultyMix[key]}
                          onChange={(e) => updateMix(key, Number(e.target.value))}
                          disabled={isLoading}
                          className="flex-1 accent-primary"
                        />
                        <span className="w-10 text-right text-sm tabular-nums">
                          {difficultyMix[key]}%
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                      Total:{" "}
                      {difficultyMix.easy + difficultyMix.medium + difficultyMix.hard}%
                      (normalized by the model if not 100)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="focus">Focus areas (optional)</Label>
                    <textarea
                      id="focus"
                      value={focusAreas}
                      onChange={(e) => setFocusAreas(e.target.value)}
                      placeholder='e.g. "focus more on character analysis"'
                      rows={3}
                      disabled={isLoading}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                </CardContent>
              </Card>

              <Button
                size="lg"
                className="w-full"
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {waitLabel ?? "Generating…"}
                  </>
                ) : waitLabel ? (
                  waitLabel
                ) : (
                  "Generate Practice Sheet"
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
