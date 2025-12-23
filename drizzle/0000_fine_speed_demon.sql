CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "embeddingIndex" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);