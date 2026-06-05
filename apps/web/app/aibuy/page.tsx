'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState as useFormState } from 'react';
import {
  ArrowRight,
  Lock,
  CheckCircle2,
  Zap,
  Shield,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

const EXAMPLE_PROMPTS = [
  'I need a laptop under ₹1L for coding',
  'Best gaming laptop with RTX 4090',
  'Budget phone under ₹30k with good camera',
  'Lightweight laptop for travel and development',
  'Best value 4K monitor under ₹50k',
];

export default function LandingPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  const handleSearch = (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);
    // Simulate navigation with query
    setTimeout(() => {
      // In real app: router.push(`/copilot?query=${encodeURIComponent(query)}`)
      console.log('Searching for:', query);
    }, 1000);
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-indigo-50/30 overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_400px_at_50%_300px,rgba(99,102,241,0.06),rgba(255,255,255,0))]" />
        <motion.div
          animate={{ y: [-20, 20], rotate: [0, 1] }}
          transition={{ duration: 10, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute top-0 right-0 w-96 h-96 bg-indigo-100/60 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ y: [20, -20], rotate: [1, 0] }}
          transition={{ duration: 12, repeat: Infinity, repeatType: 'reverse' }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-blue-100/60 rounded-full blur-3xl"
        />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header/Nav */}
        <nav className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">AiBuy</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="text-slate-600 hover:text-slate-900 transition">Docs</button>
              <button className="text-slate-600 hover:text-slate-900 transition">Pricing</button>
              <Link
                href="/signin"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
        >
          {/* Headline */}
          <motion.div variants={itemVariants} className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-2 mb-6">
              <Zap className="w-4 h-4 text-indigo-600" />
              <span className="text-sm text-indigo-700 font-medium">
                AI-Powered Shopping Assistant
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-slate-900 mb-6 leading-tight">
              Tell AI what you need.
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 bg-clip-text text-transparent">
                It buys it for you.
              </span>
            </h1>

            <p className="text-xl text-slate-500 max-w-2xl mx-auto">
              Your personal AI shopping agent finds the perfect product, negotiates the best price,
              and completes the purchase. All in seconds.
            </p>
          </motion.div>

          {/* Search Input */}
          <motion.div variants={itemVariants} className="mb-12">
            <div className="relative max-w-3xl mx-auto">
              {/* AI Thinking Animation */}
              <motion.div
                animate={{ y: [-2, 2] }}
                transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                className="absolute top-0 right-6 text-sm text-indigo-400 pointer-events-none"
              >
                <span className="inline-flex">
                  {[...Array(3)].map((_, i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.3, 1] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    >
                      •
                    </motion.span>
                  ))}
                </span>
              </motion.div>

              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={selectedPrompt || searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setSelectedPrompt(null);
                    }}
                    placeholder="I need a laptop under ₹1L for coding"
                    className="w-full px-6 py-4 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-lg shadow-sm"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSearch(selectedPrompt || searchQuery)}
                  disabled={isLoading}
                  className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-600/30 transition-all disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
                >
                  {isLoading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                      />
                      Searching...
                    </>
                  ) : (
                    <>
                      Start AI Shopping
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Example Prompts */}
          <motion.div variants={itemVariants} className="mb-16">
            <p className="text-sm text-slate-500 mb-4 text-center">Try asking about:</p>
            <div className="flex flex-wrap gap-3 justify-center">
              {EXAMPLE_PROMPTS.map((prompt, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setSelectedPrompt(prompt);
                    setSearchQuery(prompt);
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-indigo-50 hover:border-indigo-200 transition-all text-sm shadow-sm"
                >
                  <MessageSquare className="w-3.5 h-3.5 inline mr-2" />
                  {prompt}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Trust Indicators */}
          <motion.div variants={itemVariants} className="grid grid-cols-3 gap-6 max-w-2xl mx-auto">
            {[
              { icon: Lock, label: 'Secure checkout', desc: 'End-to-end encrypted' },
              {
                icon: CheckCircle2,
                label: 'Verified sellers',
                desc: '1000+ trusted brands',
              },
              {
                icon: Shield,
                label: 'Smart decisions',
                desc: 'AI-powered analysis',
              },
            ].map(({ icon: Icon, label, desc }, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 + idx * 0.1 }}
                className="text-center"
              >
                <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center mx-auto mb-3 border border-indigo-100">
                  <Icon className="w-6 h-6 text-indigo-600" />
                </div>
                <p className="font-semibold text-slate-800">{label}</p>
                <p className="text-sm text-slate-500">{desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* Feature Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-24 border-t border-slate-200"
        >
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
            <h2 className="text-4xl font-bold text-slate-900 mb-12 text-center">
              How AiBuy Works
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {[
                { number: '1', title: 'Chat', desc: 'Describe what you need' },
                {
                  number: '2',
                  title: 'Analyze',
                  desc: 'AI understands your needs',
                },
                { number: '3', title: 'Compare', desc: 'Best options selected' },
                {
                  number: '4',
                  title: 'Buy',
                  desc: 'One-click purchase',
                },
              ].map(({ number, title, desc }, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm hover:shadow-md transition-all"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg mx-auto mb-4">
                    {number}
                  </div>
                  <h3 className="font-semibold text-slate-800 mb-2">{title}</h3>
                  <p className="text-sm text-slate-500">{desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* CTA Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="border-t border-slate-200 py-16"
        >
          <div className="max-w-2xl mx-auto px-4 text-center">
            <h3 className="text-3xl font-bold text-slate-900 mb-6">
              Ready to revolutionize your shopping?
            </h3>
            <p className="text-slate-500 mb-8">
              Join thousands of users who save time and money with AiBuy
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-indigo-600/30 transition-all inline-flex items-center gap-2"
            >
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
