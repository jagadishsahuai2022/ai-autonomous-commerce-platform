/**
 * ChatInput Component
 * Input field for chat messages with send functionality
 */

import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, Paperclip } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  onAttachFile?: (file: File) => void;
  onVoiceInput?: (transcript: string) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  disabled = false,
  placeholder = 'Type your message...',
  onAttachFile,
  onVoiceInput,
}) => {
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(
        inputRef.current.scrollHeight,
        120
      ) + 'px';
    }
  }, [input]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = true;
        recognitionRef.current.language = 'en-US';

        recognitionRef.current.onstart = () => setIsListening(true);
        recognitionRef.current.onend = () => setIsListening(false);
        recognitionRef.current.onerror = () => setIsListening(false);

        recognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setInput((prev) => prev + transcript + ' ');
              if (onVoiceInput) {
                onVoiceInput(transcript);
              }
            } else {
              interimTranscript += transcript;
            }
          }
        };
      }
    }
  }, [onVoiceInput]);

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (trimmedInput && !disabled) {
      onSend(trimmedInput);
      setInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceClick = () => {
    if (recognitionRef.current) {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
      }
    }
  };

  const handleFileClick = () => {
    if (onAttachFile) {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = (e: any) => {
        if (e.target.files?.[0]) {
          onAttachFile(e.target.files[0]);
        }
      };
      input.click();
    }
  };

  return (
    <div className="w-full">
      <div className="flex gap-2 items-end bg-white rounded-lg border border-gray-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200 transition-all">
        {/* Attachment Button */}
        {onAttachFile && (
          <button
            onClick={handleFileClick}
            disabled={disabled || isListening}
            className="p-2 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5 text-gray-500" />
          </button>
        )}

        {/* Voice Input Button */}
        {recognitionRef.current && (
          <button
            onClick={handleVoiceClick}
            disabled={disabled}
            className={`p-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              isListening
                ? 'bg-red-100 text-red-600 animate-pulse'
                : 'hover:bg-gray-100 text-gray-500'
            }`}
            title={isListening ? 'Stop listening' : 'Start voice input'}
            aria-label={isListening ? 'Stop listening' : 'Start voice input'}
          >
            <Mic className="w-5 h-5" />
          </button>
        )}

        {/* Text Input */}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 resize-none bg-transparent outline-none p-3 max-h-[120px] min-h-[44px] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          rows={1}
        />

        {/* Send Button */}
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className={`p-2 transition-colors ${
            input.trim() && !disabled
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'text-gray-400 cursor-not-allowed'
          }`}
          title="Send message"
          aria-label="Send message"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* Listening Indicator */}
      {isListening && (
        <div className="mt-2 flex items-center gap-2 text-xs text-red-600">
          <div className="flex gap-1">
            <span className="w-1 h-1 bg-red-600 rounded-full animate-bounce"></span>
            <span
              className="w-1 h-1 bg-red-600 rounded-full animate-bounce"
              style={{ animationDelay: '0.1s' }}
            ></span>
            <span
              className="w-1 h-1 bg-red-600 rounded-full animate-bounce"
              style={{ animationDelay: '0.2s' }}
            ></span>
          </div>
          Listening...
        </div>
      )}

      {/* Helper Text */}
      <div className="mt-1 text-xs text-gray-500">
        Press <kbd className="bg-gray-100 px-1 rounded">Shift</kbd> +{' '}
        <kbd className="bg-gray-100 px-1 rounded">Enter</kbd> for new line
      </div>
    </div>
  );
};

export default ChatInput;
