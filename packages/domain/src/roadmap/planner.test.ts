import { describe, expect, it } from "vitest";
import { computeRoadmapProgress, diffNewTemplateMilestones } from "./planner";

describe("roadmap progress & non-destructive template diff", () => {
  it("computes overall and per-semester completion percentages across 8 semesters", () => {
    const summary = computeRoadmapProgress([
      { semester: 1, category: "academics", status: "completed" },
      { semester: 1, category: "skills", status: "in_progress" },
      { semester: 2, category: "projects", status: "completed" },
      { semester: 3, category: "academics", status: "todo" },
    ]);

    expect(summary.totalItems).toBe(4);
    expect(summary.completedItems).toBe(2);
    expect(summary.inProgressItems).toBe(1);
    expect(summary.overallPercent).toBe(50);
    expect(summary.bySemester).toHaveLength(8);
    expect(summary.bySemester[0]?.completionPercent).toBe(50);
    expect(summary.bySemester[1]?.completionPercent).toBe(100);
  });

  it("identifies only new template milestones during a content release upgrade", () => {
    const existing = new Set(["CSE-S1-FOUND", "CSE-S2-TOOLS"]);
    const diff = diffNewTemplateMilestones(existing, [
      {
        code: "CSE-S1-FOUND",
        semester: 1,
        category: "academics",
        title: "Existing",
        description: "Already present",
      },
      {
        code: "CSE-S3-NEW",
        semester: 3,
        category: "projects",
        title: "New Milestone",
        description: "Added in release v2",
      },
    ]);

    expect(diff).toHaveLength(1);
    expect(diff[0]?.code).toBe("CSE-S3-NEW");
  });
});
