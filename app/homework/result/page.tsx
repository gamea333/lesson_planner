"use client";

import { saveAs } from "file-saver";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Download,
  Loader2,
  MessageCircle,
  Pencil,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { GeneratingOverlay } from "@/components/generating-overlay";
import { BloomBadge } from "@/components/bloom-badge";
import { AssignToStudents } from "@/components/assign-to-students";
import { TeacherReviewPanel } from "@/components/teacher-review-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCooldownAction } from "@/hooks/use-cooldown-action";
import {
  loadHomeworkSession,
  saveHomeworkSession,
  type StoredHomeworkSession,
} from "@/lib/session";
import type {
  DayHomework,
  GeneratedHomework,
  HomeworkQuestion,
  HomeworkResearchTopic,
} from "@/lib/types/homework";
import { HOMEWORK_TASK_LABELS } from "@/lib/types/homework";
import type { TeacherReview } from "@/lib/types/teacher-review";
import { cn } from "@/lib/utils";
import {
  getWhatsAppDisplayNumber,
  sendPdfToWhatsApp,
} from "@/lib/whatsapp";

export default function HomeworkResultPage() {
  const [session, setSession] = useState<StoredHomeworkSession | null>(null);
  const [homework, setHomework] = useState<GeneratedHomework | null>(null);
  const [activeDay, setActiveDay] = useState(1);
  const [isEditing, setIsEditing] = useState(false);
  const [showTeacherKey, setShowTeacherKey] = useState(false);
  const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { run, isLoading: isRegenerating, isDisabled, waitLabel } = useCooldownAction({
    actionLabel: "regenerate-homework",
  });

  useEffect(() => {
    const stored = loadHomeworkSession();
    if (stored) {
      setSession(stored);
      setHomework(stored.homework);
      setActiveDay(stored.homework.days[0]?.day ?? 1);
    }
    setIsLoaded(true);
  }, []);

  function persist(next: GeneratedHomework) {
    if (!session) return;
    const updated = { ...session, homework: next };
    setSession(updated);
    setHomework(next);
    saveHomeworkSession(updated);
  }

  function handleReviewsChange(reviews: TeacherReview[]) {
    if (!session || !homework) return;
    const updated: StoredHomeworkSession = {
      ...session,
      homework,
      teacherReviews: reviews,
    };
    setSession(updated);
    saveHomeworkSession(updated);
  }

  function updateDay(dayNum: number, patch: Partial<DayHomework>) {
    if (!homework) return;
    const days = homework.days.map((d) =>
      d.day === dayNum ? { ...d, ...patch } : d
    );
    persist({ ...homework, days });
  }

  function updateQuestion(
    dayNum: number,
    qIndex: number,
    patch: Partial<HomeworkQuestion>
  ) {
    if (!homework) return;
    const days = homework.days.map((d) => {
      if (d.day !== dayNum) return d;
      const questions = d.questions.map((q, i) =>
        i === qIndex ? { ...q, ...patch } : q
      );
      return { ...d, questions };
    });
    persist({ ...homework, days });
  }

  function updateResearch(
    dayNum: number,
    rIndex: number,
    patch: Partial<HomeworkResearchTopic>
  ) {
    if (!homework) return;
    const days = homework.days.map((d) => {
      if (d.day !== dayNum) return d;
      const researchTopics = d.researchTopics.map((r, i) =>
        i === rIndex ? { ...r, ...patch } : r
      );
      return { ...d, researchTopics };
    });
    persist({ ...homework, days });
  }

  async function handleDownload(format: "docx" | "pdf") {
    if (!homework) return;
    setIsDownloading(format);
    try {
      if (format === "pdf") {
        const { exportHomeworkToPdf, getHomeworkPdfFileName } = await import(
          "@/lib/export-homework-pdf"
        );
        const blob = await exportHomeworkToPdf(homework);
        saveAs(blob, getHomeworkPdfFileName(homework));
      } else {
        const { exportHomeworkToDocx, getHomeworkDocxFileName } = await import(
          "@/lib/export-homework-docx"
        );
        const blob = await exportHomeworkToDocx(homework);
        saveAs(blob, getHomeworkDocxFileName(homework));
      }
      toast.success("Download started");
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Could not export",
      });
    } finally {
      setIsDownloading(null);
    }
  }

  async function handleSendWhatsApp() {
    if (!homework) return;
    setIsSendingWhatsApp(true);
    try {
      const { exportHomeworkToPdf, getHomeworkPdfFileName } = await import(
        "@/lib/export-homework-pdf"
      );
      const blob = await exportHomeworkToPdf(homework);
      const fileName = getHomeworkPdfFileName(homework);
      const result = await sendPdfToWhatsApp({
        blob,
        fileName,
        caption: `Homework: ${homework.subject} — ${homework.chapter} (${homework.numberOfDays} day(s))`,
      });
      if (result.method === "cancelled") {
        toast.message("WhatsApp share cancelled");
      } else if (result.method === "missing-number") {
        toast.error("Add your WhatsApp number first", {
          description: "Navbar → WhatsApp — then share again.",
        });
      } else if (result.method === "native-share") {
        toast.success("Shared — choose WhatsApp to send");
      } else {
        toast.success(`PDF ready for WhatsApp ${getWhatsAppDisplayNumber()}`, {
          description: "Attach the downloaded PDF in the chat that opened.",
        });
      }
    } catch (err) {
      toast.error("WhatsApp send failed", {
        description: err instanceof Error ? err.message : "Could not prepare PDF",
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  }

  async function handleRegenerate() {
    if (!session?.generateInput || isDisabled) return;
    try {
      const result = await run(async () => {
        const clickId = crypto.randomUUID();
        const response = await fetch("/api/generate-homework", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Click-Id": clickId,
          },
          body: JSON.stringify(session.generateInput),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to regenerate homework");
        }
        return response.json();
      });
      if (!result) return;

      const updated: StoredHomeworkSession = {
        homework: result.homework,
        generateInput: session.generateInput,
        chapterId: result.chapterId,
        teacherReviews: session.teacherReviews ?? [],
      };
      setSession(updated);
      setHomework(result.homework);
      setActiveDay(result.homework.days[0]?.day ?? 1);
      saveHomeworkSession(updated);
      setIsEditing(false);
      toast.success("Homework regenerated");
    } catch (err) {
      toast.error("Regeneration failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  }

  if (!isLoaded) return null;

  if (!session || !homework) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>No homework yet</CardTitle>
            <CardDescription>
              Generate a day-wise homework pack from a knowledge base chapter.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/homework">
                <ArrowLeft />
                Create homework
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const day =
    homework.days.find((d) => d.day === activeDay) ?? homework.days[0];

  return (
    <>
      {isRegenerating && (
        <GeneratingOverlay
          message="Rebuilding homework…"
          submessage="Refreshing day-wise tasks from the knowledge base"
        />
      )}

      <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Button variant="ghost" asChild className="w-fit">
              <Link href="/homework">
                <ArrowLeft />
                New homework
              </Link>
            </Button>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button
                variant={isEditing ? "default" : "outline"}
                onClick={() => {
                  if (isEditing) {
                    persist(homework);
                    toast.success("Changes saved");
                  }
                  setIsEditing((v) => !v);
                }}
                disabled={isRegenerating}
              >
                {isEditing ? <Check /> : <Pencil />}
                {isEditing ? "Done editing" : "Edit"}
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={isDisabled}
              >
                {isRegenerating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                {waitLabel ?? "Regenerate"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("docx")}
                disabled={Boolean(isDownloading) || isSendingWhatsApp || isRegenerating}
              >
                {isDownloading === "docx" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                Word
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("pdf")}
                disabled={Boolean(isDownloading) || isSendingWhatsApp || isRegenerating}
              >
                {isDownloading === "pdf" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                PDF
              </Button>
              <Button
                onClick={handleSendWhatsApp}
                disabled={Boolean(isDownloading) || isSendingWhatsApp || isRegenerating}
              >
                {isSendingWhatsApp ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <MessageCircle />
                )}
                WhatsApp
              </Button>
              {session && (
                <AssignToStudents
                  kind="homework"
                  title={`${homework.subject} · ${homework.chapter}`}
                  chapter={homework.chapter}
                  grade={homework.grade}
                  subject={homework.subject}
                  snapshot={{
                    ...session,
                    homework,
                  }}
                  disabled={isRegenerating}
                />
              )}
            </div>
          </motion.div>

          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {homework.subject} — {homework.chapter}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {homework.grade} · {homework.numberOfDays}-day homework pack
            </p>
            <p className="mt-3 rounded-xl border bg-white px-4 py-3 text-sm">
              <span className="font-medium">Instructions: </span>
              {isEditing ? (
                <textarea
                  value={homework.instructions}
                  onChange={(e) =>
                    persist({ ...homework, instructions: e.target.value })
                  }
                  rows={2}
                  className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm"
                />
              ) : (
                homework.instructions
              )}
            </p>
          </header>

          {homework.days.length > 1 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {homework.days.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setActiveDay(d.day)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                    activeDay === d.day
                      ? "bg-primary text-primary-foreground"
                      : "bg-white border border-border hover:bg-slate-50"
                  )}
                >
                  Day {d.day}
                </button>
              ))}
            </div>
          )}

          {day && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>
                  Day {day.day}:{" "}
                  {isEditing ? (
                    <Input
                      className="mt-2"
                      value={day.title}
                      onChange={(e) =>
                        updateDay(day.day, { title: e.target.value })
                      }
                    />
                  ) : (
                    day.title
                  )}
                </CardTitle>
                <CardDescription>
                  {isEditing ? (
                    <Input
                      className="mt-2"
                      value={day.focus}
                      onChange={(e) =>
                        updateDay(day.day, { focus: e.target.value })
                      }
                      placeholder="Day focus"
                    />
                  ) : (
                    day.focus || "Chapter-aligned homework"
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <textarea
                    value={day.overview}
                    onChange={(e) =>
                      updateDay(day.day, { overview: e.target.value })
                    }
                    rows={2}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                    placeholder="Overview for students"
                  />
                ) : (
                  day.overview && (
                    <p className="text-sm text-muted-foreground">{day.overview}</p>
                  )
                )}

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Questions & practice
                  </h3>
                  <div className="space-y-4">
                    {day.questions.map((q, i) => (
                      <div
                        key={q.id || i}
                        className="rounded-xl border bg-white p-4"
                      >
                        <p className="mb-2 flex flex-wrap items-center gap-2 text-xs font-medium text-primary">
                          <span>{HOMEWORK_TASK_LABELS[q.type] || q.type}</span>
                          <BloomBadge level={q.bloomLevel} />
                        </p>
                        {isEditing ? (
                          <textarea
                            value={q.prompt}
                            onChange={(e) =>
                              updateQuestion(day.day, i, {
                                prompt: e.target.value,
                              })
                            }
                            rows={3}
                            className="w-full rounded-lg border px-2 py-1.5 text-sm"
                          />
                        ) : (
                          <p className="text-sm">
                            {i + 1}. {q.prompt}
                          </p>
                        )}
                        {showTeacherKey && (q.hint || q.suggestedAnswer) && (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-muted-foreground">
                            {q.hint && <p>Hint: {q.hint}</p>}
                            {q.suggestedAnswer && (
                              <p className="mt-1">
                                Suggested answer: {q.suggestedAnswer}
                              </p>
                            )}
                          </div>
                        )}
                        {isEditing && (
                          <div className="mt-2 space-y-2">
                            <Input
                              placeholder="Hint (optional)"
                              value={q.hint || ""}
                              onChange={(e) =>
                                updateQuestion(day.day, i, {
                                  hint: e.target.value,
                                })
                              }
                            />
                            <textarea
                              placeholder="Suggested answer"
                              value={q.suggestedAnswer || ""}
                              onChange={(e) =>
                                updateQuestion(day.day, i, {
                                  suggestedAnswer: e.target.value,
                                })
                              }
                              rows={2}
                              className="w-full rounded-lg border px-2 py-1.5 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    {!day.questions.length && (
                      <p className="text-sm text-muted-foreground">
                        No questions for this day.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Research topics
                  </h3>
                  <div className="space-y-4">
                    {day.researchTopics.map((r, i) => (
                      <div
                        key={r.id || i}
                        className="rounded-xl border border-dashed bg-slate-50/80 p-4"
                      >
                        {isEditing ? (
                          <>
                            <Input
                              className="mb-2"
                              value={r.topic}
                              onChange={(e) =>
                                updateResearch(day.day, i, {
                                  topic: e.target.value,
                                })
                              }
                              placeholder="Research topic"
                            />
                            <textarea
                              value={r.guidance}
                              onChange={(e) =>
                                updateResearch(day.day, i, {
                                  guidance: e.target.value,
                                })
                              }
                              rows={2}
                              className="mb-2 w-full rounded-lg border px-2 py-1.5 text-sm"
                              placeholder="Guidance"
                            />
                            <Input
                              value={(r.suggestedSources || []).join("; ")}
                              onChange={(e) =>
                                updateResearch(day.day, i, {
                                  suggestedSources: e.target.value
                                    .split(";")
                                    .map((s) => s.trim())
                                    .filter(Boolean),
                                })
                              }
                              placeholder="Suggested sources (separate with ;)"
                            />
                          </>
                        ) : (
                          <>
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <BloomBadge level={r.bloomLevel} />
                            </div>
                            <p className="font-medium">
                              {i + 1}. {r.topic}
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {r.guidance}
                            </p>
                            {r.suggestedSources?.length > 0 && (
                              <p className="mt-2 text-xs italic text-slate-500">
                                Sources: {r.suggestedSources.join("; ")}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {!day.researchTopics.length && (
                      <p className="text-sm text-muted-foreground">
                        No research topics for this day.
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTeacherKey((v) => !v)}
                >
                  {showTeacherKey ? "Hide" : "Show"} teacher answer hints
                </Button>
              </CardContent>
            </Card>
          )}

          <TeacherReviewPanel
            title="Teacher review — homework"
            reviews={session.teacherReviews ?? []}
            onChange={handleReviewsChange}
          />
        </div>
      </main>
    </>
  );
}
