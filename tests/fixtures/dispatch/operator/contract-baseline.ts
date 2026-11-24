/**
 * The pinned closed-contract baseline (GH-354 §6.1, TC-CONTRACT-001).
 *
 * Every value below is a LITERAL pin of the delivered surface before this
 * change. The invariance suite re-derives each surface from the live modules and
 * compares it against these pins, so a diff is a failure rather than a
 * self-fulfilling capture.
 */

import { CLAUDE_CAPABILITIES } from "../../../../packages/adapters/src/harness/claude";
import { OPENCODE_CAPABILITIES } from "../../../../packages/adapters/src/harness/opencode";
import { catalogPaths, PRODUCTION_CATALOG } from "../../../../packages/core/src/config/catalog";
import {
  DELIVERY_RESULT_TAXONOMY,
  DOMAIN_KINDS,
  ERROR_TABLE,
  HARNESS_GAP_REASONS,
  HARNESS_KINDS,
  HARNESS_LIFECYCLE_CAPABILITIES,
  HARNESS_OPERATIONS,
} from "../../../../packages/core/src/contracts/index";

export type AdapterDeclaration = {
  readonly supportedOperations: readonly string[];
  readonly lifecycleCapabilities: readonly string[];
  readonly declaredGaps: readonly string[];
};

export type ContractBaseline = {
  readonly operations: readonly string[];
  readonly lifecycleCapabilities: readonly string[];
  readonly gapReasons: readonly string[];
  readonly harnessKinds: readonly string[];
  readonly errorRowCount: number;
  readonly tokens: readonly (readonly [string, string])[];
  readonly domainKinds: readonly string[];
  readonly laneKeys: readonly string[];
  readonly attemptKeys: readonly string[];
  readonly evidenceRefs: number;
  readonly attemptsHumanLines: number;
  readonly attemptsHumanBytes: number;
  readonly configurationKeyCount: number;
  readonly opencode: AdapterDeclaration;
  readonly claude: AdapterDeclaration;
};

/** The lane record key set (the delivered field set; no field may be added). */
export const LANE_KEYS = [
  "schema",
  "ref",
  "repository",
  "attemptId",
  "sessionId",
  "harnessKind",
  "owner",
  "iterationOrdinal",
  "restartsConsumed",
  "state",
  "recordedAt",
  "lastToken",
  "lastOutcome",
] as const;

/** The attempt record key set (the delivered field set; no field may be added). */
export const ATTEMPT_KEYS = [
  "schema",
  "attemptId",
  "repository",
  "ref",
  "harness",
  "evidenceClass",
  "startedAt",
  "finishedAt",
  "handoverState",
  "outcome",
  "token",
  "comparison",
  "falseSuccess",
  "corroboration",
  "evidenceRefs",
  "recordedAt",
  "sessionIds",
] as const;

export const CONTRACT_BASELINE: ContractBaseline = {
  operations: ["spawn", "deliver", "resume", "steer", "collect", "session-list", "terminate"],
  lifecycleCapabilities: [
    "headless-spawn",
    "resume-steer-injection",
    "session-introspection",
    "telemetry-extraction",
  ],
  gapReasons: [
    "provider-unsupported",
    "adapter-not-implemented",
    "plan-restriction",
    "headless-mode-limitation",
  ],
  harnessKinds: ["opencode", "claude-code"],
  errorRowCount: 172,
  tokens: [
    ["merged", "success"],
    ["blocked", "success"],
    ["pr-open", "success"],
    ["pr-open-unverified", "success"],
    ["failed", "user-validation"],
    ["finished", "success"],
    ["max-restarts", "user-validation"],
    ["state-unverified", "platform-provider"],
    ["partial", "user-validation"],
    ["noop-lane-permission", "user-validation"],
    ["noop-lane-nothing-to-do", "success"],
  ],
  domainKinds: [
    "provider",
    "input",
    "config",
    "state",
    "lint",
    "verify",
    "db",
    "closeout",
    "plan",
    "watchdog",
    "commit",
    "status",
    "blockers",
    "doctor",
    "merge",
    "harness",
    "retro",
    "spend",
    "ceremony",
    "queue",
    "dispatch",
    "daemon",
    "coordinator",
    "projects",
    "repos",
    "events",
    "board",
    "steer",
    "supervise",
    "metrics",
    "install",
  ],
  laneKeys: [...LANE_KEYS],
  attemptKeys: [...ATTEMPT_KEYS],
  evidenceRefs: 16,
  attemptsHumanLines: 40,
  attemptsHumanBytes: 8192,
  // GH-394 DM-5: the declarable tracker credential reference grows the
  // catalog by the github branch (the branch, its credential node, its
  // source-key node, and the eight per-style keys).
  configurationKeyCount: 91,
  opencode: {
    supportedOperations: [
      "spawn",
      "deliver",
      "resume",
      "steer",
      "collect",
      "session-list",
      "terminate",
    ],
    lifecycleCapabilities: [
      "headless-spawn",
      "resume-steer-injection",
      "session-introspection",
      "telemetry-extraction",
    ],
    declaredGaps: ["worktree-activity"],
  },
  claude: {
    supportedOperations: ["spawn", "collect"],
    lifecycleCapabilities: ["headless-spawn", "telemetry-extraction"],
    declaredGaps: [
      "terminate",
      "deliver",
      "resume",
      "steer",
      "session-list",
      "resume-steer-injection",
      "session-introspection",
      "session-traffic",
      "worktree-activity",
      "process",
    ],
  },
};

/** The live surfaces in the baseline's shape, re-derived for comparison. */
export const captureLiveContract = (): ContractBaseline => ({
  operations: [...HARNESS_OPERATIONS],
  lifecycleCapabilities: [...HARNESS_LIFECYCLE_CAPABILITIES],
  gapReasons: [...HARNESS_GAP_REASONS],
  harnessKinds: [...HARNESS_KINDS],
  errorRowCount: ERROR_TABLE.length,
  tokens: DELIVERY_RESULT_TAXONOMY.map((row) => [row.token, row.projectionClass] as const),
  domainKinds: [...DOMAIN_KINDS],
  laneKeys: [...LANE_KEYS],
  attemptKeys: [...ATTEMPT_KEYS],
  evidenceRefs: 16,
  attemptsHumanLines: 40,
  attemptsHumanBytes: 8192,
  configurationKeyCount: catalogPaths(PRODUCTION_CATALOG).length,
  opencode: {
    supportedOperations: [...OPENCODE_CAPABILITIES.supportedOperations],
    lifecycleCapabilities: [...OPENCODE_CAPABILITIES.lifecycleCapabilities],
    declaredGaps: OPENCODE_CAPABILITIES.declaredGaps.map((gap) => gap.capability),
  },
  claude: {
    supportedOperations: [...CLAUDE_CAPABILITIES.supportedOperations],
    lifecycleCapabilities: [...CLAUDE_CAPABILITIES.lifecycleCapabilities],
    declaredGaps: CLAUDE_CAPABILITIES.declaredGaps.map((gap) => gap.capability),
  },
});
