"use client";

import { DIMENSION_LABELS, DISCOVERY_QUESTIONS } from "@lockin/domain/recommendation";
import { Button } from "@lockin/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lockin/ui/components/card";
import { useActionState } from "react";
import {
  submitDiscoveryAssessmentAction,
  type DiscoveryActionState,
} from "@/server/discovery-actions";

const initialState: DiscoveryActionState = {};

const SCALE_LABELS = [
  { value: 1, label: "1 · Not for me" },
  { value: 2, label: "2 · Low interest" },
  { value: 3, label: "3 · Neutral" },
  { value: 4, label: "4 · Interested" },
  { value: 5, label: "5 · Love this" },
] as const;

export function DiscoveryQuestionnaireForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(submitDiscoveryAssessmentAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Engineering Interest & Aptitude Questionnaire (14 Questions)</CardTitle>
        <CardDescription>
          Rate each engineering activity honestly from 1 (Not for me) to 5 (Love this). Our
          explainable algorithm evaluates your alignment across 7 core engineering dimensions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-6">
          <input type="hidden" name="locale" value={locale} />
          {state.error && (
            <p role="alert" className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="bg-primary/10 text-primary rounded-md p-3 text-sm">
              {state.success}
            </p>
          )}

          <ol className="divide-y">
            {DISCOVERY_QUESTIONS.map((q, index) => (
              <li key={q.id} className="py-5 first:pt-0">
                <div className="flex flex-col gap-1">
                  <span className="text-primary text-xs font-semibold">
                    Question {index + 1} of {DISCOVERY_QUESTIONS.length} ·{" "}
                    {DIMENSION_LABELS[q.dimension]}
                  </span>
                  <p className="text-base font-medium">{q.prompt}</p>
                  <p className="text-muted-foreground text-xs">{q.helperText}</p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {SCALE_LABELS.map((opt) => (
                    <label
                      key={opt.value}
                      className="hover:bg-muted/60 has-[:checked]:border-primary has-[:checked]:bg-primary/10 flex cursor-pointer items-center gap-2 rounded-md border p-2.5 text-xs font-medium transition-colors"
                    >
                      <input
                        type="radio"
                        name={q.id}
                        value={opt.value}
                        defaultChecked={opt.value === 3}
                        required
                        className="size-3.5"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Computing your branch fit…" : "Calculate My Engineering Branch Fit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
