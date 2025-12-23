import { openai } from '@ai-sdk/openai';

/**
 * Generate an embedding vector for the given text using OpenAI's text-embedding-3-small model.
 * This model produces 1536-dimensional vectors optimized for similarity search.
 * 
 * @param text - The text to embed
 * @returns A Promise that resolves to a 1536-dimensional number array
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const embeddingModel = openai.embedding('text-embedding-3-small');
  
  const result = await embeddingModel.doEmbed({
    values: [text],
  });

  if (!result.embeddings || result.embeddings.length === 0 || !result.embeddings[0]) {
    throw new Error('Failed to generate embedding');
  }

  const embedding = result.embeddings[0];
  
  if (embedding.length !== 1536) {
    throw new Error(`Expected 1536-dimensional embedding, got ${embedding.length}`);
  }

  return embedding;
}

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value between -1 (opposite) and 1 (identical).
 * Higher values indicate more similar vectors.
 * 
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Cosine similarity score (0-1 range for normalized vectors)
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(`Vector dimensions must match: ${vec1.length} vs ${vec2.length}`);
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 0; // Handle zero vectors
  }

  return dotProduct / denominator;
}

