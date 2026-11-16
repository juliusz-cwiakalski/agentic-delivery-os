/**
 * The asks fixtures: the delivered open-question view (owner/coordinator
 * populations) and the three PDR-0003 join states the read composes.
 */
import type {
  OwnerGateSlaDefault,
  SteerAskFact,
  SteerAskSource,
} from "../../../packages/core/src/contracts/index";

export const ownerAsk = (overrides: Partial<SteerAskFact> = {}): SteerAskFact => ({
  id: "q-owner-1",
  type: "decision-needed",
  audience: "owner",
  lane: "L5",
  ref: "GH-298",
  question: "which gate applies?",
  askedAt: "2026-11-16T09:00:00.000Z",
  age: 3 * 3_600_000,
  rank: 1,
  ...overrides,
});

export const coordinatorAsk = (overrides: Partial<SteerAskFact> = {}): SteerAskFact => ({
  id: "q-coord-1",
  type: "spec-ambiguity",
  audience: "coordinator",
  lane: "L2",
  ref: "GH-298",
  question: "coordinator-only question",
  askedAt: "2026-11-16T08:00:00.000Z",
  age: 4 * 3_600_000,
  rank: 2,
  ...overrides,
});

export const asksWith = (input: {
  readonly facts: readonly SteerAskFact[];
  readonly defaultableRefs?: Readonly<Record<string, OwnerGateSlaDefault>>;
  readonly appliedRefs?: readonly string[];
}): SteerAskSource => ({
  facts: input.facts,
  join: {
    defaultableRefs: input.defaultableRefs ?? {},
    appliedRefs: input.appliedRefs ?? [],
  },
});

/** The three declared join states over one defaultable `waiver` ref. */
export const joinMatrix = (): {
  readonly pending: SteerAskSource;
  readonly applied: SteerAskSource;
  readonly none: SteerAskSource;
} => {
  const defaultableRefs = { "GH-298": "allow-after-window" } as const;
  return {
    pending: asksWith({
      facts: [ownerAsk({ id: "q-pending", ref: "GH-298" })],
      defaultableRefs,
    }),
    applied: asksWith({
      facts: [ownerAsk({ id: "q-applied", ref: "GH-298" })],
      defaultableRefs,
      appliedRefs: ["GH-298"],
    }),
    none: asksWith({ facts: [ownerAsk({ id: "q-none", ref: "GH-999" })] }),
  };
};

/** Twelve open owner asks plus three coordinator asks (the delivered cap cell). */
export const cappedPopulation = (): SteerAskSource =>
  asksWith({
    facts: [
      ...Array.from({ length: 12 }, (_, index) =>
        ownerAsk({
          id: `q-owner-${String(index).padStart(2, "0")}`,
          askedAt: new Date(Date.parse("2026-11-16T08:00:00.000Z") + index * 60_000).toISOString(),
          age: index * 60_000,
          rank: index + 1,
        }),
      ),
      ...Array.from({ length: 3 }, (_, index) =>
        coordinatorAsk({
          id: `q-coord-${String(index).padStart(2, "0")}`,
          askedAt: new Date(Date.parse("2026-11-16T07:00:00.000Z") + index * 60_000).toISOString(),
          rank: 13 + index,
        }),
      ),
    ],
  });
