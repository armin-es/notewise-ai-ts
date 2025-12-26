import { openai } from "@ai-sdk/openai";
import { streamText, tool } from "ai";
import { z } from "zod";
import { searchSimilar } from "@/lib/rag/vectorStore";
import { generateText } from "ai";
import { auth } from "@clerk/nextjs/server";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an intelligent AI agent that helps users interact with their personal notes and knowledge base. You have access to tools that let you search, summarize, analyze, and extract information from their notes.

Your capabilities:
- searchNotes: Search the user's notes using semantic similarity
- summarizeNotes: Create concise summaries of notes or content
- findGaps: Identify knowledge gaps and suggest content or ask clarifying questions
- extractEntities: Extract structured information (people, dates, topics, locations, etc.)

Guidelines:
- Use tools proactively when needed - don't wait for explicit instructions
- For questions about notes, start by using searchNotes to find relevant content
- If search doesn't yield sufficient results, use findGaps to suggest what's missing
- When summarizing, use summarizeNotes for better quality summaries
- For structured data requests, use extractEntities
- Be honest when information isn't available in the user's notes
- You can use multiple tools in sequence to answer complex queries

IMPORTANT - Source Citation Format:
When you use searchNotes and find relevant information, ALWAYS end your response with a sources section in this exact format:

---sources---
- source_name.md (relevance: 0.XX)
- another_source.md (relevance: 0.XX)
---end-sources---

Only include sources that you actually used to answer the question. The relevance score comes from the similarity field in search results.`;

export async function POST(req: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log("Chat API: Received messages:", messages.length);

    // Convert messages to the format expected by AI SDK v4
    const formattedMessages = messages.map(
      (msg: { role: string; content: string }) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })
    );

    console.log("Chat API: Starting streamText with tools (AI SDK v4)");

    const result = streamText({
      model: openai("gpt-4o"),
      system: SYSTEM_PROMPT,
      messages: formattedMessages,
      tools: {
        searchNotes: tool({
          description:
            "Search the user's notes using semantic similarity. Use this when you need to find relevant information from the user's knowledge base.",
          parameters: z.object({
            query: z
              .string()
              .describe("The search query to find relevant notes"),
          }),
          execute: async ({ query }: { query: string }) => {
            console.log(`[searchNotes] Searching for: "${query}"`);
            try {
              // Pass userId for multi-tenancy - only search user's own notes
              const results = await searchSimilar(query, 5, userId);
              console.log(`[searchNotes] Found ${results.length} results`);
              return {
                success: true,
                results: results.map((chunk) => ({
                  content: chunk.content,
                  source:
                    chunk.metadata?.source ||
                    chunk.metadata?.fileName ||
                    "unknown",
                  similarity: chunk.similarity,
                })),
                count: results.length,
              };
            } catch (error) {
              console.error("[searchNotes] Error:", error);
              return {
                success: false,
                error: error instanceof Error ? error.message : "Search failed",
              };
            }
          },
        }),
        summarizeNotes: tool({
          description:
            "Summarize notes or content from the user's knowledge base. Use this when the user asks for summaries, overviews, or concise explanations of their notes.",
          parameters: z.object({
            content: z.string().describe("The content to summarize"),
            focus: z
              .string()
              .optional()
              .describe("Optional: What aspect to focus on in the summary"),
          }),
          execute: async ({
            content,
            focus,
          }: {
            content: string;
            focus?: string;
          }) => {
            try {
              const prompt = focus
                ? `Summarize the following content, focusing on: ${focus}\n\nContent:\n${content}`
                : `Provide a concise summary of the following content:\n\n${content}`;

              const result = await generateText({
                model: openai("gpt-4o"),
                prompt,
              });

              return {
                success: true,
                summary: result.text,
                focus: focus || "general",
              };
            } catch (error) {
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Summarization failed",
              };
            }
          },
        }),
        findGaps: tool({
          description:
            "Identify knowledge gaps in the user's notes. Use this when the user's query cannot be adequately answered from existing notes. Returns suggestions for content to add and clarifying questions to ask.",
          parameters: z.object({
            query: z
              .string()
              .describe("The user's query that cannot be fully answered"),
            relevantContent: z
              .string()
              .optional()
              .describe(
                "Any relevant content found (may be empty or insufficient)"
              ),
          }),
          execute: async ({
            query,
            relevantContent,
          }: {
            query: string;
            relevantContent?: string;
          }) => {
            try {
              const hasContent = !!relevantContent;
              const contentSummary = hasContent
                ? `Relevant content found:\n${relevantContent}`
                : "No relevant content found in notes.";

              const prompt = `The user asked: "${query}"

${contentSummary}

Analyze what information is missing. Provide:
1. Suggestions for content/markdown that should be added to the notes
2. Clarifying questions that could help gather the missing information

Format your response as JSON with:
- "contentSuggestions": array of strings describing what content to add
- "clarifyingQuestions": array of strings with questions to ask`;

              const result = await generateText({
                model: openai("gpt-4o"),
                prompt,
              });

              let parsed: {
                contentSuggestions?: string[];
                clarifyingQuestions?: string[];
              } = {};
              try {
                const jsonMatch = result.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  parsed = JSON.parse(jsonMatch[0]);
                }
              } catch {
                parsed = {
                  contentSuggestions: [result.text],
                  clarifyingQuestions: ["Could you provide more details?"],
                };
              }

              return {
                success: true,
                contentSuggestions: parsed.contentSuggestions || [],
                clarifyingQuestions: parsed.clarifyingQuestions || [],
                hasRelevantContent: hasContent,
              };
            } catch (error) {
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Gap analysis failed",
                contentSuggestions: [],
                clarifyingQuestions: ["Could you provide more details?"],
              };
            }
          },
        }),
        extractEntities: tool({
          description:
            "Extract structured information (entities) from notes or text. Use this when the user wants to identify people, dates, topics, locations, or other key information in their notes.",
          parameters: z.object({
            content: z
              .string()
              .describe("The content to extract entities from"),
          }),
          execute: async ({ content }: { content: string }) => {
            try {
              const prompt = `Extract the following entities from this content: people, dates, topics, locations, organizations, and keywords

Content:
${content}

Return a JSON object with arrays for each entity type found. Use these keys:
- "people": array of person names
- "dates": array of dates, time periods, or temporal references
- "topics": array of main topics or subjects
- "locations": array of places or locations
- "organizations": array of organizations, companies, or groups
- "keywords": array of important keywords or terms

Format as JSON only, no additional text.`;

              const result = await generateText({
                model: openai("gpt-4o"),
                prompt,
              });

              let parsed = {};
              try {
                const jsonMatch = result.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  parsed = JSON.parse(jsonMatch[0]);
                }
              } catch {
                parsed = {};
              }

              return {
                success: true,
                entities: {
                  people: (parsed as Record<string, string[]>).people || [],
                  dates: (parsed as Record<string, string[]>).dates || [],
                  topics: (parsed as Record<string, string[]>).topics || [],
                  locations:
                    (parsed as Record<string, string[]>).locations || [],
                  organizations:
                    (parsed as Record<string, string[]>).organizations || [],
                  keywords: (parsed as Record<string, string[]>).keywords || [],
                },
              };
            } catch (error) {
              return {
                success: false,
                error:
                  error instanceof Error
                    ? error.message
                    : "Entity extraction failed",
                entities: {
                  people: [],
                  dates: [],
                  topics: [],
                  locations: [],
                  organizations: [],
                  keywords: [],
                },
              };
            }
          },
        }),
      },
      maxSteps: 5,
    });

    console.log("Chat API: StreamText result created, returning response");

    // Use toDataStreamResponse for proper useChat compatibility with tools
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Chat API error:", error);
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack"
    );
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
