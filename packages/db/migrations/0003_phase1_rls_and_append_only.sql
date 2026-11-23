-- ============================================================================
-- Phase 1 Row-Level Security on student.profiles and append-only privileges
-- on system.guardian_consents and system.audit_logs.
-- ============================================================================

ALTER TABLE "student"."profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "student"."profiles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint

CREATE POLICY "student_profiles_self_policy" ON "student"."profiles"
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

-- Append-only ledgers: the runtime role may INSERT and SELECT, never UPDATE.
-- (DELETE on guardian_consents is allowed only via ON DELETE CASCADE when an
-- unapproved minor account is purged or a user exercises right-to-erasure.)
REVOKE UPDATE, DELETE ON TABLE "system"."audit_logs" FROM lockin_app;
--> statement-breakpoint
REVOKE UPDATE ON TABLE "system"."guardian_consents" FROM lockin_app;
