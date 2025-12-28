import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { insertEmbedding } from "../lib/rag/vectorStore";

/**
 * Simple text chunking function similar to RecursiveCharacterTextSplitter.
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

/**
 * Process a markdown file and insert its chunks into the database.
 */
async function processMarkdownFile(
  filePath: string,
  userId: string
): Promise<number> {
  const content = await readFile(filePath, "utf-8");
  const fileName = filePath.split(/[/\\]/).pop() || "unknown";

  // Remove markdown metadata/frontmatter if present
  const cleanedContent = content.replace(/^---[\s\S]*?---\n/, "");

  // Split into chunks
  const chunks = chunkText(cleanedContent);

  console.log(`Processing ${fileName}: ${chunks.length} chunks`);

  // Insert each chunk
  let inserted = 0;
  for (const chunk of chunks) {
    await insertEmbedding(chunk, userId, {
      source: fileName,
      filePath,
      chunkIndex: inserted,
      totalChunks: chunks.length,
    });
    inserted++;
  }

  return inserted;
}

/**
 * Main ingestion function.
 * Reads markdown files from the specified directory and ingests them.
 *
 * Usage: tsx src/scripts/ingest.ts <userId> [directory]
 *   userId: Clerk user ID (required for multi-tenancy)
 *   directory: Directory containing markdown files (default: ./data/notes)
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Error: userId is required");
    console.log("Usage: tsx src/scripts/ingest.ts <userId> [directory]");
    process.exit(1);
  }

  const userId = args[0];
  const notesDir = args[1] || join(process.cwd(), "data", "notes");

  console.log(`Ingesting markdown files from: ${notesDir}`);
  console.log(`User ID: ${userId}`);

  try {
    // Check if directory exists
    const entries = await readdir(notesDir, { withFileTypes: true });
    const markdownFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => join(notesDir, entry.name));

    if (markdownFiles.length === 0) {
      console.warn(`No markdown files found in ${notesDir}`);
      console.log(
        "Create a data/notes directory and add .md files to ingest them."
      );
      process.exit(0);
    }

    console.log(`Found ${markdownFiles.length} markdown file(s)`);

    // Process each file
    let totalChunks = 0;
    for (const filePath of markdownFiles) {
      const chunks = await processMarkdownFile(filePath, userId);
      totalChunks += chunks;
    }

    console.log(`\n✅ Ingestion complete!`);
    console.log(`   Files processed: ${markdownFiles.length}`);
    console.log(`   Total chunks inserted: ${totalChunks}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.error(`Directory not found: ${notesDir}`);
      console.log(
        "Create the directory and add markdown files to ingest them."
      );
    } else {
      console.error("Error during ingestion:", error);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
