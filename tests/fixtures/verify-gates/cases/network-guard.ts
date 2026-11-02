/**
 * The named no-live network guard for the default verify-gates suite.
 *
 * Install replaces the ambient fetch with a throwing counter; restore puts the
 * original back. The check suite proves the guard rejects a forbidden call and
 * also scans the production edge and default harness sources for live-call
 * constructs, so the default suite cannot grow a hidden socket path.
 */
export type NoNetworkGuard = {
  readonly calls: readonly unknown[];
  restore(): void;
};

export const createNoNetworkGuard = (): NoNetworkGuard => {
  const original = globalThis.fetch;
  const calls: unknown[] = [];
  const guarded: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    throw new Error("verify-gates default suite must not perform a live network call");
  };
  globalThis.fetch = guarded;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};

const LIVE_CALL_PATTERNS: ReadonlyArray<{ readonly label: string; readonly pattern: RegExp }> = [
  { label: "fetch", pattern: /\bfetch\s*\(/ },
  { label: "node:http", pattern: /["']node:http(s?)["']/ },
  { label: "Bun.connect", pattern: /\bBun\s*\.\s*connect\b/ },
];

/** Report every live-call construct in one source text (empty means clean). */
export const scanForLiveCalls = (source: string): string[] =>
  LIVE_CALL_PATTERNS.filter((entry) => entry.pattern.test(source)).map((entry) => entry.label);
