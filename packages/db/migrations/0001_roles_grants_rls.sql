-- ============================================================================
-- Least-privilege grants + Row-Level Security helpers.
-- Runs as lockin_owner. Roles are created by `pnpm db:bootstrap`.
--
--   lockin_app : runtime role. READ content, READ/WRITE student + system.
--   lockin_cms : CMS role.     READ/WRITE content. NO access to student data.
-- ============================================================================

-- Schema visibility -----------------------------------------------------------
REVOKE ALL ON SCHEMA "content", "student", "system" FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "content", "student", "system" TO lockin_app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA "content" TO lockin_cms;
--> statement-breakpoint

-- content: read-only for the app, read/write for the CMS ----------------------
GRANT SELECT ON ALL TABLES IN SCHEMA "content" TO lockin_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "content" TO lockin_cms;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "content" TO lockin_cms;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "content" GRANT SELECT ON TABLES TO lockin_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "content" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lockin_cms;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "content" GRANT USAGE, SELECT ON SEQUENCES TO lockin_cms;
--> statement-breakpoint

-- student + system: read/write for the app only -------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA "student", "system" TO lockin_app;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA "student", "system" TO lockin_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "student", "system" GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lockin_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA "student", "system" GRANT USAGE, SELECT ON SEQUENCES TO lockin_app;
--> statement-breakpoint

-- Request context for RLS -----------------------------------------------------
-- Set per transaction by withRequestContext() in packages/db/src/context.ts.
-- Returns NULL when unset, so policies comparing against it match nothing.
CREATE OR REPLACE FUNCTION "system"."current_user_id"() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "system"."current_org_id"() RETURNS uuid
  LANGUAGE sql STABLE PARALLEL SAFE
  AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "system"."current_user_id"(), "system"."current_org_id"() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "system"."current_user_id"(), "system"."current_org_id"() TO lockin_app;
