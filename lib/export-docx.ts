import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import type { DayPlan, LessonPlan, TeachingMethodology } from "@/lib/types/lesson-plan";
import { isMultiDayPlan } from "@/lib/types/lesson-plan";

const border = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "333333",
};

const cellBorders = {
  top: border,
  bottom: border,
  left: border,
  right: border,
};

function headerCell(text: string, widthPct?: number): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: { fill: "E8EAF6" },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, size: 20 })],
      }),
    ],
  });
}

function bodyCell(content: string | Paragraph[], widthPct?: number): TableCell {
  const children =
    typeof content === "string"
      ? [new Paragraph({ children: [new TextRun({ text: content, size: 20 })] })]
      : content;

  return new TableCell({
    borders: cellBorders,
    width: widthPct ? { size: widthPct, type: WidthType.PERCENTAGE } : undefined,
    children,
  });
}

function bulletParagraphs(items: string[]): Paragraph[] {
  return (items ?? []).map(
    (item) =>
      new Paragraph({
        children: [new TextRun({ text: `• ${item}`, size: 20 })],
        spacing: { after: 80 },
      })
  );
}

function labeledParagraph(label: string, text: string): Paragraph[] {
  return [
    new Paragraph({
      children: [new TextRun({ text: label, bold: true, size: 20 })],
      spacing: { after: 60 },
    }),
    new Paragraph({
      children: [new TextRun({ text: text || "—", size: 20 })],
      spacing: { after: 160 },
    }),
  ];
}

function modelAnswerParagraphs(
  items: TeachingMethodology["modelKeyAnswers"]
): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: "Model Key Answers", bold: true, size: 20 })],
      spacing: { after: 100 },
    }),
  ];

  (items ?? []).forEach((item, i) => {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${i + 1}. ${item.question}`, bold: true, size: 20 }),
        ],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: `Answer: ${item.answer}`, size: 20 })],
        spacing: { after: 60 },
      }),
      new Paragraph({
        children: [new TextRun({ text: item.explanation, size: 20, italics: true })],
        spacing: { after: 160 },
      })
    );
  });

  return paragraphs;
}

function buildDayTable(
  plan: LessonPlan,
  concept: string,
  dayPlan: DayPlan | null,
  dayLabel?: string
): (Paragraph | Table)[] {
  const objectives = dayPlan?.objectives ?? plan.objectives;
  const methodology = dayPlan?.teachingMethodology ?? plan.teachingMethodology;
  const skills = dayPlan?.skillsAndAttitude ?? plan.skillsAndAttitude;
  const competencies = dayPlan?.competencies ?? plan.competencies;
  const note = dayPlan?.noteForFacilitator ?? plan.noteForFacilitator;

  const methodologyContent: Paragraph[] = [
    ...labeledParagraph(
      dayPlan && dayPlan.day > 1 ? "Recap / Warm Up" : "Warm Up",
      methodology.warmUp
    ),
    ...labeledParagraph("Concept-Building", methodology.conceptBuilding),
    new Paragraph({
      children: [new TextRun({ text: "Extension", bold: true, size: 20 })],
      spacing: { after: 60 },
    }),
    ...bulletParagraphs(methodology.extension),
    new Paragraph({
      children: [new TextRun({ text: "Assessment", bold: true, size: 20 })],
      spacing: { before: 120, after: 60 },
    }),
    ...bulletParagraphs(methodology.assessment),
    ...modelAnswerParagraphs(methodology.modelKeyAnswers),
  ];

  const objectivesContent: Paragraph[] = [
    ...labeledParagraph("Warm Up", objectives.warmUp),
    ...labeledParagraph("Concept-Building", objectives.conceptBuilding),
    ...labeledParagraph("Extension", objectives.extension),
    ...labeledParagraph("Assessment", objectives.assessment),
  ];

  const children: (Paragraph | Table)[] = [];

  if (dayLabel) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: dayLabel, bold: true, size: 28 })],
        spacing: { before: 200, after: 80 },
      })
    );
    if (dayPlan?.title || dayPlan?.focus) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: [dayPlan.title, dayPlan.focus].filter(Boolean).join(" — "),
              size: 20,
              italics: true,
            }),
          ],
          spacing: { after: 160 },
        })
      );
    }
  }

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            headerCell("Grade", 20),
            headerCell("Subject", 20),
            headerCell("Chapter", 20),
            headerCell("Concept", 20),
            headerCell("Days", 20),
          ],
        }),
        new TableRow({
          children: [
            bodyCell(plan.grade, 20),
            bodyCell(plan.subject, 20),
            bodyCell(plan.chapter, 20),
            bodyCell(concept || dayPlan?.focus || "", 20),
            bodyCell(dayLabel ? String(dayPlan?.day ?? "") : plan.numberOfDays, 20),
          ],
        }),
        new TableRow({
          children: [
            headerCell("Learning Outcomes", 20),
            bodyCell(bulletParagraphs(plan.learningOutcomes), 80),
          ],
        }),
        new TableRow({
          children: [
            headerCell("Resources Required", 20),
            bodyCell(bulletParagraphs(plan.resourcesRequired), 80),
          ],
        }),
        new TableRow({
          children: [
            headerCell("Objectives", 25),
            headerCell("Teaching Methodology", 45),
            headerCell("Skills & Attitude", 15),
            headerCell("Competencies", 15),
          ],
        }),
        new TableRow({
          children: [
            bodyCell(objectivesContent, 25),
            bodyCell(methodologyContent, 45),
            bodyCell(bulletParagraphs(skills), 15),
            bodyCell(bulletParagraphs(competencies), 15),
          ],
        }),
        new TableRow({
          children: [
            headerCell("Note for Facilitator", 20),
            bodyCell(note || "—", 80),
          ],
        }),
      ],
    })
  );

  return children;
}

export async function exportLessonPlanToDocx(
  plan: LessonPlan,
  concept: string
): Promise<Blob> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      children: [new TextRun({ text: "Lesson Plan", bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${plan.subject} — ${plan.chapter} (${plan.numberOfDays} day${plan.numberOfDays === "1" ? "" : "s"})`,
          size: 22,
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 300 },
    }),
  ];

  if (isMultiDayPlan(plan) && plan.days) {
    for (const day of plan.days) {
      children.push(
        ...buildDayTable(plan, concept, day, `Day ${day.day}`)
      );
    }
  } else {
    children.push(...buildDayTable(plan, concept, null));
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBlob(doc);
}

export function getDocxFileName(plan: LessonPlan): string {
  const subject = plan.subject || "Lesson";
  const chapter = plan.chapter ? `_${plan.chapter.replace(/\s+/g, "_")}` : "";
  const days =
    isMultiDayPlan(plan) ? `_${plan.numberOfDays}Days` : "";
  return `${subject}${chapter}${days}_LessonPlan.docx`;
}
