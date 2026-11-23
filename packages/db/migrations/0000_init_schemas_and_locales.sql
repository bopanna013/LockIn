CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "student";
--> statement-breakpoint
CREATE SCHEMA "system";
--> statement-breakpoint
CREATE TABLE "content"."locales" (
	"code" varchar(8) PRIMARY KEY NOT NULL,
	"english_name" varchar(64) NOT NULL,
	"native_name" varchar(64) NOT NULL,
	"script" varchar(8) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
