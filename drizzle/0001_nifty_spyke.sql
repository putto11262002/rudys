CREATE TABLE "employee_capture_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"employee_label" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loading_list_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"capture_type" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"upload_validation_passed" boolean DEFAULT true,
	"upload_validation_reason" text,
	"ai_classification_is_loading_list" boolean,
	"ai_classification_confidence" real,
	"ai_classification_reason" text
);
--> statement-breakpoint
ALTER TABLE "employee_capture_groups" ADD CONSTRAINT "employee_capture_groups_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loading_list_images" ADD CONSTRAINT "loading_list_images_group_id_employee_capture_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."employee_capture_groups"("id") ON DELETE cascade ON UPDATE no action;