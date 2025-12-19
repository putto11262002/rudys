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
    extraction: one(loadingListExtractions),
    items: many(loadingListItems),
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

// ============================================================================
// Loading List Extractions (AI audit trail - raw output)
// ============================================================================

// JSON types for raw extraction results (what AI returned)
export type RawActivityJson = {
  activityCode: string;
};

export type RawLineItemJson = {
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

// Loading list extractions (raw AI output - audit trail)
export const loadingListExtractions = pgTable("loading_list_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => employeeCaptureGroups.id, { onDelete: "cascade" }),

  // Extraction status: success, warning, error
  status: text("status", { enum: ["success", "warning", "error"] }).notNull(),
  message: text("message"),

  // Raw extracted data (JSON) - what AI returned, unvalidated
  rawActivities: jsonb("raw_activities").notNull().$type<RawActivityJson[]>(),
  rawLineItems: jsonb("raw_line_items").notNull().$type<RawLineItemJson[]>(),
  summary: jsonb("summary").notNull().$type<ExtractionSummaryJson>(),

  // Extraction metadata
  model: text("model"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  totalCost: real("total_cost"), // USD

  extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export type LoadingListExtraction = typeof loadingListExtractions.$inferSelect;
export type NewLoadingListExtraction = typeof loadingListExtractions.$inferInsert;

// ============================================================================
// Loading List Items (extracted line items)
// ============================================================================

// Source of item: extraction or manual entry
export const loadingListItemSource = ["extraction", "manual"] as const;

// Loading list items - all extracted line items (no catalog validation)
export const loadingListItems = pgTable("loading_list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  groupId: uuid("group_id")
    .notNull()
    .references(() => employeeCaptureGroups.id, { onDelete: "cascade" }),
  extractionId: uuid("extraction_id").references(() => loadingListExtractions.id, {
    onDelete: "set null",
  }),

  // Item data from extraction
  activityCode: text("activity_code").notNull(),
  productCode: text("product_code").notNull(),
  description: text("description"), // From AI extraction
  quantity: integer("quantity").notNull().default(1),

  // Source tracking
  source: text("source", { enum: loadingListItemSource })
    .notNull()
    .default("extraction"),

  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
    .notNull()
    .defaultNow(),
});

export type LoadingListItem = typeof loadingListItems.$inferSelect;
export type NewLoadingListItem = typeof loadingListItems.$inferInsert;

// ============================================================================
// Loading List Relations
// ============================================================================

// Extraction relations
export const loadingListExtractionsRelations = relations(
  loadingListExtractions,
  ({ one, many }) => ({
    group: one(employeeCaptureGroups, {
      fields: [loadingListExtractions.groupId],
      references: [employeeCaptureGroups.id],
    }),
    items: many(loadingListItems),
  })
);

// Item relations
export const loadingListItemsRelations = relations(
  loadingListItems,
  ({ one }) => ({
    group: one(employeeCaptureGroups, {
      fields: [loadingListItems.groupId],
      references: [employeeCaptureGroups.id],
    }),
    extraction: one(loadingListExtractions, {
      fields: [loadingListItems.extractionId],
      references: [loadingListExtractions.id],
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

