'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Mic } from 'lucide-react';
import { AIMessageBubble } from './AIMessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { cn } from '@/lib/utils/cn';

export interface ChatMessage {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: Date;
  thinking?: boolean;
  confidence?: number;
}

interface ChatWindowProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
}

export function ChatWindow({
  messages,
  onSend,
  isLoading = false,
  placeholder = 'Ask me anything...',
  className = '',
}: ChatWindowProps) {
  const [inputValue, setInputValue] = React.useState('');
  const [isRecording, setIsRecording] = React.useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSend(inputValue);
      setInputValue('');
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={cn('flex flex-col h-full bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900', className)}>
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center justify-center h-full text-center"
            >
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Start a Conversation</h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-sm">
                Ask me to help you find the perfect product or answer any questions you have.
              </p>
            </motion.div>
          )}

          {messages.map((message, idx) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: idx * 0.05 }}
            >
              {message.thinking ? (
                <ThinkingIndicator />
              ) : (
                <AIMessageBubble
                  message={message.content}
                  isUser={message.type === 'user'}
                  confidence={message.confidence}
                  timestamp={message.timestamp}
                />
              )}
            </motion.div>
          ))}

          {isLoading && <ThinkingIndicator key="thinking" />}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        {/* Attachment & Mic Quick Actions */}
        <div className="flex gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            title="Attach files"
          >
            <Paperclip size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setIsRecording(!isRecording)}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isRecording
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            )}
            title={isRecording ? 'Stop recording' : 'Start voice input'}
          >
            <Mic size={20} />
          </motion.button>
        </div>

        {/* Input Field */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={placeholder}
            className={cn(
              'flex-1 px-4 py-3 rounded-lg',
              'border border-gray-200 dark:border-gray-700',
              'bg-white dark:bg-slate-900',
              'text-gray-900 dark:text-white',
              'placeholder-gray-400 dark:placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-transparent',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className={cn(
              'px-4 py-3 rounded-lg font-semibold flex items-center gap-2',
              'bg-gradient-to-r from-primary-600 to-accent-500',
              'text-white shadow-lg',
              'hover:shadow-ai-glow transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'active:scale-95'
            )}
          >
            <Send size={18} />
            <span className="hidden sm:inline">Send</span>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
