/**
 * `@delivery-os/core/contracts` — the shared language.
 * Runtime-neutral and I/O-free; types only at scaffold.
 */

/** Discriminated result envelope shared by every package. */
export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | {
      readonly ok: false;
      readonly error: E;
    };
