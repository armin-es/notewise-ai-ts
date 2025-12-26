import { sql } from 'drizzle-orm';
import { db } from '../src/lib/db';

async function migrateSchema() {
  console.log('Starting schema migration...');

  try {
    // Drop old chat_messages table if it exists
    await db.execute(sql`DROP TABLE IF EXISTS chat_messages CASCADE`);
    console.log('Dropped old chat_messages table');

    // Create chats table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chats (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT 'New Chat',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created chats table');

    // Create index on user_id
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS chat_user_idx ON chats(user_id)
    `);
    console.log('Created chat_user_idx index');

    // Create chat_messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        sources JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Created chat_messages table');

    // Create index on chat_id
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS messages_chat_idx ON chat_messages(chat_id)
    `);
    console.log('Created messages_chat_idx index');

    // Add user_id to embeddings if not exists
    await db.execute(sql`
      ALTER TABLE embeddings 
      ADD COLUMN IF NOT EXISTS user_id TEXT
    `);
    console.log('Added user_id column to embeddings');

    // Create index on embeddings user_id
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS embedding_user_idx ON embeddings(user_id)
    `);
    console.log('Created embedding_user_idx index');

    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

migrateSchema();

