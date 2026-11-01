/**
 * Shared provider-seed test support: fixture JSON loading, an offline
 * fetch-shaped transport, and a throwing-`fetch` guard.
 *
 * Nothing here reaches the network; an unfixtured request throws instead of
 * falling back to a live call (GH-188 NFR-3 / TC-TRAP-002).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ProviderReadResult,
  ProviderRequest,
  ProviderTransport,
} from "../../../packages/adapters/src/io/provider-transport";

/** One exact method-and-URL fixture route; `method` defaults to `GET`. */
export type FixtureRoute = {
  readonly method?: ProviderRequest["method"];
  readonly url: string;
  readonly body: unknown;
  readonly status?: number;
};

/** A transport that records every request and throws on anything unfixtured. */
export type RecordingTransport = ProviderTransport & {
  readonly requests: readonly ProviderRequest[];
};

/** Read a committed JSON fixture from the repository root. */
export const readJson = (relativePath: string): unknown => {
  const parsed: unknown = JSON.parse(readFileSync(join(process.cwd(), relativePath), "utf8"));
  return parsed;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Require an object value, failing loudly with a label. */
export const requireRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`${label}: expected an object`);
  return value;
};

/** Read a required nested object field, failing loudly when the shape is wrong. */
export const recordField = (value: unknown, key: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`expected an object before field "${key}"`);
  const field = value[key];
  if (!isRecord(field)) throw new Error(`expected object field "${key}"`);
  return field;
};

/** Read a required array field, failing loudly when the shape is wrong. */
export const arrayField = (value: unknown, key: string): unknown[] => {
  if (!isRecord(value)) throw new Error(`expected an object before field "${key}"`);
  const field = value[key];
  if (!Array.isArray(field)) throw new Error(`expected array field "${key}"`);
  return field;
};

/** Read an optional string field. */
export const stringField = (value: unknown, key: string): string | undefined => {
  if (!isRecord(value)) return undefined;
  const field = value[key];
  return typeof field === "string" ? field : undefined;
};

/** Build the offline transport. */
export const createFixtureTransport = (routes: readonly FixtureRoute[]): RecordingTransport => {
  const requests: ProviderRequest[] = [];
  return {
    requests,
    send: async (request) => {
      requests.push(request);
      const route = routes.find(
        (candidate) =>
          candidate.url === request.url && (candidate.method ?? "GET") === request.method,
      );
      if (route === undefined) {
        throw new Error(`unfixtured provider request ${request.method} ${request.url}`);
      }
      return { status: route.status ?? 200, body: route.body };
    },
  };
};

/** Unwrap a successful read or throw with the classified detail. */
export const requireValue = <T>(result: ProviderReadResult<T>, label: string): T => {
  if (result.ok) return result.value;
  const detail = "detail" in result ? result.detail : result.code;
  throw new Error(`${label}: ${detail}`);
};

export type FetchGuard = {
  readonly calls: readonly unknown[];
  readonly restore: () => void;
};

/**
 * Replace the ambient `fetch` with a throwing counter for the duration of a
 * read. Any call fails the suite, proving the fixture transport was the only
 * provider input path.
 */
export const installThrowingFetchGuard = (): FetchGuard => {
  const original = globalThis.fetch;
  const calls: unknown[] = [];
  const guarded: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    throw new Error("trap suite must not perform live network calls");
  };
  globalThis.fetch = guarded;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
};
