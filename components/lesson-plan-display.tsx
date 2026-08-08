import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { LessonPlan } from "@/lib/types/lesson-plan";

function BulletList({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

export function LessonPlanDisplay({ plan }: { plan: LessonPlan }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Learning Outcomes</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={plan.learningOutcomes} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resources Required</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={plan.resourcesRequired} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objectives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed">
          <p>
            <span className="font-medium">Warm Up:</span>{" "}
            {plan.objectives.warmUp}
          </p>
          <p>
            <span className="font-medium">Concept-Building:</span>{" "}
            {plan.objectives.conceptBuilding}
          </p>
          <p>
            <span className="font-medium">Extension:</span>{" "}
            {plan.objectives.extension}
          </p>
          <p>
            <span className="font-medium">Assessment:</span>{" "}
            {plan.objectives.assessment}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teaching Methodology</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Section title="Warm Up">
            <p className="text-sm leading-relaxed text-foreground/90">
              {plan.teachingMethodology.warmUp}
            </p>
          </Section>

          <Section title="Concept-Building">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {plan.teachingMethodology.conceptBuilding}
            </p>
          </Section>

          <Section title="Extension">
            <BulletList items={plan.teachingMethodology.extension} />
          </Section>

          <Section title="Assessment">
            <BulletList items={plan.teachingMethodology.assessment} />
          </Section>

          <Section title="Model Key Answers">
            <div className="space-y-4">
              {plan.teachingMethodology.modelKeyAnswers.map((item, i) => (
                <div
                  key={i}
                  className="rounded-lg border bg-slate-50/50 px-4 py-3 text-sm"
                >
                  <p className="font-medium">{item.question}</p>
                  <p className="mt-2 text-primary">
                    Answer: {item.answer}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {item.explanation}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Skills and Attitude</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={plan.skillsAndAttitude} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competencies</CardTitle>
        </CardHeader>
        <CardContent>
          <BulletList items={plan.competencies} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Note for Facilitator</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
            {plan.noteForFacilitator}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
