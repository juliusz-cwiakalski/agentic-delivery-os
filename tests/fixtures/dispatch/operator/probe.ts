/**
 * The advisory owner-liveness probe doubles (GH-354 §6.1, API-10, DM-4).
 *
 * The OS read is never performed by a case: the fixture models the process
 * table, so the tri-state mapping, the declared 5 000 ms start-instant
 * tolerance, the reused-pid rejection, and the unreadable-table `unknown` are
 * all observable deterministically.
 */
import type {
  DispatchOwnerProbe,
  DispatchProbeVerdict,
} from "../../../../packages/core/src/contracts/index";
import { DISPATCH_PROBE_TOLERANCE_MS } from "../../../../packages/core/src/contracts/index";

/** One observed process-table row. */
export type ProcessRow = { readonly processId: number; readonly startedAt: string };

export type OwnerProbeCall = { readonly processId: number; readonly startedAt: string };

export type OwnerProbeFixture = {
  readonly probe: DispatchOwnerProbe;
  /** Every `(processId, startedAt)` the probe was asked about, in call order. */
  readonly calls: readonly OwnerProbeCall[];
  readonly reset: () => void;
};

/** A fixed-verdict probe (live/dead/unknown) that records every call. */
export const createFixedProbe = (verdict: DispatchProbeVerdict): OwnerProbeFixture => {
  const calls: OwnerProbeCall[] = [];
  return {
    probe: (owner) => {
      calls.push({ processId: owner.processId, startedAt: owner.startedAt });
      return verdict;
    },
    calls,
    reset: () => {
      calls.length = 0;
    },
  };
};

/**
 * A process-table model.
 *
 * `table: "unreadable"` reports `unknown`; a pid absent from the table is
 * confirmed gone (`dead`); a pid present with a start instant within the
 * declared tolerance is `live` and outside it is `dead` — the reused-pid rule.
 */
export const createTableProbe = (input: {
  readonly table: readonly ProcessRow[] | "unreadable";
  readonly toleranceMs?: number;
}): OwnerProbeFixture => {
  const calls: OwnerProbeCall[] = [];
  const tolerance = input.toleranceMs ?? DISPATCH_PROBE_TOLERANCE_MS;
  return {
    probe: (owner) => {
      calls.push({ processId: owner.processId, startedAt: owner.startedAt });
      if (input.table === "unreadable") return "unknown";
      const row = input.table.find((entry) => entry.processId === owner.processId);
      if (row === undefined) return "dead";
      const observed = Date.parse(row.startedAt);
      const recorded = Date.parse(owner.startedAt);
      if (!Number.isFinite(observed) || !Number.isFinite(recorded)) return "unknown";
      return Math.abs(observed - recorded) <= tolerance ? "live" : "dead";
    },
    calls,
    reset: () => {
      calls.length = 0;
    },
  };
};

/** A reused-pid model: the pid is alive but belongs to an unrelated process. */
export const createReusedPidProbe = (input: {
  readonly processId: number;
  readonly observedStartedAt: string;
}): OwnerProbeFixture =>
  createTableProbe({
    table: [{ processId: input.processId, startedAt: input.observedStartedAt }],
  });
