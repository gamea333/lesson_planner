"use client";

import { useState } from "react";

import { LessonPlanDocument } from "@/components/lesson-plan-document";
import { cn } from "@/lib/utils";
import type { DayPlan, LessonPlan } from "@/lib/types/lesson-plan";
import { isMultiDayPlan } from "@/lib/types/lesson-plan";

interface LessonPlanViewerProps {
  plan: LessonPlan;
  concept: string;
  isEditing: boolean;
  onPlanChange: (plan: LessonPlan) => void;
  onConceptChange: (concept: string) => void;
}

function projectDayOntoPlan(plan: LessonPlan, day: DayPlan): LessonPlan {
  return {
    ...plan,
    numberOfDays: String(day.day),
    objectives: day.objectives,
    teachingMethodology: day.teachingMethodology,
    skillsAndAttitude: day.skillsAndAttitude ?? plan.skillsAndAttitude,
    competencies: day.competencies ?? plan.competencies,
    noteForFacilitator: day.noteForFacilitator ?? plan.noteForFacilitator,
  };
}

function mergeDayIntoPlan(
  plan: LessonPlan,
  dayIndex: number,
  projected: LessonPlan
): LessonPlan {
  if (!plan.days) return projected;

  const days = plan.days.map((d, i) =>
    i === dayIndex
      ? {
          ...d,
          objectives: projected.objectives,
          teachingMethodology: projected.teachingMethodology,
          skillsAndAttitude: projected.skillsAndAttitude,
          competencies: projected.competencies,
          noteForFacilitator: projected.noteForFacilitator,
        }
      : d
  );

  const updated: LessonPlan = {
    ...plan,
    grade: projected.grade,
    subject: projected.subject,
    chapter: projected.chapter,
    learningOutcomes: projected.learningOutcomes,
    resourcesRequired: projected.resourcesRequired,
    skillsAndAttitude: projected.skillsAndAttitude,
    competencies: projected.competencies,
    noteForFacilitator:
      dayIndex === 0
        ? projected.noteForFacilitator
        : plan.noteForFacilitator,
    days,
  };

  // Keep flat Day-1 mirror for compatibility
  if (days[0]) {
    updated.objectives = days[0].objectives;
    updated.teachingMethodology = days[0].teachingMethodology;
  }

  return updated;
}

export function LessonPlanViewer({
  plan,
  concept,
  isEditing,
  onPlanChange,
  onConceptChange,
}: LessonPlanViewerProps) {
  const multiDay = isMultiDayPlan(plan);
  const [activeDay, setActiveDay] = useState(0);

  if (!multiDay || !plan.days) {
    return (
      <LessonPlanDocument
        plan={plan}
        concept={concept}
        isEditing={isEditing}
        onPlanChange={onPlanChange}
        onConceptChange={onConceptChange}
      />
    );
  }

  const day = plan.days[activeDay] ?? plan.days[0];
  const projected = projectDayOntoPlan(plan, day);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {plan.days.map((d, i) => (
          <button
            key={d.day}
            type="button"
            onClick={() => setActiveDay(i)}
            className={cn(
              "rounded-xl border px-4 py-2 text-sm font-medium transition-colors",
              i === activeDay
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-accent/40"
            )}
          >
            Day {d.day}
            {d.title ? (
              <span className="ml-1 hidden font-normal opacity-80 sm:inline">
                · {d.title}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {(day.title || day.focus) && (
        <p className="text-sm text-muted-foreground">
          {day.title}
          {day.title && day.focus ? " — " : ""}
          {day.focus}
        </p>
      )}

      <LessonPlanDocument
        plan={projected}
        concept={concept || day.focus}
        isEditing={isEditing}
        onPlanChange={(updated) =>
          onPlanChange(mergeDayIntoPlan(plan, activeDay, updated))
        }
        onConceptChange={onConceptChange}
      />
    </div>
  );
}
