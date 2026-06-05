'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Brain } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface AIMessageBubbleProps {
  message: string;
  isUser?: boolean;
  confidence?: number;
  timestamp: Date;
  className?: string;
}

export function AIMessageBubble({
  message,
  isUser = false,
  confidence,
  timestamp,
  className = '',
}: AIMessageBubbleProps) {
  const formattedTime = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn('flex gap-3', isUser && 'justify-end', className)}
    >
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white">
          <Brain size={16} />
        </div>
      )}

      <div className={cn('max-w-xs lg:max-w-md xl:max-w-lg flex flex-col gap-2', isUser && 'items-end')}>
        {/* Message Bubble */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'px-4 py-3 rounded-2xl shadow-soft transition-all duration-200',
            isUser
              ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-br-none'
              : 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-none glass-interactive'
          )}
        >
          <p className="text-sm leading-relaxed break-words">{message}</p>
        </motion.div>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 px-2">
          <span>{formattedTime}</span>

          {!isUser && confidence !== undefined && (
            <div className="flex items-center gap-1">
              {confidence >= 0.8 && (
                <>
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span className="text-green-600 dark:text-green-400">{Math.round(confidence * 100)}% confident</span>
                </>
              )}
              {confidence >= 0.6 && confidence < 0.8 && (
                <>
                  <AlertCircle size={14} className="text-amber-500" />
                  <span className="text-amber-600 dark:text-amber-400">{Math.round(confidence * 100)}% confident</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
