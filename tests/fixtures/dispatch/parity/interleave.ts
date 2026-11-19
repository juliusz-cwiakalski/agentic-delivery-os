/**
 * The deterministic two-invocation interleaving (GH-347 test plan §6.2).
 *
 * The latch IS the injected `delay(ms, reason)` fact: the first arrival at a
 * `claim-fence` wait parks until the latch is released, and the release is
 * wired to the winning invocation's live-lease append. Determinism comes from
 * that explicit hand-off, never from scheduler luck or a sleep.
 *
 * A pre-read admission implementation cannot survive this fixture: the parked
 * invocation decided "proceed" before the winner's lease existed, and only an
 * in-fence re-decision refuses it afterwards.
 */
import type { DispatchDelay } from "../../../../packages/core/src/contracts/index";
import {
  createParityHarness,
  type ParityHarness,
  type ParityObservation,
  type ParityWait,
} from "./harness";

export type FenceLatch = {
  readonly delay: DispatchDelay;
  /** Resolves when the first `claim-fence` wait has parked. */
  readonly parked: () => Promise<void>;
  /** Releases the parked wait. */
  readonly release: () => void;
  /** Releases the parked wait when a queue lease lands (the winner's claim). */
  readonly noteAppend: (record: { readonly kind: string }) => void;
  readonly waits: readonly ParityWait[];
  readonly isParked: () => boolean;
};

export const createFenceLatch = (): FenceLatch => {
  const waits: ParityWait[] = [];
  let parked = false;
  let releaseParked: (() => void) | undefined;
  let markParked: (() => void) | undefined;
  const parkedPromise = new Promise<void>((resolve) => {
    markParked = resolve;
  });
  const releasePromise = new Promise<void>((resolve) => {
    releaseParked = resolve;
  });
  let releaseCalled = false;
  const release = (): void => {
    if (releaseCalled) return;
    releaseCalled = true;
    releaseParked?.();
  };
  const delay: DispatchDelay = async (ms, reason) => {
    waits.push({ reason, ms });
    if (reason === "claim-fence" && !parked) {
      parked = true;
      markParked?.();
      await releasePromise;
    }
  };
  return {
    delay,
    parked: () => parkedPromise,
    release,
    noteAppend: (record) => {
      if (record.kind === "queue.lease") release();
    },
    get waits() {
      return waits;
    },
    isParked: () => parked,
  };
};

/** One admission run: the parked invocation and the winner, in start order. */
export type InterleavedAdmission = {
  readonly harness: ParityHarness;
  readonly firstResult: Awaited<ReturnType<ParityHarness["run"]>>;
  readonly secondResult: Awaited<ReturnType<ParityHarness["run"]>>;
  readonly observation: ParityObservation;
};

/**
 * Two concurrent same-ref dispatches, both orderings.
 *
 * `parked` decides which invocation (by start order) parks at its fence wait:
 * `"first"` parks the invocation started first; `"second"` starts the future
 * winner first and parks the later arrival. Either way exactly one claims and
 * exactly one is refused, and the loser decides after the winner's lease is
 * durable.
 */
export const admissionSameRefRace = async (
  options: { readonly parked?: "first" | "second"; readonly label?: string } = {},
): Promise<ParityObservation> => {
  const latch = createFenceLatch();
  const h = createParityHarness({
    label: options.label ?? "admit-same-ref",
    delay: latch.delay,
    onAppend: latch.noteAppend,
  });
  try {
    const held = h.holdFence();
    if ((options.parked ?? "first") === "first") {
      // The invocation started first parks before its verdict; the later one
      // claims once the fence frees, and the parked one re-decides from the
      // winner's live lease.
      const parkedRun = h.run();
      await latch.parked();
      h.releaseFence(held);
      await h.run();
      await parkedRun;
    } else {
      // The invocation started second is the parked one: it waits while the
      // first claims, then re-decides from the winner's live lease.
      const parkedRun = h.run();
      await latch.parked();
      const winnerRun = h.run();
      h.releaseFence(held);
      await winnerRun;
      await parkedRun;
    }
    latch.release();
    return h.observe();
  } finally {
    latch.release();
    h.dispose();
  }
};

/** A live other-ref lease refuses the dispatched ref pre-session. */
export const admissionOtherRefLease = async (): Promise<ParityObservation> => {
  const h = createParityHarness({ label: "admit-other-ref", extraRefs: ["GH-400"] });
  try {
    h.seedLease({ ref: "GH-400", holder: "lane-1" });
    await h.run(["dispatch", "GH-347", "--json"]);
    return h.observe();
  } finally {
    h.dispose();
  }
};
