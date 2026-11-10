/**
 * Lifecycle decision fixtures (GH-241): the six AC-F2 outcomes with their
 * expected decision, reason, ordinal consumption, and effect.
 */
import type { CoordinatorDecisionKind } from "../../../packages/core/src/contracts/index";
import type {
  CoordinatorLifecycleFacts,
  CoordinatorPriorSession,
} from "../../../packages/core/src/domain/index";

export const CONTEXT_LIMIT = 100_000;

export type LifecycleCase = {
  readonly id: string;
  readonly facts: CoordinatorLifecycleFacts;
  readonly expected: {
    readonly kind: CoordinatorDecisionKind;
    readonly reason: string;
    readonly consumesOrdinal: 0 | 1;
    readonly effect: "attach" | "resume" | "spawn";
  };
};

const prior = (overrides: Partial<CoordinatorPriorSession> = {}): CoordinatorPriorSession => ({
  completedCleanly: false,
  resumable: true,
  contextTokens: 10_000,
  ...overrides,
});

export const LIFECYCLE_CASES: readonly LifecycleCase[] = [
  {
    id: "live-session-joins",
    facts: { live: true, prior: prior(), resumeDeclared: true, contextLimit: CONTEXT_LIMIT },
    expected: { kind: "join-live", reason: "live-session", consumesOrdinal: 0, effect: "attach" },
  },
  {
    id: "resumable-known-below-limit",
    facts: { live: false, prior: prior(), resumeDeclared: true, contextLimit: CONTEXT_LIMIT },
    expected: {
      kind: "resume-context",
      reason: "session-interrupted",
      consumesOrdinal: 1,
      effect: "resume",
    },
  },
  {
    id: "context-at-limit-spawns",
    facts: {
      live: false,
      prior: prior({ contextTokens: CONTEXT_LIMIT }),
      resumeDeclared: true,
      contextLimit: CONTEXT_LIMIT,
    },
    expected: {
      kind: "spawn-fresh",
      reason: "context-pressure",
      consumesOrdinal: 1,
      effect: "spawn",
    },
  },
  {
    id: "context-unknown-spawns",
    facts: {
      live: false,
      prior: prior({ contextTokens: null }),
      resumeDeclared: true,
      contextLimit: CONTEXT_LIMIT,
    },
    expected: {
      kind: "spawn-fresh",
      reason: "context-unknown",
      consumesOrdinal: 1,
      effect: "spawn",
    },
  },
  {
    id: "not-resumable-spawns",
    facts: {
      live: false,
      prior: prior({ resumable: false }),
      resumeDeclared: true,
      contextLimit: CONTEXT_LIMIT,
    },
    expected: {
      kind: "spawn-fresh",
      reason: "session-interrupted",
      consumesOrdinal: 1,
      effect: "spawn",
    },
  },
  {
    id: "resume-undeclared-spawns-without-error",
    facts: { live: false, prior: prior(), resumeDeclared: false, contextLimit: CONTEXT_LIMIT },
    expected: {
      kind: "spawn-fresh",
      reason: "session-interrupted",
      consumesOrdinal: 1,
      effect: "spawn",
    },
  },
  {
    id: "no-prior-session-initial-start",
    facts: { live: false, prior: null, resumeDeclared: true, contextLimit: CONTEXT_LIMIT },
    expected: { kind: "spawn-fresh", reason: "initial-start", consumesOrdinal: 0, effect: "spawn" },
  },
  {
    id: "clean-end-no-ordinal",
    facts: {
      live: false,
      prior: prior({ completedCleanly: true }),
      resumeDeclared: true,
      contextLimit: CONTEXT_LIMIT,
    },
    expected: {
      kind: "spawn-fresh",
      reason: "clean-iteration-end",
      consumesOrdinal: 0,
      effect: "spawn",
    },
  },
];

/** The recovery subset that must consume exactly one ordinal. */
export const RECOVERY_CASES = LIFECYCLE_CASES.filter(
  (entry) => entry.expected.consumesOrdinal === 1,
);

/** The no-ordinal subset (join-live, first start, clean end). */
export const NO_ORDINAL_CASES = LIFECYCLE_CASES.filter(
  (entry) => entry.expected.consumesOrdinal === 0,
);
