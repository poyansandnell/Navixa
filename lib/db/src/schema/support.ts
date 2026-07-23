import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

import { profilesTable } from "./profiles";

// -----------------------------------------------------------------------------
// support_tickets — inbound support/contact requests. Public endpoint, so
// user_id is nullable (attached only when a valid session exists).
// category / status are kept as text with a check constraint ("enum-ish").
// -----------------------------------------------------------------------------
export const supportTicketsTable = pgTable(
  "support_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id").references(() => profilesTable.id, {
      onDelete: "set null",
    }),
    email: text("email").notNull(),
    subject: text("subject").notNull(),
    message: text("message").notNull(),
    category: text("category").notNull().default("other"),
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("support_tickets_created_idx").on(t.createdAt.desc()),
    index("support_tickets_status_idx").on(t.status, t.createdAt.desc()),
    index("support_tickets_user_idx").on(t.userId),
    check(
      "support_tickets_category_chk",
      sql`${t.category} in ('question', 'bug', 'account', 'payment', 'other')`,
    ),
    check(
      "support_tickets_status_chk",
      sql`${t.status} in ('open', 'in_progress', 'resolved', 'closed')`,
    ),
  ],
);

export const insertSupportTicketSchema = createInsertSchema(
  supportTicketsTable,
).omit({ id: true, createdAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;
