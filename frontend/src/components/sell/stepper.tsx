'use client';

import { cn } from '@/lib/utils';

export const SELL_STEPS = ['category', 'basics', 'details', 'photos', 'review'] as const;
export type SellStep = (typeof SELL_STEPS)[number];

const STEP_LABELS: Record<SellStep, string> = {
  category: 'Category',
  basics: 'Basics',
  details: 'Details',
  photos: 'Photos',
  review: 'Review',
};

/**
 * Progress indicator.
 *
 * A fifteen-field sofa form presented as one wall is hostile; splitting it into
 * named steps keeps each screen short and makes progress legible.
 */
export function Stepper({
  current,
  completed,
  onNavigate,
}: {
  current: SellStep;
  completed: Set<SellStep>;
  onNavigate: (step: SellStep) => void;
}) {
  const currentIndex = SELL_STEPS.indexOf(current);

  return (
    <ol className="mb-8 flex flex-wrap items-center gap-x-2 gap-y-3">
      {SELL_STEPS.map((step, index) => {
        const isCurrent = step === current;
        const isDone = completed.has(step) && !isCurrent;
        // Only allow jumping back to steps already satisfied.
        const canNavigate = isDone || index < currentIndex;

        return (
          <li key={step} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canNavigate}
              onClick={() => canNavigate && onNavigate(step)}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors',
                isCurrent && 'bg-brand-600 text-white',
                !isCurrent && isDone && 'text-brand-700 hover:bg-brand-50 dark:text-brand-300',
                !isCurrent && !isDone && 'text-muted',
                canNavigate ? 'cursor-pointer' : 'cursor-default',
              )}
            >
              <span
                className={cn(
                  'grid h-5 w-5 place-items-center rounded-full text-xs font-semibold',
                  isCurrent ? 'bg-white/25' : isDone ? 'bg-brand-600 text-white' : 'bg-surface-muted',
                )}
                aria-hidden
              >
                {isDone ? '✓' : index + 1}
              </span>
              {STEP_LABELS[step]}
            </button>

            {index < SELL_STEPS.length - 1 ? (
              <span className="text-muted" aria-hidden>
                ›
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
