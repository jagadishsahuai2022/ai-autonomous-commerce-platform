'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Brain } from 'lucide-react';

interface ThinkingIndicatorProps {
  text?: string;
  className?: string;
}

export function ThinkingIndicator({ text = 'AI is analyzing...', className = '' }: ThinkingIndicatorProps) {
  const dotVariants = {
    animate: (i: number) => ({
      y: [0, -8, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        delay: i * 0.1,
      },
    }),
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${className}`}>
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white animate-pulse">
        <Brain size={16} />
      </div>

      <div className="max-w-xs lg:max-w-md xl:max-w-lg flex flex-col gap-2">
        <div className="px-4 py-3 rounded-2xl rounded-bl-none bg-white dark:bg-slate-800 border border-gray-200 dark:border-gray-700 shadow-soft glass-interactive">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">{text}</span>
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  custom={i}
                  variants={dotVariants}
                  animate="animate"
                  className="w-1.5 h-1.5 rounded-full bg-primary-500"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
