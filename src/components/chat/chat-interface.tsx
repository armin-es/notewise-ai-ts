'use client';

import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { Send, Bot, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function ChatInterface() {
  const { messages, sendMessage, status } = useChat({
    transport: new TextStreamChatTransport({ api: '/api/chat' }),
  });
  
  const isLoading = status === 'submitted' || status === 'streaming';
  
  const [input, setInput] = useState('');
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage({ text: input });
    setInput('');
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messagesEndRef.current && messagesContainerRef.current) {
      // Use scrollTo instead of scrollIntoView to avoid passive listener warnings
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
            <div
              className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {m.parts.map((part, index) => (
                part.type === 'text' ? <span key={index}>{part.text}</span> : null
              ))}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {isLoading && (
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
