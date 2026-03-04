// ═══════════════════════════════════════════════════════════════════
// VoiceForge AI — Textarea Component
// ═══════════════════════════════════════════════════════════════════

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={textareaId} className="block text-sm font-medium text-text-primary">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full px-3 py-2 text-sm rounded-lg border bg-surface text-text-primary placeholder:text-text-tertiary',
            'transition-colors duration-150 resize-y min-h-[80px]',
            'focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500',
            error
              ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
              : 'border-border hover:border-border-hover',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface-tertiary',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-500">{error}</p>}
        {hint && !error && <p className="text-xs text-text-tertiary">{hint}</p>}
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
