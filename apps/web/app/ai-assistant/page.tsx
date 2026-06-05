'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  MessageSquare,
  Zap,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function AIAssistantPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

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
      transition: { duration: 0.5 },
    },
  };

  const features = [
    {
      icon: MessageSquare,
      title: 'Natural Conversations',
      desc: 'Chat naturally as if you\'re talking to a friend. The AI understands context and follows up intelligently.',
    },
    {
      icon: Zap,
      title: 'Instant Responses',
      desc: 'Get instant answers and recommendations in under 100ms. No waiting, no frustration.',
    },
    {
      icon: Target,
      title: 'Personalized Results',
      desc: 'Results are tailored to your preferences, budget, and shopping history.',
    },
  ];

  const steps = [
    { step: '1', title: 'Ask a Question', desc: 'Chat naturally about what you\'re looking for' },
    { step: '2', title: 'AI Understands Intent', desc: 'Our AI parses your request intelligently' },
    { step: '3', title: 'Get Recommendations', desc: 'Receive personalized product suggestions' },
    { step: '4', title: 'Make Purchase', desc: 'Complete your transaction seamlessly' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20"
      >
        <div className="text-center mb-12">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring' }}
            className="inline-block w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mb-6"
          >
            <Sparkles className="w-8 h-8 text-white" suppressHydrationWarning />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl font-bold text-slate-900 mb-4"
          >
            AI Shopping Assistant
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="text-xl text-slate-600 max-w-2xl mx-auto"
          >
            Your intelligent personal shopping companion powered by advanced AI
          </motion.p>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* How It Works */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20"
        >
          {/* Left: Steps */}
          <motion.div className="bg-white p-8 rounded-2xl shadow-lg border border-slate-200">
            <motion.h2
              variants={itemVariants}
              className="text-3xl font-bold text-slate-900 mb-8 flex items-center gap-2"
            >
              <Sparkles className="w-8 h-8 text-blue-600" suppressHydrationWarning />
              How It Works
            </motion.h2>
            <div className="space-y-6">
              {steps.map((item, index) => (
                <motion.div
                  key={item.step}
                  variants={itemVariants}
                  className="flex gap-4 group"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    transition={{ type: 'spring' }}
                    className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center font-bold group-hover:shadow-lg transition-all"
                  >
                    {item.step}
                  </motion.div>
                  <div>
                    <p className="font-semibold text-slate-900 text-lg">
                      {item.title}
                    </p>
                    <p className="text-slate-600 text-sm">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: Feature Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-6"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={itemVariants}
                  whileHover={{ y: -5 }}
                  className="p-6 bg-white rounded-xl shadow-md border border-slate-200 hover:shadow-lg hover:border-blue-200 transition-all"
                >
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg flex items-center justify-center">
                      <Icon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 mb-1">
                        {feature.title}
                      </h3>
                      <p className="text-slate-600 text-sm">{feature.desc}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-12 rounded-2xl text-center mb-16"
        >
          <motion.h2
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-4xl font-bold mb-4"
          >
            Ready to Experience AI Shopping?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="text-lg mb-8 opacity-90 max-w-2xl mx-auto"
          >
            Start chatting with our AI assistant today and discover products
            perfectly matched to your needs
          </motion.p>
          <motion.button
            initial={{ scale: 0.95 }}
            whileInView={{ scale: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/shopping-assistant')}
            className="px-8 py-4 bg-white text-blue-600 rounded-lg font-semibold hover:shadow-xl transition-all flex items-center gap-2 mx-auto"
          >
            Launch Assistant
            <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>

        {/* Capabilities Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16"
        >
          {[
            'Find products by description',
            'Compare products intelligently',
            'Get price recommendations',
            'Track your shopping history',
            'Get personalized suggestions',
            'Instant price alerts',
          ].map((capability, index) => (
            <motion.div
              key={capability}
              variants={itemVariants}
              className="p-6 bg-white rounded-xl shadow-md border border-slate-200 flex items-start gap-3"
            >
              <CheckCircle2 className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              <p className="text-slate-900 font-medium">{capability}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* Demo Section */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="p-8 bg-blue-50 border border-blue-200 rounded-xl mb-12"
        >
          <div className="flex items-start gap-4">
            <Sparkles className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" suppressHydrationWarning />
            <div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                🚀 Live and Ready to Use
              </h3>
              <p className="text-slate-600 mb-3">
                The AI Assistant is now live and ready to help you. Try asking
                questions like:
              </p>
              <ul className="space-y-2 text-slate-700">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  "Show me wireless headphones under ₹15,000"
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  "I need a gaming laptop with RTX 3070"
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  "What's the best smart watch for fitness tracking?"
                </li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
