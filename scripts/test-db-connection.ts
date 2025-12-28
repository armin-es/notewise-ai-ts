import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({
  connectionString: databaseUrl,
});
const db = drizzle(pool);

async function testConnection() {
  try {
    console.log("Testing database connection...");

    // Test 1: Basic connection
    const result = await db.execute(sql`SELECT version()`);
    console.log("✓ Database connection successful");

    // Test 2: Check if chats table exists
    const chatsCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'chats'
      )
    `);
    console.log("✓ Chats table exists:", chatsCheck);

    // Test 3: Check chats table structure
    const chatsColumns = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'chats'
      ORDER BY ordinal_position
    `);
    console.log("✓ Chats columns:", chatsColumns);

    // Test 4: Check embeddings table
    const embeddingsCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'embeddings'
      )
    `);
    console.log("✓ Embeddings table exists:", embeddingsCheck);

    // Test 5: Check embeddings user_id column
    const embeddingsUserId = await db.execute(sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'embeddings'
      AND column_name = 'user_id'
    `);
    console.log("✓ Embeddings user_id column:", embeddingsUserId);

    // Test 6: Try a simple query on chats
    const chatsCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM chats`
    );
    console.log("✓ Chats count:", chatsCount);

    console.log("\n✅ All database checks passed!");
  } catch (error) {
    console.error("❌ Database test failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  }
}

testConnection();
