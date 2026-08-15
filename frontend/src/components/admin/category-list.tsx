'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Input, SectionHeading, Select, Textarea } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { cn } from '@/lib/utils';

export function CategoryList({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: '', icon: '', description: '', parentId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => setCategories(await api.admin.categories.list());

  const create = async () => {
    setSaving(true);
    setError(null);

    try {
      await api.admin.categories.create({
        name: draft.name.trim(),
        icon: draft.icon.trim() || null,
        description: draft.description.trim() || null,
        parentId: draft.parentId || null,
      });

      await refresh();
      setDraft({ name: '', icon: '', description: '', parentId: '' });
      setCreating(false);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the category.');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (category: Category) => {
    await api.admin.categories.setActive(category.id, !category.isActive);
    await refresh();
  };

  // Render parents with their children nested beneath them.
  const roots = categories.filter((category) => !category.parentId);
  const childrenOf = (id: string) => categories.filter((category) => category.parentId === id);

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Categories"
        description="A category decides which questions the sell flow asks. Children inherit their parent's fields."
        action={<Button onClick={() => setCreating((value) => !value)}>+ New category</Button>}
      />

      {creating ? (
        <Card className="p-5">
          <h3 className="text-base font-semibold text-foreground">New category</h3>

          {error ? (
            <div className="mt-4">
              <Alert tone="danger">{error}</Alert>
            </div>
          ) : null}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Name</span>
              <Input
                value={draft.name}
                placeholder="e.g. Bicycle"
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Icon (emoji)</span>
              <Input
                value={draft.icon}
                placeholder="🚲"
                maxLength={4}
                onChange={(event) => setDraft({ ...draft, icon: event.target.value })}
              />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Parent category</span>
              <Select
                value={draft.parentId}
                onChange={(event) => setDraft({ ...draft, parentId: event.target.value })}
              >
                <option value="">None (top level)</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </Select>
              <span className="mt-1 block text-xs text-muted">
                A child inherits every field attached to its parent.
              </span>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-foreground">Description</span>
              <Textarea
                rows={2}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </label>
          </div>

          <div className="mt-5 flex gap-3">
            <Button onClick={create} disabled={saving || draft.name.trim().length < 2}>
              {saving ? 'Creating…' : 'Create category'}
            </Button>
            <Button variant="secondary" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {roots.map((root) => (
            <li key={root.id}>
              <CategoryRow category={root} onToggle={toggleActive} />
              {childrenOf(root.id).map((child) => (
                <div key={child.id} className="border-t border-line pl-8">
                  <CategoryRow category={child} onToggle={toggleActive} />
                </div>
              ))}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  onToggle,
}: {
  category: Category;
  onToggle: (category: Category) => void;
}) {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3 px-5 py-3', !category.isActive && 'opacity-55')}
    >
      <span className="text-xl" aria-hidden>
        {category.icon ?? '📦'}
      </span>

      <div className="min-w-40 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{category.name}</span>
          {!category.isActive ? <Badge tone="danger">Inactive</Badge> : null}
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted">{category.slug}</p>
      </div>

      <span className="text-xs text-muted">
        {category.fieldCount} fields · {category.listingCount} listings
      </span>

      <div className="flex gap-1">
        <Link
          href={`/admin/categories/${category.id}`}
          className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          Configure fields
        </Link>
        <Button variant="ghost" size="sm" onClick={() => onToggle(category)}>
          {category.isActive ? 'Deactivate' : 'Reactivate'}
        </Button>
      </div>
    </div>
  );
}
