import type {
  Category,
  CategoryAttachmentRow,
  CategoryFieldAttachment,
  Field,
  FieldImpact,
  FieldTypeInfo,
  FormSchema,
  Listing,
  Paginated,
  SignedUpload,
  UploadCapabilities,
} from './types';

/**
 * Typed API client.
 *
 * Single place that knows the backend's URL and error envelope. Server
 * Components call it directly during render; Client Components call it from
 * event handlers.
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  issues?: string[];
}

/**
 * Carries the server's structured error through to the UI so a form can map
 * `fieldErrors` onto its inputs instead of showing a generic failure.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.message);
    this.name = 'ApiError';
  }

  get fieldErrors(): Record<string, string> {
    return this.body.fieldErrors ?? {};
  }

  get issues(): string[] {
    return this.body.issues ?? [];
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Server Components opt into caching per call; mutations never cache. */
  revalidate?: number | false;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, revalidate, headers, ...rest } = options;

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    ...(revalidate === undefined
      ? { cache: 'no-store' as const }
      : { next: { revalidate: revalidate === false ? 0 : revalidate } }),
  });

  if (response.status === 204) return undefined as T;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error ?? { code: 'UNKNOWN', message: `Request failed (${response.status}).` },
    );
  }

  return payload as T;
}

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const serialised = search.toString();
  return serialised ? `?${serialised}` : '';
}

// ---------------------------------------------------------------------------
// Public
// ---------------------------------------------------------------------------

export const api = {
  categories: {
    list: () => request<{ items: Category[] }>('/categories').then((r) => r.items),

    /** The contract that drives the entire sell flow. */
    formSchema: (slug: string) => request<FormSchema>(`/categories/${slug}/form-schema`),
  },

  fieldTypes: () => request<{ items: FieldTypeInfo[] }>('/field-types').then((r) => r.items),

  uploads: {
    /** Whether storage is configured; drives upload UI vs URL fallback. */
    capabilities: () => request<UploadCapabilities>('/uploads/capabilities'),
    signature: (draftId: string) =>
      request<SignedUpload>('/uploads/signature', { method: 'POST', body: { draftId } }),
  },

  listings: {
    list: (params: {
      category?: string;
      q?: string;
      condition?: string;
      limit?: number;
      offset?: number;
    } = {}) => request<Paginated<Listing>>(`/listings${query(params)}`),

    get: (slug: string) => request<Listing>(`/listings/${slug}`),

    create: (input: unknown) => request<Listing>('/listings', { method: 'POST', body: input }),
  },

  // -------------------------------------------------------------------------
  // Admin
  // -------------------------------------------------------------------------

  admin: {
    categories: {
      list: () => request<{ items: Category[] }>('/admin/categories?includeInactive=true').then((r) => r.items),
      create: (input: unknown) => request<Category>('/admin/categories', { method: 'POST', body: input }),
      update: (id: string, input: unknown) =>
        request<Category>(`/admin/categories/${id}`, { method: 'PATCH', body: input }),
      setActive: (id: string, isActive: boolean) =>
        request<Category>(`/admin/categories/${id}/active`, { method: 'PATCH', body: { isActive } }),

      /** Own attachments (not inherited), carrying the row ids needed to edit. */
      attachments: (categoryId: string) =>
        request<{ items: CategoryAttachmentRow[] }>(`/admin/categories/${categoryId}/fields`).then(
          (r) => r.items,
        ),

      attachField: (categoryId: string, input: unknown) =>
        request<CategoryFieldAttachment>(`/admin/categories/${categoryId}/fields`, {
          method: 'POST',
          body: input,
        }),
      reorderFields: (categoryId: string, orderedIds: string[]) =>
        request<void>(`/admin/categories/${categoryId}/fields/order`, {
          method: 'PATCH',
          body: { orderedIds },
        }),
    },

    attachments: {
      update: (attachmentId: string, input: unknown) =>
        request<CategoryFieldAttachment>(`/admin/field-attachments/${attachmentId}`, {
          method: 'PATCH',
          body: input,
        }),
      detach: (attachmentId: string) =>
        request<void>(`/admin/field-attachments/${attachmentId}`, { method: 'DELETE' }),
    },

    fields: {
      list: (search?: string) =>
        request<{ items: Field[] }>(
          `/admin/fields${query({ includeInactive: 'true', q: search })}`,
        ).then((r) => r.items),
      get: (id: string) => request<Field>(`/admin/fields/${id}`),
      impact: (id: string) => request<FieldImpact>(`/admin/fields/${id}/impact`),
      create: (input: unknown) => request<Field>('/admin/fields', { method: 'POST', body: input }),
      update: (id: string, input: unknown) =>
        request<Field>(`/admin/fields/${id}`, { method: 'PATCH', body: input }),
      setActive: (id: string, isActive: boolean) =>
        request<Field>(`/admin/fields/${id}/active`, { method: 'PATCH', body: { isActive } }),
    },
  },
};
