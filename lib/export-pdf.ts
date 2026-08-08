import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import type { DayPlan, LessonPlan, TeachingMethodology } from "@/lib/types/lesson-plan";
import { isMultiDayPlan } from "@/lib/types/lesson-plan";

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function bullets(items: string[] | undefined): string {
  if (!items?.length) return "—";
  return items.map((item) => `• ${item}`).join("\n");
}

function modelAnswersBlock(
  items: TeachingMethodology["modelKeyAnswers"] | undefined
): string {
  if (!items?.length) return "";
  return items
    .map(
      (item, i) =>
        `${i + 1}. ${item.question}\nAnswer: ${item.answer}\n${item.explanation}`
    )
    .join("\n\n");
}

function methodologyText(
  methodology: TeachingMethodology,
  isRecap: boolean
): string {
  const parts = [
    `${isRecap ? "Recap / Warm Up" : "Warm Up"}:\n${methodology.warmUp || "—"}`,
    `Concept-Building:\n${methodology.conceptBuilding || "—"}`,
    `Extension:\n${bullets(methodology.extension)}`,
    `Assessment:\n${bullets(methodology.assessment)}`,
  ];
  const answers = modelAnswersBlock(methodology.modelKeyAnswers);
  if (answers) parts.push(`Model Key Answers:\n${answers}`);
  return parts.join("\n\n");
}

function objectivesText(objectives: LessonPlan["objectives"]): string {
  return [
    `Warm Up:\n${objectives.warmUp || "—"}`,
    `Concept-Building:\n${objectives.conceptBuilding || "—"}`,
    `Extension:\n${objectives.extension || "—"}`,
    `Assessment:\n${objectives.assessment || "—"}`,
  ].join("\n\n");
}

function addDaySection(
  doc: JsPdfWithAutoTable,
  plan: LessonPlan,
  concept: string,
  dayPlan: DayPlan | null,
  startY: number,
  dayLabel?: string
): number {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;

  if (dayLabel) {
    if (y > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(dayLabel, margin, y);
    y += 6;
    if (dayPlan?.title || dayPlan?.focus) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text(
        [dayPlan.title, dayPlan.focus].filter(Boolean).join(" — "),
        margin,
        y,
        { maxWidth: pageWidth - margin * 2 }
      );
      y += 8;
    }
  }

  const objectives = dayPlan?.objectives ?? plan.objectives;
  const methodology = dayPlan?.teachingMethodology ?? plan.teachingMethodology;
  const skills = dayPlan?.skillsAndAttitude ?? plan.skillsAndAttitude;
  const competencies = dayPlan?.competencies ?? plan.competencies;
  const note = dayPlan?.noteForFacilitator ?? plan.noteForFacilitator;

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
      valign: "top",
      overflow: "linebreak",
      lineColor: [51, 51, 51],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [232, 234, 246],
      textColor: [30, 30, 30],
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: "auto" },
    },
    body: [
      [
        { content: "Grade / Subject / Chapter", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        `${plan.grade}  ·  ${plan.subject}  ·  ${plan.chapter}`,
      ],
      [
        { content: "Concept / Days", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        `${concept || dayPlan?.focus || "—"}  ·  ${
          dayLabel ? `Day ${dayPlan?.day ?? ""}` : `${plan.numberOfDays} day(s)`
        }`,
      ],
      [
        { content: "Learning Outcomes", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        bullets(plan.learningOutcomes),
      ],
      [
        { content: "Resources Required", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        bullets(plan.resourcesRequired),
      ],
      [
        { content: "Objectives", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        objectivesText(objectives),
      ],
      [
        {
          content: "Teaching Methodology",
          styles: { fontStyle: "bold", fillColor: [232, 234, 246] },
        },
        methodologyText(methodology, Boolean(dayPlan && dayPlan.day > 1)),
      ],
      [
        { content: "Skills & Attitude", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        bullets(skills),
      ],
      [
        { content: "Competencies", styles: { fontStyle: "bold", fillColor: [232, 234, 246] } },
        bullets(competencies),
      ],
      [
        {
          content: "Note for Facilitator",
          styles: { fontStyle: "bold", fillColor: [232, 234, 246] },
        },
        note || "—",
      ],
    ],
  });

  return (doc.lastAutoTable?.finalY ?? y) + 12;
}

export async function exportLessonPlanToPdf(
  plan: LessonPlan,
  concept: string
): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  }) as JsPdfWithAutoTable;

  const margin = 14;
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Lesson Plan", pageWidth / 2, 18, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${plan.subject} — ${plan.chapter} (${plan.numberOfDays} day${
      plan.numberOfDays === "1" ? "" : "s"
    })`,
    pageWidth / 2,
    26,
    { align: "center", maxWidth: pageWidth - margin * 2 }
  );

  let y = 34;

  if (isMultiDayPlan(plan) && plan.days) {
    for (const day of plan.days) {
      y = addDaySection(doc, plan, concept, day, y, `Day ${day.day}`);
    }
  } else {
    addDaySection(doc, plan, concept, null, y);
  }

  return doc.output("blob");
}

export function getPdfFileName(plan: LessonPlan): string {
  const subject = plan.subject || "Lesson";
  const chapter = plan.chapter ? `_${plan.chapter.replace(/\s+/g, "_")}` : "";
  const days = isMultiDayPlan(plan) ? `_${plan.numberOfDays}Days` : "";
  return `${subject}${chapter}${days}_LessonPlan.pdf`;
}
