export const ROADMAP_ITEM_CATEGORIES = [
  "academics",
  "skills",
  "projects",
  "internships",
  "competitions",
  "certifications",
  "higher_studies",
] as const;

export type RoadmapItemCategory = (typeof ROADMAP_ITEM_CATEGORIES)[number];

export const ROADMAP_ITEM_STATUSES = ["todo", "in_progress", "completed"] as const;
export type RoadmapItemStatus = (typeof ROADMAP_ITEM_STATUSES)[number];

export interface RoadmapProgressItem {
  semester: number; // 1..8
  status: RoadmapItemStatus;
  category: RoadmapItemCategory;
}

export interface SemesterProgressSummary {
  semester: number;
  year: number;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  completionPercent: number;
}

export interface OverallRoadmapProgress {
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  overallPercent: number;
  bySemester: SemesterProgressSummary[];
}

/**
 * Pure calculation of 4-year / 8-semester roadmap completion metrics.
 */
export function computeRoadmapProgress(
  items: readonly RoadmapProgressItem[],
): OverallRoadmapProgress {
  const bySemester: SemesterProgressSummary[] = [];

  for (let sem = 1; sem <= 8; sem += 1) {
    const semItems = items.filter((item) => item.semester === sem);
    const completedItems = semItems.filter((item) => item.status === "completed").length;
    const inProgressItems = semItems.filter((item) => item.status === "in_progress").length;
    const totalItems = semItems.length;
    const completionPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    bySemester.push({
      semester: sem,
      year: Math.ceil(sem / 2),
      totalItems,
      completedItems,
      inProgressItems,
      completionPercent,
    });
  }

  const totalItems = items.length;
  const completedItems = items.filter((item) => item.status === "completed").length;
  const inProgressItems = items.filter((item) => item.status === "in_progress").length;
  const overallPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return {
    totalItems,
    completedItems,
    inProgressItems,
    overallPercent,
    bySemester,
  };
}

export interface TemplateMilestoneLite {
  code: string;
  semester: number;
  category: RoadmapItemCategory;
  title: string;
  description: string;
}

/**
 * Compute non-destructive diff between a student's existing roadmap items and a newly
 * published template release. Returns only brand-new template milestones whose `code`
 * does not exist in the student's roadmap yet — never overwrites or deletes student progress.
 */
export function diffNewTemplateMilestones(
  existingTemplateCodes: ReadonlySet<string>,
  latestTemplateMilestones: readonly TemplateMilestoneLite[],
): TemplateMilestoneLite[] {
  return latestTemplateMilestones.filter((m) => !existingTemplateCodes.has(m.code));
}
