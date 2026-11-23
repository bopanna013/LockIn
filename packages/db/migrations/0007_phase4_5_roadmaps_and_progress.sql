CREATE TABLE "student"."roadmap_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"roadmap_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"semester" integer NOT NULL,
	"category" varchar(32) NOT NULL,
	"template_code" varchar(64),
	"is_custom" boolean DEFAULT false NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"status" varchar(24) DEFAULT 'todo' NOT NULL,
	"evidence_url" varchar(500),
	"reflection_notes" text,
	"completed_at" timestamp with time zone,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student"."roadmaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"branch_slug" varchar(64) NOT NULL,
	"template_release_id" uuid,
	"template_release_version" integer DEFAULT 1 NOT NULL,
	"title" varchar(200) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student"."roadmap_items" ADD CONSTRAINT "roadmap_items_roadmap_id_roadmaps_id_fk" FOREIGN KEY ("roadmap_id") REFERENCES "student"."roadmaps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."roadmap_items" ADD CONSTRAINT "roadmap_items_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."roadmap_items" ADD CONSTRAINT "roadmap_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "system"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."roadmaps" ADD CONSTRAINT "roadmaps_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "system"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."roadmaps" ADD CONSTRAINT "roadmaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "system"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student"."roadmaps" ADD CONSTRAINT "roadmaps_template_release_id_content_releases_id_fk" FOREIGN KEY ("template_release_id") REFERENCES "content"."content_releases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_roadmap_items_roadmap_sem_idx" ON "student"."roadmap_items" USING btree ("roadmap_id","semester","sort_order");--> statement-breakpoint
CREATE INDEX "student_roadmap_items_user_idx" ON "student"."roadmap_items" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "student_roadmaps_org_user_idx" ON "student"."roadmaps" USING btree ("org_id","user_id");--> statement-breakpoint
CREATE INDEX "student_roadmaps_branch_idx" ON "student"."roadmaps" USING btree ("branch_slug");