/**
 * Slug helpers.
 *
 * Listings are addressed by slug so URLs read as
 * `/listings/iphone-13-pro-256gb-4f2a` rather than exposing a UUID.
 */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    // Unicode property escape rather than a literal combining-mark range,
    // which is invisible in source and easy to corrupt on edit.
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

/**
 * Produces a slug that does not yet exist.
 *
 * Appends a short random suffix rather than an incrementing counter: a counter
 * needs a read-then-write that two concurrent submissions can both win, while a
 * random suffix collides only by chance and is retried here.
 */
export async function uniqueSlug(
  base: string,
  exists: (candidate: string) => Promise<boolean>,
  attempts = 5,
): Promise<string> {
  const root = slugify(base) || 'listing';

  if (!(await exists(root))) return root;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidate = `${root}-${randomSuffix()}`;
    if (!(await exists(candidate))) return candidate;
  }

  // Astronomically unlikely; guarantees termination rather than looping forever.
  return `${root}-${Date.now().toString(36)}`;
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}
