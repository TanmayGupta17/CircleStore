'use client';

import { useMemo, useState } from 'react';
import { Card, Input, Select, Textarea } from '@/components/ui';
import type { Category, FormSchema, ListingCondition } from '@/lib/types';
import { CONDITION_OPTIONS, cn, formatPrice } from '@/lib/utils';

export interface CommonValues {
  title: string;
  description: string;
  price: string;
  condition: ListingCondition | '';
  city: string;
}

export interface ImageDraft {
  url: string;
  alt: string;
  /** Provider handle, present only for images uploaded through the app. */
  storageKey?: string | null;
  width?: number | null;
  height?: number | null;
}

// ---------------------------------------------------------------------------
// Step 1 — category
// ---------------------------------------------------------------------------

/** Slug of the catch-all category, pinned separately at the bottom. */
const CATCH_ALL_SLUG = 'everything-else';

/**
 * Category picker.
 *
 * Built to scale: the marketplace ships ~30 sellable categories and admins add
 * more without a deploy, so this searches and groups rather than assuming a
 * handful of tiles will fit. Only LEAF categories are selectable — parents exist
 * to group and to share fields with their children.
 */
export function CategoryStep({
  categories,
  selectedId,
  onSelect,
}: {
  categories: Category[];
  selectedId: string | null;
  onSelect: (category: Category) => void;
}) {
  const [query, setQuery] = useState('');

  const { groups, catchAll, matchCount } = useMemo(() => {
    const parentIds = new Set(categories.map((c) => c.parentId).filter(Boolean));
    const byId = new Map(categories.map((c) => [c.id, c]));
    const needle = query.trim().toLowerCase();

    const selectable = categories
      .filter((category) => !parentIds.has(category.id) && category.isActive)
      .filter((category) => {
        if (!needle) return true;
        const parentName = category.parentId ? (byId.get(category.parentId)?.name ?? '') : '';
        // Searching "phone" should also surface things grouped under Electronics.
        return `${category.name} ${parentName} ${category.description ?? ''}`
          .toLowerCase()
          .includes(needle);
      });

    const grouped = new Map<string, { name: string; icon: string | null; items: Category[] }>();
    let fallback: Category | null = null;

    for (const category of selectable) {
      if (category.slug === CATCH_ALL_SLUG) {
        fallback = category;
        continue;
      }

      const parent = category.parentId ? byId.get(category.parentId) : undefined;
      const key = parent?.id ?? '__top';
      const existing = grouped.get(key);

      if (existing) existing.items.push(category);
      else grouped.set(key, { name: parent?.name ?? 'Other', icon: parent?.icon ?? null, items: [category] });
    }

    return {
      groups: Array.from(grouped.values()),
      catchAll: fallback,
      matchCount: selectable.length,
    };
  }, [categories, query]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">What are you selling?</h2>
      <p className="mt-1 text-sm text-muted">
        The category decides which questions you will be asked next.
      </p>

      <div className="mt-5">
        <Input
          type="search"
          value={query}
          placeholder="Search categories — phone, sofa, scooter, shoes…"
          aria-label="Search categories"
          onChange={(event) => setQuery(event.target.value)}
        />
        {query ? (
          <p className="mt-2 text-xs text-muted">
            {matchCount} {matchCount === 1 ? 'category' : 'categories'} match “{query}”
          </p>
        ) : null}
      </div>

      {groups.length === 0 && !catchAll ? (
        <p className="mt-6 rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          Nothing matches “{query}”. Try a different word, or clear the search and pick
          “Everything Else”.
        </p>
      ) : null}

      <div className="mt-6 space-y-7">
        {groups.map((group) => (
          <section key={group.name}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {group.icon ? <span aria-hidden>{group.icon} </span> : null}
              {group.name}
            </h3>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {group.items.map((category) => (
                <CategoryTile
                  key={category.id}
                  category={category}
                  selected={category.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/*
        The escape hatch, pinned last and visually distinct: a seller whose item
        has no dedicated category can still list it rather than giving up.
      */}
      {catchAll ? (
        <section className="mt-8 border-t border-line pt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Not listed above?
          </h3>
          <CategoryTile
            category={catchAll}
            selected={catchAll.id === selectedId}
            onSelect={onSelect}
            wide
          />
        </section>
      ) : null}
    </div>
  );
}

function CategoryTile({
  category,
  selected,
  onSelect,
  wide,
}: {
  category: Category;
  selected: boolean;
  onSelect: (category: Category) => void;
  wide?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      aria-pressed={selected}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
        selected
          ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/30'
          : 'border-line bg-surface hover:border-brand-300',
        wide && 'w-full',
      )}
    >
      <span className="text-xl" aria-hidden>
        {category.icon ?? '📦'}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{category.name}</span>
        <span className="block truncate text-xs text-muted">
          {wide && category.description ? category.description : `${category.fieldCount} questions`}
        </span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — common information
// ---------------------------------------------------------------------------

/**
 * These five fields are COMMON to every listing regardless of category, so they
 * are real columns on the listings table and a static form here. Everything
 * category-specific is rendered by `DynamicForm` in the next step.
 */
export function BasicsStep({
  values,
  errors,
  onChange,
}: {
  values: CommonValues;
  errors: Record<string, string>;
  onChange: (patch: Partial<CommonValues>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">The basics</h2>
        <p className="mt-1 text-sm text-muted">
          Information every listing needs, whatever the category.
        </p>
      </div>

      <Labelled label="Title" error={errors.title} required htmlFor="title">
        <Input
          id="title"
          value={values.title}
          maxLength={120}
          hasError={Boolean(errors.title)}
          placeholder="e.g. iPhone 13 Pro 256GB — Graphite"
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </Labelled>

      <Labelled label="Description" error={errors.description} required htmlFor="description">
        <Textarea
          id="description"
          rows={5}
          value={values.description}
          maxLength={5000}
          hasError={Boolean(errors.description)}
          placeholder="Condition, reason for selling, anything a buyer should know."
          onChange={(event) => onChange({ description: event.target.value })}
        />
        <p className="mt-1 text-right text-xs text-muted">{values.description.length} / 5000</p>
      </Labelled>

      <div className="grid gap-5 sm:grid-cols-2">
        <Labelled label="Price (₹)" error={errors.price} required htmlFor="price">
          <Input
            id="price"
            type="number"
            min={0}
            value={values.price}
            hasError={Boolean(errors.price)}
            placeholder="0"
            onChange={(event) => onChange({ price: event.target.value })}
          />
        </Labelled>

        <Labelled label="Condition" error={errors.condition} required htmlFor="condition">
          <Select
            id="condition"
            value={values.condition}
            hasError={Boolean(errors.condition)}
            onChange={(event) => onChange({ condition: event.target.value as ListingCondition })}
          >
            <option value="">Select condition</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Labelled>
      </div>

      <Labelled label="City" error={errors.city} required htmlFor="city">
        <Input
          id="city"
          value={values.city}
          hasError={Boolean(errors.city)}
          placeholder="e.g. Bengaluru"
          onChange={(event) => onChange({ city: event.target.value })}
        />
      </Labelled>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — review
// ---------------------------------------------------------------------------

export function ReviewStep({
  common,
  schema,
  attributes,
  images,
}: {
  common: CommonValues;
  schema: FormSchema | null;
  attributes: Record<string, unknown>;
  images: ImageDraft[];
}) {
  const answered = (schema?.fields ?? []).filter(
    (field) => attributes[field.key] !== undefined && attributes[field.key] !== '',
  );

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Review your listing</h2>
      <p className="mt-1 text-sm text-muted">Check everything reads the way you want it to.</p>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-line bg-surface-muted px-5 py-3">
          <p className="text-xs uppercase tracking-wide text-muted">
            {schema?.category.icon} {schema?.category.name}
          </p>
          <h3 className="mt-1 font-semibold text-foreground">{common.title || 'Untitled listing'}</h3>
          <p className="mt-1 text-lg font-bold text-foreground">
            {common.price ? formatPrice(Number(common.price)) : '—'}
          </p>
        </div>

        <dl className="divide-y divide-line">
          <Row label="Condition" value={CONDITION_OPTIONS.find((c) => c.value === common.condition)?.label ?? '—'} />
          <Row label="City" value={common.city || '—'} />
          <Row label="Photos" value={String(images.filter((image) => image.url.trim()).length)} />
          {answered.map((field) => (
            <Row key={field.key} label={field.label} value={displayValue(field.key, attributes, field)} />
          ))}
        </dl>
      </Card>

      <Card className="mt-4 p-5">
        <h3 className="text-sm font-semibold text-foreground">Description</h3>
        <p className="mt-2 whitespace-pre-line text-sm text-muted">{common.description || '—'}</p>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}

function displayValue(
  key: string,
  attributes: Record<string, unknown>,
  field: FormSchema['fields'][number],
): string {
  const value = attributes[key];
  if (value === undefined || value === null || value === '') return '—';

  const labelFor = (raw: unknown) =>
    field.options.find((option) => option.value === String(raw))?.label ?? String(raw);

  if (Array.isArray(value)) return value.length ? value.map(labelFor).join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (field.options.length > 0) return labelFor(value);
  return field.unit ? `${value} ${field.unit}` : String(value);
}

// ---------------------------------------------------------------------------

function Labelled({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-1 text-red-500" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
