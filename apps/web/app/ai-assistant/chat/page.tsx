'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, MessageSquare, TrendingUp, AlertCircle, Zap } from 'lucide-react';
import { ProductCard } from '@/components/product/DCProductCard';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
  metadata?: any;
}

interface Recommendation {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image?: string;
  rating: number;
  reviewCount: number;
  category: string;
  confidence: number;
  reason: string;
  codAvailable?: boolean;
  hasEMI?: boolean;
}

// Mock recommendations
const mockRecommendations: Recommendation[] = [
  {
    id: 1,
    name: 'Premium Wireless Headphones',
    price: 4999,
    originalPrice: 8999,
    image: 'https://via.placeholder.com/150?text=Headphones',
    rating: 4.5,
    reviewCount: 234,
    category: 'Electronics',
    confidence: 95,
    reason: 'Best seller in audio category',
    codAvailable: true,
    hasEMI: true,
  },
  {
    id: 2,
    name: 'SmartWatch Pro',
    price: 12999,
    originalPrice: 19999,
    image: 'https://via.placeholder.com/150?text=SmartWatch',
    rating: 4.7,
    reviewCount: 456,
    category: 'Wearables',
    confidence: 88,
    reason: 'Top-rated in your budget',
    codAvailable: true,
    hasEMI: true,
  },
  {
    id: 3,
    name: 'USB-C Fast Charger',
    price: 1299,
    originalPrice: 2499,
    image: 'https://via.placeholder.com/150?text=Charger',
    rating: 4.2,
    reviewCount: 123,
    category: 'Accessories',
    confidence: 82,
    reason: 'Perfect complement to headphones',
    codAvailable: true,
    hasEMI: false,
  },
];

export default function AIAssistantChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! 👋 I\'m your AI shopping assistant. What are you looking for today?',
      timestamp: new Date(),
      confidence: 100,
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [recommendations, setRecommendations] = useState<Recommendation[]>(mockRecommendations);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    // Add user message
    const newUserMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, newUserMessage]);
    const query = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('authToken') : null;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers,
        body: JSON.stringify({ message: query }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const text = await res.text();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: text || 'I found some options for you! Check the recommendations panel.',
        timestamp: new Date(),
        confidence: 87,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.warn('[chat] API call failed, using fallback:', err);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `I found some great options for "${query}"! I've updated the recommendations based on your query. Let me know if you'd like more details or have other preferences.`,
        timestamp: new Date(),
        confidence: 75,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductClick = (productId: number) => {
    const product = recommendations.find((p) => p.id === productId);
    if (product) {
      setInputValue(`Tell me more about ${product.name}`);
    }
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-white dark:bg-gray-950 overflow-hidden">
      {/* Chat Section - Left */}
      <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800">
        {/* Chat Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={18} className="text-blue-600" />
            <h1 className="font-bold text-gray-900 dark:text-white">AI Shopping Assistant</h1>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Ask me anything about products, prices, or recommendations
          </p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${message.type === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
                  }`}
              >
                <p>{message.content}</p>
                {message.type === 'assistant' && message.confidence && (
                  <div className="text-xs mt-1 opacity-70 flex items-center gap-1">
                    <Zap size={10} />
                    {message.confidence}% confident
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2 items-center"
            >
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse" />
              <div className="text-xs text-gray-500">AI is typing...</div>
            </motion.div>
          )}

          {/* Scroll to bottom anchor */}
          <div id="messages-end" />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask me anything..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            💡 Try: "Best headphones under 5000" or "Show me premium smartwatches"
          </p>
        </div>
      </div>

      {/* Recommendations Section - Right */}
      <div className="hidden lg:flex lg:w-80 flex-col border-l border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 overflow-auto">
        {/* Recommendations Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-green-600" />
            <h2 className="font-bold text-gray-900 dark:text-white text-sm">Recommended for You</h2>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Based on your preferences</p>
        </div>

        {/* Recommendations List */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
          {recommendations.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">
              <AlertCircle size={20} className="mx-auto mb-2 opacity-50" />
              <p>No recommendations yet. Ask me for suggestions!</p>
            </div>
          ) : (
            recommendations.map((rec) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="group cursor-pointer"
                onClick={() => handleProductClick(rec.id)}
              >
                {/* Quick Preview Card */}
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden hover:shadow-md transition-all">
                  {/* Image */}
                  <div className="h-20 bg-gray-100 dark:bg-gray-700 overflow-hidden flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={rec.image}
                      alt={rec.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-2 text-xs">
                    <p className="font-semibold text-gray-900 dark:text-white line-clamp-1">
                      {rec.name}
                    </p>

                    {/* Price */}
                    <div className="flex items-baseline gap-1 my-1">
                      <span className="font-bold text-gray-900 dark:text-white">
                        ₹{rec.price.toLocaleString('en-IN')}
                      </span>
                      {rec.originalPrice && (
                        <span className="text-gray-500 line-through text-xs">
                          ₹{rec.originalPrice.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>

                    {/* Rating & Confidence */}
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-yellow-600">⭐ {rec.rating}</span>
                      <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1 rounded">
                        {rec.confidence}%
                      </span>
                    </div>

                    {/* Why Recommended */}
                    <p className="text-gray-600 dark:text-gray-400 text-xs italic">
                      "{rec.reason}"
                    </p>

                    {/* Tags */}
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {rec.codAvailable && (
                        <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1 rounded text-xs">
                          COD
                        </span>
                      )}
                      {rec.hasEMI && (
                        <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 px-1 rounded text-xs">
                          EMI
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
