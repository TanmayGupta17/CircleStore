'use client';

import { Input, Select, Textarea, inputClasses } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { FieldInputProps } from './types';

/**
 * One component per field type.
 *
 * Each is small and self-contained; adding a new input type means adding a
 * component here and one line in `registry.ts`. Nothing else in the form
 * pipeline changes.
 */

function asString(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

export function TextInput({ field, value, onChange, id, hasError, describedBy, disabled }: FieldInputProps) {
  return (
    <Input
      id={id}
      type="text"
      value={asString(value)}
      placeholder={field.placeholder ?? undefined}
      maxLength={field.validation.maxLength}
      hasError={hasError}
      aria-describedby={describedBy}
      aria-invalid={hasError || undefined}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export function TextareaInput({ field, value, onChange, id, hasError, describedBy, disabled }: FieldInputProps) {
  const maxLength = field.validation.maxLength;
  const length = asString(value).length;

  return (
    <div>
      <Textarea
        id={id}
        rows={4}
        value={asString(value)}
        placeholder={field.placeholder ?? undefined}
        maxLength={maxLength}
        hasError={hasError}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
      {maxLength ? (
        <p className="mt-1 text-right text-xs text-muted">
          {length} / {maxLength}
        </p>
      ) : null}
    </div>
  );
}

export function NumberInput({ field, value, onChange, id, hasError, describedBy, disabled }: FieldInputProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={asString(value)}
        placeholder={field.placeholder ?? undefined}
        min={typeof field.validation.min === 'number' ? field.validation.min : undefined}
        max={typeof field.validation.max === 'number' ? field.validation.max : undefined}
        step={field.validation.step ?? 'any'}
        hasError={hasError}
        aria-describedby={describedBy}
        aria-invalid={hasError || undefined}
        disabled={disabled}
        className={field.unit ? 'pr-14' : undefined}
        // Empty string rather than 0, so "cleared" is distinguishable from "zero".
        onChange={(event) => onChange(event.target.value === '' ? '' : Number(event.target.value))}
      />
      {field.unit ? (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
          {field.unit}
        </span>
      ) : null}
    </div>
  );
}

export function SelectInput({ field, value, onChange, id, hasError, describedBy, disabled }: FieldInputProps) {
  return (
    <Select
      id={id}
      value={asString(value)}
      hasError={hasError}
      aria-describedby={describedBy}
      aria-invalid={hasError || undefined}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{field.placeholder ?? 'Select an option'}</option>
      {field.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}

export function RadioInput({ field, value, onChange, id, describedBy, disabled }: FieldInputProps) {
  const current = asString(value);

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-describedby={describedBy} id={id}>
      {field.options.map((option) => {
        const checked = current === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors',
              checked
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
                : 'border-line bg-surface text-foreground hover:border-muted/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="radio"
              name={field.key}
              value={option.value}
              checked={checked}
              disabled={disabled}
              className="sr-only"
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export function MultiSelectInput({ field, value, onChange, id, describedBy, disabled }: FieldInputProps) {
  const selected = Array.isArray(value) ? value.map(String) : [];

  const toggle = (optionValue: string) => {
    onChange(
      selected.includes(optionValue)
        ? selected.filter((item) => item !== optionValue)
        : [...selected, optionValue],
    );
  };

  return (
    <div className="flex flex-wrap gap-2" id={id} aria-describedby={describedBy}>
      {field.options.map((option) => {
        const checked = selected.includes(option.value);
        return (
          <label
            key={option.value}
            className={cn(
              'cursor-pointer rounded-lg border px-3 py-2 text-sm transition-colors',
              checked
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/40 dark:text-brand-100'
                : 'border-line bg-surface text-foreground hover:border-muted/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <input
              type="checkbox"
              value={option.value}
              checked={checked}
              disabled={disabled}
              className="sr-only"
              onChange={() => toggle(option.value)}
            />
            <span aria-hidden className="mr-1.5">
              {checked ? '✓' : '+'}
            </span>
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

export function BooleanInput({ field, value, onChange, id, describedBy, disabled }: FieldInputProps) {
  const checked = value === true;

  return (
    <label
      className={cn(
        'flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-sm',
        disabled && 'cursor-not-allowed opacity-60',
      )}
      htmlFor={id}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-describedby={describedBy}
        className="h-4 w-4 accent-brand-600"
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{checked ? 'Yes' : 'No'}</span>
      <span className="text-muted">— {field.label}</span>
    </label>
  );
}

export function DateInput({ field, value, onChange, id, hasError, describedBy, disabled }: FieldInputProps) {
  return (
    <input
      id={id}
      type="date"
      value={asString(value)}
      min={typeof field.validation.min === 'string' ? field.validation.min : undefined}
      max={typeof field.validation.max === 'string' ? field.validation.max : undefined}
      aria-describedby={describedBy}
      aria-invalid={hasError || undefined}
      disabled={disabled}
      className={inputClasses(hasError)}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
