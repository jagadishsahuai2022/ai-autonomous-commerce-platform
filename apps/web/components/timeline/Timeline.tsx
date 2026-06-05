'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Brain,
  Search,
  Filter,
  BarChart3,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Loader2,
  Clock,
} from 'lucide-react';
import { Card } from '@/components/ui/base';
import { OrderStep } from '@/types';

export interface TimelineStep extends OrderStep {
  icon?: React.ReactNode;
  duration?: number;
}

interface TimelineProps {
  steps?: TimelineStep[];
  currentStep?: number;
  compact?: boolean;
}

const defaultSteps: TimelineStep[] = [
  {
    id: '1',
    label: 'Request',
    description: 'Analyzing your search query',
    status: 'completed',
    icon: <Brain className="w-5 h-5" />,
  },
  {
    id: '2',
    label: 'Intent',
    description: 'Understanding your needs',
    status: 'completed',
    icon: <Search className="w-5 h-5" />,
  },
  {
    id: '3',
    label: 'Search',
    description: 'Finding relevant products',
    status: 'completed',
    icon: <Search className="w-5 h-5" />,
  },
  {
    id: '4',
    label: 'Ranking',
    description: 'Evaluating options',
    status: 'in-progress',
    icon: <BarChart3 className="w-5 h-5" />,
  },
  {
    id: '5',
    label: 'Decision',
    description: 'Creating recommendation',
    status: 'pending',
    icon: <ShieldCheck className="w-5 h-5" />,
  },
  {
    id: '6',
    label: 'Approval',
    description: 'Waiting for confirmation',
    status: 'pending',
    icon: <CheckCircle2 className="w-5 h-5" />,
  },
  {
    id: '7',
    label: 'Execute',
    description: 'Processing your order',
    status: 'pending',
    icon: <Zap className="w-5 h-5" />,
  },
];

export function Timeline({
  steps = defaultSteps,
  currentStep = 3,
  compact = false,
}: TimelineProps) {
  if (compact) {
    return <CompactTimeline steps={steps} currentStep={currentStep} />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full"
    >
      <Card className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900">AI Pipeline</h2>
          <p className="text-sm text-gray-600 mt-1">
            Real-time processing of your request
          </p>
        </div>

        {/* Timeline */}
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-start space-x-4 group"
            >
              {/* Timeline Item */}
              <div className="flex flex-col items-center space-y-2">
                {/* Icon Circle */}
                <motion.div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all ${
                    step.status === 'completed'
                      ? 'bg-emerald-100 text-emerald-600'
                      : step.status === 'in-progress'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-gray-100 text-gray-600'
                  }`}
                  whileHover={{ scale: 1.1 }}
                >
                  {step.status === 'in-progress' ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: 'linear',
                      }}
                    >
                      <Loader2 className="w-5 h-5" />
                    </motion.div>
                  ) : step.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <span className="text-sm">{idx + 1}</span>
                  )}
                </motion.div>

                {/* Connector Line */}
                {idx < steps.length - 1 && (
                  <motion.div
                    className={`w-1 h-12 transition-all ${
                      step.status === 'completed'
                        ? 'bg-emerald-200'
                        : step.status === 'in-progress'
                          ? 'bg-indigo-200'
                          : 'bg-gray-200'
                    }`}
                    initial={{ height: 0 }}
                    animate={{ height: 48 }}
                    transition={{ delay: idx * 0.15 }}
                  />
                )}
              </div>

              {/* Content */}
              <div className="pt-1 flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{step.label}</h3>
                  {step.status === 'completed' && (
                    <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                      Done
                    </span>
                  )}
                  {step.status === 'in-progress' && (
                    <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                      Processing
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600">{step.description}</p>
                {step.timestamp && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(step.timestamp).toLocaleTimeString()}</span>
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">
              Step {currentStep} of {steps.length}
            </p>
            <p className="text-xs text-gray-600">
              {steps[currentStep - 1]?.label || 'Complete'}
            </p>
          </div>
          <motion.div
            className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden"
            initial={{ width: 0 }}
            animate={{ width: 192 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(currentStep / steps.length) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        </div>
      </Card>
    </motion.div>
  );
}

function CompactTimeline({
  steps,
  currentStep,
}: {
  steps: TimelineStep[];
  currentStep: number;
}) {
  return (
    <div className="py-4">
      <div className="relative">
        {/* Continuous Line */}
        <div className="absolute top-6 left-0 right-0 h-0.5 bg-gray-200" />
        <motion.div
          className="absolute top-6 left-0 h-0.5 bg-gradient-to-r from-indigo-600 to-purple-600"
          initial={{ width: 0 }}
          animate={{
            width: `${((currentStep - 1) / (steps.length - 1)) * 100}%`,
          }}
          transition={{ duration: 0.6 }}
        />

        {/* Steps */}
        <div className="flex justify-between">
          {steps.map((step, idx) => (
            <motion.div key={step.id} className="flex flex-col items-center z-10">
              <motion.div
                className={`w-12 h-12 rounded-full flex items-center justify-center font-bold transition-all relative ${
                  idx < currentStep
                    ? 'bg-emerald-600 text-white'
                    : idx === currentStep - 1
                      ? 'bg-indigo-600 text-white ring-4 ring-indigo-200'
                      : 'bg-gray-200 text-gray-600'
                }`}
                whileHover={{ scale: 1.1 }}
              >
                {idx < currentStep ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : idx === currentStep - 1 ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  idx + 1
                )}
              </motion.div>
              <p className="text-xs font-medium text-gray-900 mt-2 text-center">
                {step.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
