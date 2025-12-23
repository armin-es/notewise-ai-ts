-- Migration to update schema: serial -> uuid, text -> jsonb, add missing columns
-- If you get vector dimension errors, see MIGRATION_FIX.md

-- For serial->uuid conversion, we need to create new column, migrate, then swap
-- Chat messages table
ALTER TABLE "chat_messages" ADD COLUMN "id_temp" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
UPDATE "chat_messages" SET "id_temp" = gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chat_messages_pkey";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "chat_messages" RENAME COLUMN "id_temp" TO "id";--> statement-breakpoint
ALTER TABLE "chat_messages" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "chat_messages" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "tool_invocations" jsonb;--> statement-breakpoint

-- Embeddings table  
ALTER TABLE "embeddings" ADD COLUMN "id_temp" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
UPDATE "embeddings" SET "id_temp" = gen_random_uuid();--> statement-breakpoint
ALTER TABLE "embeddings" DROP CONSTRAINT "embeddings_pkey";--> statement-breakpoint
ALTER TABLE "embeddings" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "embeddings" RENAME COLUMN "id_temp" TO "id";--> statement-breakpoint
ALTER TABLE "embeddings" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "embeddings" ALTER COLUMN "metadata" SET DATA TYPE jsonb USING metadata::jsonb;--> statement-breakpoint
ALTER TABLE "embeddings" ADD COLUMN "updated_at" timestamp DEFAULT now();
