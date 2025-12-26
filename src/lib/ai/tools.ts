import { tool, jsonSchema } from "ai";
import { generateText } from "ai";
import { searchSimilar } from "@/lib/rag/vectorStore";
import { openai } from "@ai-sdk/openai";

// Type definitions for tool parameters
type SearchNotesParams = { query: string; topK?: number };
type SummarizeNotesParams = { content: string; focus?: string };
type FindGapsParams = {
  query: string;
  relevantContent?: string;
  searchResults?: Array<{ content: string; source: string }>;
};
type ExtractEntitiesParams = {
  content: string;
  entityTypes?: Array<
    "people" | "dates" | "topics" | "locations" | "organizations" | "keywords"
  >;
};

/**
 * Tool: Search Notes
 * Performs vector similarity search on user's notes
 */
export const searchNotesTool = tool({
  description: `Search the user's notes using semantic similarity. Use this when you need to find relevant information from the user's knowledge base. Returns chunks of text from notes that match the query.`,
  parameters: jsonSchema<SearchNotesParams>({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant notes",
      },
      topK: {
        type: "number",
        description: "Number of results to return (default: 5)",
      },
    },
    required: ["query"],
  }),
  // @ts-expect-error - AI SDK v6 type definitions issue
  execute: async ({ query, topK }: SearchNotesParams) => {
    try {
      console.log(
        `[searchNotesTool] Searching for: "${query}" with topK: ${topK}`
      );
      const results = await searchSimilar(query, topK || 5);
      console.log(`[searchNotesTool] Found ${results.length} results`);
      const response = {
        success: true,
        results: results.map((chunk) => ({
          content: chunk.content,
          source:
            chunk.metadata?.source || chunk.metadata?.fileName || "unknown",
          similarity: chunk.similarity,
        })),
        count: results.length,
      };
      console.log(
        `[searchNotesTool] Returning response with ${response.count} results`
      );
      return response;
    } catch (error) {
      console.error("[searchNotesTool] Error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Search failed",
      };
    }
  },
});

/**
 * Tool: Summarize Notes
 * Summarizes a collection of notes or search results
 */
export const summarizeNotesTool = tool({
  description: `Summarize notes or content from the user's knowledge base. Use this when the user asks for summaries, overviews, or concise explanations of their notes.`,
  parameters: jsonSchema<SummarizeNotesParams>({
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "The content to summarize (can be concatenated chunks from search results)",
      },
      focus: {
        type: "string",
        description:
          'Optional: What aspect to focus on in the summary (e.g., "key points", "timeline", "decisions")',
      },
    },
    required: ["content"],
  }),
  // @ts-expect-error - AI SDK v6 type definitions issue
  execute: async ({ content, focus }: SummarizeNotesParams) => {
    try {
      const model = openai("gpt-4o");

      const prompt = focus
        ? `Summarize the following content, focusing on: ${focus}\n\nContent:\n${content}`
        : `Provide a concise summary of the following content:\n\n${content}`;

      const result = await generateText({
        model,
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
        error: error instanceof Error ? error.message : "Summarization failed",
      };
    }
  },
});

/**
 * Tool: Find Knowledge Gaps
 * Identifies gaps in knowledge and suggests content or questions
 */
export const findGapsTool = tool({
  description: `Identify knowledge gaps in the user's notes. Use this when the user's query cannot be adequately answered from existing notes. Returns suggestions for content to add and clarifying questions to ask.`,
  parameters: jsonSchema<FindGapsParams>({
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The user's query that cannot be fully answered",
      },
      relevantContent: {
        type: "string",
        description:
          "Any relevant content found (may be empty or insufficient)",
      },
      searchResults: {
        type: "array",
        items: {
          type: "object",
          properties: {
            content: { type: "string" },
            source: { type: "string" },
          },
          required: ["content", "source"],
        },
        description:
          "Search results that were found (may be empty or insufficient)",
      },
    },
    required: ["query"],
  }),
  // @ts-expect-error - AI SDK v6 type definitions issue
  execute: async ({
    query,
    relevantContent,
    searchResults,
  }: FindGapsParams) => {
    try {
      const model = openai("gpt-4o");

      const searchResultsArray = searchResults || [];
      const hasContent = relevantContent || searchResultsArray.length > 0;
      const contentSummary = hasContent
        ? `Relevant content found:\n${
            relevantContent ||
            searchResultsArray
              .map(
                (r: { source: string; content: string }) =>
                  `[${r.source}]: ${r.content.substring(0, 200)}...`
              )
              .join("\n\n")
          }`
        : "No relevant content found in notes.";

      const prompt = `The user asked: "${query}"

${contentSummary}

Analyze what information is missing or insufficient to fully answer this query. Provide:
1. Suggestions for the type of content/markdown that should be added to the notes (be specific about what information would help)
2. Clarifying questions that could help gather the missing information

Format your response as JSON with:
- "contentSuggestions": array of strings describing what content to add
- "clarifyingQuestions": array of strings with questions to ask`;

      const result = await generateText({
        model,
        prompt,
      });

      // Try to parse JSON from the response
      let parsed: {
        contentSuggestions?: string[];
        clarifyingQuestions?: string[];
      };
      try {
        // Extract JSON from the response (may have markdown code blocks)
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = {
            contentSuggestions: ["Unable to parse structured response"],
            clarifyingQuestions: [
              "Could you provide more details about what you're looking for?",
            ],
          };
        }
      } catch {
        // Fallback if JSON parsing fails
        parsed = {
          contentSuggestions: [result.text],
          clarifyingQuestions: [
            "Could you provide more details about this topic?",
          ],
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
        error: error instanceof Error ? error.message : "Gap analysis failed",
        contentSuggestions: [],
        clarifyingQuestions: ["Could you provide more details?"],
      };
    }
  },
});

/**
 * Tool: Extract Entities
 * Extracts structured entities (people, dates, topics, etc.) from notes
 */
export const extractEntitiesTool = tool({
  description: `Extract structured information (entities) from notes or text. Use this when the user wants to identify people, dates, topics, locations, or other key information in their notes.`,
  parameters: jsonSchema<ExtractEntitiesParams>({
    type: "object",
    properties: {
      content: {
        type: "string",
        description:
          "The content to extract entities from (can be from search results or specific notes)",
      },
      entityTypes: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "people",
            "dates",
            "topics",
            "locations",
            "organizations",
            "keywords",
          ],
        },
        description: "Which types of entities to extract (default: all types)",
      },
    },
    required: ["content"],
  }),
  // @ts-expect-error - AI SDK v6 type definitions issue
  execute: async ({ content, entityTypes }: ExtractEntitiesParams) => {
    try {
      const model = openai("gpt-4o");

      const typesList =
        entityTypes && entityTypes.length > 0
          ? entityTypes.join(", ")
          : "people, dates, topics, locations, organizations, and keywords";

      const prompt = `Extract the following entities from this content: ${typesList}

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
        model,
        prompt,
      });

      // Try to parse JSON from the response
      let parsed;
      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = {};
        }
      } catch {
        parsed = {};
      }

      return {
        success: true,
        entities: {
          people: parsed.people || [],
          dates: parsed.dates || [],
          topics: parsed.topics || [],
          locations: parsed.locations || [],
          organizations: parsed.organizations || [],
          keywords: parsed.keywords || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Entity extraction failed",
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
});

/**
 * Export all tools as a tool map for use in streamText
 */
export const tools = {
  searchNotes: searchNotesTool,
  summarizeNotes: summarizeNotesTool,
  findGaps: findGapsTool,
  extractEntities: extractEntitiesTool,
};
