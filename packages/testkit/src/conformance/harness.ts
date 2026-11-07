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
} from "@delivery-os/core/contracts";

/** The six-scenario classification floor (test-plan §4.2). */
export const HARNESS_CONFORMANCE_SCENARIOS = [
  "completed",
  "tool-failure",
  "premature-end",
  "harness-failure",
  "spawn-refusal",
  "timeout",
] as const;

export type HarnessConformanceScenarioId = (typeof HARNESS_CONFORMANCE_SCENARIOS)[number];

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
  readonly scenarios: readonly HarnessConformanceScenarioId[];
  readonly build: (io: HarnessConformanceIo, deps: HarnessConformanceDeps) => HarnessSessionPort;
};

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
    return createOpencodeSession({
      ...common,
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
    scenarios: [...HARNESS_CONFORMANCE_SCENARIOS],
    build: (io, deps) => build("opencode", io, deps),
  },
  {
    kind: "claude-code",
    capabilities: CLAUDE_CAPABILITIES,
    scenarios: [...HARNESS_CONFORMANCE_SCENARIOS],
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
    for (const scenario of HARNESS_CONFORMANCE_SCENARIOS) {
      if (!registration.scenarios.includes(scenario)) {
        violations.push(`${registration.kind}: missing classification scenario ${scenario}`);
      }
    }
  }
  return violations;
};
