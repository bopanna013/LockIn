CREATE TABLE "student"."assessment_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"dimension_scores" jsonb NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student"."recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"assessment_response_id" uuid NOT NULL,
	"content_release_id" uuid,
	"algorithm_version" varchar(32) NOT NULL,
	"dimension_scores" jsonb NOT NULL,
	"ranked_branches" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student"."profiles" ADD COLUMN "selected_branch_slug" varchar(64);--> statement-breakpoint
ALTER TABLE "student"."assessment_responses" ADD CONSTRAINT "assessment_responses_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."assessment_responses" ADD CONSTRAINT "assessment_responses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "system"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."recommendations" ADD CONSTRAINT "recommendations_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."recommendations" ADD CONSTRAINT "recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "system"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."recommendations" ADD CONSTRAINT "recommendations_assessment_response_id_assessment_responses_id_fk" FOREIGN KEY ("assessment_response_id") REFERENCES "student"."assessment_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."recommendations" ADD CONSTRAINT "recommendations_content_release_id_content_releases_id_fk" FOREIGN KEY ("content_release_id") REFERENCES "content"."content_releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_assessment_responses_user_idx" ON "student"."assessment_responses" USING btree ("org_id","user_id","submitted_at");--> statement-breakpoint
CREATE INDEX "student_recommendations_user_idx" ON "student"."recommendations" USING btree ("org_id","user_id","created_at");