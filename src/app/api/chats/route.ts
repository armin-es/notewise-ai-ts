import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { chats, chatMessages } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET /api/chats - List all chats for the current user
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const userChats = await db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.updatedAt));

    return new Response(JSON.stringify(userChats), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch chats' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/chats - Create a new chat
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const title = body.title || 'New Chat';

    const [newChat] = await db
      .insert(chats)
      .values({ userId, title })
      .returning();

    return new Response(JSON.stringify(newChat), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create chat' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// DELETE /api/chats - Delete a chat (with chatId in body)
export async function DELETE(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { chatId } = await req.json();
    
    if (!chatId) {
      return new Response(JSON.stringify({ error: 'Chat ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only delete if the chat belongs to the user
    await db
      .delete(chats)
      .where(eq(chats.id, chatId));

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete chat' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

