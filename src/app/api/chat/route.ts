import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages } from "ai";
import { searchSimilar } from "@/lib/rag/vectorStore";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

/**
 * Build a system prompt with RAG context from similar note chunks
 */
function buildSystemPrompt(
  contextChunks: Array<{ content: string; metadata: any }>
): string {
  if (contextChunks.length === 0) {
    return `You are a helpful AI assistant that answers questions based on the user's notes and knowledge base.
If you don't have relevant information in the context, say so honestly.`;
  }

  const contextText = contextChunks
    .map((chunk, idx) => {
      const source = chunk.metadata?.source || "unknown";
      return `[Context ${idx + 1} from ${source}]:\n${chunk.content}`;
    })
    .join("\n\n");

  return `You are a helpful AI assistant that answers questions based on the user's notes and knowledge base.

Use the following context from the user's notes to answer the question. If the context doesn't contain relevant information, say so honestly.

Context from notes:
${contextText}

Instructions:
- Answer the question using the context provided above
- Cite the source when referencing specific information (e.g., "According to [source name]...")
- If the context doesn't contain enough information, say so and provide a general helpful response
- Be concise but thorough`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get the last user message for RAG search
    const lastUserMessage = messages
      .filter((m: any) => m.role === "user")
      .pop();

    // Perform RAG search if we have a user message
    let contextChunks: Array<{ content: string; metadata: any }> = [];
    if (lastUserMessage?.parts?.[0]?.text) {
      const query = lastUserMessage.parts[0].text;
      try {
        const similar = await searchSimilar(query, 5);
        contextChunks = similar.map((chunk) => ({
          content: chunk.content,
          metadata: chunk.metadata,
        }));
      } catch (error) {
        console.warn("RAG search failed, continuing without context:", error);
        // Continue without context if search fails
      }
    }

    // Convert UI messages to model messages format (strip id field as required)
    const modelMessages = await convertToModelMessages(
      messages.map(({ id, ...msg }: any) => msg)
    );

    // Add system prompt with RAG context at the beginning
    const systemPrompt = buildSystemPrompt(contextChunks);
    const messagesWithContext = [
      { role: "system" as const, content: systemPrompt },
      ...modelMessages,
    ];

    const result = streamText({
      model: openai("gpt-4o"),
      messages: messagesWithContext,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
