/**
 * Live transport composition and the read-only request guard (GH-189 F-9).
 *
 * Native `fetch` and request recording live under `tests/`, never in testkit
 * source. The guard is a pure function over a widened method string so its
 * negative control can feed a synthetic POST.
 */
import type { ConformanceTransport, ConformanceTransportResponse } from "@delivery-os/testkit";

/** One recorded live request descriptor. */
export type RecordedRequest = {
  readonly method: string;
  readonly url: string;
};

/** A recording transport, exposing every request it observed. */
export type RecordingTransport = ConformanceTransport & {
  readonly records: readonly RecordedRequest[];
};

/** The production live transport: a native-fetch JSON round trip. */
export const createNativeFetchTransport = (): ConformanceTransport => ({
  send: async (request): Promise<ConformanceTransportResponse> => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
    });
    const body: unknown = await response.json();
    return { status: response.status, body };
  },
});

/**
 * Wrap an inner transport and record every request.
 *
 * `initialRecords` is a test-only seam used to feed a synthetic non-GET
 * request; production composition never passes it.
 */
export const createRecordingTransport = (
  inner: ConformanceTransport,
  initialRecords: readonly RecordedRequest[] = [],
): RecordingTransport => {
  const records: RecordedRequest[] = [...initialRecords];
  return {
    records,
    send: async (request) => {
      records.push({ method: request.method, url: request.url });
      return inner.send(request);
    },
  };
};

/**
 * Report every non-GET request, naming the method and URL.
 *
 * A read-only live run must return an empty list.
 */
export const readOnlyViolations = (records: readonly RecordedRequest[]): string[] =>
  records
    .filter((record) => record.method !== "GET")
    .map((record) => `non-GET live request ${record.method} ${record.url}`);
