import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Reusable UI primitives.
 *
 * Every surface in the app — storefront, sell flow, admin — composes these, so
 * spacing, focus rings and dark-mode behaviour are defined once. Nothing here
 * knows about listings or fields; they are generic building blocks.
 */

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-600/50',
  secondary: 'bg-surface border border-line text-foreground hover:bg-surface-muted',
  ghost: 'text-muted hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-600/50',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

interface ButtonProps extends ComponentProps<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

interface LinkButtonProps extends ComponentProps<typeof Link> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function LinkButton({ variant = 'primary', size = 'md', className, ...props }: LinkButtonProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const CONTROL_BASE =
  'w-full rounded-lg border bg-surface px-3 py-2 text-sm text-foreground transition-colors ' +
  'placeholder:text-muted/70 disabled:cursor-not-allowed disabled:opacity-60';

export function inputClasses(hasError?: boolean, className?: string): string {
  return cn(
    CONTROL_BASE,
    hasError ? 'border-red-500' : 'border-line hover:border-muted/50',
    className,
  );
}

export function Input({
  hasError,
  className,
  ...props
}: ComponentProps<'input'> & { hasError?: boolean }) {
  return <input className={inputClasses(hasError, className)} {...props} />;
}

export function Textarea({
  hasError,
  className,
  ...props
}: ComponentProps<'textarea'> & { hasError?: boolean }) {
  return (
    <textarea className={inputClasses(hasError, cn('min-h-24 resize-y', className))} {...props} />
  );
}

export function Select({
  hasError,
  className,
  ...props
}: ComponentProps<'select'> & { hasError?: boolean }) {
  return <select className={inputClasses(hasError, cn('pr-8', className))} {...props} />;
}

// ---------------------------------------------------------------------------
// Layout & feedback
// ---------------------------------------------------------------------------

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-line bg-surface', className)}
      {...props}
    />
  );
}

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: 'neutral' | 'brand' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-surface-muted text-muted',
    brand: 'bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-200',
    warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
    danger: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200',
  } as const;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-16 text-center">
      {icon ? <div className="mb-3 text-3xl">{icon}</div> : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Alert({
  tone = 'danger',
  title,
  children,
}: {
  tone?: 'danger' | 'warning' | 'info';
  title?: string;
  children: ReactNode;
}) {
  const tones = {
    danger: 'border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/50 dark:text-red-200',
    warning:
      'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
    info: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-800 dark:bg-brand-950/50 dark:text-brand-100',
  } as const;

  return (
    <div className={cn('rounded-lg border px-4 py-3 text-sm', tones[tone])} role="alert">
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className={title ? 'mt-1' : undefined}>{children}</div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden
    />
  );
}

export function SectionHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
