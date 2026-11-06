/**
 * TC-BRIEF-021 mutant corpus: real source mutations plus cross-referenced
 * seeded controls.
 *
 * Each `BriefSourceMutation` disables exactly one named guard in the production
 * `packages/core/src/domain/brief.ts` source. `fires` encodes the intended
 * suite's load-bearing assertion: it returns true only when the mutated module
 * emits the prohibited observable, so the clean module resists and the mutant
 * fails the intended case by name. Mutations are written to `tmp/tmpdir` by the
 * meta-check loader and never touch the live tree.
 *
 * Guards that live outside the brief domain (model/network imports, the store
 * write path, child processes, the redaction chokepoint) are covered by the
 * existing seeded controls listed in `briefSeededControls`; the meta-check
 * verifies each referenced control still exists under that exact test name.
 */
import {
  type BriefPayload,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
} from "../../../../packages/core/src/contracts/index";
import { SYNTHETIC_BRAND } from "../../../golden/helpers";
import {
  baseFacts,
  deliveryRequestRead,
  failedDeliveryRequestRead,
  makeDeliveryRequest,
  makeWorkItem,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  workItemRead,
} from "../harness";

/** The production module shape the meta-check loads from a mutated temp copy. */
export type BriefDomainModule = typeof import("../../../../packages/core/src/domain/brief");

export type BriefSourceMutation = {
  readonly id: string;
  readonly caseName: string;
  readonly ac: string;
  /** The intended suite whose load-bearing assertion `fires` encodes. */
  readonly intendedSuite: string;
  /** The observable the guard must prevent. */
  readonly prohibited: string;
  readonly mutate: (source: string) => string;
  readonly fires: (module: BriefDomainModule) => boolean;
};

export type BriefSeededControl = {
  readonly id: string;
  readonly ac: string;
  readonly file: string;
  readonly testName: string;
  readonly proves: string;
};

const replaceOnce = (source: string, needle: string, replacement: string): string => {
  if (!source.includes(needle)) throw new Error(`mutation needle not found: ${needle}`);
  return source.replace(needle, replacement);
};

const approved = (count: number, entityId = (index: number) => String(500 + index)) =>
  deliveryRequestRead(
    Array.from({ length: count }, (_, index) =>
      makeDeliveryRequest({ entityId: entityId(index), reviewState: "approved" }),
    ),
    REVIEWS_AVAILABLE,
  );

const unknownReviewFacts = () =>
  baseFacts({
    changes: deliveryRequestRead(
      [makeDeliveryRequest({ entityId: "501", reviewState: "approved" })],
      REVIEWS_UNAVAILABLE,
    ),
  });

const handBack = (entityId: string, updatedAt?: string) =>
  makeWorkItem({
    entityId,
    title: `Hand back ${entityId}`,
    labels: ["hand-back"],
    ...(updatedAt === undefined ? {} : { updatedAt }),
  });

const futureAgeFacts = () =>
  baseFacts({ tracker: workItemRead([handBack("GH-104", "2026-12-01T00:00:00Z")]) });

const absentAgeFacts = () => baseFacts({ tracker: workItemRead([handBack("GH-102")]) });

/** A world whose single approved ready line exceeds the 4096-byte human bound. */
const overBoundFacts = () =>
  baseFacts({
    changes: approved(8, (index) => `PR-${index}-${"X".repeat(600)}`),
  });

const humanLines = (text: string): number =>
  text.split("\n").filter((line) => line.length > 0).length;

const exceedsHumanBound = (text: string): boolean =>
  humanLines(text) > STATUS_MAX_HUMAN_LINES ||
  Buffer.byteLength(text, "utf8") > STATUS_MAX_HUMAN_BYTES;

const surface = (payload: BriefPayload, id: string): BriefPayload["surfaces"][number] | undefined =>
  payload.surfaces.find((entry) => entry.id === id);

const anchorItems = (
  payload: BriefPayload,
  group: BriefPayload["anchors"][number]["group"],
): BriefPayload["anchors"][number]["items"] =>
  payload.anchors.find((entry) => entry.group === group)?.items ?? [];

const ownerAgeEvidence = (payload: BriefPayload, index: number) => {
  const evidence = anchorItems(payload, "owner-gate-ages")[index]?.evidence;
  return evidence?.kind === "owner-hand-back" ? evidence : undefined;
};

export const briefSourceMutations: readonly BriefSourceMutation[] = [
  {
    id: "fabricated-surface-state",
    caseName: "brief-mutant-fabricated-surface-state",
    ac: "AC-F1-1",
    intendedSuite: "tests/behaviour/brief-shared-truth.test.ts (TC-BRIEF-004)",
    prohibited: "a tenth surface appears beside the closed nine-surface set",
    mutate: (source) =>
      replaceOnce(
        source,
        "const surfaces = buildSurfaces(digest);",
        'const surfaces = [...buildSurfaces(digest), { id: "tenth-surface", title: "Extra", state: "observed", counts: { observed: 1, unknown: 0, total: 1, omitted: 0 }, truncated: false }];',
      ),
    fires: (module) => module.projectBrief(baseFacts()).surfaces.length !== 9,
  },
  {
    id: "brief-only-fact",
    caseName: "brief-mutant-brief-only-fact",
    ac: "AC-F1-1",
    intendedSuite: "tests/behaviour/brief-shared-truth.test.ts (TC-BRIEF-004)",
    prohibited: "the payload carries a brief-only fact the digest cannot derive",
    mutate: (source) =>
      replaceOnce(
        source,
        "    schemaVersion: BRIEF_SCHEMA_VERSION,",
        "    schemaVersion: BRIEF_SCHEMA_VERSION,\n    briefOnly: true,",
      ),
    fires: (module) => Object.hasOwn(module.projectBrief(baseFacts()), "briefOnly") === true,
  },
  {
    id: "surface-state-mapping",
    caseName: "brief-mutant-surface-state-mapping",
    ac: "AC-F4-1",
    intendedSuite: "tests/behaviour/brief-negative-controls.test.ts (TC-BRIEF-010)",
    prohibited: "a degraded digest section renders as an observed surface",
    mutate: (source) => replaceOnce(source, "    state: section.state,", '    state: "observed",'),
    fires: (module) =>
      surface(
        module.projectBrief(baseFacts({ changes: failedDeliveryRequestRead() })),
        "changes-and-prs",
      )?.state === "observed",
  },
  {
    id: "review-signal-predicate",
    caseName: "brief-mutant-ready-from-unknown-review",
    ac: "AC-F2-1",
    intendedSuite: "tests/behaviour/brief-anchors.test.ts (TC-BRIEF-007)",
    prohibited: "an unknown item review signal produces a ready-to-merge action",
    mutate: (source) =>
      replaceOnce(source, 'item.reviewState === "observed",', 'item.reviewState !== "impossible",'),
    fires: (module) =>
      anchorItems(module.projectBrief(unknownReviewFacts()), "ready-to-merge").length > 0,
  },
  {
    id: "age-future-guard",
    caseName: "brief-mutant-future-timestamp-age",
    ac: "AC-F2-2",
    intendedSuite: "tests/behaviour/brief-anchors.test.ts (TC-BRIEF-008)",
    prohibited: "a future timestamp derives a negative age instead of unknown",
    mutate: (source) =>
      replaceOnce(
        source,
        'if (!Number.isFinite(parsed) || parsed > nowMs) return { state: "unknown" };',
        'if (!Number.isFinite(parsed)) return { state: "unknown" };',
      ),
    fires: (module) =>
      ownerAgeEvidence(module.projectBrief(futureAgeFacts()), 0)?.ageState === "observed",
  },
  {
    id: "unknown-as-zero-age",
    caseName: "brief-mutant-unknown-as-zero-age",
    ac: "AC-F2-2",
    intendedSuite: "tests/behaviour/brief-anchors.test.ts (TC-BRIEF-008)",
    prohibited: "an absent timestamp defaults to age zero instead of unknown",
    mutate: (source) =>
      replaceOnce(
        source,
        'if (updatedAt === undefined) return { state: "unknown" };',
        'if (updatedAt === undefined) return { state: "observed", days: 0 };',
      ),
    fires: (module) => {
      const evidence = ownerAgeEvidence(module.projectBrief(absentAgeFacts()), 0);
      return evidence?.ageState === "observed" && evidence.ageDays === 0;
    },
  },
  {
    id: "placeholder-as-observed",
    caseName: "brief-mutant-placeholder-as-observed",
    ac: "AC-F3-1",
    intendedSuite: "tests/behaviour/brief-placeholders.test.ts (TC-BRIEF-009)",
    prohibited: "a placeholder surface renders as observed",
    mutate: (source) => replaceOnce(source, "  state: entry.state,", '  state: "observed",'),
    fires: (module) =>
      surface(module.projectBrief(baseFacts()), "typed-questions")?.state !== "not-delivered",
  },
  {
    id: "fourth-catalog-entry",
    caseName: "brief-mutant-fourth-catalog-entry",
    ac: "AC-F3-1",
    intendedSuite: "tests/behaviour/brief-placeholders.test.ts (TC-BRIEF-009)",
    prohibited: "the closed three-entry catalog grows a fourth entry",
    mutate: (source) =>
      replaceOnce(
        source,
        "    placeholders: BRIEF_PLACEHOLDER_CATALOG,",
        '    placeholders: [...BRIEF_PLACEHOLDER_CATALOG, { capability: "spend", owningStory: "M1-S19", state: "not-delivered" } as never],',
      ),
    fires: (module) => module.projectBrief(baseFacts()).placeholders.length !== 3,
  },
  {
    id: "unavailability-throws",
    caseName: "brief-mutant-exit-one-on-unavailability",
    ac: "AC-F5-1",
    intendedSuite: "tests/behaviour/brief-envelope.test.ts (TC-BRIEF-011/012)",
    prohibited: "collector unavailability becomes a failure instead of digest data at exit 0",
    mutate: (source) =>
      replaceOnce(
        source,
        "  const digest = aggregateStatus(facts);",
        '  const digest = aggregateStatus(facts);\n  if (!facts.changes.ok) throw new Error("status.collector.github.unavailable");',
      ),
    fires: (module) => {
      try {
        module.projectBrief(baseFacts({ changes: failedDeliveryRequestRead() }));
        return false;
      } catch (error: unknown) {
        return error instanceof Error && error.message.includes("status.collector.");
      }
    },
  },
  {
    id: "unbounded-renderer",
    caseName: "brief-mutant-unbounded-renderer",
    ac: "AC-F1-2",
    intendedSuite: "tests/behaviour/brief-output.test.ts (TC-BRIEF-006)",
    prohibited: "the renderer emits beyond the one-screen bound without dropping",
    mutate: (source) =>
      replaceOnce(source, "    if (kept.length === 0) break;", "    if (true) break;"),
    fires: (module) =>
      exceedsHumanBound(
        module.renderBriefHuman(module.projectBrief(overBoundFacts()), SYNTHETIC_BRAND),
      ),
  },
  {
    id: "date-now-renderer",
    caseName: "brief-mutant-date-now-renderer",
    ac: "AC-F6-1",
    intendedSuite: "tests/behaviour/brief-determinism.test.ts (TC-BRIEF-017)",
    prohibited: "the human renderer emits a wall-clock epoch timestamp",
    mutate: (source) =>
      replaceOnce(
        source,
        "  const lines: string[] = [",
        "  const lines: string[] = [String(Date.now()),",
      ),
    fires: (module) =>
      /(?:^|\D)1\d{12}(?:\D|$)/.test(
        module.renderBriefHuman(module.projectBrief(baseFacts()), SYNTHETIC_BRAND),
      ),
  },
];

/**
 * Guards that no `domain/brief.ts` source mutation can express: the capability
 * scans, the store/child-process fences, and the redaction chokepoint. Each
 * entry names the live seeded control that proves the guard, verified by the
 * meta-check against the current tree.
 */
export const briefSeededControls: readonly BriefSeededControl[] = [
  {
    id: "model-network-import-control",
    ac: "AC-F6-2",
    file: "tests/structure/brief-imports.test.ts",
    testName: "seeded model, network, and fetch controls fail by name",
    proves: "node:http, openai, and fetch probes are rejected by name",
  },
  {
    id: "render-path-capability-scan",
    ac: "AC-F6-2",
    file: "tests/structure/brief-imports.test.ts",
    testName: "the render path has no model or network capability",
    proves: "a non-empty render-path scan finds no model/network/fetch capability",
  },
  {
    id: "store-write-control",
    ac: "AC-F6-3",
    file: "tests/behaviour/brief-readonly.test.ts",
    testName: "the guarded store observes reads and no mutation or fence call",
    proves: "the guarded store records reads only and throws on a deliberate fence",
  },
  {
    id: "child-process-scan",
    ac: "AC-F6-3",
    file: "tests/behaviour/brief-readonly.test.ts",
    testName: "no brief module contains a child-process capability",
    proves: "a non-empty module scan finds no child-process token",
  },
  {
    id: "redaction-chokepoint-control",
    ac: "AC-F6-3",
    file: "tests/behaviour/brief-readonly.test.ts",
    testName: "the write chokepoint redacts a planted canary in human text",
    proves: "the single writeOutput path redacts human text",
  },
  {
    id: "brief-end-to-end-redaction",
    ac: "AC-F6-3",
    file: "tests/golden/redaction.test.ts",
    testName: "a canary planted in a rendered identity never reaches either stream",
    proves: "a canary reachable through the projection is redacted on both streams",
  },
];
