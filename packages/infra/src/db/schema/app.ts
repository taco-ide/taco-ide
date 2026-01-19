import { pgTable, serial, text } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { user } from "./auth";

// Role table - application specific
export const role = pgTable("role", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

// Role relations
export const roleRelations = relations(role, ({ many }) => ({
  users: many(user),
}));

// Export types
export type Role = typeof role.$inferSelect;
export type NewRole = typeof role.$inferInsert;
