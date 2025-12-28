import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { chats, chatMessages, embeddings } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

// GET /api/chats/[chatId]/referenced-files - Get unique file sources referenced in a chat
export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { chatId } = await params;

    // Verify the chat belongs to the user
    const [chat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));

    if (!chat) {
      return new Response(JSON.stringify({ error: "Chat not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get all messages with sources for this chat
    const messages = await db
      .select({
        sources: chatMessages.sources,
      })
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId));

    // Extract unique file names and chunk references from sources
    const referencedFiles = new Set<string>();
    const fileChunkMap = new Map<string, Set<string>>(); // file -> chunk IDs

    for (const message of messages) {
      if (message.sources) {
        let sources: any[] = [];

        // Handle different JSONB formats
        if (Array.isArray(message.sources)) {
          sources = message.sources;
        } else if (typeof message.sources === "object") {
          // Could be { sources: [...] } or direct array-like object
          sources =
            (message.sources as any).sources ||
            (Array.isArray((message.sources as any).data)
              ? (message.sources as any).data
              : []);
        }

        for (const source of sources) {
          if (source && typeof source === "object") {
            // Extract filename
            const fileName = source.name ? String(source.name).trim() : null;
            if (fileName) {
              referencedFiles.add(fileName);
              // Also add without .md extension for flexible matching
              if (fileName.endsWith(".md")) {
                referencedFiles.add(fileName.slice(0, -3));
              }
            }

            // Extract chunk ID if present
            if (source.chunkId && fileName) {
              if (!fileChunkMap.has(fileName)) {
                fileChunkMap.set(fileName, new Set());
              }
              fileChunkMap.get(fileName)!.add(String(source.chunkId));
            }
          } else if (typeof source === "string") {
            const fileName = source.trim();
            referencedFiles.add(fileName);
            if (fileName.endsWith(".md")) {
              referencedFiles.add(fileName.slice(0, -3));
            }
          }
        }
      }
    }

    // Query chunks for referenced files to get chunk details
    const fileNames = Array.from(referencedFiles);
    if (fileNames.length === 0) {
      return new Response(JSON.stringify({ files: [], chunks: [] }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Query all chunks for the user and filter by referenced files in JavaScript
    // This is simpler than complex SQL array matching
    const allChunks = await db
      .select({
        id: embeddings.id,
        metadata: embeddings.metadata,
        content: embeddings.content,
      })
      .from(embeddings)
      .where(eq(embeddings.userId, userId));

    // Filter and transform chunks
    const chunksQuery = allChunks
      .filter((chunk: { id: string; metadata: any; content: string }) => {
        const metadata = chunk.metadata as Record<string, any> | null;
        if (!metadata) return false;

        const source = metadata.source || metadata.Source;
        const fileName = metadata.fileName || metadata.FileName || source;
        if (!source && !fileName) return false;

        // Check if this chunk belongs to a referenced file
        return fileNames.some((fn) => {
          const normalizedFn = fn.replace(/\.md$/, "");
          const normalizedSource = String(source || "").replace(/\.md$/, "");
          const normalizedFileName = String(fileName || "").replace(
            /\.md$/,
            ""
          );
          return (
            normalizedSource === fn ||
            normalizedSource === normalizedFn ||
            normalizedFileName === fn ||
            normalizedFileName === normalizedFn ||
            source === fn ||
            fileName === fn
          );
        });
      })
      .map((chunk: { id: string; metadata: any; content: string }) => {
        const metadata = chunk.metadata as Record<string, any> | null;
        return {
          id: chunk.id,
          source: metadata?.source || metadata?.Source || "unknown",
          fileName:
            metadata?.fileName ||
            metadata?.FileName ||
            metadata?.source ||
            metadata?.Source ||
            "unknown",
          chunkIndex:
            typeof metadata?.chunkIndex === "number"
              ? metadata.chunkIndex
              : typeof metadata?.ChunkIndex === "number"
              ? metadata.ChunkIndex
              : typeof metadata?.chunkIndex === "string"
              ? parseInt(metadata.chunkIndex, 10)
              : null,
          content: chunk.content,
        };
      });

    // Organize chunks by file
    const chunksByFile = new Map<
      string,
      Array<{
        id: string;
        chunkIndex: number | null;
        content: string;
        isReferenced: boolean;
      }>
    >();

    for (const chunk of chunksQuery) {
      const fileKey = chunk.fileName || chunk.source || "unknown";
      if (!chunksByFile.has(fileKey)) {
        chunksByFile.set(fileKey, []);
      }

      const chunkSet = fileChunkMap.get(fileKey) || new Set();
      chunksByFile.get(fileKey)!.push({
        id: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        isReferenced: chunkSet.has(chunk.id) || chunkSet.size === 0, // If no specific chunks tracked, mark all as potentially referenced
      });
    }

    // Convert to response format
    const chunksResponse = Array.from(chunksByFile.entries()).map(
      ([file, chunks]) => ({
        file,
        chunks: chunks.sort(
          (a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0)
        ),
      })
    );

    return new Response(
      JSON.stringify({
        files: Array.from(referencedFiles),
        chunks: chunksResponse,
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching referenced files:", error);
    return new Response(
      JSON.stringify({ error: "Failed to fetch referenced files" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
