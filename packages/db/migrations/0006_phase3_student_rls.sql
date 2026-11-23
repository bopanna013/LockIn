-- ============================================================================
-- Phase 3 Row-Level Security on student.assessment_responses and
-- student.recommendations.
-- ============================================================================

ALTER TABLE "student"."assessment_responses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student"."assessment_responses" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "student_assessment_responses_self_policy" ON "student"."assessment_responses"
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

ALTER TABLE "student"."recommendations" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student"."recommendations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "student_recommendations_self_policy" ON "student"."recommendations"
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
