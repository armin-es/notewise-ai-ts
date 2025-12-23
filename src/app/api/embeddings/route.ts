import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { embeddings } from '@/lib/db/schema';
import { auth } from '@clerk/nextjs/server';
import { eq, sql } from 'drizzle-orm';

/**
 * GET /api/embeddings
 * List all unique files that have been embedded, grouped by source/file name
 */
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all embeddings grouped by source (file name)
    // Using raw SQL for better aggregation
    const result = await db.execute(sql`
      SELECT 
        metadata->>'source' as source,
        metadata->>'fileName' as "fileName",
        COUNT(*)::int as "chunkCount",
        MIN(created_at) as "firstUploaded",
        MAX(created_at) as "lastUpdated",
        array_agg(id::text) as "embeddingIds"
      FROM embeddings
      WHERE metadata->>'source' IS NOT NULL
      GROUP BY metadata->>'source', metadata->>'fileName'
      ORDER BY MAX(created_at) DESC
    `);

    // Transform the results (handle different result formats from drizzle)
    const rows = (result as any).rows || (Array.isArray(result) ? result : []);
    const fileList = rows.map((row: any) => ({
      source: row.source || 'unknown',
      fileName: row.fileName || row.filename || row.source || 'unknown',
      chunkCount: typeof row.chunkCount === 'number' ? row.chunkCount : parseInt(String(row.chunkcount || row.chunkCount || '0'), 10),
      firstUploaded: row.firstUploaded || row.firstuploaded || null,
      lastUpdated: row.lastUpdated || row.lastupdated || null,
      embeddingIds: Array.isArray(row.embeddingIds) ? row.embeddingIds : (Array.isArray(row.embeddingids) ? row.embeddingids : []),
    }));

    return NextResponse.json({ files: fileList });
  } catch (error) {
    console.error('Error fetching embeddings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch embeddings',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/embeddings?source=filename.md
 * Delete all embeddings for a specific file/source
 */
export async function DELETE(req: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const searchParams = req.nextUrl.searchParams;
    const source = searchParams.get('source');

    if (!source) {
      return NextResponse.json(
        { error: 'Source parameter is required' },
        { status: 400 }
      );
    }

    // Delete all embeddings where metadata->>'source' matches
    const deleted = await db
      .delete(embeddings)
      .where(sql`${embeddings.metadata}->>'source' = ${source}`)
      .returning({ id: embeddings.id });

    return NextResponse.json({
      success: true,
      deletedCount: deleted.length,
      source,
      message: `Deleted ${deleted.length} chunk(s) for ${source}`,
    });
  } catch (error) {
    console.error('Error deleting embeddings:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete embeddings',
      },
      { status: 500 }
    );
  }
}

