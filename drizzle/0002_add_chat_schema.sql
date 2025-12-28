-- Migration to add chats table and update chat_messages for multi-tenancy
-- This adds the missing schema for chat functionality

-- Create chats table if it doesn't exist
CREATE TABLE IF NOT EXISTS "chats" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "title" text NOT NULL DEFAULT 'New Chat',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

-- Create index on chats.user_id
CREATE INDEX IF NOT EXISTS "chatUserIdx" ON "chats" ("user_id");

-- Add user_id to chat_messages if it doesn't exist (required for multi-tenancy)
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "user_id" text;

-- Add chat_id to chat_messages if it doesn't exist
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "chat_id" uuid REFERENCES "chats"("id") ON DELETE CASCADE;

-- Add sources column to chat_messages if it doesn't exist (replaces tool_invocations)
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "sources" jsonb;

-- Create index on chat_messages.chat_id
CREATE INDEX IF NOT EXISTS "messagesChatIdx" ON "chat_messages" ("chat_id");

-- Add user_id to embeddings if it doesn't exist
-- Note: We keep it nullable for now to handle existing data without user_id
-- You can clean up and add NOT NULL constraint later if needed
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "user_id" text;

-- Create index on embeddings.user_id
CREATE INDEX IF NOT EXISTS "embeddingUserIdx" ON "embeddings" ("user_id");

