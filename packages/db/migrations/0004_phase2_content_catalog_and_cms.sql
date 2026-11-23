CREATE TABLE "content"."branch_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"title" varchar(160) NOT NULL,
	"short_summary" text NOT NULL,
	"overview" text NOT NULL,
	"who_it_suits" text NOT NULL,
	"core_subjects" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"key_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"career_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"top_recruiters_india" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"higher_studies_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"code" varchar(16) NOT NULL,
	"category" varchar(48) NOT NULL,
	"duration_years" integer DEFAULT 4 NOT NULL,
	"total_semesters" integer DEFAULT 8 NOT NULL,
	"entry_salary_min_inr" integer NOT NULL,
	"entry_salary_max_inr" integer NOT NULL,
	"mid_career_salary_max_inr" integer NOT NULL,
	"fit_weights" jsonb NOT NULL,
	"entrance_exam_slugs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'draft' NOT NULL,
	"display_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."content_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_number" integer NOT NULL,
	"label" varchar(120) NOT NULL,
	"notes" text,
	"published_by_email" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."entrance_exam_translations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"summary" text NOT NULL,
	"eligibility_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."entrance_exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"short_name" varchar(32) NOT NULL,
	"level" varchar(32) NOT NULL,
	"conducting_body" varchar(160) NOT NULL,
	"typical_month" varchar(64) NOT NULL,
	"official_url" varchar(255) NOT NULL,
	"status" varchar(24) DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."roadmap_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"branch_id" uuid NOT NULL,
	"locale" varchar(8) NOT NULL,
	"release_id" uuid,
	"title" varchar(200) NOT NULL,
	"milestones" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" varchar(24) DEFAULT 'published' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content"."branch_translations" ADD CONSTRAINT "branch_translations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "content"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."branch_translations" ADD CONSTRAINT "branch_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "content"."locales"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."entrance_exam_translations" ADD CONSTRAINT "entrance_exam_translations_exam_id_entrance_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "content"."entrance_exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."entrance_exam_translations" ADD CONSTRAINT "entrance_exam_translations_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "content"."locales"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."roadmap_templates" ADD CONSTRAINT "roadmap_templates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "content"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."roadmap_templates" ADD CONSTRAINT "roadmap_templates_locale_locales_code_fk" FOREIGN KEY ("locale") REFERENCES "content"."locales"("code") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."roadmap_templates" ADD CONSTRAINT "roadmap_templates_release_id_content_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."content_releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "branch_translations_branch_locale_idx" ON "content"."branch_translations" USING btree ("branch_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_slug_idx" ON "content"."branches" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "branches_status_order_idx" ON "content"."branches" USING btree ("status","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "content_releases_version_idx" ON "content"."content_releases" USING btree ("version_number");--> statement-breakpoint
CREATE INDEX "content_releases_active_idx" ON "content"."content_releases" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "entrance_exam_translations_exam_locale_idx" ON "content"."entrance_exam_translations" USING btree ("exam_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "entrance_exams_slug_idx" ON "content"."entrance_exams" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "roadmap_templates_branch_locale_idx" ON "content"."roadmap_templates" USING btree ("branch_id","locale");