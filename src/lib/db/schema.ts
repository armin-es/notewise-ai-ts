import { pgTable, text, timestamp, uuid, vector, jsonb, index } from 'drizzle-orm/pg-core';

export const embeddings = pgTable('embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // text-embedding-3-small
  metadata: jsonb('metadata'), // Source, filename, etc.
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
]);

export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: text('role', { enum: ['user', 'assistant', 'system', 'data'] }).notNull(),
  content: text('content').notNull(),
  toolInvocations: jsonb('tool_invocations'),
  createdAt: timestamp('created_at').defaultNow(),
});
