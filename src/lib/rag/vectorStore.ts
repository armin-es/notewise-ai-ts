import { db } from "@/lib/db";
import { embeddings } from "@/lib/db/schema";
import { cosineDistance } from "drizzle-orm/sql/functions/vector";
import { eq } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";

export interface SimilarChunk {
  id: string;
  content: string;
  metadata: Record<string, any> | null;
  similarity: number; // Lower is more similar (distance, not similarity score)
}

/**
 * Search for similar text chunks using vector similarity search.
 * Uses pgvector's cosine distance operator (<=>) with HNSW index for fast search.
 *
 * @param query - The text query to search for
 * @param topK - Number of top results to return (default: 5)
 * @param userId - Optional user ID to filter embeddings (multi-tenancy)
 * @returns Array of similar chunks with their content, metadata, and similarity scores
 */
export async function searchSimilar(
  query: string,
  topK: number = 5,
  userId?: string
): Promise<SimilarChunk[]> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Build query with optional user filter
  let queryBuilder = db
    .select({
      id: embeddings.id,
      content: embeddings.content,
      metadata: embeddings.metadata,
      distance: cosineDistance(embeddings.embedding, queryEmbedding),
    })
    .from(embeddings);

  // Apply user filter if provided
  if (userId) {
    queryBuilder = queryBuilder.where(
      eq(embeddings.userId, userId)
    ) as typeof queryBuilder;
  }

  const results = await queryBuilder
    .orderBy(cosineDistance(embeddings.embedding, queryEmbedding))
    .limit(topK);

  // Convert distance to similarity score (1 - distance for cosine)
  // Cosine distance ranges from 0 (identical) to 2 (opposite)
  // Similarity score: 1 - distance/2, ranges from 0 (opposite) to 1 (identical)
  return results.map((result) => ({
    id: result.id,
    content: result.content,
    metadata: result.metadata as Record<string, any> | null,
    // For cosine distance: similarity = 1 - (distance / 2)
    // Distance is already a number, so we calculate similarity
    similarity:
      typeof result.distance === "number"
        ? Math.max(0, 1 - result.distance / 2)
        : 0.5, // Fallback if distance is somehow not a number
  }));
}

/**
 * Insert a text chunk with its embedding into the database.
 *
 * @param content - The text content to store
 * @param userId - The user ID for multi-tenancy
 * @param metadata - Optional metadata (e.g., source file, page number)
 * @returns The inserted embedding record
 */
export async function insertEmbedding(
  content: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<{ id: string }> {
  // Generate embedding for the content
  const embedding = await generateEmbedding(content);

  // Insert into database
  const [result] = await db
    .insert(embeddings)
    .values({
      content,
      userId,
      embedding: embedding as any, // Drizzle expects the vector type
      metadata: metadata || null,
    })
    .returning({ id: embeddings.id });

  return result;
}
