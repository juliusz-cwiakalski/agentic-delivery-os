/**
 * The harness conformance registry (GH-233 F-1, F-2, DEC-1, DEC-10).
 *
 * Lists exactly the two shipped harnesses. Per registration: the capability
 * declaration, a spawn/collect builder over injected harness I/O, and the
 * supported scenario ids. The coverage meta-check fails a registered harness
 * with no classification case and fails a closed-vocabulary kind that is not
 * registered. The registry imports the delivery-result token type from core
 * contracts; it never re-declares the taxonomy.
 */
import {
  CLAUDE_CAPABILITIES,
  createClaudeSession,
  createOpencodeSession,
  OPENCODE_CAPABILITIES,
} from "@delivery-os/adapters/harness";
import {
  HARNESS_KINDS,
  type HarnessCapabilityDeclaration,
  type HarnessClassifier,
  type HarnessEnvironmentBuilder,
  type HarnessKind,
  type HarnessLivenessAssembler,
  type HarnessLivenessSourcedReading,
  type HarnessSessionPort,
  type HarnessSeatBinding,
  type HarnessSpawnStarter,
  type HarnessVersionProbeOutcome,
  type HarnessVersionVerdict,
} from "@delivery-os/core/contracts";
import {
  evaluateHarnessModeAvailability,
  evaluateHarnessVersion,
  evaluateModelExpressibility,
  resolveBinding,
} from "@delivery-os/core";

/**
 * The six-scenario classification floor (test-plan §4.2, AC-F7-1).
 *
 * Exactly the six delivered ids in their delivered order. The extension list
 * below can never widen this constant.
 */
export const HARNESS_CONFORMANCE_FLOOR_SCENARIOS = [
  "completed",
  "tool-failure",
  "premature-end",
  "harness-failure",
  "spawn-refusal",
  "timeout",
] as const;

/** The delivered floor constant's name, kept for delivered importers. */
export const HARNESS_CONFORMANCE_SCENARIOS = HARNESS_CONFORMANCE_FLOOR_SCENARIOS;

export type HarnessConformanceFloorScenarioId =
  (typeof HARNESS_CONFORMANCE_FLOOR_SCENARIOS)[number];

/** The four extension scenario ids (GH-335 F-7, AC-F7-2). */
export const HARNESS_CONFORMANCE_EXTENSION_SCENARIOS = [
  "version-window",
  "version-unknown",
  "mode-unavailable",
  "profile-propagation",
] as const;

export type HarnessConformanceExtensionScenarioId =
  (typeof HARNESS_CONFORMANCE_EXTENSION_SCENARIOS)[number];

/** The union discipline: a new id never silently enters the floor. */
export type HarnessConformanceScenarioId =
  | HarnessConformanceFloorScenarioId
  | HarnessConformanceExtensionScenarioId;

/** The refusal identity to the scenario that must exercise it (C-04). */
export const HARNESS_REFUSAL_SCENARIO_MAP = {
  "harness.version.unsupported": "version-window",
  "harness.version.unknown": "version-unknown",
  "harness.mode.unavailable": "mode-unavailable",
  "harness.profile.model-unrepresentable": "profile-propagation",
} as const satisfies Readonly<Record<string, HarnessConformanceExtensionScenarioId>>;

/** One harness's raw I/O for one scenario. */
export type HarnessConformanceIo = {
  readonly spawnStdout: string;
  readonly spawnStatus: number;
  readonly spawnTimedOut: boolean;
  readonly livenessFacts?: readonly HarnessLivenessSourcedReading[];
};

/** The injected seams every registration builder consumes. */
export type HarnessConformanceDeps = {
  readonly command: string;
  readonly spawnArgs: readonly string[];
  readonly resumeArgs: readonly string[];
  readonly listArgs: readonly string[];
  readonly buildEnvironment: HarnessEnvironmentBuilder;
  readonly classify: HarnessClassifier;
  readonly assembleLiveness: HarnessLivenessAssembler;
  readonly now: () => string;
  readonly timeoutMs: number;
};

export type HarnessConformanceRegistration = {
  readonly kind: HarnessKind;
  readonly capabilities: HarnessCapabilityDeclaration;
  readonly scenarios: readonly HarnessConformanceFloorScenarioId[];
  /** The extension scenarios this registration declares (all four are required). */
  readonly extensionScenarios: readonly HarnessConformanceExtensionScenarioId[];
  readonly build: (io: HarnessConformanceIo, deps: HarnessConformanceDeps) => HarnessSessionPort;
};

/** The injected facts an extension scenario asserts against (GH-335 OQ-9). */
export type HarnessConformanceFacts = {
  readonly probeOutcome: HarnessVersionProbeOutcome;
  readonly requestedMode: Parameters<typeof evaluateHarnessModeAvailability>[0];
  /** The caller-supplied agent identity (DEC-16); absent is role-less. */
  readonly agent?: string;
  /** The composition-resolved single-seat binding it produced. */
  readonly binding?: HarnessSeatBinding;
  /** The invocation argv the surface echo recorded. */
  readonly invocationArgs?: readonly string[];
  /** The store row set the harness reported. */
  readonly storeRows?: readonly {
    readonly sessionId: string;
    readonly agent: string;
    readonly model: string;
  }[];
};

/** One extension scenario's declared outcome. */
export type HarnessConformanceScenarioOutcome = {
  readonly scenarioId: HarnessConformanceScenarioId;
  readonly verdict: "satisfied" | "mismatch";
  readonly reasons: readonly string[];
  readonly observedVersion: string | null;
  readonly versionVerdict: HarnessVersionVerdict | null;
};

const pairsIn = (
  args: readonly string[],
): { readonly agents: readonly string[]; readonly models: readonly string[] } => ({
  agents: args.flatMap((value, index) => (value === "--agent" ? [args[index + 1] ?? ""] : [])),
  models: args.flatMap((value, index) => (value === "--model" ? [args[index + 1] ?? ""] : [])),
});

/**
 * Run one extension scenario through the delivered registry's additive executor
 * (GH-335 F-7, OQ-9, OQ-12).
 *
 * The facts are injected as data: the probe outcome, the requested mode, the
 * caller-supplied agent identity, the resolved single-seat binding, and the
 * invocation/store echo. No live resolution, no catalogue, and no child process.
 * A floor id is refused here: the floor is the registry's classification
 * behaviour, not an extension scenario.
 */
export const runHarnessConformanceScenario = (input: {
  readonly registration: HarnessConformanceRegistration;
  readonly scenarioId: HarnessConformanceScenarioId;
  readonly facts: HarnessConformanceFacts;
}): HarnessConformanceScenarioOutcome => {
  const reasons: string[] = [];
  const scenarioId = input.scenarioId;
  if ((HARNESS_CONFORMANCE_EXTENSION_SCENARIOS as readonly string[]).includes(scenarioId)) {
    if (!(input.registration.extensionScenarios as readonly string[]).includes(scenarioId)) {
      reasons.push(`${input.registration.kind}: scenario ${scenarioId} is not registered`);
    }
  } else {
    reasons.push(`${scenarioId} is a floor scenario; the registry owns its classification`);
  }
  const facts = input.facts;
  const evaluated =
    facts.probeOutcome.status === "answered"
      ? evaluateHarnessVersion(facts.probeOutcome.stdout)
      : {
          verdict: "indeterminate" as const,
          observedVersion: null,
          requirement: "refuse-unknown" as const,
        };
  const base = {
    scenarioId,
    observedVersion: evaluated.observedVersion,
    versionVerdict: evaluated.verdict as HarnessVersionVerdict | null,
  };
  if (scenarioId === "version-window") {
    const inside = evaluateHarnessVersion("opencode v2.3.2");
    if (inside.requirement !== "proceed") reasons.push("the in-window control did not proceed");
    if (evaluated.verdict === "outside" && evaluated.requirement !== "refuse-unsupported") {
      reasons.push("an outside line did not refuse");
    }
    if (evaluated.verdict === "inside" && evaluated.requirement !== "proceed") {
      reasons.push("an inside line did not proceed");
    }
  } else if (scenarioId === "version-unknown") {
    if (evaluated.verdict !== "indeterminate")
      reasons.push("the unknown case did not classify unknown");
    if (evaluated.observedVersion !== null) reasons.push("an unknown version fabricated a value");
  } else if (scenarioId === "mode-unavailable") {
    const availability = evaluateHarnessModeAvailability(facts.requestedMode);
    if (availability.available)
      reasons.push("the requested non-default mode was reported available");
    if (!availability.available && availability.requested !== facts.requestedMode) {
      reasons.push("the refusal did not name the requested mode");
    }
  } else if (scenarioId === "profile-propagation") {
    const args = facts.invocationArgs ?? [];
    const { agents, models } = pairsIn(args);
    const binding = facts.binding;
    if (facts.agent === undefined) {
      // A role-less spawn binds nothing and sends neither flag.
      if (agents.length !== 0) reasons.push(`a role-less spawn sent ${agents.length} --agent`);
      if (models.length !== 0) reasons.push(`a role-less spawn sent ${models.length} --model`);
    } else if (agents.length !== 1 || models.length !== 1) {
      reasons.push(`expected exactly one --agent, saw ${agents.length}`);
      reasons.push(`expected exactly one --model, saw ${models.length}`);
    }
    if (facts.agent !== undefined) {
      if (binding === undefined) reasons.push("a named agent produced no binding");
      else {
        if (binding.agent !== facts.agent)
          reasons.push("the binding's agent is not the supplied agent");
        if (agents[0] !== binding.agent)
          reasons.push("the invocation's --agent is not the binding's agent");
        if (models[0] !== binding.resolvedModel)
          reasons.push("the invocation's --model is not the resolved model");
        const expressibility = evaluateModelExpressibility(binding);
        if (!expressibility.ok) reasons.push("an unrepresentable seat model was not refused");
      }
    } else if (binding !== undefined) {
      reasons.push("a role-less spawn bound a seat");
    }
    if (facts.storeRows !== undefined && binding !== undefined) {
      const seatRows = facts.storeRows.filter((row) => row.agent === binding.agent);
      if (seatRows.length > 0) {
        const diverged = seatRows.filter((row) => row.model !== binding.resolvedModel);
        if (diverged.length === seatRows.length) {
          reasons.push("the reported model never agreed with the resolved model");
        }
      }
    }
  }
  return { ...base, verdict: reasons.length === 0 ? "satisfied" : "mismatch", reasons };
};

/** Resolve one binding for the propagation scenario's fixture (pure, no I/O). */
export const resolveConformanceBinding = resolveBinding;

const build = (
  kind: HarnessKind,
  io: HarnessConformanceIo,
  deps: HarnessConformanceDeps,
): HarnessSessionPort => {
  const runner = async () => ({
    stdout: io.spawnStdout,
    stderr: "",
    status: io.spawnStatus,
    timedOut: io.spawnTimedOut,
  });
  const common = {
    command: deps.command,
    runner,
    buildEnvironment: deps.buildEnvironment,
    classify: deps.classify,
    assembleLiveness: deps.assembleLiveness,
    now: deps.now,
    timeoutMs: deps.timeoutMs,
    spawnArgs: deps.spawnArgs,
    ...(io.livenessFacts === undefined ? {} : { livenessFacts: io.livenessFacts }),
  };
  if (kind === "opencode") {
    // The opencode registration acquires through the streaming seam, derived
    // from the scenario's real stdout so the six delivered envelopes keep their
    // delivered evidence and the JSONL counterparts can be exercised.
    const starter: HarnessSpawnStarter = () => {
      const lines = io.spawnStdout.split("\n").filter((line) => line.length > 0);
      return {
        lines: {
          async *[Symbol.asyncIterator](): AsyncIterator<string> {
            for (const line of lines) yield line;
          },
        },
        completion: Promise.resolve({
          stdout: io.spawnStdout,
          stderr: "",
          status: io.spawnStatus,
          timedOut: io.spawnTimedOut,
        }),
        acquired: () => undefined,
        kill: () => undefined,
      };
    };
    return createOpencodeSession({
      ...common,
      starter,
      resumeArgs: deps.resumeArgs,
      listArgs: deps.listArgs,
    });
  }
  return createClaudeSession({ ...common, headlessArgs: deps.spawnArgs });
};

/** The sole harness conformance participant list: exactly the two shipped kinds. */
export const HARNESS_CONFORMANCE_REGISTRY: readonly HarnessConformanceRegistration[] = [
  {
    kind: "opencode",
    capabilities: OPENCODE_CAPABILITIES,
    scenarios: [...HARNESS_CONFORMANCE_FLOOR_SCENARIOS],
    extensionScenarios: [...HARNESS_CONFORMANCE_EXTENSION_SCENARIOS],
    build: (io, deps) => build("opencode", io, deps),
  },
  {
    kind: "claude-code",
    capabilities: CLAUDE_CAPABILITIES,
    scenarios: [...HARNESS_CONFORMANCE_FLOOR_SCENARIOS],
    extensionScenarios: [...HARNESS_CONFORMANCE_EXTENSION_SCENARIOS],
    build: (io, deps) => build("claude-code", io, deps),
  },
];

/** Return every registry/vocabulary/coverage drift. */
export const harnessConformanceViolations = (
  registry: readonly HarnessConformanceRegistration[],
): string[] => {
  const violations: string[] = [];
  const kinds = registry.map((registration) => registration.kind);
  for (const kind of HARNESS_KINDS) {
    const count = kinds.filter((candidate) => candidate === kind).length;
    if (count !== 1)
      violations.push(`harness ${kind} must be registered exactly once; got ${count}`);
  }
  for (const registration of registry) {
    if (!(HARNESS_KINDS as readonly string[]).includes(registration.kind)) {
      violations.push(`harness ${registration.kind} is not in the closed vocabulary`);
    }
    for (const scenario of HARNESS_CONFORMANCE_FLOOR_SCENARIOS) {
      if (!registration.scenarios.includes(scenario)) {
        violations.push(`${registration.kind}: missing classification scenario ${scenario}`);
      }
    }
    for (const scenario of HARNESS_CONFORMANCE_EXTENSION_SCENARIOS) {
      if (!registration.extensionScenarios.includes(scenario)) {
        violations.push(`${registration.kind}: missing extension scenario ${scenario}`);
      }
    }
    for (const [identity, scenario] of Object.entries(HARNESS_REFUSAL_SCENARIO_MAP)) {
      if (!registration.extensionScenarios.includes(scenario)) {
        violations.push(
          `${registration.kind}: refusal identity ${identity} has no scenario ${scenario}`,
        );
      }
    }
  }
  return violations;
};
