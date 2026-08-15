'use client';

import { createElement, useMemo } from 'react';
import type { FieldDefinition, FormSchema } from '@/lib/types';
import { visibleFields } from '@/lib/visibility';
import { getFieldComponent } from './registry';

/**
 * The one and only form renderer.
 *
 * There are no per-category form components anywhere in this codebase. This
 * component takes a `FormSchema` — fetched from the API, which built it from
 * the database — and renders whatever it describes. A new category with new
 * fields renders here with zero code changes.
 */

interface DynamicFormProps {
  schema: FormSchema;
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  /** Rendered inside the first section — used by the sell flow for common fields. */
  idPrefix?: string;
}

export function DynamicForm({
  schema,
  values,
  errors = {},
  onChange,
  disabled,
  idPrefix = 'field',
}: DynamicFormProps) {
  // Visibility is recomputed on every change so conditional fields appear and
  // disappear as the seller answers. The forward pass makes hiding cascade.
  const visible = useMemo(() => new Set(visibleFields(schema.fields, values).map((f) => f.key)), [
    schema.fields,
    values,
  ]);

  if (schema.fields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
        This category has no additional fields configured yet.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {schema.sections.map((section) => {
        const sectionFields = section.fields.filter((field) => visible.has(field.key));
        if (sectionFields.length === 0) return null;

        return (
          <section key={section.title}>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
              {section.title}
            </h3>
            <div className="space-y-5">
              {sectionFields.map((field) => (
                <FieldShell
                  key={field.key}
                  field={field}
                  value={values[field.key]}
                  error={errors[field.key]}
                  onChange={(value) => onChange(field.key, value)}
                  disabled={disabled}
                  idPrefix={idPrefix}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Label, help text, error and the input itself.
 *
 * Written once so every field type gets identical accessibility wiring —
 * `htmlFor`, `aria-describedby`, `aria-invalid` — rather than each input
 * re-implementing it.
 */
export function FieldShell({
  field,
  value,
  error,
  onChange,
  disabled,
  idPrefix = 'field',
}: {
  field: FieldDefinition;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  const helpId = field.helpText ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  // A single checkbox carries its own label, so the shell must not repeat it.
  const showLabel = field.type !== 'BOOLEAN';

  return (
    <div>
      {showLabel ? (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
          {field.label}
          {field.isRequired ? (
            <span className="ml-1 text-red-500" aria-hidden>
              *
            </span>
          ) : null}
          {field.inheritedFrom ? (
            <span className="ml-2 text-xs font-normal text-muted">
              from {field.inheritedFrom.categoryName}
            </span>
          ) : null}
        </label>
      ) : null}

      {/* `createElement` rather than binding the looked-up component to a local
          capitalised variable: the registry entry is a stable module-level
          reference, but assigning it in render reads as defining a component
          there. */}
      {createElement(getFieldComponent(field.type), {
        field,
        value,
        onChange,
        id,
        hasError: Boolean(error),
        describedBy,
        disabled,
      })}

      {field.helpText ? (
        <p id={helpId} className="mt-1.5 text-xs text-muted">
          {field.helpText}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
