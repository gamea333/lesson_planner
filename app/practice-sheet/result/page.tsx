"use client";

import { saveAs } from "file-saver";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
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
  loadAssessmentSession,
  saveAssessmentSession,
  type StoredAssessmentSession,
} from "@/lib/session";
import type { AssessmentQuestion, GeneratedAssessment } from "@/lib/types/assessment";
import { QUESTION_TYPE_LABELS } from "@/lib/types/assessment";
import type { TeacherReview } from "@/lib/types/teacher-review";
import { cn } from "@/lib/utils";
import {
  getWhatsAppDisplayNumber,
  sendPdfToWhatsApp,
} from "@/lib/whatsapp";

export default function PracticeSheetResultPage() {
  const [session, setSession] = useState<StoredAssessmentSession | null>(null);
  const [assessment, setAssessment] = useState<GeneratedAssessment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);
  const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const { run, isLoading: isRegenerating, isDisabled, waitLabel } = useCooldownAction({
    actionLabel: "regenerate-practice-sheet",
  });

  useEffect(() => {
    const stored = loadAssessmentSession();
    if (stored) {
      setSession(stored);
      setAssessment(stored.assessment);
    }
    setIsLoaded(true);
  }, []);

  function persist(next: GeneratedAssessment) {
    if (!session) return;
    const updated = { ...session, assessment: next };
    setSession(updated);
    setAssessment(next);
    saveAssessmentSession(updated);
  }

  function handleReviewsChange(reviews: TeacherReview[]) {
    if (!session || !assessment) return;
    const updated: StoredAssessmentSession = {
      ...session,
      assessment,
      teacherReviews: reviews,
    };
    setSession(updated);
    saveAssessmentSession(updated);
  }

  function updateQuestion(index: number, patch: Partial<AssessmentQuestion>) {
    if (!assessment) return;
    const questions = assessment.questions.map((q, i) =>
      i === index ? { ...q, ...patch } : q
    );
    persist({ ...assessment, questions });
  }

  function updateOption(qIndex: number, oIndex: number, value: string) {
    if (!assessment) return;
    const questions = assessment.questions.map((q, i) => {
      if (i !== qIndex) return q;
      const options = [...(q.options ?? [])];
      options[oIndex] = value;
      return { ...q, options };
    });
    persist({ ...assessment, questions });
  }

  async function handleDownload(format: "docx" | "pdf") {
    if (!assessment) return;
    setIsDownloading(format);
    try {
      if (format === "pdf") {
        const { exportAssessmentToPdf, getAssessmentPdfFileName } = await import(
          "@/lib/export-assessment-pdf"
        );
        const blob = await exportAssessmentToPdf(assessment);
        saveAs(blob, getAssessmentPdfFileName(assessment));
      } else {
        const { exportAssessmentToDocx, getAssessmentDocxFileName } =
          await import("@/lib/export-assessment-docx");
        const blob = await exportAssessmentToDocx(assessment);
        saveAs(blob, getAssessmentDocxFileName(assessment));
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
    if (!assessment) return;
    setIsSendingWhatsApp(true);
    try {
      const { exportAssessmentToPdf, getAssessmentPdfFileName } = await import(
        "@/lib/export-assessment-pdf"
      );
      const blob = await exportAssessmentToPdf(assessment);
      const fileName = getAssessmentPdfFileName(assessment);
      const result = await sendPdfToWhatsApp({
        blob,
        fileName,
        caption: `Practice sheet: ${assessment.subject} — ${assessment.chapter} (${assessment.grade}) · ${assessment.questions.length} questions`,
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
        console.log(
          `[PracticeSheet] regenerate (clickId: ${clickId}, chapterId: ${session.chapterId})`
        );
        const response = await fetch("/api/generate-assessment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Click-Id": clickId,
          },
          body: JSON.stringify(session.generateInput),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to regenerate practice sheet");
        }
        return response.json();
      });

      if (!result) return;

      const updated: StoredAssessmentSession = {
        assessment: result.assessment,
        generateInput: session.generateInput,
        chapterId: result.chapterId,
        teacherReviews: session.teacherReviews ?? [],
      };
      setSession(updated);
      setAssessment(result.assessment);
      saveAssessmentSession(updated);
      setIsEditing(false);
      toast.success("Practice sheet regenerated");
    } catch (err) {
      toast.error("Regeneration failed", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    }
  }

  if (!isLoaded) return null;

  if (!session || !assessment) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>No practice sheet yet</CardTitle>
            <CardDescription>
              Select a chapter and generate a practice sheet first.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/practice-sheet">
                <ArrowLeft />
                Back to Practice Sheet
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      {isRegenerating && (
        <GeneratingOverlay
          message="Building your practice sheet…"
          submessage="Regenerating from the same chapter and options"
        />
      )}

      <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Button variant="ghost" asChild className="w-fit">
              <Link href="/practice-sheet">
                <ArrowLeft />
                New practice sheet
              </Link>
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant={isEditing ? "default" : "outline"}
                onClick={() => {
                  if (isEditing) {
                    persist(assessment);
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
                Download Word
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
                Download PDF
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
                Send to WhatsApp
              </Button>
              {session && (
                <AssignToStudents
                  kind="practice_sheet"
                  title={`${assessment.subject} · ${assessment.chapter}`}
                  chapter={assessment.chapter}
                  grade={assessment.grade}
                  subject={assessment.subject}
                  snapshot={{
                    ...session,
                    assessment,
                  }}
                  disabled={isRegenerating}
                />
              )}
            </div>
          </motion.div>

          <header className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight">
              {assessment.subject} — {assessment.chapter}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {assessment.grade} · {assessment.questions.length} questions
            </p>
            <p className="mt-3 rounded-xl border bg-white px-4 py-3 text-sm">
              <span className="font-medium">Instructions: </span>
              {isEditing ? (
                <textarea
                  value={assessment.instructions}
                  onChange={(e) =>
                    persist({ ...assessment, instructions: e.target.value })
                  }
                  rows={2}
                  className="mt-2 w-full rounded-lg border px-2 py-1.5 text-sm"
                />
              ) : (
                assessment.instructions
              )}
            </p>
          </header>

          <div className="space-y-4">
            {assessment.questions.map((q, i) => (
              <Card key={q.id || i}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-primary">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5">
                      Q{i + 1}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 capitalize text-slate-600">
                      {q.difficulty}
                    </span>
                    <BloomBadge level={q.bloomLevel} />
                  </div>

                  {isEditing ? (
                    <textarea
                      value={q.questionText}
                      onChange={(e) =>
                        updateQuestion(i, { questionText: e.target.value })
                      }
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium leading-relaxed">{q.questionText}</p>
                  )}

                  {q.options?.length ? (
                    <div className="space-y-2">
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-start gap-2 text-sm">
                          <span className="mt-0.5 font-medium text-muted-foreground">
                            {String.fromCharCode(65 + oi)}.
                          </span>
                          {isEditing ? (
                            <Input
                              value={opt}
                              onChange={(e) => updateOption(i, oi, e.target.value)}
                            />
                          ) : (
                            <span>{opt}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={() => setShowAnswers((v) => !v)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border bg-white px-4 py-3 text-left text-sm font-semibold shadow-soft"
              )}
            >
              {showAnswers ? "Hide Answers" : "Show Answers"}
              {showAnswers ? <ChevronUp /> : <ChevronDown />}
            </button>

            {showAnswers && (
              <Card className="mt-3">
                <CardHeader>
                  <CardTitle className="text-base">Answer Key</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {assessment.questions.map((q, i) => (
                    <div key={q.id || i} className="border-b pb-3 last:border-0">
                      <p className="text-sm font-medium">
                        {i + 1}.{" "}
                        {isEditing ? (
                          <Input
                            className="mt-1"
                            value={q.correctAnswer}
                            onChange={(e) =>
                              updateQuestion(i, { correctAnswer: e.target.value })
                            }
                          />
                        ) : (
                          q.correctAnswer
                        )}
                      </p>
                      {isEditing ? (
                        <textarea
                          value={q.explanation}
                          onChange={(e) =>
                            updateQuestion(i, { explanation: e.target.value })
                          }
                          rows={2}
                          className="mt-2 w-full rounded-lg border px-2 py-1.5 text-xs"
                          placeholder="Explanation"
                        />
                      ) : (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="mt-6">
            <TeacherReviewPanel
              title="Teacher review — practice sheet"
              reviews={session.teacherReviews ?? []}
              onChange={handleReviewsChange}
            />
          </div>
        </div>
      </main>
    </>
  );
}
