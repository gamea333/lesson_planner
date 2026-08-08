"use client";

import { Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useGenerateAction } from "@/hooks/use-generate-action";
import type { CustomizationOptions } from "@/lib/types/knowledge-base";

interface ChapterOption {
  id: number;
  grade: string;
  subject: string;
  chapter: string;
}

const DEFAULT_CUSTOMIZATION: CustomizationOptions = {
  shortenWarmUp: false,
  extraPractice: false,
  simplifyLanguage: false,
  realWorldExamples: false,
  customText: "",
};

export default function HomePage() {
  const router = useRouter();
  const generateGuardRef = useRef(false);

  const [grades, setGrades] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<ChapterOption[]>([]);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState<number | null>(null);
  const [numberOfDays, setNumberOfDays] = useState("1");
  const [customization, setCustomization] = useState<CustomizationOptions>(DEFAULT_CUSTOMIZATION);

  const { invokeGenerate, isLoading: isGenerating, isDisabled: generateDisabled, waitLabel } =
    useGenerateAction({ action: "generate" });

  const loadFilters = useCallback(async (grade?: string, subject?: string) => {
    const params = new URLSearchParams({ filters: "true" });
    if (grade) params.set("grade", grade);
    if (subject) params.set("subject", subject);

    const res = await fetch(`/api/knowledge-base?${params}`);
    const data = await res.json();
    setGrades(data.grades ?? []);
    setSubjects(data.subjects ?? []);
    setChapters(data.chapters ?? []);
  }, []);

  useEffect(() => {
    loadFilters();
  }, [loadFilters]);

  useEffect(() => {
    if (selectedGrade) {
      loadFilters(selectedGrade);
      setSelectedSubject("");
      setSelectedChapterId(null);
    }
  }, [selectedGrade, loadFilters]);

  useEffect(() => {
    if (selectedGrade && selectedSubject) {
      loadFilters(selectedGrade, selectedSubject);
      setSelectedChapterId(null);
    }
  }, [selectedGrade, selectedSubject, loadFilters]);

  const selectedChapter = chapters.find((c) => c.id === selectedChapterId);
  const canGenerate =
    Boolean(selectedChapterId) && !isGenerating && !generateDisabled;

  async function handleGenerate() {
    if (!selectedChapterId || generateGuardRef.current || generateDisabled) return;

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
        description: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      generateGuardRef.current = false;
    }
  }

  function toggleCustomization(key: keyof Omit<CustomizationOptions, "customText">) {
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

          {grades.length === 0 ? (
            <Card className="text-center">
              <CardHeader>
                <CardTitle>Knowledge base is empty</CardTitle>
                <CardDescription>
                  Upload chapter lesson plan PDFs first, then come back to generate.
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
                    Choose Grade → Subject → Chapter from your stored library
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Grade</Label>
                    <select
                      value={selectedGrade}
                      onChange={(e) => setSelectedGrade(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={isGenerating}
                    >
                      <option value="">Select grade…</option>
                      {grades.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={!selectedGrade || isGenerating}
                    >
                      <option value="">Select subject…</option>
                      {subjects.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Chapter</Label>
                    <select
                      value={selectedChapterId ?? ""}
                      onChange={(e) => setSelectedChapterId(Number(e.target.value) || null)}
                      className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      disabled={!selectedSubject || isGenerating}
                    >
                      <option value="">Select chapter…</option>
                      {chapters.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.chapter}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedChapter && (
                    <p className="rounded-lg bg-accent/40 px-3 py-2 text-xs text-muted-foreground">
                      Using stored data for <strong>{selectedChapter.chapter}</strong> — pulled
                      from knowledge base, not a fresh upload.
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
                      <option value="1">1 day</option>
                      <option value="2">2 days</option>
                      <option value="3">3 days</option>
                      <option value="4">4 days</option>
                    </select>
                    {Number(numberOfDays) > 1 && (
                      <p className="text-xs text-muted-foreground">
                        Content will be split progressively across {numberOfDays} days
                        (Day 1 full warm-up; later days use a short recap).
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Customize this lesson plan</CardTitle>
                  <CardDescription>
                    Optional adjustments — applied on top of the source chapter&apos;s style
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        ["shortenWarmUp", "Shorten Warm-Up"],
                        ["extraPractice", "Add Extra Practice Questions"],
                        ["simplifyLanguage", "Simplify Language"],
                        ["realWorldExamples", "Include More Real-World Examples"],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent/30"
                      >
                        <input
                          type="checkbox"
                          checked={customization[key]}
                          onChange={() => toggleCustomization(key)}
                          disabled={isGenerating}
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="customText">Additional instructions</Label>
                    <textarea
                      id="customText"
                      value={customization.customText}
                      onChange={(e) =>
                        setCustomization((prev) => ({
                          ...prev,
                          customText: e.target.value,
                        }))
                      }
                      placeholder='e.g. "focus more on real-life examples," "add extra practice questions"'
                      rows={3}
                      disabled={isGenerating}
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
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {waitLabel ?? "Generating…"}
                  </>
                ) : waitLabel ? (
                  waitLabel
                ) : (
                  "Generate Lesson Plan"
                )}
              </Button>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
