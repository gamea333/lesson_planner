"use client";

import { BookMarked, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
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
import {
  loadLessonPlanSession,
  saveHomeworkSession,
} from "@/lib/session";
import type {
  GenerateHomeworkInput,
  HomeworkDayFocusHint,
} from "@/lib/types/homework";
import { DEFAULT_HOMEWORK_BLOOM_LEVELS } from "@/lib/types/homework";
import {
  BLOOM_LEVELS,
  BLOOM_LEVEL_LABELS,
  type BloomLevel,
} from "@/lib/types/blooms-taxonomy";
import { getDayCount, isMultiDayPlan } from "@/lib/types/lesson-plan";
import { cn } from "@/lib/utils";

function HomeworkCreatorInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
    hydrateSelection,
    isEmpty,
  } = useChapterFilters();

  const [numberOfDays, setNumberOfDays] = useState(1);
  const [questionsPerDay, setQuestionsPerDay] = useState(4);
  const [researchTopicsPerDay, setResearchTopicsPerDay] = useState(1);
  const [includeAnswerHints, setIncludeAnswerHints] = useState(true);
  const [customNotes, setCustomNotes] = useState("");
  const [bloomLevels, setBloomLevels] = useState<BloomLevel[]>(
    DEFAULT_HOMEWORK_BLOOM_LEVELS
  );
  const [dayFocusHints, setDayFocusHints] = useState<HomeworkDayFocusHint[]>([]);
  const [linkedFromLesson, setLinkedFromLesson] = useState(false);

  const { run, isLoading, isDisabled, waitLabel } = useCooldownAction({
    actionLabel: "generate-homework",
  });

  // Prefill from current lesson plan session and/or query params
  useEffect(() => {
    const fromPlan = searchParams.get("fromLesson") === "1";
    const chapterParam = searchParams.get("chapterId");
    const daysParam = searchParams.get("days");

    const lessonSession = loadLessonPlanSession();

    async function hydrate() {
      if (lessonSession && (fromPlan || !chapterParam)) {
        const plan = lessonSession.lessonPlan;
        const days = getDayCount(plan);
        setNumberOfDays(Math.min(4, Math.max(1, days)));
        await hydrateSelection(
          lessonSession.metadata.grade || plan.grade || "",
          lessonSession.metadata.subject || plan.subject || "",
          lessonSession.chapterId
        );
        if (isMultiDayPlan(plan) && plan.days) {
          setDayFocusHints(
            plan.days.map((d) => ({
              day: d.day,
              title: d.title || `Day ${d.day}`,
              focus: d.focus || "",
            }))
          );
        } else {
          setDayFocusHints([
            {
              day: 1,
              title: plan.chapter || "Day 1",
              focus: plan.objectives?.conceptBuilding || "",
            },
          ]);
        }
        setLinkedFromLesson(true);
      } else if (chapterParam) {
        const id = Number(chapterParam);
        if (Number.isFinite(id)) setSelectedChapterId(id);
      }

      if (daysParam) {
        const d = Number(daysParam);
        if (Number.isFinite(d)) setNumberOfDays(Math.min(4, Math.max(1, d)));
      }
    }

    void hydrate();
  }, [
    searchParams,
    setSelectedChapterId,
    hydrateSelection,
  ]);

  const canGenerate =
    Boolean(selectedChapterId) && bloomLevels.length > 0 && !isDisabled;

  const daySummary = useMemo(() => {
    if (!dayFocusHints.length) return null;
    return dayFocusHints
      .slice(0, numberOfDays)
      .map((d) => `Day ${d.day}: ${d.title}${d.focus ? ` — ${d.focus}` : ""}`)
      .join(" · ");
  }, [dayFocusHints, numberOfDays]);

  async function handleGenerate() {
    if (!selectedChapterId || !canGenerate) return;

    const input: GenerateHomeworkInput = {
      chapterId: selectedChapterId,
      numberOfDays,
      questionsPerDay,
      researchTopicsPerDay,
      includeAnswerHints,
      customNotes,
      bloomLevels,
      dayFocusHints: dayFocusHints.slice(0, numberOfDays),
      source: "knowledge_base",
    };

    try {
      const result = await run(async () => {
        const clickId = crypto.randomUUID();
        console.log(
          `[Homework] button click (clickId: ${clickId}, chapterId: ${selectedChapterId}, days: ${numberOfDays})`
        );

        const response = await fetch("/api/generate-homework", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Click-Id": clickId,
          },
          body: JSON.stringify(input),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to generate homework");
        }

        return response.json();
      });

      if (!result) return;

      saveHomeworkSession({
        homework: result.homework,
        generateInput: input,
        chapterId: result.chapterId,
      });
      toast.success("Homework pack ready");
      router.push("/homework/result");
    } catch (err) {
      toast.error("Generation failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  }

  if (isEmpty) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>No chapters yet</CardTitle>
            <CardDescription>
              Upload chapter lesson plans to the knowledge base first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/knowledge-base">Go to Knowledge Base</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      {isLoading && (
        <GeneratingOverlay
          message="Building day-wise homework…"
          submessage="Bloom’s Taxonomy–aligned tasks grounded in your knowledge base chapter"
        />
      )}

      <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
          <header className="mb-8">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <BookMarked className="h-4 w-4" />
              Homework Creator
            </div>
            <h1 className="text-3xl font-bold tracking-tight">
              Day-wise student homework
            </h1>
            <p className="mt-2 text-muted-foreground">
              Generate Bloom&apos;s Taxonomy–aligned questions and research topics
              for each lesson-plan day, grounded in the chapter knowledge base.
            </p>
          </header>

          {linkedFromLesson && (
            <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">
                Linked to your current lesson plan
              </p>
              {daySummary && (
                <p className="mt-1 text-muted-foreground">{daySummary}</p>
              )}
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Chapter & options</CardTitle>
              <CardDescription>
                Choose the chapter and how many days of homework to create.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Grade</Label>
                  <select
                    value={selectedGrade}
                    onChange={(e) => setSelectedGrade(e.target.value)}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select grade</option>
                    {grades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subject</Label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    disabled={!selectedGrade}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
                  >
                    <option value="">Select subject</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Chapter</Label>
                  <select
                    value={selectedChapterId ?? ""}
                    onChange={(e) =>
                      setSelectedChapterId(
                        e.target.value ? Number(e.target.value) : null
                      )
                    }
                    disabled={!selectedSubject}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm disabled:opacity-50"
                  >
                    <option value="">Select chapter</option>
                    {chapters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.chapter}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selectedChapter && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedChapter.grade} · {selectedChapter.subject} ·{" "}
                  {selectedChapter.chapter}
                </p>
              )}

              <div className="space-y-2">
                <Label>Number of homework days</Label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNumberOfDays(d)}
                      className={cn(
                        "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
                        numberOfDays === d
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-white hover:bg-slate-50"
                      )}
                    >
                      {d} day{d === 1 ? "" : "s"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Match this to your lesson plan length (e.g. 2-day plan → 2 days
                  of homework).
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Questions / practice per day</Label>
                  <select
                    value={questionsPerDay}
                    onChange={(e) => setQuestionsPerDay(Number(e.target.value))}
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {[2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Research topics per day</Label>
                  <select
                    value={researchTopicsPerDay}
                    onChange={(e) =>
                      setResearchTopicsPerDay(Number(e.target.value))
                    }
                    className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    {[0, 1, 2, 3].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Bloom&apos;s Taxonomy levels</Label>
                <p className="text-xs text-muted-foreground">
                  Tasks are distributed across selected levels (Remember → Create).
                  Research topics usually use Analyze / Evaluate / Create.
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
                        onChange={() =>
                          setBloomLevels((prev) =>
                            prev.includes(level)
                              ? prev.filter((l) => l !== level)
                              : [...prev, level]
                          )
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      {BLOOM_LEVEL_LABELS[level]}
                    </label>
                  ))}
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={includeAnswerHints}
                  onChange={(e) => setIncludeAnswerHints(e.target.checked)}
                />
                <span>
                  Include suggested answers / hints for the teacher (not shown on
                  the student PDF by default in the overview — still stored for
                  editing).
                </span>
              </label>

              <div className="space-y-1.5">
                <Label htmlFor="hw-notes">Extra teacher notes (optional)</Label>
                <textarea
                  id="hw-notes"
                  rows={3}
                  value={customNotes}
                  onChange={(e) => setCustomNotes(e.target.value)}
                  placeholder="e.g. Emphasize Maxwell’s equations; keep research offline-friendly"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <Button
                className="w-full sm:w-auto"
                disabled={!canGenerate}
                onClick={handleGenerate}
              >
                {isLoading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <BookMarked />
                )}
                {waitLabel ?? "Generate homework"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

export default function HomeworkPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </main>
      }
    >
      <HomeworkCreatorInner />
    </Suspense>
  );
}
