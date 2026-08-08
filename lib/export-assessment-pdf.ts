import { jsPDF } from "jspdf";

import type { GeneratedAssessment } from "@/lib/types/assessment";
import { QUESTION_TYPE_LABELS } from "@/lib/types/assessment";
import { BLOOM_LEVEL_LABELS } from "@/lib/types/blooms-taxonomy";

function ensureSpace(doc: jsPDF, y: number, needed = 24): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 14) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function exportAssessmentToPdf(
  assessment: GeneratedAssessment
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Practice Sheet", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${assessment.grade} · ${assessment.subject} · ${assessment.chapter}`,
    pageWidth / 2,
    y,
    { align: "center", maxWidth }
  );
  y += 8;

  doc.setFontSize(9);
  doc.text(`Total Questions: ${assessment.questions.length}`, margin, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Instructions:", margin, y);
  doc.setFont("helvetica", "normal");
  const instructionLines = doc.splitTextToSize(
    assessment.instructions || "—",
    maxWidth - 28
  );
  doc.text(instructionLines, margin + 28, y);
  y += Math.max(8, instructionLines.length * 4.5 + 4);

  assessment.questions.forEach((q, i) => {
    y = ensureSpace(doc, y, 30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const bloom =
      q.bloomLevel && BLOOM_LEVEL_LABELS[q.bloomLevel]
        ? BLOOM_LEVEL_LABELS[q.bloomLevel]
        : null;
    const header = bloom
      ? `${i + 1}. [${QUESTION_TYPE_LABELS[q.type]} · ${q.difficulty} · Bloom: ${bloom}]`
      : `${i + 1}. [${QUESTION_TYPE_LABELS[q.type]} · ${q.difficulty}]`;
    doc.text(header, margin, y);
    y += 5;

    doc.setFont("helvetica", "normal");
    const qLines = doc.splitTextToSize(q.questionText || "—", maxWidth);
    doc.text(qLines, margin, y);
    y += qLines.length * 4.5 + 2;

    if (q.options?.length) {
      q.options.forEach((opt, oi) => {
        y = ensureSpace(doc, y, 10);
        const letter = String.fromCharCode(65 + oi);
        const optLines = doc.splitTextToSize(
          `${letter}. ${opt}`,
          maxWidth - 6
        );
        doc.text(optLines, margin + 4, y);
        y += optLines.length * 4.2 + 1;
      });
    } else if (q.type === "fill_blank") {
      y = ensureSpace(doc, y, 8);
      doc.text("________________________", margin + 4, y);
      y += 6;
    } else {
      y = ensureSpace(doc, y, 8);
      doc.text("Answer: ________________________", margin + 4, y);
      y += 6;
    }
    y += 3;
  });

  doc.addPage();
  y = 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Answer Key", pageWidth / 2, y, { align: "center" });
  y += 10;

  assessment.questions.forEach((q, i) => {
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const answerLines = doc.splitTextToSize(
      `${i + 1}. ${q.correctAnswer || "—"}`,
      maxWidth
    );
    doc.text(answerLines, margin, y);
    y += answerLines.length * 4.2 + 1;

    doc.setFont("helvetica", "italic");
    const explLines = doc.splitTextToSize(q.explanation || "", maxWidth - 4);
    if (explLines.length) {
      doc.text(explLines, margin + 4, y);
      y += explLines.length * 4 + 4;
    } else {
      y += 4;
    }
  });

  return doc.output("blob");
}

export function getAssessmentPdfFileName(assessment: GeneratedAssessment): string {
  const chapter = assessment.chapter.replace(/\s+/g, "_") || "Chapter";
  return `${assessment.subject || "PracticeSheet"}_${chapter}_PracticeSheet.pdf`;
}
