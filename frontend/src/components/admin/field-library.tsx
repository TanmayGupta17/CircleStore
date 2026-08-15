'use client';

import { useState } from 'react';
import { Alert, Badge, Button, Card, EmptyState, Input, SectionHeading } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { Field, FieldTypeInfo } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  FieldEditor,
  draftFromField,
  emptyDraft,
  type FieldDraft,
} from './field-editor';

/**
 * The global field library.
 *
 * Fields live here once and are attached to as many categories as needed —
 * "RAM" is a single definition shared by Mobile Phone and Laptop. Editing it
 * here updates every category that uses it.
 */
export function FieldLibrary({
  initialFields,
  fieldTypes,
}: {
  initialFields: Field[];
  fieldTypes: FieldTypeInfo[];
}) {
  const [fields, setFields] = useState(initialFields);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<{ id: string | null; draft: FieldDraft } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = async () => setFields(await api.admin.fields.list());

  const visible = fields.filter((field) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return field.label.toLowerCase().includes(needle) || field.key.toLowerCase().includes(needle);
  });

  const save = async () => {
    if (!editing) return;

    setSaving(true);
    setError(null);
    setIssues([]);

    // Empty strings mean "not set" rather than an empty value.
    const payload = {
      label: editing.draft.label.trim(),
      helpText: editing.draft.helpText.trim() || null,
      unit: editing.draft.unit.trim() || null,
      placeholder: editing.draft.placeholder.trim() || null,
      defaultValue: editing.draft.defaultValue.trim() || null,
      validation: editing.draft.validation,
      options: editing.draft.options
        .filter((option) => option.value.trim() && option.label.trim())
        .map((option, index) => ({ ...option, sortOrder: index })),
    };

    try {
      if (editing.id) {
        await api.admin.fields.update(editing.id, payload);
      } else {
        await api.admin.fields.create({
          ...payload,
          key: editing.draft.key.trim(),
          type: editing.draft.type,
        });
      }

      await refresh();
      setEditing(null);
      setNotice(editing.id ? 'Field updated.' : 'Field created.');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
        setIssues([...caught.issues, ...Object.values(caught.fieldErrors)]);
      } else {
        setError('Could not save the field.');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (field: Field) => {
    // Show the blast radius before a deactivation, never after.
    if (field.isActive) {
      try {
        const impact = await api.admin.fields.impact(field.id);
        const confirmed = window.confirm(
          `Deactivate “${field.label}”?\n\n` +
            `· Used by ${impact.attachments} categor${impact.attachments === 1 ? 'y' : 'ies'}\n` +
            `· ${impact.listingsWithValue} listing(s) already store a value\n\n` +
            'Existing listings keep displaying their values via the schema snapshot. ' +
            'The field will stop appearing in new listings.',
        );
        if (!confirmed) return;
      } catch {
        // If the impact call fails, fall through to a plain confirmation.
        if (!window.confirm(`Deactivate “${field.label}”?`)) return;
      }
    }

    await api.admin.fields.setActive(field.id, !field.isActive);
    await refresh();
    setNotice(field.isActive ? 'Field deactivated.' : 'Field reactivated.');
  };

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Field library"
        description="Reusable question definitions. Attach them to categories to build a form."
        action={
          <Button
            onClick={() => {
              setEditing({ id: null, draft: emptyDraft() });
              setError(null);
              setNotice(null);
            }}
          >
            + New field
          </Button>
        }
      />

      {notice ? <Alert tone="info">{notice}</Alert> : null}

      {editing ? (
        <FieldEditor
          draft={editing.draft}
          fieldTypes={fieldTypes}
          isEditing={editing.id !== null}
          saving={saving}
          error={error}
          issues={issues}
          onChange={(draft) => setEditing({ ...editing, draft })}
          onSave={save}
          onCancel={() => {
            setEditing(null);
            setError(null);
          }}
        />
      ) : null}

      <Input
        value={search}
        placeholder="Search fields by label or key…"
        onChange={(event) => setSearch(event.target.value)}
        className="max-w-sm"
      />

      {visible.length === 0 ? (
        <EmptyState
          icon="🧱"
          title="No fields found"
          description="Create a field, then attach it to one or more categories."
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {visible.map((field) => (
              <li
                key={field.id}
                className={cn(
                  'flex flex-wrap items-center gap-3 px-5 py-3',
                  !field.isActive && 'opacity-55',
                )}
              >
                <div className="min-w-48 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{field.label}</span>
                    <Badge>{field.type}</Badge>
                    {!field.isActive ? <Badge tone="danger">Inactive</Badge> : null}
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-muted">
                    {field.key}
                    {field.unit ? ` · ${field.unit}` : ''}
                    {field.options.length > 0
                      ? ` · ${field.options.filter((o) => o.isActive).length} options`
                      : ''}
                  </p>
                </div>

                <span className="text-xs text-muted">
                  used by {field.usageCount ?? 0} categor{(field.usageCount ?? 0) === 1 ? 'y' : 'ies'}
                </span>

                <div className="flex gap-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditing({ id: field.id, draft: draftFromField(field) });
                      setError(null);
                      setNotice(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void toggleActive(field)}>
                    {field.isActive ? 'Deactivate' : 'Reactivate'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
