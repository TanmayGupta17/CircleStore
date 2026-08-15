'use client';

import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Accessible modal dialog.
 *
 * Kept in its own file rather than `ui/index.tsx` because it needs hooks: that
 * module is imported by Server Components, and adding `'use client'` there would
 * drag every primitive into the client bundle.
 *
 * Handles the things a hand-rolled modal usually forgets: Escape to close,
 * backdrop click, background scroll lock, focus moved in on open and restored to
 * the trigger on close, and `aria-modal` wiring.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  // Whatever had focus before opening, so it can be handed back on close.
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);

    // Prevent the page behind the dialog from scrolling.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, handleClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        // Only a click that starts on the backdrop closes — dragging a text
        // selection out of the panel should not dismiss it.
        if (!panelRef.current?.contains(event.target as Node)) handleClose();
      }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" aria-hidden />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className={cn(
          'modal-panel relative w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl',
        )}
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          aria-label="Close dialog"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          ✕
        </button>

        {icon ? (
          <div className="mb-3 text-3xl" aria-hidden>
            {icon}
          </div>
        ) : null}

        <h2 id="modal-title" className="pr-8 text-lg font-semibold text-foreground">
          {title}
        </h2>

        {description ? (
          <p id="modal-description" className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        {footer ? <div className="mt-6 flex justify-end gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}
