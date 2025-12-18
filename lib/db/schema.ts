import { pgTable, uuid, timestamp, pgEnum, text } from "drizzle-orm/pg-core";

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
