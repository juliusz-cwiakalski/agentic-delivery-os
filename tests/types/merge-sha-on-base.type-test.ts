/**
 * TC-F1-012 type probe — `landing.shaOnBase` widens to exactly
 * `boolean | "unknown"` (DM-3, AC-F1-2).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it; the root
 * `pnpm typecheck` compiles it through `tests/types/tsconfig.json`.
 */
import type {
  MergeLandingEvidence,
  MergeTransactionRecord,
} from "../../packages/core/src/contracts/index";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Expect<T extends true> = T;

/** The widened domain is exactly the boolean domain plus the third literal. */
type ShaOnBaseUnion = Expect<Equal<MergeLandingEvidence["shaOnBase"], boolean | "unknown">>;

/** `unknown` is not `undefined`: absence is a missing field, never a value. */
type ShaOnBaseIsNotOptional = Expect<
  Equal<undefined extends MergeLandingEvidence["shaOnBase"] ? true : false, false>
>;

/** The field keeps its delivered name and participates in no second member. */
type LandingKeys = Expect<Equal<keyof MergeLandingEvidence, "shaOnBase" | "requestState">>;

/** Both delivered boolean states and the third state are representable. */
export const legacyTrue: MergeLandingEvidence = { shaOnBase: true, requestState: "merged" };
export const legacyFalse: MergeLandingEvidence = { shaOnBase: false, requestState: "merged" };
export const unknownState: MergeLandingEvidence = { shaOnBase: "unknown", requestState: "merged" };

/** A whole transaction record carrying the third state type-checks. */
export const recordWithUnknown: MergeTransactionRecord = {
  schema: "delivery.merge.transaction.v1",
  changeRef: "GH-349",
  result: "merged",
  replayed: false,
  landing: unknownState,
  refresh: { attempts: 0, outcome: "not-attempted" },
  waiverRefs: [],
  postLanding: [],
  recordedAt: "2026-11-19T00:00:00Z",
};

// @ts-expect-error a confirmatory value is not representable
const rejectedYes: MergeLandingEvidence = { shaOnBase: "yes", requestState: "merged" };
// @ts-expect-error a numeric signal is not representable
const rejectedOne: MergeLandingEvidence = { shaOnBase: 1, requestState: "merged" };
// @ts-expect-error absence is a missing field, never null
const rejectedNull: MergeLandingEvidence = { shaOnBase: null, requestState: "merged" };

export type Probes = [ShaOnBaseUnion, ShaOnBaseIsNotOptional, LandingKeys];
export const rejected = [rejectedYes, rejectedOne, rejectedNull];
