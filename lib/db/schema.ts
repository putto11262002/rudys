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

export const sessionState = [
  "draft",
  "capturing_loading_lists",
  "review_demand",
  "capturing_inventory",
  "review_order",
  "completed",
] as const;

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  status: text("status", { enum: sessionState })
    .notNull()
    .default("capturing_loading_lists"),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
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
  uploadedAt: timestamp("uploaded_at", { withTimezone: true, mode: "date" })
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

    // Raw extraction output (JSON) - matches LoadingListExtractionSchema
    imageChecks: jsonb("image_checks").notNull().$type<ImageCheckJson[]>(),
    activities: jsonb("activities").notNull().$type<ActivityJson[]>(),
    lineItems: jsonb("line_items").notNull().$type<LineItemJson[]>(),
    ignoredImages: jsonb("ignored_images")
      .notNull()
      .$type<IgnoredImageJson[]>(),
    warnings: jsonb("warnings").notNull().$type<WarningJson[]>(),
    summary: jsonb("summary").notNull().$type<ExtractionSummaryJson>(),

    extractedAt: timestamp("extracted_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  }
);

// JSON types for extraction results (matches Zod schema output)
export type ImageCheckJson = {
  imageIndex: number;
  isLoadingList: boolean;
  loadingListConfidence: number;
  notLoadingListReason?: string;
  isContinuationOfPrevious?: boolean;
  continuationConfidence?: number;
  sequenceNote?: "ok" | "overlap" | "gap" | "uncertain";
};

export type ActivityJson = {
  activityCode: string;
  room?: string;
  endUser?: string;
  notes?: string;
  confidence: number;
  evidence: {
    firstSeenImageIndex: number;
  };
};

export type LineItemJson = {
  lineItemId: string;
  activityCode: string;
  codes: string[];
  primaryCode: string;
  primaryCodeConfidence: number;
  description?: string;
  internalCode?: string;
  quantity: number;
  isPartial: boolean;
  reconciled: boolean;
  confidence: number;
  evidence: {
    imageIndex: number;
  };
};

export type IgnoredImageJson = {
  imageIndex: number;
  reason: string;
};

export type WarningJson = {
  code:
    | "NOT_LOADING_LIST"
    | "LOW_CONFIDENCE"
    | "PARTIAL_ITEM_IGNORED"
    | "PARTIAL_NOT_RECONCILED"
    | "POSSIBLE_DUPLICATE"
    | "SEQUENCE_GAP_OR_REORDER"
    | "UNREADABLE";
  severity: "info" | "warn" | "block";
  message: string;
  imageIndex?: number;
  lineItemId?: string;
};

export type ExtractionSummaryJson = {
  totalLoadingListImages: number;
  totalActivities: number;
  totalLineItemsCounted: number;
  totalLineItemsIgnored: number;
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

