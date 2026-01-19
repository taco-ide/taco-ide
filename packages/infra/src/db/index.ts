import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { env } from "../env";

// PostgreSQL connection
const client = postgres(env.DATABASE_URL);

// Drizzle client with schema
export const db = drizzle(client, { schema });

// Export types
export type DB = typeof db;
