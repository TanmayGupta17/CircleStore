'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DynamicForm } from '@/components/fields/dynamic-form';
import { Alert, Badge, Button, Card, Input, SectionHeading, Select } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type {
  Category,
  CategoryAttachmentRow,
  Field,
  FormSchema,
  VisibilityOperator,
} from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Category builder — configuration on the left, a LIVE preview on the right.
 *
 * The preview is not a mock. It renders `DynamicForm`, the exact component the
 * seller flow uses, fed by the exact `form-schema` endpoint the seller flow
 * calls. Every change round-trips through the real resolver, so what an admin
 * sees here is what a seller gets, and the preview doubles as a smoke test of
 * the resolver itself.
 */
export function CategoryBuilder({
  category,
  allFields,
}: {
  category: Category;
  allFields: Field[];
}) {
  const [attachments, setAttachments] = useState<CategoryAttachmentRow[]>([]);
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [addFieldId, setAddFieldId] = useState('');

  const reload = useCallback(async () => {
    const [rows, form] = await Promise.all([
      api.admin.categories.attachments(category.id),
      api.categories.formSchema(category.slug),
    ]);
    setAttachments(rows);
    setSchema(form);
  }, [category.id, category.slug]);

  // Initial load. State is only written once the requests resolve, so nothing
  // is set synchronously during the effect.
  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      api.admin.categories.attachments(category.id),
      api.categories.formSchema(category.slug),
    ]).then(([rows, form]) => {
      if (cancelled) return;
      setAttachments(rows);
      setSchema(form);
    }).catch((caught: unknown) => {
      if (cancelled) return;
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues(caught.issues);
      } else {
        setError(
          'Could not reach the API. Check that the backend is running and allows this site in its CORS configuration.',
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [category.id, category.slug]);

  /** Every mutation funnels through here so error handling is written once. */
  const mutate = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    setIssues([]);

    try {
      await action();
      await reload();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues(caught.issues);
      } else {
        setError(
          'Could not reach the API. Check that the backend is running and allows this site in its CORS configuration.',
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const attachedFieldIds = new Set(attachments.map((row) => row.field.id));
  const available = allFields.filter((field) => field.isActive && !attachedFieldIds.has(field.id));

  // Fields usable as a rule's controlling field: attached, and earlier in order.
  const controllingCandidates = (index: number) =>
    attachments.slice(0, index).filter((row) => row.field.options.length > 0 || row.field.type === 'BOOLEAN');

  const inheritedFields = (schema?.fields ?? []).filter((field) => field.inheritedFrom);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/categories" className="text-sm text-muted hover:text-foreground">
          ← All categories
        </Link>
        <SectionHeading
          title={`${category.icon ?? ''} ${category.name}`.trim()}
          description="Attach fields, set what is required, group into sections, and add conditional rules."
        />
      </div>

      {error ? (
        <Alert tone="danger" title="Change rejected">
          {error}
          {issues.length > 0 ? (
            <ul className="mt-2 list-disc pl-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {/* ---------------------------- Configuration ---------------------- */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-semibold text-foreground">Add a field</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Select
                className="min-w-48 flex-1"
                value={addFieldId}
                onChange={(event) => setAddFieldId(event.target.value)}
              >
                <option value="">Choose from the library…</option>
                {available.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label} ({field.type})
                  </option>
                ))}
              </Select>
              <Button
                disabled={!addFieldId || busy}
                onClick={() =>
                  void mutate(async () => {
                    await api.admin.categories.attachField(category.id, {
                      fieldId: addFieldId,
                      section: 'Details',
                    });
                    setAddFieldId('');
                  })
                }
              >
                Attach
              </Button>
            </div>
            {available.length === 0 ? (
              <p className="mt-2 text-xs text-muted">
                Every active field is already attached.{' '}
                <Link href="/admin/fields" className="underline underline-offset-2">
                  Create a new one
                </Link>
                .
              </p>
            ) : null}
          </Card>

          {inheritedFields.length > 0 ? (
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-foreground">Inherited fields</h3>
              <p className="mt-1 text-xs text-muted">
                Defined on a parent category and resolved automatically. Edit them on the parent.
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {inheritedFields.map((field) => (
                  <li key={field.key}>
                    <Badge>
                      {field.label} · from {field.inheritedFrom?.categoryName}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {attachments.length === 0 ? (
            <Card className="px-4 py-10 text-center text-sm text-muted">
              No fields attached yet. Add one above to start building the form.
            </Card>
          ) : (
            <ul className="space-y-3">
              {attachments.map((row, index) => (
                <AttachmentCard
                  key={row.id}
                  row={row}
                  index={index}
                  total={attachments.length}
                  busy={busy}
                  candidates={controllingCandidates(index)}
                  onUpdate={(patch) =>
                    void mutate(() => api.admin.attachments.update(row.id, patch))
                  }
                  onDetach={() => void mutate(() => api.admin.attachments.detach(row.id))}
                  onMove={(direction) =>
                    void mutate(() => {
                      const ordered = attachments.map((item) => item.id);
                      const target = index + direction;
                      if (target < 0 || target >= ordered.length) return Promise.resolve();
                      const next = [...ordered];
                      const [moved] = next.splice(index, 1);
                      if (moved) next.splice(target, 0, moved);
                      return api.admin.categories.reorderFields(category.id, next);
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {/* ------------------------------ Preview -------------------------- */}
        <div className="xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Live seller preview</h3>
                <p className="text-xs text-muted">
                  The real form component, fed by the real API.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPreviewValues({})}>
                Reset
              </Button>
            </div>

            {schema ? (
              <DynamicForm
                schema={schema}
                values={previewValues}
                onChange={(key, value) =>
                  setPreviewValues((previous) => ({ ...previous, [key]: value }))
                }
                idPrefix="preview"
              />
            ) : (
              <p className="text-sm text-muted">Loading preview…</p>
            )}

            <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
              Try a conditional rule: set one below and watch the dependent field appear and
              disappear as you answer.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

const OPERATOR_LABELS: Partial<Record<VisibilityOperator, string>> = {
  eq: 'is',
  neq: 'is not',
  truthy: 'is yes',
  falsy: 'is no',
};

function AttachmentCard({
  row,
  index,
  total,
  busy,
  candidates,
  onUpdate,
  onDetach,
  onMove,
}: {
  row: CategoryAttachmentRow;
  index: number;
  total: number;
  busy: boolean;
  candidates: CategoryAttachmentRow[];
  onUpdate: (patch: Record<string, unknown>) => void;
  onDetach: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  const rule = row.visibilityRule;
  const condition =
    rule?.all && rule.all.length > 0 && 'field' in rule.all[0]!
      ? (rule.all[0] as { field: string; op: VisibilityOperator; value?: unknown })
      : null;

  const [showRule, setShowRule] = useState(Boolean(condition));

  return (
    <Card className={cn('p-4', !row.field.isActive && 'opacity-60')}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-40 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{row.field.label}</span>
            <Badge>{row.field.type}</Badge>
            {!row.field.isActive ? <Badge tone="danger">Inactive</Badge> : null}
          </div>
          <p className="mt-0.5 font-mono text-xs text-muted">{row.field.key}</p>
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="sm" aria-label="Move up" disabled={busy || index === 0} onClick={() => onMove(-1)}>
            ↑
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Move down"
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
          >
            ↓
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={onDetach}>
            Remove
          </Button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">Section</span>
          <Input
            defaultValue={row.section}
            disabled={busy}
            onBlur={(event) => {
              const section = event.target.value.trim();
              if (section && section !== row.section) onUpdate({ section });
            }}
          />
        </label>

        <div className="flex items-end gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={row.isRequired}
              disabled={busy}
              className="h-4 w-4 accent-brand-600"
              onChange={(event) => onUpdate({ isRequired: event.target.checked })}
            />
            Required
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={row.showInCard}
              disabled={busy}
              className="h-4 w-4 accent-brand-600"
              onChange={(event) => onUpdate({ showInCard: event.target.checked })}
            />
            Show on card
          </label>
        </div>
      </div>

      <div className="mt-3 border-t border-line pt-3">
        {!showRule && !condition ? (
          <button
            type="button"
            className="text-xs font-medium text-brand-600 hover:underline"
            disabled={candidates.length === 0 || busy}
            onClick={() => setShowRule(true)}
          >
            {candidates.length === 0
              ? 'Conditional rules need an earlier yes/no or choice field'
              : '+ Only show this field when…'}
          </button>
        ) : (
          <ConditionEditor
            condition={condition}
            candidates={candidates}
            busy={busy}
            onClear={() => {
              setShowRule(false);
              onUpdate({ visibilityRule: null });
            }}
            onApply={(next) => onUpdate({ visibilityRule: { all: [next] } })}
          />
        )}
      </div>
    </Card>
  );
}

function ConditionEditor({
  condition,
  candidates,
  busy,
  onApply,
  onClear,
}: {
  condition: { field: string; op: VisibilityOperator; value?: unknown } | null;
  candidates: CategoryAttachmentRow[];
  busy: boolean;
  onApply: (condition: { field: string; op: VisibilityOperator; value?: unknown }) => void;
  onClear: () => void;
}) {
  const [fieldKey, setFieldKey] = useState(condition?.field ?? candidates[0]?.field.key ?? '');
  const [op, setOp] = useState<VisibilityOperator>(condition?.op ?? 'eq');
  const [value, setValue] = useState(condition?.value !== undefined ? String(condition.value) : '');

  const selected = candidates.find((row) => row.field.key === fieldKey);
  const needsValue = op === 'eq' || op === 'neq';

  return (
    <div className="rounded-lg bg-surface-muted p-3">
      <p className="mb-2 text-xs font-medium text-muted">Only show this field when</p>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          className="min-w-32 flex-1"
          value={fieldKey}
          disabled={busy}
          onChange={(event) => setFieldKey(event.target.value)}
        >
          {candidates.map((row) => (
            <option key={row.id} value={row.field.key}>
              {row.field.label}
            </option>
          ))}
        </Select>

        <Select
          className="w-28"
          value={op}
          disabled={busy}
          onChange={(event) => setOp(event.target.value as VisibilityOperator)}
        >
          {(Object.keys(OPERATOR_LABELS) as VisibilityOperator[]).map((operator) => (
            <option key={operator} value={operator}>
              {OPERATOR_LABELS[operator]}
            </option>
          ))}
        </Select>

        {needsValue ? (
          selected && selected.field.options.length > 0 ? (
            <Select
              className="min-w-28 flex-1"
              value={value}
              disabled={busy}
              onChange={(event) => setValue(event.target.value)}
            >
              <option value="">Select…</option>
              {selected.field.options
                .filter((option) => option.isActive)
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </Select>
          ) : (
            <Input
              className="min-w-28 flex-1"
              value={value}
              disabled={busy}
              placeholder="value"
              onChange={(event) => setValue(event.target.value)}
            />
          )
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <Button
          size="sm"
          disabled={busy || !fieldKey || (needsValue && !value)}
          onClick={() => onApply(needsValue ? { field: fieldKey, op, value } : { field: fieldKey, op })}
        >
          Apply rule
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
          Remove rule
        </Button>
      </div>
    </div>
  );
}
