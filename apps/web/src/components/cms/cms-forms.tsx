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
import {
  cmsPublishReleaseAction,
  cmsUpsertBranchAction,
  type CmsActionState,
} from "@/server/cms-actions";

const initialState: CmsActionState = {};

export function CmsBranchEditorForm() {
  const [state, action, pending] = useActionState(cmsUpsertBranchAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create or Update Engineering Branch (Draft → Review → Publish)</CardTitle>
        <CardDescription>
          Executed over the least-privilege <code>lockin_cms</code> role (can write{" "}
          <code>content.*</code>, physically blocked from reading <code>student.*</code>).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
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
            <span>Branch Slug (stable ID)</span>
            <input
              name="slug"
              required
              placeholder="mechatronics-engineering"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Short Code</span>
            <input
              name="code"
              required
              placeholder="MTR"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Discipline Category</span>
            <input
              name="category"
              required
              defaultValue="Core & Manufacturing"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Workflow Status</span>
              <select
                name="status"
                defaultValue="draft"
                className="bg-background h-10 rounded-md border px-3 text-sm"
              >
                <option value="draft">Draft (hidden)</option>
                <option value="in_review">In Review</option>
                <option value="published">Published (live)</option>
                <option value="archived">Archived</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Language</span>
              <select
                name="locale"
                defaultValue="en"
                className="bg-background h-10 rounded-md border px-3 text-sm"
              >
                <option value="en">English (en)</option>
                <option value="kn">Kannada (kn)</option>
                <option value="hi">Hindi (hi)</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            <span>Branch Title</span>
            <input
              name="title"
              required
              placeholder="Mechatronics and Robotics Engineering"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Entry Salary Min (₹/yr)</span>
              <input
                name="entrySalaryMinInr"
                type="number"
                required
                defaultValue={500000}
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Entry Salary Max (₹/yr)</span>
              <input
                name="entrySalaryMaxInr"
                type="number"
                required
                defaultValue={1500000}
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium">
              <span>Mid-Career Max (₹/yr)</span>
              <input
                name="midCareerSalaryMaxInr"
                type="number"
                required
                defaultValue={3400000}
                className="bg-background h-10 rounded-md border px-3 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            <span>Short Summary</span>
            <input
              name="shortSummary"
              required
              placeholder="Integration of mechanical engineering, embedded electronics, and autonomous control."
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            <span>Detailed Overview</span>
            <textarea
              name="overview"
              rows={2}
              required
              className="bg-background rounded-md border p-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium sm:col-span-2">
            <span>Who It Suits</span>
            <textarea
              name="whoItSuits"
              rows={2}
              required
              className="bg-background rounded-md border p-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Core Subjects (comma-separated)</span>
            <input
              name="coreSubjects"
              defaultValue="Kinematics, Microcontrollers, Control Systems, Sensors & Actuators"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Key Skills (comma-separated)</span>
            <input
              name="keySkills"
              defaultValue="ROS2, Embedded C, SolidWorks, MATLAB"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Career Roles (comma-separated)</span>
            <input
              name="careerRoles"
              defaultValue="Robotics Engineer, Mechatronics Design Engineer, Automation Specialist"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Top Recruiters in India (comma-separated)</span>
            <input
              name="topRecruitersIndia"
              defaultValue="ABB, Bosch India, Fanuc, Tata Motors"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Higher Studies Paths (comma-separated)</span>
            <input
              name="higherStudiesPaths"
              defaultValue="GATE ME/EC -> M.Tech Robotics, MS in Mechatronics"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Entrance Exam Slugs (comma-separated)</span>
            <input
              name="entranceExamSlugs"
              defaultValue="jee-main, jee-advanced, kcet, comedk"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving to content schema…" : "Save Branch Content"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function CmsPublishReleaseForm() {
  const [state, action, pending] = useActionState(cmsPublishReleaseAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cut Immutable Content Release</CardTitle>
        <CardDescription>
          Publishing a release snapshots a new version in <code>content.content_releases</code>.
          Existing student roadmaps stay pinned to their original release until the student chooses
          to upgrade.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-3">
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

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Release Label</span>
            <input
              name="label"
              required
              placeholder="2026.11 Curriculum & Placement Update"
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium">
            <span>Release Notes (optional)</span>
            <input
              name="notes"
              placeholder="Updated salary bands and added new specialization details."
              className="bg-background h-10 rounded-md border px-3 text-sm"
            />
          </label>

          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Publishing release…" : "Publish New Content Release"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
