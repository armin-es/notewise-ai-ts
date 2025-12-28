import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: databaseUrl,
});

async function applyMigration() {
  const migrationSQL = readFileSync(
    join(process.cwd(), "drizzle", "0002_add_chat_schema.sql"),
    "utf-8"
  );

  console.log("Applying migration 0002_add_chat_schema.sql...");

  // Split by semicolons and execute each statement
  const statements = migrationSQL
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const statement of statements) {
    if (statement.trim()) {
      try {
        await pool.query(statement);
        console.log("✓ Executed statement");
      } catch (error) {
        // Some statements might fail if they already exist (IF NOT EXISTS), that's okay
        if (
          error instanceof Error &&
          error.message.includes("already exists")
        ) {
          console.log("ℹ Statement already applied (skipping)");
        } else {
          console.error(
            "✗ Error executing statement:",
            statement.substring(0, 100)
          );
          console.error(
            "  Error:",
            error instanceof Error ? error.message : error
          );
          throw error;
        }
      }
    }
  }

  console.log("✅ Migration completed successfully!");
}

applyMigration()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
