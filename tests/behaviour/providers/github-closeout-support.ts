/** A tiny assertion helper proving method+URL matching (never URL-only). */
export const methodAwareMismatch = (requested: string, fixture: string): boolean =>
  requested !== fixture;
