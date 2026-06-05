'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageCircle } from 'lucide-react';
import { useChatStore } from '@/lib/stores';
import { ChatMessage as ChatMessageType } from '@/types';
import { SkeletonLoader } from '@/components/ui/base';

interface ChatWindowProps {
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
  showProductCards?: boolean;
}

export function ChatWindow({
  onSendMessage,
  isLoading = false,
  showProductCards = true,
}: ChatWindowProps) {
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState('');

  const { messages } = useChatStore();

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      onSendMessage?.(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-white to-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 backdrop-blur-sm px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">AI Shopping Copilot</h1>
            <p className="text-sm text-gray-500">Powered by advanced ranking</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesRef}
        className="flex-1 overflow-y-auto px-6 py-8 space-y-6"
      >
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isLast={idx === messages.length - 1}
                showProducts={showProductCards}
              />
            ))}
          </AnimatePresence>
        )}

        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-end space-x-3"
          >
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex-shrink-0" />
            <div className="space-y-2">
              <SkeletonLoader count={1} height="h-4" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Input Area */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white px-6 py-4">
        <div className="flex space-x-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Tell me what you're looking for..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          <motion.button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Send className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

function ChatMessageBubble({
  message,
  isLast,
  showProducts,
}: {
  message: ChatMessageType;
  isLast: boolean;
  showProducts: boolean;
}) {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-xs lg:max-w-md ${
          isUser
            ? 'bg-indigo-600 text-white rounded-3xl rounded-tr-lg'
            : 'bg-gray-100 text-gray-900 rounded-3xl rounded-tl-lg'
        } px-4 py-3 text-sm leading-relaxed`}
      >
        {message.content}
      </div>
    </motion.div>
  );
}

function EmptyState() {
  const suggestions = [
    '🎧 Find the best wireless headphones under ₹8,000',
    '📱 Compare flagship phones with good cameras',
    '⌚ Smart watches with long battery life',
    '💻 Laptops for coding and video editing',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col items-center justify-center text-center space-y-8"
    >
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center">
        <MessageCircle className="w-8 h-8 text-white" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Welcome to AI Shopping
        </h2>
        <p className="text-gray-600">
          Describe what you're looking for and let AI handle the rest
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {suggestions.map((suggestion, i) => (
          <motion.button
            key={i}
            whileHover={{ scale: 1.05 }}
            className="px-4 py-3 rounded-xl bg-gray-100 hover:bg-gray-200 text-left text-sm font-medium text-gray-700 transition"
          >
            {suggestion}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
