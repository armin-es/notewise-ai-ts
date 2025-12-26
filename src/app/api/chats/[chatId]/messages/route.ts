import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { chats, chatMessages } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';

// GET /api/chats/[chatId]/messages - Get all messages for a chat
export async function GET(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { chatId } = await params;

    // Verify the chat belongs to the user
    const [chat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));

    if (!chat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(asc(chatMessages.createdAt));

    return new Response(JSON.stringify(messages), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch messages' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// POST /api/chats/[chatId]/messages - Add a message to a chat
export async function POST(
  req: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { chatId } = await params;
    const { role, content, sources } = await req.json();

    // Verify the chat belongs to the user
    const [chat] = await db
      .select()
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)));

    if (!chat) {
      return new Response(JSON.stringify({ error: 'Chat not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [newMessage] = await db
      .insert(chatMessages)
      .values({ chatId, role, content, sources })
      .returning();

    // Update chat's updatedAt timestamp
    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    return new Response(JSON.stringify(newMessage), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error adding message:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to add message' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

