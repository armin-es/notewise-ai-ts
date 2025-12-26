'use client';

import { useChat, type Message } from 'ai/react';
import { Send, Bot, User, FileText } from 'lucide-react';
import { useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface ParsedSource {
  name: string;
  relevance: number;
}

function parseSourcesFromContent(content: string): { mainContent: string; sources: ParsedSource[] } {
  const sourcesMatch = content.match(/---sources---\n([\s\S]*?)---end-sources---/);
  
  if (!sourcesMatch) {
    return { mainContent: content, sources: [] };
  }
  
  const mainContent = content.replace(/---sources---[\s\S]*?---end-sources---/, '').trim();
  const sourcesText = sourcesMatch[1];
  
  const sources: ParsedSource[] = [];
  const lines = sourcesText.split('\n').filter(line => line.trim().startsWith('-'));
  
  for (const line of lines) {
    const match = line.match(/^-\s*(.+?)\s*\(relevance:\s*([\d.]+)\)/);
    if (match) {
      sources.push({
        name: match[1].trim(),
        relevance: parseFloat(match[2]),
      });
    }
  }
  
  return { mainContent, sources };
}

function SourceBadge({ source }: { source: ParsedSource }) {
  const relevancePercent = Math.round(source.relevance * 100);
  const relevanceColor = relevancePercent >= 80 
    ? 'bg-green-100 text-green-700 border-green-200' 
    : relevancePercent >= 60 
    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-gray-100 text-gray-600 border-gray-200';
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs ${relevanceColor}`}>
      <FileText className="w-3 h-3" />
      <span className="font-medium">{source.name}</span>
      <span className="opacity-70">{relevancePercent}%</span>
    </div>
  );
}

function MessageContent({ message }: { message: { role: string; content: string } }) {
  const { mainContent, sources } = useMemo(
    () => parseSourcesFromContent(message.content),
    [message.content]
  );

  if (message.role === 'user') {
    return (
      <div className="max-w-[85%] rounded-lg p-3 text-sm bg-blue-600 text-white">
        <span className="whitespace-pre-wrap">{message.content}</span>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="max-w-[85%] space-y-2">
      <div className="rounded-lg p-3 text-sm bg-gray-100 text-gray-800">
        {mainContent ? (
          <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-headings:my-2 prose-pre:bg-gray-800 prose-pre:text-gray-100 prose-code:text-blue-600 prose-code:bg-blue-50 prose-code:px-1 prose-code:rounded">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {mainContent}
            </ReactMarkdown>
          </div>
        ) : (
          <span className="text-gray-400 italic">Thinking...</span>
        )}
      </div>
      
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-1">
          {sources.map((source, idx) => (
            <SourceBadge key={idx} source={source} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ChatInterfaceProps {
  chatId?: string | null;
  onChatCreated?: (chatId: string, title: string) => void;
}

export function ChatInterface({ 
  chatId, 
  onChatCreated,
}: ChatInterfaceProps) {
  const currentChatIdRef = useRef<string | null>(chatId || null);
  const lastSavedMessageCountRef = useRef<number>(0);
  
  const { messages, input, handleInputChange, handleSubmit: originalHandleSubmit, isLoading, setMessages } = useChat({
    api: '/api/chat',
    id: chatId || undefined,
    onFinish: async (message) => {
      // Save assistant message to database
      if (currentChatIdRef.current) {
        await saveMessage(currentChatIdRef.current, 'assistant', message.content);
      }
    },
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async (id: string | null | undefined) => {
    // Validate chatId before making request
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return;
    }
    
    try {
      const res = await fetch(`/api/chats/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        const formattedMessages: Message[] = data.map((m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        setMessages(formattedMessages);
        lastSavedMessageCountRef.current = formattedMessages.length;
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  }, [setMessages]);

  // Load messages when chatId changes
  useEffect(() => {
    if (chatId && typeof chatId === 'string' && chatId.trim() !== '') {
      currentChatIdRef.current = chatId;
      loadMessages(chatId);
    } else {
      currentChatIdRef.current = null;
      setMessages([]);
      lastSavedMessageCountRef.current = 0;
    }
  }, [chatId, loadMessages, setMessages]);

  const saveMessage = async (chatId: string, role: string, content: string) => {
    if (!chatId || typeof chatId !== 'string' || chatId.trim() === '') {
      console.error('Invalid chatId for saving message');
      return;
    }
    
    try {
      await fetch(`/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, content }),
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
  };

  const createChat = async (firstMessage: string): Promise<string | null> => {
    try {
      // Generate a title from the first message (first 50 chars)
      const title = firstMessage.length > 50 
        ? firstMessage.substring(0, 47) + '...' 
        : firstMessage;
      
      const res = await fetch('/api/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      
      if (res.ok) {
        const chat = await res.json();
        currentChatIdRef.current = chat.id;
        if (onChatCreated) {
          onChatCreated(chat.id, title);
        }
        return chat.id;
      }
    } catch (error) {
      console.error('Failed to create chat:', error);
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    
    // If no chat exists, create one first
    if (!currentChatIdRef.current) {
      const newChatId = await createChat(userMessage);
      if (!newChatId) {
        console.error('Failed to create chat');
        return;
      }
    }

    // Save user message to database
    if (currentChatIdRef.current) {
      await saveMessage(currentChatIdRef.current, 'user', userMessage);
    }

    // Now call the original submit handler
    originalHandleSubmit(e);
  };

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messagesEndRef.current && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <Bot className="w-12 h-12 mx-auto mb-2 text-blue-200" />
            <p>Start a conversation with your notes.</p>
          </div>
        )}
        
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${
              m.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {m.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-blue-600" />
              </div>
            )}
            <MessageContent message={m} />
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-500 animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t bg-white">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-black placeholder-gray-400"
            value={input}
            onChange={handleInputChange}
            placeholder="Ask anything..."
            disabled={isLoading}
          />
          <button
            type="submit"
            className="bg-blue-600 text-white rounded-lg px-4 py-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={isLoading || !input.trim()}
          >
             <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
