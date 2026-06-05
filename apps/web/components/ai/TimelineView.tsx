'use client';

import { motion } from 'framer-motion';
import { Search, Brain, ListFilter, BarChart2, ShieldCheck, Zap, CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StepStatus = 'idle' | 'active' | 'complete' | 'error';

export interface TimelineStep {
  id: string;
  label: string;
  description?: string;
  status: StepStatus;
  timestamp?: Date;
  duration?: number; // ms
  detail?: string;
}

interface TimelineViewProps {
  steps?: TimelineStep[];
  className?: string;
}

const DEFAULT_STEPS: TimelineStep[] = [
  { id: 'request', label: 'Request received', description: 'User query parsed', status: 'idle' },
  { id: 'intent', label: 'Intent analysis', description: 'Understanding your needs', status: 'idle' },
  { id: 'search', label: 'Product search', description: 'Scanning merchant catalogs', status: 'idle' },
  { id: 'ranking', label: 'AI ranking', description: 'Scoring & comparing products', status: 'idle' },
  { id: 'decision', label: 'Decision made', description: 'Best match identified', status: 'idle' },
  { id: 'approval', label: 'Approval check', description: 'Validating purchase limits', status: 'idle' },
  { id: 'execution', label: 'Ready to execute', description: 'Awaiting your confirmation', status: 'idle' },
];

const STEP_ICONS: Record<string, React.ReactNode> = {
  request: <Zap className="w-3.5 h-3.5" />,
  intent: <Brain className="w-3.5 h-3.5" />,
  search: <Search className="w-3.5 h-3.5" />,
  ranking: <ListFilter className="w-3.5 h-3.5" />,
  decision: <BarChart2 className="w-3.5 h-3.5" />,
  approval: <ShieldCheck className="w-3.5 h-3.5" />,
  execution: <CheckCircle2 className="w-3.5 h-3.5" />,
};

function StepIcon({ id, status }: { id: string; status: StepStatus }) {
  const base = STEP_ICONS[id] ?? <Circle className="w-3.5 h-3.5" />;
  if (status === 'active') {
    return (
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className="flex items-center justify-center"
      >
        <Loader2 className="w-3.5 h-3.5 text-violet-500" />
      </motion.div>
    );
  }
  if (status === 'error') return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
  return base;
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function TimelineView({ steps = DEFAULT_STEPS, className }: TimelineViewProps) {
  const activeIndex = steps.findIndex((s) => s.status === 'active');
  const completedCount = steps.filter((s) => s.status === 'complete').length;
  const totalProgress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className={cn('bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">AI Pipeline</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {completedCount}/{steps.length} steps complete
          </p>
        </div>
        {/* Overall progress bar */}
        <div className="w-20 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="relative">
        {/* Vertical connector line */}
        <div className="absolute left-[17px] top-4 bottom-4 w-px bg-gray-100 dark:bg-gray-800" />

        {/* Animated progress line */}
        <motion.div
          className="absolute left-[17px] top-4 w-px bg-gradient-to-b from-violet-500 to-purple-500"
          initial={{ height: 0 }}
          animate={{ height: `${(completedCount / Math.max(steps.length - 1, 1)) * 100}%` }}
          transition={{ duration: 0.5 }}
        />

        <div className="space-y-4">
          {steps.map((step, i) => {
            const isComplete = step.status === 'complete';
            const isActive = step.status === 'active';
            const isError = step.status === 'error';
            const isIdle = step.status === 'idle';

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="flex items-start gap-3 relative"
              >
                {/* Step icon circle */}
                <div
                  className={cn(
                    'relative z-10 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-all duration-300',
                    isComplete && 'bg-violet-100 dark:bg-violet-900/40 border-violet-400 dark:border-violet-600 text-violet-600 dark:text-violet-400',
                    isActive && 'bg-violet-50 dark:bg-violet-950/50 border-violet-400 dark:border-violet-500 text-violet-500',
                    isError && 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-500',
                    isIdle && 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-300 dark:text-gray-600'
                  )}
                >
                  {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-violet-500" />
                  ) : (
                    <StepIcon id={step.id} status={step.status} />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0 pt-1.5">
                  <div className="flex items-center gap-2">
                    <p
                      className={cn(
                        'text-xs font-semibold',
                        isComplete && 'text-gray-700 dark:text-gray-300',
                        isActive && 'text-violet-600 dark:text-violet-400',
                        isError && 'text-red-600 dark:text-red-400',
                        isIdle && 'text-gray-300 dark:text-gray-600'
                      )}
                    >
                      {step.label}
                    </p>
                    {step.duration != null && (
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">
                        {formatDuration(step.duration)}
                      </span>
                    )}
                    {step.timestamp && (
                      <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-auto">
                        {formatTime(step.timestamp)}
                      </span>
                    )}
                  </div>
                  {(isActive || isComplete) && step.description && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{step.description}</p>
                  )}
                  {step.detail && (isActive || isComplete) && (
                    <p className="text-[11px] text-violet-500 dark:text-violet-400 mt-0.5 font-medium">{step.detail}</p>
                  )}
                  {isError && step.detail && (
                    <p className="text-[11px] text-red-500 mt-0.5">{step.detail}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
