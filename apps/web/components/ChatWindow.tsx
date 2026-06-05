/**
 * ChatWindow Component
 * Main container for AI chat interface with conversation history
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { useChat } from '@/hooks/useChat';
import { Loader2, MessageSquare, X } from 'lucide-react';
interface ChatWindowProps {
  userId: number;
  onClose?: () => void;
  title?: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  userId,
  onClose,
  title = 'Shopping Assistant',
}) => {
  const {
    messages,
    loading,
    error,
    sendMessage,
    clearHistory,
    suggestions,
  } = useChat(userId);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [inputValue, setInputValue] = useState('');

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text: string) => {
    if (text.trim()) {
      setInputValue('');
      await sendMessage(text);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
  };

  const renderMessage = (message: any, index: number) => (
    <ChatMessage
      key={index}
      role={message.role}
      content={message.content}
      timestamp={message.createdAt}
      products={message.products}
      intent={message.intent}
    />
  );

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-white" />
          <h2 className="text-white font-semibold">{title}</h2>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-blue-800 rounded-md transition-colors"
            aria-label="Close chat"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Start a conversation with our shopping assistant!</p>
            {suggestions && suggestions.length > 0 && (
              <div className="mt-4 w-full">
                <p className="text-xs font-semibold mb-2">Try asking about:</p>
                {suggestions.map((suggestion: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="block w-full text-left text-xs bg-blue-50 hover:bg-blue-100 p-2 rounded mb-2 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message, index) => renderMessage(message, index))}
            {loading && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t p-4 bg-gray-50">
        <ChatInput
          onSend={handleSendMessage}
          disabled={loading}
          placeholder="Ask me about products, prices, recommendations..."
        />
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Clear conversation
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
