'use client';

import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { Bot } from 'lucide-react';
import { ChatInterface } from '@/components/chat/chat-interface';
import { FileUpload } from '@/components/upload/file-upload';
import { EmbeddingsList } from '@/components/embeddings/embeddings-list';
import { ChatList, ChatListRef } from '@/components/chat/chat-list';
import { useState, useCallback, useRef } from 'react';

export default function Home() {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [chatKey, setChatKey] = useState(0); // Force remount on new chat
  const chatListRef = useRef<ChatListRef>(null);

  const handleSelectChat = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
  }, []);

  const handleNewChat = useCallback(() => {
    setSelectedChatId(null);
    setChatKey(prev => prev + 1); // Force remount to clear messages
  }, []);

  const handleChatCreated = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    // Refresh the chat list to show the new chat
    chatListRef.current?.refresh();
  }, []);
  return (
    <main className="flex min-h-screen flex-col items-center bg-gray-50 p-4">
      <div className="w-full max-w-7xl flex flex-col h-[85vh]">
        {/* Header */}
        <div className="p-4 bg-white rounded-lg border border-gray-200 flex justify-between items-center shadow-sm mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Bot className="w-6 h-6 text-blue-600" />
              NoteWise AI
            </h1>
          </div>
          <div>
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 transition-colors">
                  Sign In
                </button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
        </div>

        <SignedOut>
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg shadow-sm border border-gray-200">
            <Bot className="w-16 h-16 text-blue-200 mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Welcome to NoteWise AI</h2>
            <p className="text-gray-500 mb-6 max-w-md">
              Please sign in to access your personal note assistant and start chatting with your knowledge base.
            </p>
            <SignInButton mode="modal">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                Sign In to Continue
              </button>
            </SignInButton>
          </div>
        </SignedOut>

        <SignedIn>
          <div className="flex-1 flex gap-4 min-h-0">
            {/* Left Sidebar - Chat List */}
            <div className="w-64 flex-shrink-0 bg-white rounded-lg border border-gray-200 overflow-hidden">
              <ChatList
                ref={chatListRef}
                selectedChatId={selectedChatId}
                onSelectChat={handleSelectChat}
                onNewChat={handleNewChat}
              />
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col min-h-0">
              <ChatInterface 
                key={chatKey} 
                chatId={selectedChatId} 
                onChatCreated={handleChatCreated}
              />
            </div>
            
            {/* Right Sidebar - Files */}
            <div className="w-72 flex-shrink-0 flex flex-col gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Upload Notes</h2>
                <FileUpload />
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4 flex-1 flex flex-col min-h-0">
                <EmbeddingsList />
              </div>
            </div>
          </div>
        </SignedIn>
      </div>
    </main>
  );
}
