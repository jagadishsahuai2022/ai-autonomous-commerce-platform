'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  MessageSquare,
  Zap,
  TrendingUp,
  Search,
} from 'lucide-react';
import { ProductCard } from '@/components/shared/ProductCard';
import { useAISearch } from '@/hooks/useAI';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  products?: any[];
  isStreaming?: boolean;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Phase 1 & 2: Wire real AI hooks with search + ranking
  const { parsed: parseQuery, ranked: rankQuery, isLoading: isAISearching, isError } = useAISearch(currentQuery, isLoading);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Phase 1: Add user message
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const query = inputValue;
    setInputValue('');
    setIsLoading(true);

    // Phase 1: Trigger AI search flow
    setCurrentQuery(query);

    // Wait a bit for AI processing
    try {
      // Simulate API delay - in reality this is handled by the hook
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Get ranked products from the hook
      const rankedProducts = rankQuery.data || [];
      
      // Add AI response with products
      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `I found some great options for you. Based on your search for "${query}", here are the top-ranked products.`,
        timestamp: new Date(),
        products: rankedProducts,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'Sorry, I had trouble searching for products. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentQuery(null);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Left Panel - Chat */}
      <motion.div
        initial={{ x: -400 }}
        animate={{ x: 0 }}
        className="flex-1 flex flex-col border-r border-slate-200"
      >
        {/* Chat Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-blue-600 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900">AI Shopping Copilot</h1>
                <p className="text-sm text-slate-600">Always thinking, finding you the best</p>
              </div>
            </div>
            <button className="p-2 hover:bg-slate-100 rounded-lg transition">
              <Zap className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence>
            {messages.map((message, idx) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex flex-col ${message.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* Message Bubble */}
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-900 rounded-bl-none'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                </div>
                
                {/* Products if included */}
                {message.products && message.products.length > 0 && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-4 w-full space-y-3"
                  >
                    {message.products.slice(0, 3).map((product: any) => (
                      <div key={product.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 hover:border-blue-300 transition">
                        <h4 className="font-semibold text-sm text-slate-900 mb-1">{product.name}</h4>
                        <div className="flex justify-between items-center">
                          <span className="text-blue-600 font-bold">₹{product.price.toLocaleString('en-IN')}</span>
                          <span className="text-xs text-slate-600">⭐ {product.rating}</span>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isAISearching && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-none">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  <span className="text-sm text-slate-600">Searching and ranking products...</span>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-white border-t border-slate-200 p-4">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask me anything..."
              className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            />
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={isLoading}
              className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>
          </form>
        </div>
      </motion.div>

      {/* Right Panel - Decision & Processing  */}
      <motion.div
        initial={{ x: 400 }}
        animate={{ x: 0 }}
        className="w-96 border-l border-slate-200 bg-white overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4">
          <h2 className="font-bold text-slate-900">AI is working...</h2>
          <p className="text-sm text-slate-600">Live processing updates</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Processing Steps */}
          <div className="space-y-3">
            {[
              { icon: MessageSquare, label: 'Understanding intent', done: true },
              { icon: Search, label: 'Searching products', done: true },
              { icon: TrendingUp, label: 'Ranking options', done: false },
            ].map(({ icon: Icon, label, done }, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="flex items-center gap-3"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    done
                      ? 'bg-green-500 text-white'
                      : 'bg-indigo-100 text-indigo-600'
                  }`}
                >
                  {done ? (
                    <motion.span animate={{ scale: [1, 1.2, 1] }} className="text-lg">
                      ✓
                    </motion.span>
                  ) : (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                  )}
                </div>
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </motion.div>
            ))}
          </div>

          {/* Top Products Preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8"
          >
            <h3 className="font-semibold text-slate-900 mb-3">Top Recommendations</h3>
            <div className="space-y-3">
              {rankQuery.data && rankQuery.data.slice(0, 2).map((product: any, idx: number) => (
                <motion.div
                  key={product.id}
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.6 + idx * 0.1 }}
                  className="bg-slate-50 rounded-lg p-3 border border-slate-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-indigo-600">
                      #{idx + 1} Match
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 line-clamp-1">{product.name}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-bold text-slate-900">
                      ₹{product.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                </motion.div>
              ))}
              {!rankQuery.data && (
                <div className="text-center py-8 text-slate-500">
                  <p>Waiting for search results...</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Processing Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="bg-indigo-50 rounded-lg p-4 border border-indigo-200"
          >
            <div className="grid grid-cols-2 gap-3 text-center">
              <div>
                <p className="text-xs text-indigo-600 font-medium">Products searched</p>
                <p className="text-lg font-bold text-indigo-900">847</p>
              </div>
              <div>
                <p className="text-xs text-indigo-600 font-medium">Processing time</p>
                <p className="text-lg font-bold text-indigo-900">2.3s</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
