"use client";

import { cn } from "@/lib/utils";
import type { LessonPlan } from "@/lib/types/lesson-plan";

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  isEditing: boolean;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
}

function EditableField({
  value,
  onChange,
  isEditing,
  multiline = false,
  className,
  placeholder,
}: EditableFieldProps) {
  if (!isEditing) {
    return (
      <div className={cn("whitespace-pre-wrap text-sm leading-relaxed", className)}>
        {value || <span className="text-muted-foreground italic">—</span>}
      </div>
    );
  }

  const baseClass =
    "w-full rounded-md border border-primary/30 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";

  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className={cn(baseClass, "min-h-[80px] resize-y", className)}
      />
    );
  }

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(baseClass, className)}
    />
  );
}

function linesToArray(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
}

function arrayToLines(items: string[]): string {
  return items.map((item) => `• ${item}`).join("\n");
}

interface LessonPlanDocumentProps {
  plan: LessonPlan;
  concept: string;
  isEditing: boolean;
  onPlanChange: (plan: LessonPlan) => void;
  onConceptChange: (concept: string) => void;
}

function Th({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <th
      colSpan={colSpan}
      className={cn(
        "border border-slate-300 bg-indigo-50 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-700 sm:px-3 sm:py-2 sm:text-xs",
        className
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className, colSpan }: { children: React.ReactNode; className?: string; colSpan?: number }) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "border border-slate-300 px-2 py-1.5 align-top text-xs sm:px-3 sm:py-2 sm:text-sm",
        className
      )}
    >
      {children}
    </td>
  );
}

export function LessonPlanDocument({
  plan,
  concept,
  isEditing,
  onPlanChange,
  onConceptChange,
}: LessonPlanDocumentProps) {
  function updateField<K extends keyof LessonPlan>(key: K, value: LessonPlan[K]) {
    onPlanChange({ ...plan, [key]: value });
  }

  function updateObjectives(key: keyof LessonPlan["objectives"], value: string) {
    onPlanChange({
      ...plan,
      objectives: { ...plan.objectives, [key]: value },
    });
  }

  function updateMethodology<K extends keyof LessonPlan["teachingMethodology"]>(
    key: K,
    value: LessonPlan["teachingMethodology"][K]
  ) {
    onPlanChange({
      ...plan,
      teachingMethodology: { ...plan.teachingMethodology, [key]: value },
    });
  }

  function updateModelAnswer(
    index: number,
    field: keyof LessonPlan["teachingMethodology"]["modelKeyAnswers"][0],
    value: string
  ) {
    const updated = plan.teachingMethodology.modelKeyAnswers.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    updateMethodology("modelKeyAnswers", updated);
  }

  return (
    <div className="-mx-4 overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-soft sm:mx-0">
      <table className="w-full min-w-[640px] border-collapse md:min-w-[720px]">
        <tbody>
          <tr>
            <Th>Grade</Th>
            <Td>
              <EditableField
                value={plan.grade}
                onChange={(v) => updateField("grade", v)}
                isEditing={isEditing}
              />
            </Td>
            <Th>Subject</Th>
            <Td>
              <EditableField
                value={plan.subject}
                onChange={(v) => updateField("subject", v)}
                isEditing={isEditing}
              />
            </Td>
            <Th>Chapter</Th>
            <Td>
              <EditableField
                value={plan.chapter}
                onChange={(v) => updateField("chapter", v)}
                isEditing={isEditing}
              />
            </Td>
            <Th>Concept</Th>
            <Td>
              <EditableField
                value={concept}
                onChange={onConceptChange}
                isEditing={isEditing}
                placeholder="Core concept"
              />
            </Td>
            <Th>Days</Th>
            <Td>
              <EditableField
                value={plan.numberOfDays}
                onChange={(v) => updateField("numberOfDays", v)}
                isEditing={isEditing}
              />
            </Td>
          </tr>

          <tr>
            <Th colSpan={2}>Learning Outcomes</Th>
            <Td colSpan={8}>
              <EditableField
                value={arrayToLines(plan.learningOutcomes)}
                onChange={(v) => updateField("learningOutcomes", linesToArray(v))}
                isEditing={isEditing}
                multiline
                placeholder="One outcome per line"
              />
            </Td>
          </tr>

          <tr>
            <Th colSpan={2}>Resources Required</Th>
            <Td colSpan={8}>
              <EditableField
                value={arrayToLines(plan.resourcesRequired)}
                onChange={(v) => updateField("resourcesRequired", linesToArray(v))}
                isEditing={isEditing}
                multiline
                placeholder="One resource per line"
              />
            </Td>
          </tr>

          <tr>
            <Th>Objectives</Th>
            <Th colSpan={4}>Teaching Methodology</Th>
            <Th>Skills &amp; Attitude</Th>
            <Th colSpan={3}>Competencies</Th>
          </tr>

          <tr>
            <Td>
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Warm Up</p>
                  <EditableField
                    value={plan.objectives.warmUp}
                    onChange={(v) => updateObjectives("warmUp", v)}
                    isEditing={isEditing}
                    multiline
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Concept-Building</p>
                  <EditableField
                    value={plan.objectives.conceptBuilding}
                    onChange={(v) => updateObjectives("conceptBuilding", v)}
                    isEditing={isEditing}
                    multiline
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Extension</p>
                  <EditableField
                    value={plan.objectives.extension}
                    onChange={(v) => updateObjectives("extension", v)}
                    isEditing={isEditing}
                    multiline
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Assessment</p>
                  <EditableField
                    value={plan.objectives.assessment}
                    onChange={(v) => updateObjectives("assessment", v)}
                    isEditing={isEditing}
                    multiline
                  />
                </div>
              </div>
            </Td>

            <Td colSpan={4}>
              <div className="space-y-5">
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Warm Up</p>
                  <EditableField
                    value={plan.teachingMethodology.warmUp}
                    onChange={(v) => updateMethodology("warmUp", v)}
                    isEditing={isEditing}
                    multiline
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Concept-Building</p>
                  <EditableField
                    value={plan.teachingMethodology.conceptBuilding}
                    onChange={(v) => updateMethodology("conceptBuilding", v)}
                    isEditing={isEditing}
                    multiline
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Extension</p>
                  <EditableField
                    value={arrayToLines(plan.teachingMethodology.extension)}
                    onChange={(v) => updateMethodology("extension", linesToArray(v))}
                    isEditing={isEditing}
                    multiline
                    placeholder="One question per line"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs font-semibold text-primary">Assessment</p>
                  <EditableField
                    value={arrayToLines(plan.teachingMethodology.assessment)}
                    onChange={(v) => updateMethodology("assessment", linesToArray(v))}
                    isEditing={isEditing}
                    multiline
                    placeholder="One question per line"
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold text-primary">Model Key Answers</p>
                  <div className="space-y-3">
                    {plan.teachingMethodology.modelKeyAnswers.map((item, i) => (
                      <div key={i} className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
                        {isEditing ? (
                          <div className="space-y-2">
                            <EditableField
                              value={item.question}
                              onChange={(v) => updateModelAnswer(i, "question", v)}
                              isEditing
                              multiline
                              placeholder="Question"
                            />
                            <EditableField
                              value={item.answer}
                              onChange={(v) => updateModelAnswer(i, "answer", v)}
                              isEditing
                              placeholder="Answer"
                            />
                            <EditableField
                              value={item.explanation}
                              onChange={(v) => updateModelAnswer(i, "explanation", v)}
                              isEditing
                              multiline
                              placeholder="Explanation"
                            />
                          </div>
                        ) : (
                          <>
                            <p className="font-medium">{item.question}</p>
                            <p className="mt-1 text-primary">Answer: {item.answer}</p>
                            <p className="mt-1 text-muted-foreground">{item.explanation}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Td>

            <Td>
              <EditableField
                value={arrayToLines(plan.skillsAndAttitude)}
                onChange={(v) => updateField("skillsAndAttitude", linesToArray(v))}
                isEditing={isEditing}
                multiline
                placeholder="One item per line"
              />
            </Td>

            <Td colSpan={3}>
              <EditableField
                value={arrayToLines(plan.competencies)}
                onChange={(v) => updateField("competencies", linesToArray(v))}
                isEditing={isEditing}
                multiline
                placeholder="One item per line"
              />
            </Td>
          </tr>

          <tr>
            <Th colSpan={2}>Note for Facilitator</Th>
            <Td colSpan={8}>
              <EditableField
                value={plan.noteForFacilitator}
                onChange={(v) => updateField("noteForFacilitator", v)}
                isEditing={isEditing}
                multiline
              />
            </Td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
