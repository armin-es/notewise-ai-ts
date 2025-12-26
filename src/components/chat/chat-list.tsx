'use client';

import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';

interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatListProps {
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
}

export interface ChatListRef {
  refresh: () => void;
}

export const ChatList = forwardRef<ChatListRef, ChatListProps>(function ChatList(
  { selectedChatId, onSelectChat, onNewChat },
  ref
) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/chats');
      if (!res.ok) throw new Error('Failed to fetch chats');
      const data = await res.json();
      setChats(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chats');
    } finally {
      setLoading(false);
    }
  }, []);

  // Expose refresh method to parent
  useImperativeHandle(ref, () => ({
    refresh: fetchChats,
  }), [fetchChats]);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleDelete = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId) return;
    
    setDeletingId(chatId);
    try {
      const res = await fetch('/api/chats', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });
      
      if (!res.ok) throw new Error('Failed to delete chat');
      
      setChats(prev => prev.filter(c => c.id !== chatId));
      
      // If we deleted the selected chat, clear selection
      if (selectedChatId === chatId) {
        onNewChat();
      }
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="text-sm text-red-500 text-center py-4">
            {error}
          </div>
        )}

        {!loading && !error && chats.length === 0 && (
          <div className="text-sm text-gray-400 text-center py-8">
            No chats yet
          </div>
        )}

        {chats.map((chat) => (
          <button
            key={chat.id}
            onClick={() => onSelectChat(chat.id)}
            className={`w-full group flex items-center gap-2 px-3 py-2 text-left rounded-lg transition-colors ${
              selectedChatId === chat.id
                ? 'bg-blue-100 text-blue-700'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <MessageSquare className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{chat.title}</div>
              <div className="text-xs text-gray-400">{formatDate(chat.updatedAt)}</div>
            </div>
            <button
              onClick={(e) => handleDelete(chat.id, e)}
              className={`p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ${
                deletingId === chat.id ? 'opacity-100' : ''
              }`}
              disabled={deletingId === chat.id}
            >
              {deletingId === chat.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </button>
        ))}
      </div>
    </div>
  );
});

