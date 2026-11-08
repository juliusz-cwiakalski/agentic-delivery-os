/**
 * The pilot stub/real matrix (spec Appendix D, TC-PILOT-003).
 *
 * One row per surface the J1 exercise touches. `real` rows must be backed by
 * the real state ledger, real git objects, real change-folder files, real
 * envelopes/text, or the real help/version surface. `stubbed` rows are served
 * by the in-process recorders in `stubs.ts` and never reach the network.
 * `injected` rows are the fixed clock and the deterministic id/fence sequence.
 */

export type PilotSurfaceKind = "real" | "stubbed" | "injected";

export type PilotMatrixEntry = {
  readonly id: string;
  readonly surface: string;
  readonly kind: PilotSurfaceKind;
  /** How the isolation suite proves the row. */
  readonly evidence: string;
};

export const PILOT_MATRIX: readonly PilotMatrixEntry[] = [
  {
    id: "state-ledger",
    surface: "State ledger (JSONL, fences, verified reads)",
    kind: "real",
    evidence:
      "phase.transition, commit.telemetry, merge, closeout, blocker, and queue records are appended and re-read",
  },
  {
    id: "git",
    surface: "Git working tree, commit objects, local bare remote",
    kind: "real",
    evidence:
      "baseline, delivery, and squash commits exist; the delivery branch is deleted; the bare mirror holds the base branch",
  },
  {
    id: "change-files",
    surface: "Change-folder files (spec, plan, pm-notes)",
    kind: "real",
    evidence: "the seeded change folder is committed by the delivery completion",
  },
  {
    id: "envelopes",
    surface: "CLI envelopes, text renderers, exit codes",
    kind: "real",
    evidence: "every step is driven through runCli and parsed from the real result envelope",
  },
  {
    id: "help-version",
    surface: "--help / --version",
    kind: "real",
    evidence: "the real entrypoint self-description renders without composing a command runtime",
  },
  {
    id: "tracker",
    surface: "Tracker reads/writes",
    kind: "stubbed",
    evidence:
      "the injected work-item read is served in process and every access is recorded with outbound=false",
  },
  {
    id: "ci",
    surface: "CI check-runs",
    kind: "stubbed",
    evidence:
      "the injected check-run page is served in process and recorded; no fetch/spawn is reached",
  },
  {
    id: "pr-platform",
    surface: "PR-platform merge transport",
    kind: "stubbed",
    evidence:
      "the request detail and merged-request reads are injected; landing is a local git squash",
  },
  {
    id: "provider-network",
    surface: "Provider and network",
    kind: "stubbed",
    evidence:
      "provider reads return in-memory observations and the throwing fetch guard records zero network attempts",
  },
  {
    id: "clock-ids",
    surface: "Clock and id generation",
    kind: "injected",
    evidence:
      "fixed ISO/epoch clock and a deterministic run-id/fence sequence are injected into every runtime",
  },
] as const;

export const pilotMatrixEntry = (id: string): PilotMatrixEntry => {
  const entry = PILOT_MATRIX.find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`unknown pilot matrix surface ${id}`);
  return entry;
};
