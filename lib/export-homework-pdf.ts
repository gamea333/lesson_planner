import { jsPDF } from "jspdf";

import type { GeneratedHomework } from "@/lib/types/homework";
import { HOMEWORK_TASK_LABELS } from "@/lib/types/homework";
import { BLOOM_LEVEL_LABELS } from "@/lib/types/blooms-taxonomy";

function ensureSpace(doc: jsPDF, y: number, needed = 24): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + needed > pageHeight - 14) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function exportHomeworkToPdf(
  homework: GeneratedHomework
): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = 18;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Student Homework Pack", pageWidth / 2, y, { align: "center" });
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${homework.grade} · ${homework.subject} · ${homework.chapter}`,
    pageWidth / 2,
    y,
    { align: "center", maxWidth }
  );
  y += 6;
  doc.text(`${homework.numberOfDays}-day homework`, pageWidth / 2, y, {
    align: "center",
  });
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Instructions:", margin, y);
  doc.setFont("helvetica", "normal");
  const instr = doc.splitTextToSize(homework.instructions || "—", maxWidth - 28);
  doc.text(instr, margin + 28, y);
  y += Math.max(8, instr.length * 4.5 + 4);

  homework.days.forEach((day) => {
    y = ensureSpace(doc, y, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(`Day ${day.day}: ${day.title}`, margin, y);
    y += 6;
    if (day.focus) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      const focusLines = doc.splitTextToSize(`Focus: ${day.focus}`, maxWidth);
      doc.text(focusLines, margin, y);
      y += focusLines.length * 4.2 + 2;
    }
    if (day.overview) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const ov = doc.splitTextToSize(day.overview, maxWidth);
      doc.text(ov, margin, y);
      y += ov.length * 4.2 + 3;
    }

    if (day.questions.length) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Questions & Practice", margin, y);
      y += 5;
      day.questions.forEach((q, i) => {
        y = ensureSpace(doc, y, 16);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const bloom =
          q.bloomLevel && BLOOM_LEVEL_LABELS[q.bloomLevel]
            ? ` · Bloom: ${BLOOM_LEVEL_LABELS[q.bloomLevel]}`
            : "";
        doc.text(
          `${i + 1}. [${HOMEWORK_TASK_LABELS[q.type] || q.type}${bloom}]`,
          margin,
          y
        );
        y += 4.5;
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(q.prompt || "—", maxWidth);
        doc.text(lines, margin, y);
        y += lines.length * 4.2 + 3;
      });
    }

    if (day.researchTopics.length) {
      y = ensureSpace(doc, y, 16);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text("Research Topics", margin, y);
      y += 5;
      day.researchTopics.forEach((r, i) => {
        y = ensureSpace(doc, y, 20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        const researchBloom =
          r.bloomLevel && BLOOM_LEVEL_LABELS[r.bloomLevel]
            ? ` [Bloom: ${BLOOM_LEVEL_LABELS[r.bloomLevel]}]`
            : "";
        const topicLines = doc.splitTextToSize(
          `${i + 1}. ${r.topic}${researchBloom}`,
          maxWidth
        );
        doc.text(topicLines, margin, y);
        y += topicLines.length * 4.2 + 1;
        doc.setFont("helvetica", "normal");
        const guide = doc.splitTextToSize(r.guidance || "", maxWidth - 2);
        if (guide.length) {
          doc.text(guide, margin + 2, y);
          y += guide.length * 4 + 2;
        }
        if (r.suggestedSources?.length) {
          doc.setFont("helvetica", "italic");
          const src = doc.splitTextToSize(
            `Sources: ${r.suggestedSources.join("; ")}`,
            maxWidth - 2
          );
          doc.text(src, margin + 2, y);
          y += src.length * 4 + 3;
        }
      });
    }

    y += 4;
  });

  return doc.output("blob");
}

export function getHomeworkPdfFileName(homework: GeneratedHomework): string {
  const chapter = homework.chapter.replace(/\s+/g, "_") || "Chapter";
  return `${homework.subject || "Homework"}_${chapter}_${homework.numberOfDays}Day_Homework.pdf`;
}
