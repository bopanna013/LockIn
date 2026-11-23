-- ============================================================================
-- Phase 4 & 5 Row-Level Security on student.roadmaps and student.roadmap_items.
-- ============================================================================

ALTER TABLE "student"."roadmaps" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student"."roadmaps" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "student_roadmaps_self_policy" ON "student"."roadmaps"
  AS PERMISSIVE
  FOR ALL
  TO lockin_app
  USING (
    "user_id" = "system"."current_user_id"()
    AND "org_id" = "system"."current_org_id"()
  )
  WITH CHECK (
    "user_id" = "system"."current_user_id"()
    AND "org_id" = "system"."current_org_id"()
  );
--> statement-breakpoint

ALTER TABLE "student"."roadmap_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student"."roadmap_items" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "student_roadmap_items_self_policy" ON "student"."roadmap_items"
  AS PERMISSIVE
  FOR ALL
  TO lockin_app
  USING (
    "user_id" = "system"."current_user_id"()
    AND "org_id" = "system"."current_org_id"()
  )
  WITH CHECK (
    "user_id" = "system"."current_user_id"()
    AND "org_id" = "system"."current_org_id"()
  );
