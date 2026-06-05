'use client';

import { motion, Variants } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface PremiumButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-700 hover:to-blue-700 shadow-lg hover:shadow-2xl',
  secondary:
    'bg-gradient-to-r from-slate-100 to-slate-50 text-slate-900 hover:from-slate-200 hover:to-slate-100 border border-slate-200',
  outline:
    'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 bg-white',
  ghost: 'text-indigo-600 hover:bg-indigo-50 bg-transparent',
  danger:
    'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-700 hover:to-rose-700 shadow-lg',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm font-medium rounded-lg',
  md: 'px-4 py-2.5 text-sm font-semibold rounded-lg',
  lg: 'px-6 py-3 text-base font-semibold rounded-xl',
  xl: 'px-8 py-4 text-base font-bold rounded-2xl',
};

export const PremiumButton = React.forwardRef<
  HTMLButtonElement,
  PremiumButtonProps
>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const buttonVariants: Variants = {
      rest: {
        scale: 1,
      },
      hover: {
        scale: 1.02,
      },
      tap: {
        scale: 0.98,
      },
    };

    return (
      <motion.button
        ref={ref as any}
        variants={buttonVariants}
        initial="rest"
        whileHover={!disabled && !isLoading ? 'hover' : 'rest'}
        whileTap={!disabled && !isLoading ? 'tap' : 'rest'}
        disabled={disabled || isLoading}
        className={`
          ${sizeClasses[size]}
          ${variantClasses[variant]}
          ${fullWidth ? 'w-full' : ''}
          relative overflow-hidden
          font-medium transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2
          ${className}
        `}
        {...(props as any)}
      >
        {/* Shimmer Effect on Hover */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0"
          animate={{
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatDelay: 2,
          }}
        />

        {/* Loading Spinner */}
        {isLoading && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          >
            <Loader2 className="w-4 h-4" strokeWidth={2.5} />
          </motion.div>
        )}

        {/* Icon and Text */}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {icon && iconPosition === 'left' && !isLoading && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              {icon}
            </motion.span>
          )}

          <span>{children}</span>

          {icon && iconPosition === 'right' && !isLoading && (
            <motion.span
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              {icon}
            </motion.span>
          )}
        </span>
      </motion.button>
    );
  }
);

PremiumButton.displayName = 'PremiumButton';

/**
 * Button Group Component
 */
interface ButtonGroupProps {
  children: React.ReactNode;
  orientation?: 'horizontal' | 'vertical';
  gap?: number;
}

export function ButtonGroup({
  children,
  orientation = 'horizontal',
  gap = 3,
}: ButtonGroupProps) {
  return (
    <div
      className={`flex ${
        orientation === 'horizontal' ? 'flex-row' : 'flex-col'
      } gap-${gap}`}
    >
      {children}
    </div>
  );
}

/**
 * Icon Button Component
 */
interface IconButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  tooltip?: string;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      variant = 'secondary',
      size = 'md',
      tooltip,
      className = '',
      ...props
    },
    ref
  ) => {
    const sizeMap = {
      sm: 'w-8 h-8',
      md: 'w-10 h-10',
      lg: 'w-12 h-12',
    };

    const baseClasses = {
      primary:
        'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg hover:shadow-xl',
      secondary:
        'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200',
      ghost: 'text-slate-600 hover:bg-slate-100',
    };

    return (
      <motion.button
        ref={ref as any}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className={`
          ${sizeMap[size]}
          ${baseClasses[variant]}
          rounded-lg flex items-center justify-center
          transition-all duration-200 relative
          disabled:opacity-50 disabled:cursor-not-allowed
          ${className}
        `}
        title={tooltip}
        {...(props as any)}
      >
        {icon}

        {tooltip && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            whileHover={{ opacity: 1, y: -5 }}
            className="absolute bottom-full mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs rounded-lg whitespace-nowrap pointer-events-none"
          >
            {tooltip}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
          </motion.div>
        )}
      </motion.button>
    );
  }
);

IconButton.displayName = 'IconButton';

/**
 * Text Link Button (for navigation)
 */
interface TextLinkProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  as?: 'button' | 'a';
  href?: string;
}

export const TextLink = React.forwardRef<HTMLButtonElement, TextLinkProps>(
  ({ children, as = 'button', href, className = '', ...props }, ref) => {
    const baseClasses =
      'text-indigo-600 font-semibold hover:text-indigo-700 underline transition-colors';

    if (as === 'a') {
      return (
        <a
          href={href}
          className={`${baseClasses} ${className}`}
          {...(props as any)}
        >
          {children}
        </a>
      );
    }

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={`${baseClasses} ${className}`}
        {...(props as any)}
      >
        {children}
      </motion.button>
    );
  }
);

TextLink.displayName = 'TextLink';

/**
 * Badge Component (for status indicators)
 */
type BadgeVariant = 'default' | 'success' | 'warning' | 'error';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}

const badgeClasses: Record<BadgeVariant, string> = {
  default: 'bg-indigo-100 text-indigo-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
};

export function Badge({
  children,
  variant = 'default',
  icon,
}: BadgeProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`
        inline-flex items-center gap-1.5
        px-3 py-1 rounded-full text-xs font-semibold
        ${badgeClasses[variant]}
      `}
    >
      {icon}
      {children}
    </motion.span>
  );
}
