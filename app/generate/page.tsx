"use client";

import { saveAs } from "file-saver";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Download,
  Loader2,
  Pencil,
  RefreshCw,
  Check,
  MessageCircle,
  BookMarked,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { GeneratingOverlay } from "@/components/generating-overlay";
import { LessonPlanViewer } from "@/components/lesson-plan-viewer";
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
import { useGenerateAction } from "@/hooks/use-generate-action";
import {
  loadLessonPlanSession,
  saveLessonPlanSession,
  type StoredLessonPlanSession,
} from "@/lib/session";
import type { LessonPlan } from "@/lib/types/lesson-plan";
import { getDayCount } from "@/lib/types/lesson-plan";
import type { TeacherReview } from "@/lib/types/teacher-review";
import {
  getWhatsAppDisplayNumber,
  sendPdfToWhatsApp,
} from "@/lib/whatsapp";

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: "easeOut" as const },
};

export default function GeneratePage() {
  const regenerateGuardRef = useRef(false);
  const [session, setSession] = useState<StoredLessonPlanSession | null>(null);
  const [lessonPlan, setLessonPlan] = useState<LessonPlan | null>(null);
  const [concept, setConcept] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isDownloading, setIsDownloading] = useState<"docx" | "pdf" | null>(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const {
    invokeGenerate,
    isLoading: isRegenerating,
    isDisabled: regenerateDisabled,
    waitLabel: regenerateWaitLabel,
  } = useGenerateAction({ action: "regenerate" });

  // Session load only — never calls /api/generate
  useEffect(() => {
    const stored = loadLessonPlanSession();
    if (stored) {
      setSession(stored);
      setLessonPlan(stored.lessonPlan);
      setConcept(stored.concept ?? "");
    }
    setIsLoaded(true);
  }, []);

  const persistSession = useCallback(
    (plan: LessonPlan, conceptValue: string, base?: StoredLessonPlanSession | null) => {
      const current = base ?? session;
      if (!current) return;

      const updated: StoredLessonPlanSession = {
        ...current,
        lessonPlan: plan,
        concept: conceptValue,
      };
      setSession(updated);
      saveLessonPlanSession(updated);
    },
    [session]
  );

  function handlePlanChange(plan: LessonPlan) {
    setLessonPlan(plan);
    persistSession(plan, concept);
  }

  function handleConceptChange(value: string) {
    setConcept(value);
    if (lessonPlan) persistSession(lessonPlan, value);
  }

  function handleReviewsChange(reviews: TeacherReview[]) {
    if (!session || !lessonPlan) return;
    const updated: StoredLessonPlanSession = {
      ...session,
      lessonPlan,
      concept,
      teacherReviews: reviews,
    };
    setSession(updated);
    saveLessonPlanSession(updated);
  }

  function toggleEdit() {
    if (isEditing && lessonPlan) {
      persistSession(lessonPlan, concept);
      toast.success("Changes saved", {
        description: "Your edits have been saved locally.",
      });
    }
    setIsEditing((prev) => !prev);
  }

  async function handleDownload(format: "docx" | "pdf") {
    if (!lessonPlan) return;

    setIsDownloading(format);

    try {
      if (format === "pdf") {
        const { exportLessonPlanToPdf, getPdfFileName } = await import(
          "@/lib/export-pdf"
        );
        const blob = await exportLessonPlanToPdf(lessonPlan, concept);
        saveAs(blob, getPdfFileName(lessonPlan));
        toast.success("Download started", {
          description: "Your PDF is being saved.",
        });
      } else {
        const { exportLessonPlanToDocx, getDocxFileName } = await import(
          "@/lib/export-docx"
        );
        const blob = await exportLessonPlanToDocx(lessonPlan, concept);
        saveAs(blob, getDocxFileName(lessonPlan));
        toast.success("Download started", {
          description: "Your Word document is being saved.",
        });
      }
    } catch (err) {
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Failed to export document",
      });
    } finally {
      setIsDownloading(null);
    }
  }

  async function handleSendWhatsApp() {
    if (!lessonPlan) return;
    setIsSendingWhatsApp(true);
    try {
      const { exportLessonPlanToPdf, getPdfFileName } = await import(
        "@/lib/export-pdf"
      );
      const blob = await exportLessonPlanToPdf(lessonPlan, concept);
      const fileName = getPdfFileName(lessonPlan);
      const result = await sendPdfToWhatsApp({
        blob,
        fileName,
        caption: `Lesson plan: ${lessonPlan.subject} — ${lessonPlan.chapter} (${lessonPlan.grade})`,
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
    if (!session?.generateInput || regenerateGuardRef.current || regenerateDisabled) {
      return;
    }

    regenerateGuardRef.current = true;
    setIsEditing(false);

    try {
      const result = await invokeGenerate(session.generateInput);
      if (!result) return;

      const updated: StoredLessonPlanSession = {
        lessonPlan: result.lessonPlan,
        metadata: result.metadata,
        generateInput: session.generateInput,
        chapterId: result.chapterId,
        concept: concept || session.concept || "",
        teacherReviews: session.teacherReviews ?? [],
      };

      setSession(updated);
      setLessonPlan(result.lessonPlan);
      saveLessonPlanSession(updated);
      toast.success("Lesson plan regenerated", {
        description: "A fresh plan has been created from your knowledge base chapter.",
      });
    } catch (err) {
      toast.error("Regeneration failed", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      regenerateGuardRef.current = false;
    }
  }

  if (!isLoaded) {
    return null;
  }

  if (!session || !lessonPlan) {
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <motion.div {...fadeIn} className="w-full max-w-md">
          <Card className="text-center">
            <CardHeader>
              <CardTitle>No lesson plan yet</CardTitle>
              <CardDescription>
                Select a chapter from your knowledge base to generate a lesson plan.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/">
                  <ArrowLeft />
                  Back to Create
                </Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    );
  }

  return (
    <>
      {isRegenerating && (
        <GeneratingOverlay
          message="Building your lesson plan…"
          submessage="Regenerating from your knowledge base chapter"
        />
      )}

      <main className="flex-1 bg-gradient-to-b from-white to-slate-50/80">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <Button variant="ghost" asChild className="w-fit">
              <Link href="/">
                <ArrowLeft />
                New lesson plan
              </Link>
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button
                variant={isEditing ? "default" : "outline"}
                onClick={toggleEdit}
                disabled={isRegenerating}
                className="w-full sm:w-auto"
              >
                {isEditing ? <Check /> : <Pencil />}
                {isEditing ? "Done editing" : "Edit"}
              </Button>
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={regenerateDisabled || !session.generateInput}
                className="w-full sm:w-auto"
              >
                {isRegenerating ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <RefreshCw />
                )}
                {regenerateWaitLabel ?? "Regenerate"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownload("docx")}
                disabled={Boolean(isDownloading) || isSendingWhatsApp || isRegenerating}
                className="w-full sm:w-auto"
              >
                {isDownloading === "docx" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                Download Word
              </Button>
              <Button
                onClick={() => handleDownload("pdf")}
                disabled={Boolean(isDownloading) || isSendingWhatsApp || isRegenerating}
                className="w-full sm:w-auto"
              >
                {isDownloading === "pdf" ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                Download PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleSendWhatsApp}
                disabled={Boolean(isDownloading) || isSendingWhatsApp || isRegenerating}
                className="w-full sm:w-auto"
              >
                {isSendingWhatsApp ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <MessageCircle />
                )}
                Send to WhatsApp
              </Button>
              <Button variant="outline" asChild className="w-full sm:w-auto">
                <Link
                  href={`/homework?fromLesson=1&chapterId=${session.chapterId}&days=${getDayCount(lessonPlan)}`}
                >
                  <BookMarked />
                  Create homework
                </Link>
              </Button>
              <AssignToStudents
                kind="lesson_plan"
                title={`${session.metadata.subject} · ${session.metadata.chapter}`}
                chapter={session.metadata.chapter}
                grade={session.metadata.grade}
                subject={session.metadata.subject}
                snapshot={{
                  ...session,
                  lessonPlan,
                  concept,
                }}
                disabled={isRegenerating}
              />
            </div>
          </motion.div>

          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="mb-6"
          >
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {lessonPlan.subject || session.metadata.subject || "Lesson Plan"}
              {(lessonPlan.chapter || session.metadata.chapter) &&
                ` — ${lessonPlan.chapter || session.metadata.chapter}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {lessonPlan.days && lessonPlan.days.length > 1
                ? `${lessonPlan.days.length}-day plan — switch days below.`
                : isEditing
                  ? "Click any section below to edit the AI-generated content."
                  : "Read-only preview — click Edit to make changes before downloading."}
            </p>
          </motion.header>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <LessonPlanViewer
              plan={lessonPlan}
              concept={concept}
              isEditing={isEditing}
              onPlanChange={handlePlanChange}
              onConceptChange={handleConceptChange}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="mt-6"
          >
            <TeacherReviewPanel
              title="Teacher review — lesson plan"
              reviews={session.teacherReviews ?? []}
              onChange={handleReviewsChange}
            />
          </motion.div>
        </div>
      </main>
    </>
  );
}
