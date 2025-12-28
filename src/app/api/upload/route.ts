import { NextRequest, NextResponse } from "next/server";
import { insertEmbedding } from "@/lib/rag/vectorStore";
import { auth } from "@clerk/nextjs/server";

/**
 * Simple text chunking function.
 * Splits text into overlapping chunks to preserve context.
 */
function chunkText(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): string[] {
  const chunks: string[] = [];
  let start = 0;

  // Helper to find the last word boundary (space, tab, newline) before a position
  const findLastWordBoundary = (str: string, maxPos: number): number => {
    // Look for spaces, tabs, newlines - but not at position 0
    for (let i = Math.min(maxPos, str.length - 1); i > 0; i--) {
      const char = str[i];
      if (char === " " || char === "\t" || char === "\n") {
        return i;
      }
    }
    return -1;
  };

  // Helper to find the next word boundary after a position
  const findNextWordBoundary = (str: string, minPos: number): number => {
    for (let i = minPos; i < str.length; i++) {
      const char = str[i];
      if (char === " " || char === "\t" || char === "\n") {
        return i;
      }
    }
    return str.length;
  };

  while (start < text.length) {
    const idealEnd = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, idealEnd);

    // If this is the last chunk, use it as-is
    if (idealEnd >= text.length) {
      chunks.push(chunk.trim());
      break;
    }

    // Try to find a good split point
    // First priority: sentence boundaries (period followed by space, or newline)
    let splitPoint = -1;
    const lastPeriod = chunk.lastIndexOf(".");
    const lastNewline = chunk.lastIndexOf("\n");

    // Check if period is followed by space/newline (sentence end)
    if (lastPeriod >= chunkSize * 0.5 && lastPeriod < chunk.length - 1) {
      const afterPeriod = chunk[lastPeriod + 1];
      if (afterPeriod === " " || afterPeriod === "\n" || afterPeriod === "\t") {
        splitPoint = lastPeriod + 1; // Include the space after period
      }
    }

    // Use newline if it's a good boundary
    if (splitPoint === -1 && lastNewline >= chunkSize * 0.5) {
      splitPoint = lastNewline;
    }

    // Second priority: word boundaries (spaces, tabs)
    if (splitPoint === -1 || splitPoint < chunkSize * 0.5) {
      const wordBoundary = findLastWordBoundary(chunk, chunk.length - 1);
      if (wordBoundary > chunkSize * 0.5) {
        splitPoint = wordBoundary;
      } else if (wordBoundary > 0) {
        // Prefer any word boundary over cutting a word
        splitPoint = wordBoundary;
      }
    }

    // If we found a split point, use it
    if (splitPoint > 0) {
      chunk = chunk.slice(0, splitPoint).trimEnd();

      // Calculate next start with overlap, ensuring it starts at a word boundary
      const chunkEnd = start + splitPoint;
      const overlapStart = chunkEnd - chunkOverlap;
      const overlapStartBounded = Math.max(start, overlapStart);

      // Find the nearest word boundary at or before the overlap start position
      // We need to search in the original text, not the chunk
      const textBeforeOverlap = text.slice(0, overlapStartBounded);
      const overlapBoundary = findLastWordBoundary(
        textBeforeOverlap,
        textBeforeOverlap.length
      );

      // Use word boundary if found and it's not before current start
      if (overlapBoundary >= start) {
        start = overlapBoundary + 1; // Start after the space/whitespace
      } else {
        // If no boundary found going back, find next boundary forward from overlap start
        const nextBoundary = findNextWordBoundary(text, overlapStartBounded);
        start = nextBoundary < text.length ? nextBoundary + 1 : chunkEnd;
      }
    } else {
      // Should not happen if text has spaces, but handle gracefully
      // Find next word boundary forward
      const nextBoundary = findNextWordBoundary(text, idealEnd);
      if (nextBoundary < text.length) {
        chunk = text.slice(start, nextBoundary).trimEnd();
        start = nextBoundary + 1;
      } else {
        // Last chunk
        chunks.push(chunk.trim());
        break;
      }
    }

    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Only accept markdown files
    if (!file.name.endsWith(".md") && file.type !== "text/markdown") {
      return NextResponse.json(
        { error: "Only markdown (.md) files are supported" },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();

    // Remove markdown metadata/frontmatter if present
    const cleanedContent = text.replace(/^---[\s\S]*?---\n/, "");

    // Split into chunks
    const chunks = chunkText(cleanedContent);

    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "File appears to be empty after processing" },
        { status: 400 }
      );
    }

    // Insert each chunk with metadata
    let inserted = 0;
    for (const chunk of chunks) {
      await insertEmbedding(chunk, userId, {
        source: file.name,
        fileName: file.name,
        uploadedAt: new Date().toISOString(),
        chunkIndex: inserted,
        totalChunks: chunks.length,
      });
      inserted++;
    }

    return NextResponse.json({
      success: true,
      fileName: file.name,
      chunksInserted: inserted,
      message: `Successfully processed ${file.name} into ${inserted} chunks`,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to process file",
      },
      { status: 500 }
    );
  }
}
