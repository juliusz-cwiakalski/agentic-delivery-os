/**
 * The injectable provider transport seam shared by the provider client seeds.
 *
 * Runtime-neutral by construction: types only. Clients accept a
 * `ProviderTransport` as a construction input so trap suites replay committed
 * fixtures offline; the production default wraps native `fetch` inside each
 * provider subpath. No module-level transport or credential is cached.
 *
 * Provider seeds import this module with a relative `../io/provider-transport.js`
 * specifier, not the `#io/*` imports alias. The alias is src-mapped
 * (`./src/io/*.ts`), which resolves only in the repository; a packed adapter
 * tarball ships `dist` only, so the alias would dangle after install. The
 * relative `.js` specifier resolves to the built sibling in both the workspace
 * and the tarball, preserving packed-export parity. Do not rewrite these
 * imports to the alias; see the feature spec's intra-package import note.
 */
import type { CredentialResolutionFailure } from "@delivery-os/core/contracts";

/** The closed set of request methods the provider transports can issue. */
export type ProviderHttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/** One provider request, fully shaped before it reaches the transport. */
export type ProviderRequest = {
  readonly url: string;
  readonly method: ProviderHttpMethod;
  readonly headers: Readonly<Record<string, string>>;
  /** An optional serialized request body for write operations. */
  readonly body?: string;
  /** An optional per-request timeout override; production defaults to 30 s. */
  readonly timeoutMs?: number;
};

/** The raw provider response; the body stays untrusted until normalized. */
export type ProviderResponse = {
  readonly status: number;
  readonly body: unknown;
};

/** The injectable provider transport (production wraps native `fetch`). */
export type ProviderTransport = {
  readonly send: (request: ProviderRequest) => Promise<ProviderResponse>;
};

/** A visibly classified payload/transport failure (never a silent flattening). */
export type ProviderPayloadFailure = {
  readonly ok: false;
  readonly code: "provider.payload.invalid";
  readonly detail: string;
};

/** A read failure: the classified credential identity or a payload failure. */
export type ProviderReadFailure = CredentialResolutionFailure | ProviderPayloadFailure;

/** A read result: a normalized primitive view or a classified failure. */
export type ProviderReadResult<T> = { readonly ok: true; readonly value: T } | ProviderReadFailure;

/** A write result: a landed write or a classified failure. */
export type ProviderWriteResult<T = void> =
  | { readonly ok: true; readonly value: T }
  | ProviderReadFailure;

/** Construct the reified payload failure with one readable detail string. */
export const providerPayloadFailure = (detail: string): ProviderPayloadFailure => ({
  ok: false,
  code: "provider.payload.invalid",
  detail,
});
