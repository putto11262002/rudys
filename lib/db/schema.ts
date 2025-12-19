import {
  pgTable,
  uuid,
  timestamp,
  text,
  integer,
  boolean,
  real,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Session phases - tracks last visited phase for resume
export const sessionPhase = [
  "loading-lists",
  "demand",
  "inventory",
  "order",
] as const;

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  lastPhase: text("last_phase", { enum: sessionPhase })
    .notNull()
    .default("loading-lists"),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Employee capture group status enum
export const employeeCaptureGroupStatus = [
  "pending",
  "extracted",
  "needs_attention",
] as const;

// Employee capture group (stub for T2, full implementation in T3)
export const employeeCaptureGroups = pgTable("employee_capture_groups", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  employeeLabel: text("employee_label"),
  status: text("status", { enum: employeeCaptureGroupStatus })
    .notNull()
    .default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export type EmployeeCaptureGroup = typeof employeeCaptureGroups.$inferSelect;
export type NewEmployeeCaptureGroup = typeof employeeCaptureGroups.$inferInsert;

// Loading list image capture type enum
export const captureType = ["camera_photo", "uploaded_file"] as const;

// Loading list image
export const loadingListImages = pgTable("loading_list_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => employeeCaptureGroups.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  captureType: text("capture_type", { enum: captureType }).notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
  // Upload validation
  uploadValidationPassed: boolean("upload_validation_passed").default(true),
  uploadValidationReason: text("upload_validation_reason"),
  // AI classification (populated in T4)
  aiClassificationIsLoadingList: boolean("ai_classification_is_loading_list"),
  aiClassificationConfidence: real("ai_classification_confidence"),
  aiClassificationReason: text("ai_classification_reason"),
});

export type LoadingListImage = typeof loadingListImages.$inferSelect;
export type NewLoadingListImage = typeof loadingListImages.$inferInsert;

// Relations
export const sessionsRelations = relations(sessions, ({ many }) => ({
  employeeCaptureGroups: many(employeeCaptureGroups),
  stationCaptures: many(stationCaptures),
}));

export const employeeCaptureGroupsRelations = relations(
  employeeCaptureGroups,
  ({ one, many }) => ({
    session: one(sessions, {
      fields: [employeeCaptureGroups.sessionId],
      references: [sessions.id],
    }),
    images: many(loadingListImages),
    extractionResult: one(loadingListExtractionResults),
  })
);

export const loadingListImagesRelations = relations(
  loadingListImages,
  ({ one }) => ({
    group: one(employeeCaptureGroups, {
      fields: [loadingListImages.groupId],
      references: [employeeCaptureGroups.id],
    }),
  })
);

// Loading list extraction results (AI output per group)
export const loadingListExtractionResults = pgTable(
  "loading_list_extraction_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => employeeCaptureGroups.id, { onDelete: "cascade" }),

    // Extraction status: success, warning, error
    status: text("status", { enum: ["success", "warning", "error"] }).notNull(),
    message: text("message"),

    // Extracted data (JSON)
    activities: jsonb("activities").notNull().$type<ActivityJson[]>(),
    lineItems: jsonb("line_items").notNull().$type<LineItemJson[]>(),
    summary: jsonb("summary").notNull().$type<ExtractionSummaryJson>(),

    // Extraction metadata
    model: text("model"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    totalCost: real("total_cost"), // USD

    extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  }
);

// JSON types for extraction results (matches simplified Zod schema)
export type ActivityJson = {
  activityCode: string;
};

export type LineItemJson = {
  activityCode: string;
  primaryCode: string;
  secondaryCode?: string;
  description?: string;
  internalCode?: string;
  quantity: number;
  room?: string;
  endUser?: string;
};

export type ExtractionSummaryJson = {
  totalImages: number;
  validImages: number;
  totalActivities: number;
  totalLineItems: number;
};

export type LoadingListExtractionResult =
  typeof loadingListExtractionResults.$inferSelect;
export type NewLoadingListExtractionResult =
  typeof loadingListExtractionResults.$inferInsert;

// Extraction results relations
export const loadingListExtractionResultsRelations = relations(
  loadingListExtractionResults,
  ({ one }) => ({
    group: one(employeeCaptureGroups, {
      fields: [loadingListExtractionResults.groupId],
      references: [employeeCaptureGroups.id],
    }),
  })
);


// ============================================================================
// Station Capture (T6/T7)
// ============================================================================

// Station capture status enum
export const stationCaptureStatus = [
  "pending",
  "valid",
  "needs_attention",
  "failed",
] as const;

// Match status enum
export const matchStatusEnum = [
  "matched",
  "mismatch",
  "uncertain",
  "invalid_images",
] as const;

// Station capture table - one station = sign image + stock image
export const stationCaptures = pgTable("station_captures", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  status: text("status", { enum: stationCaptureStatus })
    .notNull()
    .default("pending"),

  // Sign image (station label showing product code, min, max)
  signBlobUrl: text("sign_blob_url"),
  signWidth: integer("sign_width"),
  signHeight: integer("sign_height"),
  signUploadedAt: timestamp("sign_uploaded_at", {
    withTimezone: true,
    mode: "string",
  }),

  // Stock image (showing items on shelf)
  stockBlobUrl: text("stock_blob_url"),
  stockWidth: integer("stock_width"),
  stockHeight: integer("stock_height"),
  stockUploadedAt: timestamp("stock_uploaded_at", {
    withTimezone: true,
    mode: "string",
  }),

  // Extraction results (populated after AI extraction)
  productCode: text("product_code"),
  minQty: integer("min_qty"),
  maxQty: integer("max_qty"),
  onHandQty: integer("on_hand_qty"),

  // Confidence scores
  signConfidence: real("sign_confidence"),
  stockCountConfidence: real("stock_count_confidence"),
  matchConfidence: real("match_confidence"),
  matchStatus: text("match_status", { enum: matchStatusEnum }),
  matchReason: text("match_reason"),

  // Issues/warnings from extraction
  issues: jsonb("issues").$type<StationIssueJson[]>(),

  // Error message (when extraction fails)
  errorMessage: text("error_message"),

  // Extraction metadata
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalCost: real("total_cost"), // USD

  // Timestamps
  extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

// JSON type for station issues
export type StationIssueJson = {
  code: string;
  message: string;
};

export type StationCapture = typeof stationCaptures.$inferSelect;
export type NewStationCapture = typeof stationCaptures.$inferInsert;

// Station capture relations
export const stationCapturesRelations = relations(stationCaptures, ({ one }) => ({
  session: one(sessions, {
    fields: [stationCaptures.sessionId],
    references: [sessions.id],
  }),
}));

