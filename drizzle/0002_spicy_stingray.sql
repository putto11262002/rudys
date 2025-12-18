CREATE TABLE "loading_list_extraction_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"image_checks" jsonb NOT NULL,
	"activities" jsonb NOT NULL,
	"line_items" jsonb NOT NULL,
	"ignored_images" jsonb NOT NULL,
	"warnings" jsonb NOT NULL,
	"summary" jsonb NOT NULL,
	"extracted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loading_list_extraction_results" ADD CONSTRAINT "loading_list_extraction_results_group_id_employee_capture_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."employee_capture_groups"("id") ON DELETE cascade ON UPDATE no action;