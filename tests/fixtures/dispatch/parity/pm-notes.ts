/**
 * Real pm-notes documents on disk for the parity battery (GH-347 §6.1).
 *
 * The writer and the document constants live beside the composition harness so
 * the harness can default to a complete document; this module owns the
 * tracker-outage scenarios that pair an artifact with an exhausted ladder.
 */
import {
  createParityHarness,
  readableParityTransport,
  type ParityObservation,
  writePmNotesFixture,
} from "./harness";
import { createGuardedRunner } from "./process-runner";

export {
  COMPLETE_PM_NOTES,
  INCOMPLETE_PM_NOTES,
  MALFORMED_PM_NOTES,
  type PmNotesFixtureKind,
  writePmNotesFixture,
} from "./harness";

const OPEN_PULL = {
  number: 501,
  state: "open",
  head: { ref: "feat/GH-347/parity", sha: "0123456789abcdef" },
  base: { ref: "main-tools" },
  mergeable: true,
  mergeable_state: "clean",
  changed_files: 2,
};

const MERGED_PULL = {
  number: 502,
  state: "closed",
  merged_at: "2026-11-19T00:00:00.000Z",
  head: { ref: "feat/GH-347/parity", sha: "0123456789abcdef" },
  base: { ref: "main-tools" },
  changed_files: 2,
};

/** A dispatch whose tracker read exhausts the ladder, with a decisive artifact. */
export const trackerOutage = async (input: {
  readonly label: string;
  readonly artifact: TrackerArtifact;
  readonly trackerFailures?: number;
}): Promise<ParityObservation> => {
  const guarded = createGuardedRunner({
    ahead: input.artifact === "none" ? 0 : 2,
  });
  const h = createParityHarness({
    label: input.label,
    guarded,
    transport: readableParityTransport({
      trackerFailures: input.trackerFailures ?? 5,
      ...(input.artifact === "open-pr" ? { openPulls: [OPEN_PULL] } : {}),
      ...(input.artifact === "already-merged" ? { mergedPulls: [MERGED_PULL] } : {}),
    }),
  });
  try {
    // The harness already wrote a COMPLETE document; the incomplete row replaces it.
    if (input.artifact === "commits-incomplete") {
      writePmNotesFixture(h.checkout, "incomplete");
    }
    await h.run();
    return h.observe();
  } finally {
    h.dispose();
  }
};

/** A transient tracker outage followed by success (5 attempts, 2/4/8/16 s waits). */
export const trackerTransient = async (
  options: { readonly failures?: number; readonly ahead?: number } = {},
): Promise<ParityObservation> => {
  const guarded = createGuardedRunner({ ahead: options.ahead ?? 2 });
  const h = createParityHarness({
    label: "tracker-transient",
    guarded,
    transport: readableParityTransport({ trackerFailures: options.failures ?? 3 }),
  });
  try {
    await h.run();
    return h.observe();
  } finally {
    h.dispose();
  }
};

export const trackerOutageWithArtifact = (): Promise<ParityObservation> =>
  trackerOutage({ label: "tracker-outage-with-artifact", artifact: "commits-complete" });

export const trackerOutageWithoutArtifact = (): Promise<ParityObservation> =>
  trackerOutage({ label: "tracker-outage-without-artifact", artifact: "none" });
