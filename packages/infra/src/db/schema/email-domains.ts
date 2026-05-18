import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { organization } from "./auth";
import type { RoleName } from "../../auth/permissions";

// Auto-link rules: when a new user signs up with an email matching `domain`,
// they are added to `organizationId` with `role`. UNIQUE(domain, role) is global
// so the same domain+role can only be claimed by one organization at a time.
//
// `role` is typed as `RoleName` so Drizzle infers the union directly. The DB
// column stays `text` (no migration needed); writers must still validate input
// with Zod or `isValidRole` to keep the runtime contract safe.
export const organizationEmailDomain = pgTable(
  "organization_email_domain",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    role: text("role").$type<RoleName>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("organization_email_domain_domain_role_idx").on(
      table.domain,
      table.role
    ),
    index("organization_email_domain_org_idx").on(table.organizationId),
  ]
);

export type OrganizationEmailDomain =
  typeof organizationEmailDomain.$inferSelect;
export type NewOrganizationEmailDomain =
  typeof organizationEmailDomain.$inferInsert;
