'use client';

import { useState } from 'react';
import { Alert, Button, Card, Input, Select, Textarea } from '@/components/ui';
import type { Field, FieldType, FieldTypeInfo, ValidationConfig } from '@/lib/types';

export interface FieldDraft {
  key: string;
  label: string;
  type: FieldType;
  helpText: string;
  unit: string;
  placeholder: string;
  defaultValue: string;
  validation: ValidationConfig;
  options: Array<{ value: string; label: string }>;
}

export function emptyDraft(): FieldDraft {
  return {
    key: '',
    label: '',
    type: 'TEXT',
    helpText: '',
    unit: '',
    placeholder: '',
    defaultValue: '',
    validation: {},
    options: [],
  };
}

export function draftFromField(field: Field): FieldDraft {
  return {
    key: field.key,
    label: field.label,
    type: field.type,
    helpText: field.helpText ?? '',
    unit: field.unit ?? '',
    placeholder: field.placeholder ?? '',
    defaultValue: field.defaultValue ?? '',
    validation: field.validation ?? {},
    options: field.options
      .filter((option) => option.isActive)
      .map(({ value, label }) => ({ value, label })),
  };
}

/** Auto-derives a machine key from the label while creating a new field. */
function toKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

/**
 * Field editor.
 *
 * Which validation controls appear is driven by the field type — the same idea
 * as the seller form, applied to the admin surface.
 */
export function FieldEditor({
  draft,
  fieldTypes,
  isEditing,
  saving,
  error,
  issues,
  onChange,
  onSave,
  onCancel,
}: {
  draft: FieldDraft;
  fieldTypes: FieldTypeInfo[];
  isEditing: boolean;
  saving: boolean;
  error?: string | null;
  issues?: string[];
  onChange: (draft: FieldDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [keyTouched, setKeyTouched] = useState(isEditing);

  const typeInfo = fieldTypes.find((info) => info.type === draft.type);
  const usesOptions = typeInfo?.usesOptions ?? false;
  const isNumeric = draft.type === 'NUMBER';
  const isDate = draft.type === 'DATE';
  const isText = draft.type === 'TEXT' || draft.type === 'TEXTAREA';
  const isMulti = draft.type === 'MULTISELECT';

  const set = (patch: Partial<FieldDraft>) => onChange({ ...draft, ...patch });
  const setValidation = (patch: Partial<ValidationConfig>) =>
    onChange({ ...draft, validation: { ...draft.validation, ...patch } });

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold text-foreground">
        {isEditing ? `Edit “${draft.label}”` : 'New field'}
      </h3>

      {error ? (
        <div className="mt-4">
          <Alert tone="danger">
            {error}
            {issues && issues.length > 0 ? (
              <ul className="mt-2 list-disc pl-5">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            ) : null}
          </Alert>
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Label" required>
            <Input
              value={draft.label}
              placeholder="e.g. Battery Health"
              onChange={(event) => {
                const label = event.target.value;
                set(keyTouched ? { label } : { label, key: toKey(label) });
              }}
            />
          </Labelled>

          <Labelled
            label="Key"
            required
            hint={
              isEditing
                ? 'Immutable — it is the storage key for every existing answer.'
                : 'Lowercase letters, numbers and underscores.'
            }
          >
            <Input
              value={draft.key}
              disabled={isEditing}
              placeholder="battery_health"
              onChange={(event) => {
                setKeyTouched(true);
                set({ key: event.target.value });
              }}
            />
          </Labelled>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled
            label="Type"
            required
            hint={isEditing ? 'Immutable — changing it would invalidate stored values.' : undefined}
          >
            <Select
              value={draft.type}
              disabled={isEditing}
              onChange={(event) =>
                set({ type: event.target.value as FieldType, options: [], validation: {} })
              }
            >
              {fieldTypes.map((info) => (
                <option key={info.type} value={info.type}>
                  {info.label}
                </option>
              ))}
            </Select>
          </Labelled>

          <Labelled label="Unit" hint="Shown as a suffix, e.g. GB or %.">
            <Input
              value={draft.unit}
              placeholder="GB"
              onChange={(event) => set({ unit: event.target.value })}
            />
          </Labelled>
        </div>

        <Labelled label="Help text">
          <Textarea
            rows={2}
            value={draft.helpText}
            placeholder="Guidance shown under the input."
            onChange={(event) => set({ helpText: event.target.value })}
          />
        </Labelled>

        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label="Placeholder">
            <Input
              value={draft.placeholder}
              onChange={(event) => set({ placeholder: event.target.value })}
            />
          </Labelled>

          <Labelled label="Default value">
            <Input
              value={draft.defaultValue}
              placeholder={draft.type === 'BOOLEAN' ? 'true or false' : undefined}
              onChange={(event) => set({ defaultValue: event.target.value })}
            />
          </Labelled>
        </div>

        {/* Validation controls vary by type — no point offering minLength on a date. */}
        {(isNumeric || isDate || isText || isMulti) && (
          <fieldset className="rounded-lg border border-line p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Validation
            </legend>

            <div className="grid gap-4 sm:grid-cols-3">
              {isNumeric ? (
                <>
                  <Labelled label="Minimum">
                    <Input
                      type="number"
                      value={draft.validation.min ?? ''}
                      onChange={(event) =>
                        setValidation({ min: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                    />
                  </Labelled>
                  <Labelled label="Maximum">
                    <Input
                      type="number"
                      value={draft.validation.max ?? ''}
                      onChange={(event) =>
                        setValidation({ max: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                    />
                  </Labelled>
                  <Labelled label="Step">
                    <Input
                      type="number"
                      value={draft.validation.step ?? ''}
                      onChange={(event) =>
                        setValidation({ step: event.target.value === '' ? undefined : Number(event.target.value) })
                      }
                    />
                  </Labelled>
                </>
              ) : null}

              {isDate ? (
                <>
                  <Labelled label="Earliest">
                    <Input
                      type="date"
                      value={typeof draft.validation.min === 'string' ? draft.validation.min : ''}
                      onChange={(event) => setValidation({ min: event.target.value || undefined })}
                    />
                  </Labelled>
                  <Labelled label="Latest">
                    <Input
                      type="date"
                      value={typeof draft.validation.max === 'string' ? draft.validation.max : ''}
                      onChange={(event) => setValidation({ max: event.target.value || undefined })}
                    />
                  </Labelled>
                </>
              ) : null}

              {isText ? (
                <>
                  <Labelled label="Min length">
                    <Input
                      type="number"
                      value={draft.validation.minLength ?? ''}
                      onChange={(event) =>
                        setValidation({
                          minLength: event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </Labelled>
                  <Labelled label="Max length">
                    <Input
                      type="number"
                      value={draft.validation.maxLength ?? ''}
                      onChange={(event) =>
                        setValidation({
                          maxLength: event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </Labelled>
                </>
              ) : null}

              {isMulti ? (
                <>
                  <Labelled label="Min selected">
                    <Input
                      type="number"
                      value={draft.validation.minSelected ?? ''}
                      onChange={(event) =>
                        setValidation({
                          minSelected: event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </Labelled>
                  <Labelled label="Max selected">
                    <Input
                      type="number"
                      value={draft.validation.maxSelected ?? ''}
                      onChange={(event) =>
                        setValidation({
                          maxSelected: event.target.value === '' ? undefined : Number(event.target.value),
                        })
                      }
                    />
                  </Labelled>
                </>
              ) : null}
            </div>
          </fieldset>
        )}

        {usesOptions ? (
          <OptionEditor
            options={draft.options}
            onChange={(options) => set({ options })}
          />
        ) : null}
      </div>

      <div className="mt-6 flex gap-3">
        <Button onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Create field'}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </Card>
  );
}

function OptionEditor({
  options,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  onChange: (options: Array<{ value: string; label: string }>) => void;
}) {
  const update = (index: number, patch: Partial<{ value: string; label: string }>) =>
    onChange(options.map((option, i) => (i === index ? { ...option, ...patch } : option)));

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= options.length) return;
    const next = [...options];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onChange(next);
  };

  return (
    <fieldset className="rounded-lg border border-line p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
        Options
      </legend>

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Input
              className="min-w-32 flex-1"
              value={option.label}
              placeholder="Label shown to sellers"
              onChange={(event) => {
                const label = event.target.value;
                // Keep value in step with label until an admin edits it directly.
                update(index, option.value === toKey(option.label) || !option.value
                  ? { label, value: toKey(label) }
                  : { label });
              }}
            />
            <Input
              className="min-w-28 flex-1 font-mono text-xs"
              value={option.value}
              placeholder="stored_value"
              onChange={(event) => update(index, { value: event.target.value })}
            />
            <Button variant="ghost" size="sm" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}>
              ↑
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Move down"
              disabled={index === options.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove option"
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              ✕
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        size="sm"
        className="mt-3"
        onClick={() => onChange([...options, { value: '', label: '' }])}
      >
        + Add option
      </Button>

      <p className="mt-3 text-xs text-muted">
        Removing an option deactivates it rather than deleting it, so listings that already chose it
        still display correctly.
      </p>
    </fieldset>
  );
}

function Labelled({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-red-500" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      {children}
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
