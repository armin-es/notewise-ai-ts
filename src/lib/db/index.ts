import { drizzle as drizzleNode } from "drizzle-orm/node-postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

dotenv.config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined");
}

const databaseUrl = process.env.DATABASE_URL;

// Detect if this is a Neon database URL (contains @neon.tech or uses Neon HTTP endpoint)
const isNeonDatabase =
  databaseUrl.includes("@neon.tech") ||
  databaseUrl.includes("neon.tech") ||
  (databaseUrl.includes("/?sslmode=require") && databaseUrl.includes("ep-"));

// Create database instance with appropriate driver based on database type
// Use 'any' type to avoid TypeScript union type issues since both drivers
// implement the same Drizzle API interface at runtime
let db: any;

if (isNeonDatabase) {
  // Use Neon HTTP for better serverless performance on Vercel/production
  const sql = neon(databaseUrl);
  db = drizzleNeon(sql, { schema });
} else {
  // Use pg Pool for local databases or other PostgreSQL instances
  const pool = new Pool({
    connectionString: databaseUrl,
  });
  db = drizzleNode(pool, { schema });
}

export { db };
