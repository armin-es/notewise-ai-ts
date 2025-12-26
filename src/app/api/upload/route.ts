import { NextRequest, NextResponse } from 'next/server';
import { insertEmbedding } from '@/lib/rag/vectorStore';
import { auth } from '@clerk/nextjs/server';

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

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Only accept markdown files
    if (!file.name.endsWith('.md') && file.type !== 'text/markdown') {
      return NextResponse.json(
        { error: 'Only markdown (.md) files are supported' },
        { status: 400 }
      );
    }

    // Read file content
    const text = await file.text();
    
    // Remove markdown metadata/frontmatter if present
    const cleanedContent = text.replace(/^---[\s\S]*?---\n/, '');
    
    // Split into chunks
    const chunks = chunkText(cleanedContent);
    
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: 'File appears to be empty after processing' },
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
    console.error('Upload error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process file',
      },
      { status: 500 }
    );
  }
}

