'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  HelpCircle, ChevronLeft, ChevronDown, ChevronUp,
  MessageSquare, Send, Bot, User, Mail, Phone,
  CheckCircle, Clock,
} from 'lucide-react';

type FAQ = { q: string; a: string };
const FAQS: FAQ[] = [
  {
    q: 'How does the AI shopping delegate work?',
    a: 'The AI delegate learns your preferences, budget, and shopping history to autonomously browse products, compare prices, and recommend the best deals tailored to you. You stay in control — the AI only acts on your confirmed instructions.',
  },
  {
    q: 'How do I track my order?',
    a: 'Go to Account → Your Orders. Each order shows real-time status (Processing, Shipped, Delivered). Click "Details" on any order to see the full tracking timeline.',
  },
  {
    q: 'What is the return policy?',
    a: 'Most items are eligible for a 10-day return window from delivery date. Electronics have a 7-day policy. To initiate a return, visit Your Orders and click the return option on the delivered item.',
  },
  {
    q: 'How do price drop alerts work?',
    a: 'When you wishlist a product, the AI monitors its price across our catalog and sends you a notification (email or push) when the price drops by 5% or more.',
  },
  {
    q: 'Is my payment information secure?',
    a: 'Yes. We never store raw card details. All payments are processed through PCI-DSS certified payment gateways with end-to-end encryption. You can also pay via UPI, net banking, or COD.',
  },
  {
    q: 'How do I cancel an order?',
    a: 'Orders can be cancelled before they are shipped. Go to Your Orders, find the order, and click "Cancel". Once shipped, you will need to raise a return request after delivery.',
  },
  {
    q: 'How do I change my delivery address?',
    a: 'Go to Account → Your Addresses to add, edit, or remove delivery addresses. You can also update the address during checkout before confirming the order.',
  },
];

type ChatMessage = { role: 'user' | 'bot'; text: string };

const BOT_RESPONSES: Record<string, string> = {
  default: "I'm here to help! You can ask me about orders, returns, payments, shipping, or how the AI delegate works.",
  order: "To track your order, go to Account → Your Orders. You can see real-time status there. Need help with a specific order ID?",
  return: "Returns are accepted within 10 days of delivery for most items. Visit Your Orders and select the delivered item to start the return process.",
  payment: "We accept cards, UPI, net banking, and COD. All transactions are secured with end-to-end encryption.",
  delivery: "Standard delivery takes 1–3 business days. Free delivery is available on orders above ₹499.",
  password: "You can change your password under Account → Login & Security. Look for the 'Change Password' section.",
  cancel: "To cancel an order, visit Your Orders before it is shipped and click Cancel. After shipping, you'll need to wait for delivery and then initiate a return.",
};

function getAIResponse(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes('order') || lower.includes('track')) return BOT_RESPONSES.order;
  if (lower.includes('return') || lower.includes('refund')) return BOT_RESPONSES.return;
  if (lower.includes('pay') || lower.includes('card') || lower.includes('upi')) return BOT_RESPONSES.payment;
  if (lower.includes('deliver') || lower.includes('ship')) return BOT_RESPONSES.delivery;
  if (lower.includes('password') || lower.includes('security')) return BOT_RESPONSES.password;
  if (lower.includes('cancel')) return BOT_RESPONSES.cancel;
  return BOT_RESPONSES.default;
}

export default function HelpPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'bot', text: "Hi! I'm your DelegateCart support assistant. How can I help you today?" },
  ]);
  const [contactForm, setContactForm] = useState({ subject: '', message: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) { router.push('/signin'); return; }
    setMounted(true);
  }, [router]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', text }]);
    setChatInput('');
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMessages(prev => [...prev, { role: 'bot', text: getAIResponse(text) }]);
    }, 900 + Math.random() * 600);
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setContactForm({ subject: '', message: '', email: '' });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <Link href="/account" className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-4 transition-colors">
            <ChevronLeft className="w-4 h-4" /> Back to Account
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Help &amp; Support</h1>
              <p className="text-white/80 text-sm">FAQs, AI chat support, and contact options</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left column: FAQ + Contact */}
        <div className="space-y-6">

          {/* FAQ Accordion */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Frequently Asked Questions</h2>
            </div>
            <div className="space-y-1">
              {FAQS.map((faq, i) => (
                <div key={i} className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white pr-2">{faq.q}</span>
                    {openFaq === i
                      ? <ChevronUp className="w-4 h-4 text-teal-500 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {openFaq === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-3 pb-3 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Contact Form */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">Contact Support</h2>
            </div>

            {submitted ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircle className="w-10 h-10 text-green-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Ticket submitted!</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center">We'll respond within 24 hours. Check your email for a confirmation.</p>
                <button onClick={() => setSubmitted(false)} className="text-xs text-blue-600 font-medium hover:underline mt-1">Submit another</button>
              </div>
            ) : (
              <form onSubmit={handleContactSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                  <input
                    required
                    type="email"
                    value={contactForm.email}
                    onChange={e => setContactForm(p => ({ ...p, email: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Subject</label>
                  <input
                    required
                    type="text"
                    value={contactForm.subject}
                    onChange={e => setContactForm(p => ({ ...p, subject: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                    placeholder="Subject (e.g. Order issue, refund request)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={contactForm.message}
                    onChange={e => setContactForm(p => ({ ...p, message: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none resize-none"
                    placeholder="Describe your issue in detail..."
                  />
                </div>
                <button type="submit"
                  className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-lg transition-colors">
                  Submit Ticket
                </button>
              </form>
            )}

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Phone className="w-3.5 h-3.5" /> 1800-123-4567 (9AM–9PM)
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3.5 h-3.5" /> Avg. reply: 4–6 hrs
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right column: AI Chat */}
        <div>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden flex flex-col" style={{ height: '640px' }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-900/20 dark:to-cyan-900/20">
              <div className="w-7 h-7 bg-teal-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">AI Support Assistant</p>
                <p className="text-[10px] text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" /> Online
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex items-end gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'bot' && (
                    <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                  )}
                  <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-sm'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm'
                  }`}>
                    {msg.text}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
                    </div>
                  )}
                </div>
              ))}
              {typing && (
                <div className="flex items-end gap-2">
                  <div className="w-6 h-6 bg-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-2xl rounded-bl-sm">
                    <div className="flex gap-1">
                      {[0, 1, 2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick suggestions */}
            <div className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide border-t border-gray-100 dark:border-gray-800">
              {['Track my order', 'Return policy', 'Cancel order', 'Payment issue'].map(q => (
                <button
                  key={q}
                  onClick={() => { setChatInput(q); }}
                  className="whitespace-nowrap text-xs px-2.5 py-1 border border-gray-200 dark:border-gray-700 rounded-full text-gray-700 dark:text-gray-300 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700 dark:hover:bg-teal-900/20 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-800 flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none"
                placeholder="Type your question…"
              />
              <button
                onClick={sendMessage}
                disabled={!chatInput.trim() || typing}
                className="p-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
