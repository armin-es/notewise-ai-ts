import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { insertEmbedding } from '../lib/rag/vectorStore';

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

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let chunk = text.slice(start, end);

    // Try to split at sentence boundaries for better chunk quality
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const splitPoint = Math.max(lastPeriod, lastNewline);

      if (splitPoint > chunkSize * 0.5) {
        // Only split if we found a good boundary (at least halfway through chunk)
        chunk = chunk.slice(0, splitPoint + 1);
        start += splitPoint + 1 - chunkOverlap;
      } else {
        start += chunkSize - chunkOverlap;
      }
    } else {
      start = end;
    }

    chunks.push(chunk.trim());
  }

  return chunks.filter((chunk) => chunk.length > 0);
}

/**
 * Process a markdown file and insert its chunks into the database.
 */
async function processMarkdownFile(filePath: string): Promise<number> {
  const content = await readFile(filePath, 'utf-8');
  const fileName = filePath.split(/[/\\]/).pop() || 'unknown';
  
  // Remove markdown metadata/frontmatter if present
  const cleanedContent = content.replace(/^---[\s\S]*?---\n/, '');
  
  // Split into chunks
  const chunks = chunkText(cleanedContent);
  
  console.log(`Processing ${fileName}: ${chunks.length} chunks`);

  // Insert each chunk
  let inserted = 0;
  for (const chunk of chunks) {
    await insertEmbedding(chunk, {
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
 * Usage: tsx scripts/ingest.ts [directory]
 * Default directory: ./data/notes
 */
async function main() {
  const args = process.argv.slice(2);
  const notesDir = args[0] || join(process.cwd(), 'data', 'notes');

  console.log(`Ingesting markdown files from: ${notesDir}`);

  try {
    // Check if directory exists
    const entries = await readdir(notesDir, { withFileTypes: true });
    const markdownFiles = entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map((entry) => join(notesDir, entry.name));

    if (markdownFiles.length === 0) {
      console.warn(`No markdown files found in ${notesDir}`);
      console.log('Create a data/notes directory and add .md files to ingest them.');
      process.exit(0);
    }

    console.log(`Found ${markdownFiles.length} markdown file(s)`);

    // Process each file
    let totalChunks = 0;
    for (const filePath of markdownFiles) {
      const chunks = await processMarkdownFile(filePath);
      totalChunks += chunks;
    }

    console.log(`\n✅ Ingestion complete!`);
    console.log(`   Files processed: ${markdownFiles.length}`);
    console.log(`   Total chunks inserted: ${totalChunks}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.error(`Directory not found: ${notesDir}`);
      console.log('Create the directory and add markdown files to ingest them.');
    } else {
      console.error('Error during ingestion:', error);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

