import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  PageBreak,
} from "docx";

import type { GeneratedAssessment } from "@/lib/types/assessment";
import { QUESTION_TYPE_LABELS } from "@/lib/types/assessment";
import { BLOOM_LEVEL_LABELS } from "@/lib/types/blooms-taxonomy";

function questionParagraphs(assessment: GeneratedAssessment): Paragraph[] {
  const paras: Paragraph[] = [];

  assessment.questions.forEach((q, i) => {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${i + 1}. [${QUESTION_TYPE_LABELS[q.type]} · ${q.difficulty}${
              q.bloomLevel && BLOOM_LEVEL_LABELS[q.bloomLevel]
                ? ` · Bloom: ${BLOOM_LEVEL_LABELS[q.bloomLevel]}`
                : ""
            }] `,
            bold: true,
            size: 22,
          }),
          new TextRun({ text: q.questionText, size: 22 }),
        ],
        spacing: { before: 200, after: 100 },
      })
    );

    if (q.options?.length) {
      q.options.forEach((opt, oi) => {
        const letter = String.fromCharCode(65 + oi);
        paras.push(
          new Paragraph({
            children: [new TextRun({ text: `   ${letter}. ${opt}`, size: 20 })],
            spacing: { after: 40 },
          })
        );
      });
    } else if (q.type === "fill_blank") {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: "   ________________________", size: 20 })],
          spacing: { after: 80 },
        })
      );
    } else {
      paras.push(
        new Paragraph({
          children: [new TextRun({ text: "   Answer: ________________________", size: 20 })],
          spacing: { after: 80 },
        })
      );
    }
  });

  return paras;
}

function answerKeyParagraphs(assessment: GeneratedAssessment): Paragraph[] {
  const paras: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Answer Key", bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ];

  assessment.questions.forEach((q, i) => {
    paras.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 20 }),
          new TextRun({ text: q.correctAnswer, size: 20 }),
        ],
        spacing: { after: 40 },
      }),
      new Paragraph({
        children: [
          new TextRun({ text: `   ${q.explanation}`, size: 18, italics: true }),
        ],
        spacing: { after: 120 },
      })
    );
  });

  return paras;
}

export async function exportAssessmentToDocx(
  assessment: GeneratedAssessment
): Promise<Blob> {
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({ text: "Practice Sheet", bold: true, size: 36 }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `${assessment.grade} · ${assessment.subject} · ${assessment.chapter}`,
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Total Questions: ${assessment.questions.length}`,
                size: 20,
              }),
            ],
            spacing: { after: 160 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Instructions: ", bold: true, size: 20 }),
              new TextRun({ text: assessment.instructions, size: 20 }),
            ],
            spacing: { after: 300 },
          }),
          ...questionParagraphs(assessment),
          new Paragraph({ children: [new PageBreak()] }),
          ...answerKeyParagraphs(assessment),
        ],
      },
    ],
  });

  return Packer.toBlob(doc);
}

export function getAssessmentDocxFileName(assessment: GeneratedAssessment): string {
  const chapter = assessment.chapter.replace(/\s+/g, "_") || "Chapter";
  return `${assessment.subject || "PracticeSheet"}_${chapter}_PracticeSheet.docx`;
}
