/**
 * The `dispatch attempts` read use case (GH-289 F-1, F-3, F-4; DEC-1, DEC-3,
 * DEC-8; TDR-0023 C-6).
 *
 * Reads one repository's recorded attempts over injected ports. The reference
 * and the checkout identity resolve before the store is touched, so a refusal
 * performs no store read; a successful read performs exactly one verified
 * ledger read; and an unreadable store keeps its own `state.*` identity rather
 * than being reported as an empty history.
 */
import { ATTEMPTS_DEFAULT_LIMIT, type DispatchAttemptsData, type StateStorePort } from "#contracts";
import { selectAttemptsPage } from "../domain/dispatch-attempts.js";
import { readDispatchAttempts } from "./dispatch-ledger.js";

/** The injected read ports; every one is resolved before the store is read. */
export type DispatchAttemptsReadPorts = {
  readonly store: StateStorePort;
  /** Resolve the invoking checkout's repository identity, persistence disabled. */
  readonly resolveRepository: () => string | undefined;
  /** Resolve the active change reference from the local PM context. */
  readonly resolveActiveRef: () => string | null;
  /** The local context path the refusal names. */
  readonly contextPath: string;
};

/** The read request; both members are already grammar-checked by the caller. */
export type DispatchAttemptsReadInput = {
  readonly ref?: string;
  readonly limit?: number;
};

/** A classified read failure: a request/identity refusal or a state fault. */
export type DispatchAttemptsReadResult =
  | { readonly ok: true; readonly data: DispatchAttemptsData }
  | {
      readonly ok: false;
      readonly error: {
        readonly kind: "input" | "state";
        readonly code: string;
        readonly summary?: string;
      };
    };

const refusal = (summary: string): DispatchAttemptsReadResult => ({
  ok: false,
  error: { kind: "input", code: "input.value.rejected", summary },
});

/** Read one reference's attempt history for the invoking repository. */
export const readDispatchAttemptHistory = (
  ports: DispatchAttemptsReadPorts,
  input: DispatchAttemptsReadInput,
): DispatchAttemptsReadResult => {
  const explicitRef = input.ref;
  const activeRef = explicitRef === undefined ? ports.resolveActiveRef() : null;
  const ref = explicitRef ?? activeRef ?? undefined;
  if (ref === undefined) {
    return refusal(
      `no active change in ${ports.contextPath}; pass --ref <ref> to name the reference`,
    );
  }
  const repository = ports.resolveRepository();
  if (repository === undefined) {
    return refusal(
      "repository identity is unresolvable for this checkout; run inside a checkout with a readable origin or a bound dispatch identity",
    );
  }
  const read = readDispatchAttempts(ports.store);
  if (!read.ok) {
    return {
      ok: false,
      error: {
        kind: "state",
        code: read.code,
        summary: `attempt ledger unreadable at ${read.path}`,
      },
    };
  }
  return {
    ok: true,
    data: selectAttemptsPage({
      records: read.records,
      repository,
      ref,
      refSource: explicitRef === undefined ? "active-change" : "flag",
      limit: input.limit ?? ATTEMPTS_DEFAULT_LIMIT,
      ...(read.truncation === undefined ? {} : { ledgerTruncation: read.truncation }),
    }),
  };
};
