"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
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
import { useGenerateAction } from "@/hooks/use-generate-action";
import type { CustomizationOptions } from "@/lib/types/knowledge-base";

const DEFAULT_CUSTOMIZATION: CustomizationOptions = {
  shortenWarmUp: false,
  extraPractice: false,
  simplifyLanguage: false,
  realWorldExamples: false,
  customText: "",
};

function chapterLabel(c: {
  chapter: string;
  grade: string;
  subject: string;
  metadataComplete?: boolean;
}) {
  const meta =
    c.grade === "Unspecified" && c.subject === "Unspecified"
      ? "metadata not set yet"
      : `${c.grade} · ${c.subject}`;
  return `${c.chapter} (${meta})`;
}

export default function HomePage() {
  const router = useRouter();
  const generateGuardRef = useRef(false);

  const {
    grades,
    subjects,
    chapters,
    allChapters,
    totalEntries,
    incompleteCount,
    selectedGrade,
    setSelectedGrade,
    selectedSubject,
    setSelectedSubject,
    selectedChapterId,
    setSelectedChapterId,
    selectedChapter,
    isEmpty,
  } = useChapterFilters();

  const [numberOfDays, setNumberOfDays] = useState("1");
  const [customization, setCustomization] =
    useState<CustomizationOptions>(DEFAULT_CUSTOMIZATION);

  const {
    invokeGenerate,
    isLoading: isGenerating,
    isDisabled: generateDisabled,
    waitLabel,
  } = useGenerateAction({ action: "generate" });

  const canGenerate =
    Boolean(selectedChapterId) && !isGenerating && !generateDisabled;

  async function handleGenerate() {
    if (!selectedChapterId || generateGuardRef.current || generateDisabled)
      return;

    generateGuardRef.current = true;

    try {
      console.log(
        `[LessonPlanner] Chapter selected from knowledge base: id=${selectedChapterId} — fetching stored data (no upload)`
      );

      const result = await invokeGenerate({
        chapterId: selectedChapterId,
        numberOfDays,
        customization,
        source: "knowledge_base",
      });

      if (!result) return;

      const sessionData = {
        lessonPlan: result.lessonPlan,
        metadata: result.metadata,
        chapterId: result.chapterId,
        generateInput: {
          chapterId: selectedChapterId,
          numberOfDays,
          customization,
          source: "knowledge_base" as const,
        },
        concept: "",
      };

      sessionStorage.setItem("lessonPlanResult", JSON.stringify(sessionData));
      toast.success("Lesson plan ready!", {
        description: `Generated from ${result.metadata.chapter} in your knowledge base.`,
      });
      router.push("/generate");
    } catch (err) {
      toast.error("Generation failed", {
        description:
          err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      generateGuardRef.current = false;
    }
  }

  function toggleCustomization(
    key: keyof Omit<CustomizationOptions, "customText">
  ) {
    setCustomization((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <>
      {isGenerating && (
        <GeneratingOverlay
          message="Building your lesson plan…"
          submessage="Adapting the stored chapter template with your customizations"
        />
      )}

      <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
          <header className="mb-8 text-center sm:mb-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              <Sparkles className="h-4 w-4" />
              Knowledge-base powered
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Create a lesson plan
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-base text-muted-foreground">
              Select a chapter from your knowledge base — no re-upload needed.
            </p>
          </header>

          {isEmpty ? (
            <Card className="text-center">
              <CardHeader>
                <CardTitle>Knowledge base is empty</CardTitle>
                <CardDescription>
                  Upload chapter lesson plan PDFs first, then come back to
                  generate.
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
                    Every stored chapter appears here right after upload — even
                    before Grade / Subject are filled in. Filters below are
                    optional.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  {incompleteCount > 0 && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                      {incompleteCount} of {totalEntries} chapter(s) still need
                      Grade / Subject / Chapter in{" "}
                      <Link href="/knowledge-base" className="underline">
                        Knowledge Base
                      </Link>
                      . You can generate now; titles may show as the PDF name.
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label>Chapter</Label>
                    <select
                      value={selectedChapterId ?? ""}
                      onChange={(e) =>
                        setSelectedChapterId(
                          Number(e.target.value) || null
                        )
                      }
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={isGenerating}
                    >
                      <option value="">Select chapter…</option>
                      {(selectedGrade || selectedSubject
                        ? chapters
                        : allChapters
                      ).map((c) => (
                        <option key={c.id} value={c.id}>
                          {chapterLabel(c)}
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
                        disabled={isGenerating}
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
                        disabled={isGenerating}
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
                      {selectedChapter.metadataComplete === false
                        ? " — tip: add Grade/Subject in Knowledge Base when you can."
                        : " — pulled from knowledge base, not a fresh upload."}
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="days">Number of Days</Label>
                    <select
                      id="days"
                      value={numberOfDays}
                      onChange={(e) => setNumberOfDays(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={isGenerating}
                    >
                      {[1, 2, 3, 4].map((d) => (
                        <option key={d} value={String(d)}>
                          {d} {d === 1 ? "day" : "days"}
                        </option>
                      ))}
                    </select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customize (optional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(
                    [
                      ["shortenWarmUp", "Shorten warm-up"],
                      ["extraPractice", "Add extra practice"],
                      ["simplifyLanguage", "Simplify language"],
                      ["realWorldExamples", "Add real-world examples"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      key={key}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={customization[key]}
                        onChange={() => toggleCustomization(key)}
                        disabled={isGenerating}
                        className="h-4 w-4 accent-primary"
                      />
                      {label}
                    </label>
                  ))}
                  <div className="space-y-1.5 pt-1">
                    <Label htmlFor="custom">Extra notes</Label>
                    <textarea
                      id="custom"
                      rows={2}
                      value={customization.customText}
                      onChange={(e) =>
                        setCustomization((prev) => ({
                          ...prev,
                          customText: e.target.value,
                        }))
                      }
                      disabled={isGenerating}
                      placeholder="Anything else for this lesson…"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                {isGenerating ? (
                  <Loader2 className="animate-spin" />
                ) : null}
                {waitLabel ?? "Generate lesson plan"}
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
