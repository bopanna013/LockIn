"use client";

import { Button } from "@lockin/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@lockin/ui/components/card";
import { useActionState } from "react";
import { addCustomRoadmapItemAction, type RoadmapActionState } from "@/server/roadmap-actions";

const initialState: RoadmapActionState = {};

export function AddCustomMilestoneForm({ locale }: { locale: string }) {
  const [state, action, pending] = useActionState(addCustomRoadmapItemAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Custom Milestone or Personal Goal</CardTitle>
        <CardDescription>
          Customize your 8-semester plan with NPTEL/SWAYAM certifications, research papers, club
          leadership, GATE prep targets, or personal projects.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="locale" value={locale} />
          {state.error && (
            <p
              role="alert"
              className="bg-destructive/10 text-destructive rounded-md p-3 text-sm sm:col-span-2"
            >
              {state.error}
            </p>
          )}
          {state.success && (
            <p
              role="status"
              className="bg-primary/10 text-primary rounded-md p-3 text-sm sm:col-span-2"
            >
              {state.success}
            </p>
          )}

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Target Semester</span>
            <select
              name="semester"
              defaultValue={1}
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                <option key={s} value={s}>
                  Semester {s} (Year {Math.ceil(s / 2)})
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Category</span>
            <select
              name="category"
              defaultValue="skills"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            >
              <option value="academics">Academics</option>
              <option value="skills">Skills & Tooling</option>
              <option value="projects">Projects</option>
              <option value="internships">Internships</option>
              <option value="competitions">Hackathons & Competitions</option>
              <option value="certifications">NPTEL / Certifications</option>
              <option value="higher_studies">GATE / Higher Studies Prep</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            <span>Milestone Title</span>
            <input
              name="title"
              required
              placeholder="e.g., Complete NPTEL IIT Madras course or build a working hardware prototype"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            <span>Actionable Plan & Success Criteria</span>
            <textarea
              name="description"
              rows={2}
              required
              placeholder="What concrete artifact, project repo, or certificate will prove completion?"
              className="bg-background rounded-md border p-3 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Adding milestone…" : "+ Add Custom Milestone"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
