import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

import type { GeneratedHomework } from "@/lib/types/homework";
import { HOMEWORK_TASK_LABELS } from "@/lib/types/homework";
import { BLOOM_LEVEL_LABELS } from "@/lib/types/blooms-taxonomy";

export async function exportHomeworkToDocx(
  homework: GeneratedHomework
): Promise<Blob> {
  const children: Paragraph[] = [
    new Paragraph({
      children: [
        new TextRun({ text: "Student Homework Pack", bold: true, size: 36 }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${homework.grade} · ${homework.subject} · ${homework.chapter}`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${homework.numberOfDays}-day homework`,
          size: 20,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Instructions: ", bold: true, size: 20 }),
        new TextRun({ text: homework.instructions, size: 20 }),
      ],
      spacing: { after: 300 },
    }),
  ];

  homework.days.forEach((day) => {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Day ${day.day}: ${day.title}`,
            bold: true,
            size: 28,
          }),
        ],
        spacing: { before: 280, after: 100 },
      })
    );
    if (day.focus) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Focus: ${day.focus}`,
              italics: true,
              size: 20,
            }),
          ],
          spacing: { after: 80 },
        })
      );
    }
    if (day.overview) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: day.overview, size: 20 })],
          spacing: { after: 160 },
        })
      );
    }

    if (day.questions.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Questions & Practice", bold: true, size: 22 }),
          ],
          spacing: { before: 120, after: 100 },
        })
      );
      day.questions.forEach((q, i) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${i + 1}. [${HOMEWORK_TASK_LABELS[q.type] || q.type}${
                  q.bloomLevel && BLOOM_LEVEL_LABELS[q.bloomLevel]
                    ? ` · Bloom: ${BLOOM_LEVEL_LABELS[q.bloomLevel]}`
                    : ""
                }] `,
                bold: true,
                size: 20,
              }),
              new TextRun({ text: q.prompt, size: 20 }),
            ],
            spacing: { after: 100 },
          })
        );
      });
    }

    if (day.researchTopics.length) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: "Research Topics", bold: true, size: 22 }),
          ],
          spacing: { before: 160, after: 100 },
        })
      );
      day.researchTopics.forEach((r, i) => {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${i + 1}. ${r.topic}${
                  r.bloomLevel && BLOOM_LEVEL_LABELS[r.bloomLevel]
                    ? ` [Bloom: ${BLOOM_LEVEL_LABELS[r.bloomLevel]}]`
                    : ""
                }`,
                bold: true,
                size: 20,
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: r.guidance, size: 20 })],
            spacing: { after: 60 },
          })
        );
        if (r.suggestedSources?.length) {
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `Sources: ${r.suggestedSources.join("; ")}`,
                  italics: true,
                  size: 18,
                }),
              ],
              spacing: { after: 120 },
            })
          );
        }
      });
    }
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  return Packer.toBlob(doc);
}

export function getHomeworkDocxFileName(homework: GeneratedHomework): string {
  const chapter = homework.chapter.replace(/\s+/g, "_") || "Chapter";
  return `${homework.subject || "Homework"}_${chapter}_${homework.numberOfDays}Day_Homework.docx`;
}
