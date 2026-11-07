/**
 * Type-contract cases for TC-ECON-001, TC-ECON-005, TC-ECON-012 and
 * TC-ECON-062's optional-field modelling.
 *
 * This file is compiled by `pnpm typecheck` (`tests/types/tsconfig.json`), not
 * run by Bun; the `@ts-expect-error` comments are the assertions.
 */
import type {
  EconomicsOutcome,
  EconomicsRestartReason,
  EconomicsRestartRecord,
  EconomicsSourcedSignalKind,
  EconomicsView,
  HarnessLivenessReport,
  WatchdogSignals,
} from "../../packages/core/src/contracts/index";
import {
  ECONOMICS_RESTART_SCHEMA_ID,
  ECONOMICS_SOURCED_SIGNAL_KINDS,
  RESUME_AMPLIFICATION_LOOP_FLAG,
} from "../../packages/core/src/contracts/index";

const sourcedKind: EconomicsSourcedSignalKind = "heartbeat-age";
const restartReason: EconomicsRestartReason = "watchdog.liveness-stalled";
const outcome: EconomicsOutcome = "restart-past-budget";

// @ts-expect-error — a literal outside the closed sourced-signal set is rejected.
const unknownSourced: EconomicsSourcedSignalKind = "cpu";

// @ts-expect-error — a literal outside the closed restart-reason set is rejected.
const unknownReason: EconomicsRestartReason = "operator-said-so";

const widened: string = "heartbeat-age";
// @ts-expect-error — a widened string is not assignable to the closed union.
const widenedSourced: EconomicsSourcedSignalKind = widened;

// @ts-expect-error — `cpu` is not a delivered liveness kind and never a sourced kind.
const cpuLiveness: EconomicsSourcedSignalKind = "cpu";

// @ts-expect-error — CPU-shaped keys are not assignable into the signal shape.
const cpuSignals: WatchdogSignals = { cpu: 0.9 };

const recordWithoutRepay: EconomicsRestartRecord = {
  schemaId: ECONOMICS_RESTART_SCHEMA_ID,
  workItemRef: "GH-235",
  runId: "run-1",
  sessionId: "ses_fixture_1",
  ordinal: 1,
  reason: restartReason,
  recordedAt: "2026-11-07T00:00:00Z",
};

// @ts-expect-error — exact optional modelling: an unobserved figure is absent, not undefined.
const recordWithExplicitUndefined: EconomicsRestartRecord = {
  schemaId: ECONOMICS_RESTART_SCHEMA_ID,
  workItemRef: "GH-235",
  runId: "run-1",
  sessionId: "ses_fixture_1",
  ordinal: 1,
  reason: restartReason,
  repayTokens: undefined,
  recordedAt: "2026-11-07T00:00:00Z",
};

const reportWithoutSourced: HarnessLivenessReport = { readings: [] };

// @ts-expect-error — exact optional modelling: the sourced member is absent, not explicit undefined.
const reportWithExplicitUndefined: HarnessLivenessReport = {
  readings: [],
  sourcedSignals: undefined,
};

const view: EconomicsView = {
  restarts: 0,
  resumeAmplification: null,
  restartHistory: [],
  amplificationFlag: null,
  warnings: [],
};

const flaggedView: EconomicsView = { ...view, amplificationFlag: RESUME_AMPLIFICATION_LOOP_FLAG };

// @ts-expect-error — the view field names are literal-checked.
const wrongView: EconomicsView = { ...view, amplification: 1 };

const sourcedKinds: readonly string[] = ECONOMICS_SOURCED_SIGNAL_KINDS;

export {
  cpuLiveness,
  cpuSignals,
  flaggedView,
  outcome,
  recordWithExplicitUndefined,
  recordWithoutRepay,
  reportWithExplicitUndefined,
  reportWithoutSourced,
  sourcedKind,
  sourcedKinds,
  unknownReason,
  unknownSourced,
  view,
  widenedSourced,
  wrongView,
};
