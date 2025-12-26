import { pgTable, text, timestamp, uuid, vector, jsonb, index } from 'drizzle-orm/pg-core';

export const embeddings = pgTable('embeddings', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(), // Clerk user ID for multi-tenancy
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }), // text-embedding-3-small
  metadata: jsonb('metadata'), // Source, filename, etc.
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('embeddingIndex').using('hnsw', table.embedding.op('vector_cosine_ops')),
  index('embeddingUserIdx').on(table.userId),
]);

// Chat conversations - one per user interaction session
export const chats = pgTable('chats', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull(), // Clerk user ID
  title: text('title').notNull().default('New Chat'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('chatUserIdx').on(table.userId),
]);

// Chat messages - belong to a specific chat
export const chatMessages = pgTable('chat_messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  chatId: uuid('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  sources: jsonb('sources'), // Parsed sources from the response
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
  index('messagesChatIdx').on(table.chatId),
]);
