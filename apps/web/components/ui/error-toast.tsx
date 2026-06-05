import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ToastType = 'error' | 'success' | 'warning' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ErrorToastProps extends Toast {
  onClose: (id: string) => void;
}

const toastConfig: Record<ToastType, { icon: React.FC<any>; bgColor: string; borderColor: string; textColor: string }> = {
  error: {
    icon: AlertCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800',
  },
  success: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800',
  },
};

export function ErrorToast({ id, message, type, duration = 5000, action, onClose }: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);
  const config = toastConfig[type];
  const Icon = config.icon;

  useEffect(() => {
    if (duration === 0) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 300); // Allow animation to complete
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  if (!isVisible) return null;

  return (
    <div
      className={`
        ${config.bgColor}
        ${config.borderColor}
        border rounded-lg shadow-lg p-4 mb-3
        flex items-start gap-3
        backdrop-blur-sm
        transform transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
      role="alert"
    >
      <Icon className={`${config.textColor} flex-shrink-0 w-5 h-5 mt-0.5`} />

      <div className="flex-grow">
        <p className={`${config.textColor} text-sm font-medium`}>{message}</p>
        
        {action && (
          <button
            onClick={() => {
              action.onClick();
              setIsVisible(false);
              setTimeout(() => onClose(id), 300);
            }}
            className={`${config.textColor} text-sm font-semibold mt-2 hover:underline`}
          >
            {action.label}
          </button>
        )}
      </div>

      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(() => onClose(id), 300);
        }}
        className={`${config.textColor} flex-shrink-0 hover:opacity-75 transition-opacity`}
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-w-full">
      <div className="flex flex-col gap-2">
        {toasts.map((toast) => (
          <ErrorToast key={toast.id} {...toast} onClose={onRemove} />
        ))}
      </div>
    </div>
  );
}
