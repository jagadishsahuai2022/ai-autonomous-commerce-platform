/**
 * Clarifying Question Card Component
 * Displays questions from intent analysis with multiple input types
 */

'use client';

import React, { useState, useEffect } from 'react';
import { HelpCircle, CheckCircle } from 'lucide-react';
import type { ClarifyingQuestion } from '@/types/shopping-assistant';
import { useChatStore } from '@/lib/stores/chat-store';

interface ClarifyingQuestionCardProps {
  question: ClarifyingQuestion;
  onAnswer: (answer: string | number | boolean, displayLabel?: string) => void;
  isLoading?: boolean;
  /** Kept for backward compat — the component now reads directly from the store */
  initialAnswered?: boolean;
}

export const ClarifyingQuestionCard: React.FC<ClarifyingQuestionCardProps> = ({
  question,
  onAnswer,
  isLoading = false,
  initialAnswered = false,
}) => {
  // Subscribe directly to the store so the card reacts even if the prop was stale
  const storedLabel = useChatStore((state) => state.answeredQuestions[question.id]);
  const isStoredAsAnswered = storedLabel !== undefined;

  const [selectedAnswer, setSelectedAnswer] = useState<string | number | boolean | null>(null);
  const [openAnswer, setOpenAnswer] = useState('');
  const [customText, setCustomText] = useState('');
  const [rangeAnswer, setRangeAnswer] = useState<[number, number]>([0, 100000]);
  const [answered, setAnswered] = useState(initialAnswered || isStoredAsAnswered);
  const [submittedLabel, setSubmittedLabel] = useState(
    isStoredAsAnswered ? (storedLabel || 'Answered') : (initialAnswered ? 'Answered' : '')
  );

  // React to store changes (handles async hydration edge cases)
  useEffect(() => {
    if (isStoredAsAnswered && !answered) {
      setAnswered(true);
      setSubmittedLabel(storedLabel || 'Answered');
    }
  }, [isStoredAsAnswered, storedLabel, answered]);

  const showCustomInput = selectedAnswer === 'other';

  const handleSubmit = () => {
    let answer: string | number | boolean;
    let displayLabel: string;

    switch (question.type) {
      case 'multiple_choice':
        if (selectedAnswer === 'other') {
          if (!customText.trim()) {
            alert('Please enter your custom value');
            return;
          }
          // For budget "Other", send the numeric value; for brand "Other", send the text
          if (question.category === 'budget') {
            const num = Number(customText.replace(/[^0-9]/g, ''));
            if (!num || num <= 0) {
              alert('Please enter a valid numeric budget amount');
              return;
            }
            answer = `custom_${num}`;
            displayLabel = `₹${num.toLocaleString('en-IN')}`;
          } else {
            answer = `custom_${customText.trim()}`;
            displayLabel = customText.trim();
          }
        } else {
          answer = selectedAnswer ?? '';
          displayLabel = question.options?.find((o) => o.value === selectedAnswer)?.label ?? String(selectedAnswer ?? '');
        }
        break;
      case 'boolean':
        answer = selectedAnswer === 'yes';
        displayLabel = selectedAnswer === 'yes' ? 'Yes' : 'No';
        break;
      case 'range':
        answer = rangeAnswer[1];
        displayLabel = `Up to ₹${rangeAnswer[1].toLocaleString()}`;
        break;
      case 'open_ended':
        answer = openAnswer;
        displayLabel = openAnswer;
        break;
      default:
        return;
    }

    if (answer === '' || answer === null) {
      alert('Please select an answer');
      return;
    }

    onAnswer(answer, displayLabel);
    setSubmittedLabel(displayLabel);
    setAnswered(true);
  };

  const categoryColors: Record<string, string> = {
    budget: 'bg-green-50 border-green-200 text-green-900',
    brand: 'bg-blue-50 border-blue-200 text-blue-900',
    features: 'bg-purple-50 border-purple-200 text-purple-900',
    delivery: 'bg-orange-50 border-orange-200 text-orange-900',
    quality: 'bg-red-50 border-red-200 text-red-900',
  };

  if (answered) {
    return (
      <div className={`border rounded-lg p-3 ${categoryColors[question.category] || 'bg-gray-50 border-gray-200'}`}>
        <p className="text-[11px] font-medium opacity-55 mb-1.5 truncate">{question.question}</p>
        <div className="flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-sm font-semibold">{submittedLabel || 'Answered'}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`border rounded-lg p-4 ${categoryColors[question.category] || 'bg-gray-50 border-gray-200'}`}
    >
      {/* Question Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="w-8 h-8 rounded-full bg-current opacity-20 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div>
          <p className="font-medium text-sm">{question.question}</p>
          <span className="text-xs opacity-75 capitalize">{question.category}</span>
        </div>
      </div>

      {/* Answer Inputs */}
      <div className="space-y-3 mb-4">
        {question.type === 'multiple_choice' && question.options && (
          <>
            {question.options.map((option) => (
              <label key={option.value} className="flex items-center gap-3 cursor-pointer p-2 rounded hover:bg-white hover:bg-opacity-50 transition-colors">
                <input
                  type="radio"
                  name={question.id}
                  value={option.value}
                  checked={selectedAnswer === option.value}
                  onChange={(e) => setSelectedAnswer(e.target.value)}
                  disabled={isLoading}
                  className="w-4 h-4"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
            {/* Free text input when "Other" is selected */}
            {showCustomInput && (
              <div className="ml-7 mt-1">
                <input
                  type={question.category === 'budget' ? 'text' : 'text'}
                  inputMode={question.category === 'budget' ? 'numeric' : 'text'}
                  value={customText}
                  onChange={(e) => {
                    if (question.category === 'budget') {
                      // Allow only digits
                      setCustomText(e.target.value.replace(/[^0-9]/g, ''));
                    } else {
                      // Allow alphanumeric and spaces
                      setCustomText(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ''));
                    }
                  }}
                  placeholder={
                    question.category === 'budget'
                      ? 'Enter your budget in ₹ (e.g., 5000)'
                      : 'Enter brand name (e.g., Bosch)'
                  }
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-current bg-white"
                />
              </div>
            )}
          </>
        )}

        {question.type === 'boolean' && (
          <div className="flex gap-2">
            {[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setSelectedAnswer(option.value)}
                className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
                  selectedAnswer === option.value
                    ? 'bg-white text-gray-900 shadow'
                    : 'bg-white bg-opacity-50 text-gray-700 hover:bg-opacity-75'
                }`}
                disabled={isLoading}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {question.type === 'range' && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>₹{rangeAnswer[0].toLocaleString()}</span>
              <span>₹{rangeAnswer[1].toLocaleString()}</span>
            </div>
            <input
              type="range"
              min="0"
              max="500000"
              step="5000"
              value={rangeAnswer[1]}
              onChange={(e) => setRangeAnswer([rangeAnswer[0], parseInt(e.target.value)])}
              disabled={isLoading}
              className="w-full"
            />
          </div>
        )}

        {question.type === 'open_ended' && (
          <input
            type="text"
            value={openAnswer}
            onChange={(e) => setOpenAnswer(e.target.value)}
            placeholder="Type your answer here..."
            disabled={isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-current"
          />
        )}
      </div>

      {/* Submit Button */}
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex-1 px-3 py-2 bg-white text-sm font-medium rounded hover:shadow transition-shadow disabled:opacity-50"
        >
          {isLoading ? 'Submitting...' : 'Submit'}
        </button>
        {question.required === false && (
          <button
            onClick={() => { const lbl = 'Skipped'; setSubmittedLabel(lbl); setAnswered(true); onAnswer('', lbl); }}
            disabled={isLoading}
            className="px-3 py-2 bg-white bg-opacity-50 text-sm rounded hover:bg-opacity-75 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};
