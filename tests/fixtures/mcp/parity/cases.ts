/**
 * The shared CLI/MCP parity case definitions (test plan §4.2).
 *
 * Every case builds one fact bundle, hands it to both surfaces, and declares
 * only the expected kind (and the spec-pinned code where one is named). No case
 * declares a hand-written expected data object: the in-process CLI is the
 * oracle. Each `run*` call constructs fresh runtimes so replay determinism is
 * tested, not assumed.
 */
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import type { McpToolResult } from "../../../../packages/mcp/src/index";
import { createToolset } from "../../../../packages/mcp/src/index";
import {
  appendLandingForRef,
  corruptHeaderVersion,
  createVerifyHarness,
  createVerifyState,
  fullBase,
  materializeAbsentTarget,
  materializeTarget,
  readFixture,
  VERIFY_REF,
  ROOT as VERIFY_ROOT,
  type VerifyHarnessOptions,
  type VerifyState,
  withOpenPhase,
  withoutPhaseKey,
} from "../../../behaviour/verify-support";
import {
  baseFacts,
  capSizedFacts,
  createStatusRecorder,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  makeDeliveryRequest,
  makePipelineRun,
  makeWorkItem,
  missingLocalContext,
  pipelineRunRead,
  repository,
  runStatusCli,
  type StatusCallRecorder,
  statusRuntime,
  unavailableBinding,
  workItemRead,
} from "../../../fixtures/status/harness";
import {
  clone,
  EXPECTED_JOBS,
  baseFacts as gatesBaseFacts,
  run,
  withReadError,
} from "../../../fixtures/verify-gates/cases/facts";
import {
  combinedRuntime,
  gatesRuntime,
  runVerify,
} from "../../../fixtures/verify-gates/cases/harness";
import { SYNTHETIC_BRAND } from "../../../golden/helpers";
import { type CaseOutcome, fromEnvelope, fromToolResult } from "./harness";

/** One declared case expectation: success, or a spec-named failure code. */
export type CaseExpectation =
  | { readonly kind: "success"; readonly schemaVersion?: string }
  | { readonly kind: "failure"; readonly code: string };

/** One parity case over one tool. */
export type ToolParityCase = {
  readonly id: string;
  readonly tool: "status" | "verify-artifact" | "gate-report";
  readonly expectation: CaseExpectation;
  readonly runCli: () => Promise<CaseOutcome>;
  readonly runMcp: () => Promise<CaseOutcome>;
  readonly readsCli: () => Promise<readonly string[]>;
  readonly readsMcp: () => Promise<readonly string[]>;
};

const parseEnvelope = (stdout: string): Record<string, unknown> =>
  JSON.parse(stdout.trim()) as Record<string, unknown>;

/* --------------------------------- status --------------------------------- */

const statusCaseFrom = (
  id: string,
  factory: (recorder: StatusCallRecorder) => ReturnType<typeof statusRuntime>,
  expectation: CaseExpectation,
): ToolParityCase => {
  const run = async (
    surface: "cli" | "mcp",
  ): Promise<{ readonly outcome: CaseOutcome; readonly reads: readonly string[] }> => {
    const recorder = createStatusRecorder();
    const runtime = factory(recorder);
    if (surface === "cli") {
      const result = await runStatusCli(["--json", "status"], runtime, { recorder });
      return { outcome: fromEnvelope(parseEnvelope(result.stdout)), reads: [...recorder.calls] };
    }
    const result: McpToolResult = await createToolset({
      brand: SYNTHETIC_BRAND,
      status: runtime,
    }).callTool("status", {});
    return { outcome: fromToolResult(result), reads: [...recorder.calls] };
  };
  return {
    id,
    tool: "status",
    expectation,
    runCli: async () => (await run("cli")).outcome,
    runMcp: async () => (await run("mcp")).outcome,
    readsCli: async () => (await run("cli")).reads,
    readsMcp: async () => (await run("mcp")).reads,
  };
};

const statusCase = (
  id: string,
  facts: Parameters<typeof statusRuntime>[0],
  expectation: CaseExpectation,
): ToolParityCase => statusCaseFrom(id, (recorder) => statusRuntime(facts, recorder), expectation);

const observedFacts = () =>
  baseFacts({
    tracker: workItemRead([
      makeWorkItem({
        entityId: "GH-231",
        title: "Observed item",
        updatedAt: "2026-10-30T00:00:00Z",
      }),
      makeWorkItem({
        entityId: "GH-232",
        title: "Owner hand back",
        labels: ["hand-back"],
        updatedAt: "2026-10-30T00:00:00Z",
      }),
    ]),
    changes: deliveryRequestRead([
      makeDeliveryRequest({ entityId: "231" }),
      makeDeliveryRequest({ entityId: "232", reviewState: "draft" }),
    ]),
    ci: pipelineRunRead([makePipelineRun({ entityId: "9001", pipelineName: "ci-main" })]),
  });

const degradedFacts = () =>
  baseFacts({
    tracker: failedWorkItemRead("read-failed"),
    changes: failedDeliveryRequestRead("read-failed"),
    ci: failedPipelineRunRead("read-failed"),
  });

const unavailableFacts = () =>
  baseFacts({
    repository: repository({ binding: unavailableBinding() }),
    tracker: { ok: false, reason: "not-configured" },
    changes: { ok: false, reason: "not-configured" },
    ci: { ok: false, reason: "not-configured" },
  });

const notDeliveredFacts = () =>
  baseFacts({
    localContext: missingLocalContext(),
    tracker: workItemRead([]),
    changes: deliveryRequestRead([]),
    ci: pipelineRunRead([]),
  });

const containmentFacts = () =>
  statusCaseFrom(
    "status-containment",
    (recorder) => ({
      readRepository: () => {
        recorder.calls.push("readRepository");
        throw new Error("synthetic containment failure");
      },
      readWorkItems: async () => {
        recorder.calls.push("readWorkItems");
        throw new Error("unreachable");
      },
      readDeliveryRequests: async () => {
        recorder.calls.push("readDeliveryRequests");
        throw new Error("unreachable");
      },
      readPipelineRuns: async () => {
        recorder.calls.push("readPipelineRuns");
        throw new Error("unreachable");
      },
      readProviderConfig: () => {
        recorder.calls.push("readProviderConfig");
        throw new Error("unreachable");
      },
      readProviderParks: () => {
        recorder.calls.push("readProviderParks");
        throw new Error("unreachable");
      },
      readLocalContext: () => {
        recorder.calls.push("readLocalContext");
        throw new Error("unreachable");
      },
      nowIso: () => {
        recorder.calls.push("nowIso");
        throw new Error("unreachable");
      },
      nowMs: () => {
        recorder.calls.push("nowMs");
        throw new Error("unreachable");
      },
    }),
    { kind: "failure", code: "fallback.internal" },
  );

export const STATUS_CASES: readonly ToolParityCase[] = [
  statusCase("status-observed", observedFacts(), {
    kind: "success",
    schemaVersion: "delivery.status.v1",
  }),
  statusCase("status-degraded", degradedFacts(), {
    kind: "success",
    schemaVersion: "delivery.status.v1",
  }),
  statusCase("status-unavailable", unavailableFacts(), {
    kind: "success",
    schemaVersion: "delivery.status.v1",
  }),
  statusCase("status-not-delivered", notDeliveredFacts(), {
    kind: "success",
    schemaVersion: "delivery.status.v1",
  }),
  statusCase("status-cap-sized", capSizedFacts(), {
    kind: "success",
    schemaVersion: "delivery.status.v1",
  }),
  containmentFacts(),
];

/* ----------------------------- verify-artifact ---------------------------- */

const MALFORMED_ROOT = join(VERIFY_ROOT, "tests/fixtures/verify/malformed");

const malformedText = (caseName: string): string =>
  readFileSync(
    join(
      MALFORMED_ROOT,
      caseName,
      "2026-10",
      `2026-10-31--${VERIFY_REF}--${caseName}`,
      `chg-${VERIFY_REF}-pm-notes.yaml`,
    ),
    "utf8",
  );

type VerifySpec = {
  readonly id: string;
  readonly options: VerifyHarnessOptions;
  readonly expectation: CaseExpectation;
  readonly afterCreate?: (state: VerifyState) => void;
};

const stableFixtureRoots: string[] = [];

const stableText = (text: string, label: string): string => {
  const target = materializeTarget(text, `mcp-${label}`);
  stableFixtureRoots.push(target.root);
  return target.changesDirectory;
};

const stableAbsent = (): string => {
  const target = materializeAbsentTarget();
  stableFixtureRoots.push(target.root);
  return target.changesDirectory;
};

/** Remove every stable parity fixture directory. */
export const cleanupParityFixtures = (): void => {
  for (const root of stableFixtureRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
};

process.on("exit", cleanupParityFixtures);

const verifyCase = (spec: VerifySpec): ToolParityCase => {
  const build = (): { harness: ReturnType<typeof createVerifyHarness>; state: VerifyState } => {
    const state = createVerifyState();
    const harness = createVerifyHarness({ ...spec.options, state });
    spec.afterCreate?.(state);
    return { harness, state };
  };
  const run = async (
    surface: "cli" | "mcp",
  ): Promise<{ readonly outcome: CaseOutcome; readonly reads: readonly string[] }> => {
    const { harness, state } = build();
    try {
      if (surface === "cli") {
        const result = await harness.run(["change", VERIFY_REF]);
        return {
          outcome: fromEnvelope(result.envelope),
          reads: [...harness.recorder.calls],
        };
      }
      const result = await createToolset({
        brand: SYNTHETIC_BRAND,
        verify: harness.runtime,
      }).callTool("verify-artifact", { ref: VERIFY_REF });
      return { outcome: fromToolResult(result), reads: [...harness.recorder.calls] };
    } finally {
      harness.cleanup();
      state.cleanup();
    }
  };
  return {
    id: spec.id,
    tool: "verify-artifact",
    expectation: spec.expectation,
    runCli: async () => (await run("cli")).outcome,
    runMcp: async () => (await run("mcp")).outcome,
    readsCli: async () => (await run("cli")).reads,
    readsMcp: async () => (await run("mcp")).reads,
  };
};

const overlayState = (state: VerifyState): void => {
  appendLandingForRef(state, VERIFY_REF, "review_fix", "complete", "2026-10-31T00:30:00Z");
};

export const VERIFY_CASES: readonly ToolParityCase[] = [
  verifyCase({
    id: "verify-full-finished",
    options: { changesDirectory: stableText(readFixture("full/base-complete.yaml"), "full") },
    expectation: { kind: "success" },
  }),
  verifyCase({
    id: "verify-lite-absent",
    options: {
      changesDirectory: stableText(readFixture("lite/complete-absent.yaml"), "lite-absent"),
    },
    expectation: { kind: "success" },
  }),
  verifyCase({
    id: "verify-lite-null",
    options: { changesDirectory: stableText(readFixture("lite/complete-null.yaml"), "lite-null") },
    expectation: { kind: "success" },
  }),
  verifyCase({
    id: "verify-partial-overlay",
    options: {
      changesDirectory: stableText(stringify(withOpenPhase("review_fix", fullBase())), "overlay"),
    },
    afterCreate: overlayState,
    expectation: { kind: "success" },
  }),
  verifyCase({
    id: "verify-missing-target",
    options: { changesDirectory: stableAbsent(), omitTarget: true },
    expectation: { kind: "failure", code: "lint.target.missing" },
  }),
  verifyCase({
    id: "verify-malformed",
    options: { changesDirectory: stableText(malformedText("unparseable"), "malformed") },
    expectation: { kind: "failure", code: "lint.notes.malformed" },
  }),
  verifyCase({
    id: "verify-unknown-variant",
    options: { changesDirectory: stableText(malformedText("unknown-variant-upper"), "unknown") },
    expectation: { kind: "failure", code: "lint.variant.unknown" },
  }),
  verifyCase({
    id: "verify-incomplete-phases",
    options: {
      changesDirectory: stableText(
        stringify(withoutPhaseKey("review_fix", fullBase())),
        "incomplete",
      ),
    },
    expectation: { kind: "failure", code: "lint.phases.incomplete" },
  }),
  verifyCase({
    id: "verify-ledger-incomplete",
    options: {
      changesDirectory: stableText(stringify(withOpenPhase("review_fix", fullBase())), "ledger"),
    },
    expectation: { kind: "failure", code: "verify.ledger.incomplete" },
  }),
  verifyCase({
    id: "verify-untrustworthy-registry",
    options: { changesDirectory: stableText(readFixture("full/base-complete.yaml"), "untrusted") },
    afterCreate: (state) => corruptHeaderVersion(state.identity, "delivery.state.v999"),
    expectation: { kind: "failure", code: "state.schema.mismatch" },
  }),
];

/* ------------------------------- gate-report ------------------------------ */

const GATE_REF = "GH-178";

const recordedGatesRuntime = (
  overrides: Parameters<typeof gatesRuntime>[0],
  recorder: string[],
): ReturnType<typeof gatesRuntime> => {
  const base = gatesRuntime(overrides);
  return {
    readLifecycle: (ref) => {
      recorder.push("readLifecycle");
      return base.readLifecycle(ref);
    },
    readRepository: () => {
      recorder.push("readRepository");
      return base.readRepository();
    },
    readWorkflow: () => {
      recorder.push("readWorkflow");
      return base.readWorkflow();
    },
    readOpenPullRequests: async (limit) => {
      recorder.push("readOpenPullRequests");
      return base.readOpenPullRequests(limit);
    },
    readDeliveryRequestDetail: async (pullNumber) => {
      recorder.push("readDeliveryRequestDetail");
      return base.readDeliveryRequestDetail(pullNumber);
    },
    readCheckRuns: async (sha, limit) => {
      recorder.push("readCheckRuns");
      return base.readCheckRuns(sha, limit);
    },
    readWorkItem: async (ref) => {
      recorder.push("readWorkItem");
      return base.readWorkItem(ref);
    },
  };
};

const recordedCombinedRuntime = (
  overrides: Parameters<typeof gatesRuntime>[0],
  recorder: string[],
): ReturnType<typeof combinedRuntime> => {
  const base = combinedRuntime(overrides);
  return {
    readPmNotes: (ref) => {
      recorder.push("readPmNotes");
      return base.readPmNotes(ref);
    },
    readRegistry: (ref) => {
      recorder.push("readRegistry");
      return base.readRegistry(ref);
    },
    gates: recordedGatesRuntime(overrides, recorder),
  };
};

const gateCase = (
  id: string,
  overrides: Parameters<typeof gatesRuntime>[0],
  expectation: CaseExpectation,
): ToolParityCase => {
  const run = async (
    surface: "cli" | "mcp",
  ): Promise<{ readonly outcome: CaseOutcome; readonly reads: readonly string[] }> => {
    const recorder: string[] = [];
    if (surface === "cli") {
      const result = await runVerify(recordedCombinedRuntime(overrides, recorder), [
        "gates",
        GATE_REF,
      ]);
      return { outcome: fromEnvelope(result.envelope), reads: recorder };
    }
    const result = await createToolset({
      brand: SYNTHETIC_BRAND,
      gates: recordedGatesRuntime(overrides, recorder),
    }).callTool("gate-report", { ref: GATE_REF });
    return { outcome: fromToolResult(result), reads: recorder };
  };
  return {
    id,
    tool: "gate-report",
    expectation,
    runCli: async () => (await run("cli")).outcome,
    runMcp: async () => (await run("mcp")).outcome,
    readsCli: async () => (await run("cli")).reads,
    readsMcp: async () => (await run("mcp")).reads,
  };
};

const redGateFacts = () => {
  const facts = clone(gatesBaseFacts());
  facts.checkRuns = {
    ok: true,
    value: {
      items: EXPECTED_JOBS.map((name) =>
        run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
      ),
      pageItemCount: EXPECTED_JOBS.length,
    },
  };
  return facts;
};

const unavailableGateFacts = () => {
  const facts = clone(gatesBaseFacts());
  facts.checkRuns = { ok: false, reason: "not-found" };
  return facts;
};

const credentialGateFacts = () => {
  const facts = clone(gatesBaseFacts());
  facts.openPullRequests = withReadError("credential-unavailable");
  facts.deliveryRequestDetail = withReadError("credential-unavailable");
  facts.checkRuns = withReadError("credential-unavailable");
  facts.workItem = withReadError("credential-unavailable");
  return facts;
};

export const GATE_CASES: readonly ToolParityCase[] = [
  gateCase("gate-all-pass", {}, { kind: "success", schemaVersion: "delivery.verify-gates.v1" }),
  gateCase(
    "gate-failed",
    { facts: redGateFacts() },
    {
      kind: "failure",
      code: "verify.gates.failed",
    },
  ),
  gateCase(
    "gate-unavailable",
    { facts: unavailableGateFacts() },
    {
      kind: "failure",
      code: "verify.gates.unavailable",
    },
  ),
  gateCase(
    "gate-classified-credential",
    { facts: credentialGateFacts() },
    {
      kind: "failure",
      code: "config.credential.missing",
    },
  ),
  gateCase(
    "gate-classified-state",
    { registryFailure: { code: "state.store.torn" } },
    {
      kind: "failure",
      code: "state.store.torn",
    },
  ),
];

/** Every declared parity case, grouped in catalog order. */
export const ALL_CASES: readonly ToolParityCase[] = [
  ...STATUS_CASES,
  ...VERIFY_CASES,
  ...GATE_CASES,
];

/** The declared per-tool case floors (test plan §4.2). */
export const CASE_FLOORS = { status: 5, "verify-artifact": 8, "gate-report": 4 } as const;

/** The golden path for one case under the committed fixture tree. */
export const goldenPath = (tool: ToolParityCase["tool"], id: string): string =>
  join(process.cwd(), "tests/fixtures/mcp/golden", tool, `${id}.json`);
