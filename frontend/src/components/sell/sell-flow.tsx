'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DynamicForm } from '@/components/fields/dynamic-form';
import { Alert, Button, Spinner } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { stripHidden, validateAttributes } from '@/lib/client-validation';
import type { Category, FormSchema } from '@/lib/types';
import { createDraftId } from '@/lib/upload';
import { PhotosStep } from './photo-uploader';
import {
  BasicsStep,
  CategoryStep,
  ReviewStep,
  type CommonValues,
  type ImageDraft,
} from './steps';
import { SELL_STEPS, Stepper, type SellStep } from './stepper';

const DRAFT_KEY = 'circlestore:sell-draft';

const EMPTY_COMMON: CommonValues = {
  title: '',
  description: '',
  price: '',
  condition: '',
  city: '',
};

interface Draft {
  categoryId: string | null;
  /**
   * Groups this draft's uploads under one storage folder, so files left behind
   * by an abandoned listing are identifiable by prefix.
   */
  draftId: string;
  common: CommonValues;
  /**
   * Every answer the seller has given, keyed by FIELD KEY and never scoped to a
   * category. Because the field library is global, this map is what makes
   * cross-category carry-over work — see the note on the component below.
   */
  answers: Record<string, unknown>;
  images: ImageDraft[];
}

/**
 * `draftId` is empty here and filled on mount: generating it during module
 * evaluation would produce different values on server and client and break
 * hydration.
 */
const EMPTY_DRAFT: Draft = {
  categoryId: null,
  draftId: '',
  common: EMPTY_COMMON,
  answers: {},
  images: [],
};

/**
 * The seller listing flow.
 *
 * Two things worth noting:
 *
 * 1. `answers` is a single map keyed by field key, not scoped per category.
 *    Switching from Mobile Phone to Laptop therefore carries over every shared
 *    answer (brand, RAM, storage) for free, and answers that do not apply are
 *    parked rather than destroyed — switch back and they return. Only keys
 *    present in the active schema are ever submitted.
 *
 * 2. There is no per-category code here at all. `DynamicForm` renders whatever
 *    the fetched schema describes.
 */
export function SellFlow({ categories }: { categories: Category[] }) {
  const router = useRouter();

  const [step, setStep] = useState<SellStep>('category');

  // Draft and "was it restored" move together, so hydrating from localStorage is
  // a single state write rather than a cascade of them.
  const [{ draft, restoredFromStorage }, setFlow] = useState<{
    draft: Draft;
    restoredFromStorage: boolean;
  }>({ draft: EMPTY_DRAFT, restoredFromStorage: false });

  const setDraft = useCallback((update: (previous: Draft) => Draft) => {
    setFlow((previous) => ({ ...previous, draft: update(previous.draft) }));
  }, []);

  // Cached alongside the category it belongs to, so a stale schema is never
  // rendered for a newly picked category without a synchronous reset.
  const [loadedSchema, setLoadedSchema] = useState<{ categoryId: string; schema: FormSchema } | null>(
    null,
  );
  const [schemaError, setSchemaError] = useState<string | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const category = useMemo(
    () => categories.find((item) => item.id === draft.categoryId) ?? null,
    [categories, draft.categoryId],
  );

  const schema = category && loadedSchema?.categoryId === category.id ? loadedSchema.schema : null;
  const schemaLoading = Boolean(category) && !schema && !schemaError;

  // --- Draft persistence --------------------------------------------------

  useEffect(() => {
    let restored: { draft: Draft; restoredFromStorage: boolean } | null = null;

    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      const stored = raw ? (JSON.parse(raw) as Partial<Draft>) : null;
      const known = Boolean(stored) && categories.some((item) => item.id === stored?.categoryId);

      restored = {
        draft: {
          categoryId: known ? (stored?.categoryId ?? null) : null,
          // Reuse the stored draft id so uploads from an earlier session stay
          // grouped with this listing.
          draftId: stored?.draftId || createDraftId(),
          common: { ...EMPTY_COMMON, ...stored?.common },
          answers: stored?.answers ?? {},
          images: stored?.images ?? [],
        },
        restoredFromStorage: known,
      };
    } catch {
      // A corrupt draft must never block the flow.
      window.localStorage.removeItem(DRAFT_KEY);
      restored = { draft: { ...EMPTY_DRAFT, draftId: createDraftId() }, restoredFromStorage: false };
    }

    // Hydrating state from an external store on mount is the one case where a
    // synchronous setState in an effect is correct: it runs once, cannot
    // cascade, and a lazy initialiser is unavailable because localStorage does
    // not exist during server rendering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (restored) setFlow(restored);
  }, [categories]);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  // --- Schema loading -----------------------------------------------------

  useEffect(() => {
    if (!category) return;

    let cancelled = false;

    api.categories
      .formSchema(category.slug)
      .then((loaded) => {
        if (cancelled) return;
        setLoadedSchema({ categoryId: category.id, schema: loaded });
        setSchemaError(null);
      })
      .catch(() => {
        if (!cancelled) setSchemaError('Could not load the fields for this category.');
      });

    return () => {
      cancelled = true;
    };
  }, [category]);

  /** How many stored answers this category asks for, and how many it does not. */
  const carriedOver = useMemo(() => {
    if (!schema) return { kept: 0, parked: 0 };

    const schemaKeys = new Set(schema.fields.map((field) => field.key));
    const answered = Object.entries(draft.answers)
      .filter(([, value]) => value !== undefined && value !== '' && value !== null)
      .map(([key]) => key);

    return {
      kept: answered.filter((key) => schemaKeys.has(key)).length,
      parked: answered.filter((key) => !schemaKeys.has(key)).length,
    };
  }, [schema, draft.answers]);

  // --- Validation ---------------------------------------------------------

  const validateCommon = useCallback((): Record<string, string> => {
    const { common } = draft;
    const found: Record<string, string> = {};

    if (common.title.trim().length < 5) found.title = 'Title must be at least 5 characters.';
    if (common.description.trim().length < 20)
      found.description = 'Description must be at least 20 characters.';
    if (common.price === '' || Number.isNaN(Number(common.price)) || Number(common.price) < 0)
      found.price = 'Enter a valid price.';
    if (!common.condition) found.condition = 'Select the item condition.';
    if (common.city.trim().length < 2) found.city = 'City is required.';

    return found;
  }, [draft]);

  const goNext = () => {
    setSubmitError(null);

    if (step === 'category') {
      if (!category) {
        setSubmitError('Choose a category to continue.');
        return;
      }
      setStep('basics');
      return;
    }

    if (step === 'basics') {
      const found = validateCommon();
      setErrors(found);
      if (Object.keys(found).length === 0) setStep('details');
      return;
    }

    if (step === 'details') {
      const found = schema ? validateAttributes(schema.fields, draft.answers) : {};
      setErrors(found);
      if (Object.keys(found).length === 0) setStep('photos');
      return;
    }

    if (step === 'photos') setStep('review');
  };

  const goBack = () => {
    const index = SELL_STEPS.indexOf(step);
    if (index > 0) setStep(SELL_STEPS[index - 1] as SellStep);
  };

  // --- Submit -------------------------------------------------------------

  const submit = async () => {
    if (!category || !schema) return;

    const commonErrors = validateCommon();
    if (Object.keys(commonErrors).length > 0) {
      setErrors(commonErrors);
      setStep('basics');
      return;
    }

    const attributeErrors = validateAttributes(schema.fields, draft.answers);
    if (Object.keys(attributeErrors).length > 0) {
      setErrors(attributeErrors);
      setStep('details');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const listing = await api.listings.create({
        categoryId: category.id,
        title: draft.common.title.trim(),
        description: draft.common.description.trim(),
        price: Number(draft.common.price),
        currency: 'INR',
        condition: draft.common.condition,
        city: draft.common.city.trim(),
        // Hidden fields are stripped client-side so the payload matches what the
        // seller could actually see. The server strips again — it is the authority.
        attributes: stripHidden(schema.fields, draft.answers),
        images: draft.images
          .filter((image) => image.url.trim())
          .map((image) => ({
            url: image.url.trim(),
            alt: image.alt.trim() || null,
            // Present for uploaded files; null for pasted URLs, which we must
            // never try to delete from our own storage.
            storageKey: image.storageKey ?? null,
            width: image.width ?? null,
            height: image.height ?? null,
          })),
        status: 'ACTIVE',
      });

      window.localStorage.removeItem(DRAFT_KEY);
      router.push(`/listings/${listing.slug}`);
    } catch (error) {
      setSubmitting(false);

      if (error instanceof ApiError) {
        // Server errors arrive namespaced (`attributes.brand`); unwrap them so
        // each lands on the right input.
        const mapped: Record<string, string> = {};
        let hasAttributeError = false;

        for (const [key, message] of Object.entries(error.fieldErrors)) {
          if (key.startsWith('attributes.')) {
            mapped[key.slice('attributes.'.length)] = message;
            hasAttributeError = true;
          } else {
            mapped[key] = message;
          }
        }

        setErrors(mapped);
        setSubmitError(error.message);
        if (hasAttributeError) setStep('details');
        return;
      }

      setSubmitError('Something went wrong. Please try again.');
    }
  };

  // --- Render -------------------------------------------------------------

  const completed = useMemo(() => {
    const done = new Set<SellStep>();
    if (category) done.add('category');
    if (Object.keys(validateCommon()).length === 0) done.add('basics');
    if (schema && Object.keys(validateAttributes(schema.fields, draft.answers)).length === 0)
      done.add('details');
    if (step === 'review') done.add('photos');
    return done;
  }, [category, validateCommon, schema, draft.answers, step]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Create a listing</h1>
      <p className="mb-8 text-sm text-muted">
        Pick a category and we will ask only the questions that apply to it.
      </p>

      <Stepper current={step} completed={completed} onNavigate={setStep} />

      {restoredFromStorage && step === 'category' ? (
        <div className="mb-6">
          <Alert tone="info" title="Draft restored">
            We kept what you had already filled in.{' '}
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                window.localStorage.removeItem(DRAFT_KEY);
                setFlow({
                  draft: { ...EMPTY_DRAFT, draftId: createDraftId() },
                  restoredFromStorage: false,
                });
              }}
            >
              Start fresh instead
            </button>
          </Alert>
        </div>
      ) : null}

      {submitError ? (
        <div className="mb-6">
          <Alert tone="danger">{submitError}</Alert>
        </div>
      ) : null}

      {step === 'category' ? (
        <CategoryStep
          categories={categories}
          selectedId={draft.categoryId}
          onSelect={(selected) => {
            setDraft((previous) => ({ ...previous, categoryId: selected.id }));
            setErrors({});
          }}
        />
      ) : null}

      {step === 'basics' ? (
        <BasicsStep
          values={draft.common}
          errors={errors}
          onChange={(patch) =>
            setDraft((previous) => ({ ...previous, common: { ...previous.common, ...patch } }))
          }
        />
      ) : null}

      {step === 'details' ? (
        <div>
          <h2 className="text-lg font-semibold text-foreground">{category?.name} details</h2>
          <p className="mt-1 text-sm text-muted">
            These questions come from the category configuration.
          </p>

          {carriedOver.kept > 0 || carriedOver.parked > 0 ? (
            <div className="mt-4">
              <Alert tone="info">
                {carriedOver.kept > 0 ? (
                  <>
                    {carriedOver.kept} answer{carriedOver.kept === 1 ? '' : 's'} carried over.{' '}
                  </>
                ) : null}
                {carriedOver.parked > 0 ? (
                  <>
                    {carriedOver.parked} answer{carriedOver.parked === 1 ? '' : 's'} do not apply to{' '}
                    {category?.name} and will not be saved — switch back and they return.
                  </>
                ) : null}
              </Alert>
            </div>
          ) : null}

          <div className="mt-6">
            {schemaLoading && !schema ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Spinner /> Loading fields…
              </p>
            ) : schema ? (
              <DynamicForm
                schema={schema}
                values={draft.answers}
                errors={errors}
                onChange={(key, value) =>
                  setDraft((previous) => ({
                    ...previous,
                    answers: { ...previous.answers, [key]: value },
                  }))
                }
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {step === 'photos' ? (
        <PhotosStep
          images={draft.images}
          draftId={draft.draftId}
          onChange={(images) => setDraft((previous) => ({ ...previous, images }))}
        />
      ) : null}

      {step === 'review' ? (
        <ReviewStep
          common={draft.common}
          schema={schema}
          attributes={draft.answers}
          images={draft.images}
        />
      ) : null}

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-line pt-6">
        <Button type="button" variant="secondary" onClick={goBack} disabled={step === 'category'}>
          Back
        </Button>

        {step === 'review' ? (
          <Button type="button" size="lg" onClick={submit} disabled={submitting}>
            {submitting ? <Spinner /> : null}
            {submitting ? 'Publishing…' : 'Publish listing'}
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
