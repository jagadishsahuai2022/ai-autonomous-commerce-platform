'use client';

/**
 * AutopilotExplainability
 * Shows the user WHY the AI selected a product:
 *   • confidence score with animated bar
 *   • step-by-step reasoning chain
 *   • per-agent status indicators
 *   • one-click approve / reject feedback buttons
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Brain, CheckCircle, XCircle, ChevronDown, ChevronUp, Loader2, Zap, Shield, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import type { AutopilotDecision, AgentResult } from '@/hooks/useAutopilot';

interface Props {
  decision: AutopilotDecision;
  onApprove?: (productId: string) => void;
  onReject?: (productId: string) => void;
  className?: string;
}

function AgentStatusDot({ agent }: { agent: AgentResult }) {
  const icons = {
    SearchAgent: <Zap size={12} />,
    PricingAgent: <TrendingDown size={12} />,
    TrustAgent: <Shield size={12} />,
  };
  const colors = {
    thinking: 'text-yellow-400 animate-pulse',
    done: 'text-green-500',
    error: 'text-red-500',
    idle: 'text-gray-400',
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={colors[agent.status]}>{icons[agent.agentName]}</span>
      <div>
        <p className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{agent.agentName}</p>
        {agent.output && (
          <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-tight">{agent.output}</p>
        )}
      </div>
      {agent.confidence !== undefined && (
        <span className="ml-auto text-[9px] font-bold text-blue-600 dark:text-blue-400">{agent.confidence}%</span>
      )}
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="absolute left-0 top-0 h-full rounded-full"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export function AutopilotExplainability({ decision, onApprove, onReject, className = '' }: Props) {
  const [showSteps, setShowSteps] = useState(false);
  const topId = decision.topPick?.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-xl p-4 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
          <Brain size={14} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Autopilot Decision</h3>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Multi-agent analysis complete</p>
        </div>
        {decision.userFeedback === 'approved' && (
          <span className="text-[10px] font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded-full">Approved ✓</span>
        )}
        {decision.userFeedback === 'rejected' && (
          <span className="text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">Rejected ✗</span>
        )}
      </div>

      {/* Confidence */}
      <div className="mb-3">
        <div className="flex justify-between items-center mb-1">
          <span className="text-xs text-gray-600 dark:text-gray-400">Confidence</span>
          <span className="text-xs font-bold text-gray-900 dark:text-white">{decision.confidence}%</span>
        </div>
        <ConfidenceBar value={decision.confidence} />
      </div>

      {/* Explanation */}
      <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
        {decision.explanation}
      </p>

      {/* Agents */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-3 space-y-2">
        {decision.agents.map(agent => (
          <AgentStatusDot key={agent.agentName} agent={agent} />
        ))}
      </div>

      {/* Reasoning steps toggle */}
      <button
        onClick={() => setShowSteps(v => !v)}
        className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline mb-2"
      >
        {showSteps ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {showSteps ? 'Hide' : 'Show'} reasoning chain ({decision.reasoningSteps.length} steps)
      </button>

      <AnimatePresence>
        {showSteps && (
          <motion.ol
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-1 mb-3 pl-1"
          >
            {decision.reasoningSteps.map((step, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-start gap-2 text-[11px] text-gray-600 dark:text-gray-400"
              >
                <span className="w-4 h-4 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-[9px]">
                  {i + 1}
                </span>
                {step}
              </motion.li>
            ))}
          </motion.ol>
        )}
      </AnimatePresence>

      {/* Feedback buttons */}
      {!decision.userFeedback && topId && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApprove?.(topId)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <CheckCircle size={13} /> Approve
          </button>
          <button
            onClick={() => onReject?.(topId)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold rounded-lg transition-colors"
          >
            <XCircle size={13} /> Reject
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default AutopilotExplainability;
