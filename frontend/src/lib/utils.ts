import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ListingCondition } from './types';

/** Tailwind-aware class merge, so later classes reliably win. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);

  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;

  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const CONDITION_LABELS: Record<ListingCondition, string> = {
  NEW: 'New',
  LIKE_NEW: 'Like new',
  GOOD: 'Good',
  FAIR: 'Fair',
};

export const CONDITION_OPTIONS = (Object.keys(CONDITION_LABELS) as ListingCondition[]).map(
  (value) => ({ value, label: CONDITION_LABELS[value] }),
);
