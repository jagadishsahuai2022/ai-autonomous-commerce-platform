'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { ChatMessage as ChatMessageType } from '@/lib/types/commerce';
import { CheckCircle2, Lightbulb, AlertCircle, Info, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface ChatMessagePremiumProps {
  message: ChatMessageType;
  index?: number;
  isStreaming?: boolean;
}

const ICON_MAP = {
  suggestion: Lightbulb,
  warning: AlertCircle,
  info: Info,
  confirmation: CheckCircle2,
};

export function ChatMessagePremium({
  message,
  index = 0,
  isStreaming = false,
}: ChatMessagePremiumProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const messageVariants: Variants = {
    hidden: {
      opacity: 0,
      y: isUser ? 20 : -20,
      x: isUser ? 20 : -20,
    },
    visible: {
      opacity: 1,
      y: 0,
      x: 0,
      transition: {
        type: 'spring' as const,
        stiffness: 300,
        damping: 30,
        delay: index * 0.05,
      },
    },
    exit: {
      opacity: 0,
      y: isUser ? 20 : -20,
      transition: { duration: 0.2 },
    },
  };

  const bubbleVariants: Variants = {
    hidden: { scale: 0.8, opacity: 0 },
    visible: { scale: 1, opacity: 1 },
    hover: { scale: 1.02 },
  };

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: index * 0.05,
      },
    },
  };

  const dotVariants: Variants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0 },
    animate: {
      y: [0, -8, 0],
      opacity: [1, 0.5, 1],
    },
  };

  const getIconComponent = () => {
    const Icon = message.type ? ICON_MAP[message.type as keyof typeof ICON_MAP] : null;
    return Icon;
  };

  const Icon = getIconComponent();

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      variants={messageVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-3 mb-4`}
    >
      {/* Assistant Avatar */}
      {!isUser && (
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg"
        >
          <span className="text-white text-xs font-bold">AI</span>
        </motion.div>
      )}

      {/* Message Bubble */}
      <motion.div
        variants={bubbleVariants}
        whileHover="hover"
        className={`max-w-xs lg:max-w-md group relative ${
          isUser ? 'order-first' : ''
        }`}
      >
        <motion.div
          className={`relative px-4 py-3 rounded-2xl shadow-md transition-all ${
            isUser
              ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-none'
              : 'bg-white border border-slate-200 text-slate-900 rounded-bl-none'
          }`}
          whileHover={{
            boxShadow: isUser
              ? '0 10px 20px rgba(79, 70, 229, 0.2)'
              : '0 10px 20px rgba(0, 0, 0, 0.1)',
          }}
        >
          {/* Glassmorphic Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 0.05 }}
            className={`absolute inset-0 rounded-2xl ${
              isUser ? 'bg-white' : 'bg-slate-50'
            } pointer-events-none`}
          />

          {/* Message Type Icon */}
          {Icon && !isUser && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2 mb-2"
            >
              <Icon className="w-4 h-4 text-indigo-600" strokeWidth={2.5} />
              <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wide">
                {message.type}
              </span>
            </motion.div>
          )}

          {/* Content */}
          <motion.p
            className="text-sm leading-relaxed relative z-10"
            variants={containerVariants}
          >
            {message.content.split('\n').map((line, idx) => (
              <motion.div key={idx} variants={dotVariants}>
                {line || <br />}
              </motion.div>
            ))}
          </motion.p>

          {/* Typing Indicator */}
          {isStreaming && (
            <motion.div
              className="flex gap-1 mt-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  variants={dotVariants}
                  animate="animate"
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                  className={`w-1.5 h-1.5 rounded-full ${
                    isUser ? 'bg-white/60' : 'bg-slate-400'
                  }`}
                />
              ))}
            </motion.div>
          )}
        </motion.div>

        {/* Copy Button */}
        {!isUser && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            whileHover={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleCopy}
            className="absolute -right-10 top-0 p-2 rounded-lg bg-white shadow-lg border border-slate-200 text-slate-600 hover:text-indigo-600 transition-colors opacity-0 group-hover:opacity-100"
            title={copied ? 'Copied!' : 'Copy message'}
          >
            <motion.div
              animate={{ rotate: copied ? 360 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {copied ? (
                <Check className="w-4 h-4" strokeWidth={3} />
              ) : (
                <Copy className="w-4 h-4" strokeWidth={2} />
              )}
            </motion.div>
          </motion.button>
        )}
      </motion.div>

      {/* User Avatar */}
      {isUser && (
        <motion.div
          initial={{ scale: 0, rotate: 180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center flex-shrink-0 shadow-lg"
        >
          <span className="text-white text-xs font-bold">You</span>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Chat Messages Container with Stagger Animation
 */
interface ChatMessagesContainerProps {
  messages: ChatMessageType[];
  isLoading?: boolean;
}

export function ChatMessagesContainer({
  messages,
  isLoading = false,
}: ChatMessagesContainerProps) {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-1"
    >
      <AnimatePresence mode="popLayout">
        {messages.map((message, idx) => (
          <ChatMessagePremium
            key={`${idx}-${message.content}`}
            message={message}
            index={idx}
            isStreaming={isLoading && idx === messages.length - 1}
          />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}
