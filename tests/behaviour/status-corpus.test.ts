/**
 * TC-STATUS-030 — the committed corpus drives every section and state edge with
 * zero live calls, expected states/reasons/counts/ordered ids/truncation, and a
 * completeness meta-check covering AC-F9-1 and the section state matrix.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  StatusCounts,
  StatusFacts,
  StatusSection,
  StatusSectionId,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import {
  activeChange,
  baseFacts,
  capSizedFacts,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  GITHUB_SLICE_AVAILABILITY,
  localContext,
  malformedLocalContext,
  missingLocalContext,
  parkView,
  providerConfig,
  providerConfigRead,
  providers,
  repository,
  unavailableBinding,
  workItemRead,
} from "../fixtures/status/harness";
import { installThrowingFetchGuard } from "./providers/support";

const ROOT = process.cwd();
const CORPUS = "tests/fixtures/status/corpus";

type ExpectedSection = {
  readonly state: string;
  readonly reasons: readonly string[];
  readonly counts: StatusCounts;
  readonly orderedIds: readonly string[];
  readonly truncated: boolean;
};

type CorpusCase = {
  readonly name: string;
  readonly scenario: string;
  readonly controls?: readonly string[];
  readonly expected: {
    readonly sections: Record<string, ExpectedSection>;
  };
};

const loadCases = (): CorpusCase[] =>
  readdirSync(join(ROOT, CORPUS), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const parsed: unknown = JSON.parse(
        readFileSync(join(ROOT, CORPUS, entry.name, "case.json"), "utf8"),
      );
      return parsed as CorpusCase;
    })
    .sort((left, right) => left.name.localeCompare(right.name));

const noChain = () =>
  providerConfigRead(providerConfig({ defaultChain: undefined, chains: {}, entries: {} }));

const unresolvedChain = () =>
  providerConfigRead(
    providerConfig({
      defaultChain: "ghost",
      entries: { primary: { name: "primary", class: "subscription", enabled: true } },
      chains: {
        primary: { name: "primary", entries: ["primary"], allowPaidFallback: false },
      },
    }),
  );

const factsFor = (scenario: string): StatusFacts => {
  switch (scenario) {
    case "fully-observed":
      return capSizedFacts();
    case "tracker-degraded-github":
      return baseFacts({ tracker: workItemRead([], GITHUB_SLICE_AVAILABILITY) });
    case "failed-reads-degraded":
      return baseFacts({
        tracker: failedWorkItemRead("read-failed"),
        changes: failedDeliveryRequestRead("read-failed"),
        ci: failedPipelineRunRead("read-failed"),
        localContext: localContext({ activeChange: activeChange() }),
        providers: providers({ config: noChain() }),
      });
    case "missing-context-unavailable":
      return baseFacts({
        localContext: missingLocalContext(),
        providers: providers({ config: noChain() }),
      });
    case "active-park-observed":
      return baseFacts({
        providers: providers({
          config: providerConfigRead(providerConfig()),
          parks: { ok: true, parks: [parkView()] },
        }),
      });
    case "missing-credential-unknown":
      return baseFacts({
        tracker: failedWorkItemRead("credential-unavailable"),
        changes: failedDeliveryRequestRead("credential-unavailable"),
        ci: failedPipelineRunRead("credential-unavailable"),
        localContext: localContext({ activeChange: activeChange() }),
      });
    case "unresolved-sha-unknown":
      return baseFacts({ repository: repository({ head: { detached: true } }) });
    case "unresolved-binding-unavailable":
      return baseFacts({
        repository: repository({ binding: unavailableBinding() }),
        localContext: missingLocalContext(),
      });
    case "torn-park-degraded":
      return baseFacts({
        providers: providers({
          parks: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
        }),
      });
    case "unresolved-chain-unknown":
      return baseFacts({ providers: providers({ config: unresolvedChain() }) });
    case "malformed-context-unknown":
      return baseFacts({ localContext: malformedLocalContext() });
    case "changes-unknown-pr-failed":
      return baseFacts({
        changes: failedDeliveryRequestRead("read-failed"),
        localContext: missingLocalContext(),
      });
    default:
      throw new Error(`unknown corpus scenario ${scenario}`);
  }
};

const orderedIds = (section: StatusSection): readonly string[] => {
  switch (section.id) {
    case "tracker":
      return (section.families ?? []).flatMap((family) =>
        family.items.map((item) => `${family.family}:${item.workItemRef}`),
      );
    case "changes-and-prs":
      return (section.pullRequests ?? []).map((item) => item.entityId);
    case "ci":
      return (section.runs ?? []).map((run) => run.identity.entityId);
    case "lanes-or-queue":
      return [];
    case "providers":
      return [
        ...(section.entries ?? []).map((entry) => `entry:${entry.name}`),
        ...(section.parks ?? []).map((park) => `park:${park.name}`),
      ];
    case "parked-work":
      return (section.items ?? []).map((item) => item.workItemRef ?? "(unknown)");
    default:
      return [];
  }
};

const failuresFor = (cases: readonly CorpusCase[]): string[] => {
  const failures: string[] = [];
  for (const testCase of cases) {
    const digest = aggregateStatus(factsFor(testCase.scenario));
    for (const [id, expected] of Object.entries(testCase.expected.sections)) {
      const section = digest.sections.find((entry) => entry.id === id);
      if (section === undefined) {
        failures.push(`${testCase.name}: missing section ${id}`);
        continue;
      }
      if (section.state !== expected.state) {
        failures.push(`${testCase.name}: ${id} ${section.state} != ${expected.state}`);
      }
      for (const reason of expected.reasons) {
        if (!section.evidence.reasons.includes(reason as never)) {
          failures.push(`${testCase.name}: ${id} missing reason ${reason}`);
        }
      }
      for (const [field, expectedValue] of Object.entries(expected.counts)) {
        const actual = section.counts[field as keyof StatusCounts];
        if (actual !== expectedValue) {
          failures.push(`${testCase.name}: ${id} counts.${field} ${actual} != ${expectedValue}`);
        }
      }
      const actualIds = orderedIds(section);
      if (JSON.stringify(actualIds) !== JSON.stringify(expected.orderedIds)) {
        failures.push(
          `${testCase.name}: ${id} ordered ids ${JSON.stringify(actualIds)} != ${JSON.stringify(expected.orderedIds)}`,
        );
      }
      if (section.truncated !== expected.truncated) {
        failures.push(
          `${testCase.name}: ${id} truncated ${section.truncated} != ${expected.truncated}`,
        );
      }
    }
  }
  return failures;
};

const SECTION_STATE_MATRIX: Readonly<Record<StatusSectionId, readonly string[]>> = {
  tracker: ["observed", "degraded", "unknown", "unavailable"],
  "changes-and-prs": ["observed", "degraded", "unknown", "unavailable"],
  ci: ["observed", "unknown", "unavailable"],
  "lanes-or-queue": ["not-delivered"],
  providers: ["observed", "degraded", "unknown", "unavailable"],
  "parked-work": ["observed", "unknown", "unavailable"],
};

const REQUIRED_CONTROLS = [
  "failed issues read",
  "failed PR read",
  "failed check-runs read",
  "missing credential",
  "unresolved SHA",
  "unresolved repository binding",
  "torn park store",
  "missing provider chain",
  "missing PM context",
  "active provider park",
];

const completenessFailures = (cases: readonly CorpusCase[]): string[] => {
  const failures: string[] = [];
  const states = new Set<string>();
  const seenBySection = new Map<string, Set<string>>();
  const controls = new Set<string>();
  for (const id of Object.keys(SECTION_STATE_MATRIX)) seenBySection.set(id, new Set());
  for (const testCase of cases) {
    for (const control of testCase.controls ?? []) controls.add(control);
    for (const [id, expected] of Object.entries(testCase.expected.sections)) {
      const stateSet = seenBySection.get(id);
      if (stateSet === undefined) {
        failures.push(`corpus has unknown section ${id}`);
        continue;
      }
      stateSet.add(expected.state);
      states.add(expected.state);
      if (!Array.isArray(expected.reasons)) {
        failures.push(`${testCase.name}: ${id} has no reasons`);
      }
      if (!Array.isArray(expected.orderedIds)) {
        failures.push(`${testCase.name}: ${id} has no ordered ids`);
      }
      if (typeof expected.truncated !== "boolean") {
        failures.push(`${testCase.name}: ${id} has no truncated flag`);
      }
      if (expected.counts === undefined) {
        failures.push(`${testCase.name}: ${id} has no counts`);
      }
    }
    for (const id of Object.keys(SECTION_STATE_MATRIX)) {
      if (testCase.expected.sections[id] === undefined) {
        failures.push(`${testCase.name}: missing section ${id}`);
      }
    }
  }
  for (const required of ["observed", "degraded", "unknown", "unavailable", "not-delivered"]) {
    if (!states.has(required)) failures.push(`corpus has no ${required} state`);
  }
  for (const [id, requiredStates] of Object.entries(SECTION_STATE_MATRIX)) {
    const seen = seenBySection.get(id) ?? new Set<string>();
    for (const required of requiredStates) {
      if (!seen.has(required)) failures.push(`corpus has no ${id} ${required} state`);
    }
  }
  for (const control of REQUIRED_CONTROLS) {
    if (!controls.has(control)) failures.push(`corpus has no AC-F9-1 control: ${control}`);
  }
  return failures;
};

describe("TC-STATUS-030 committed corpus", () => {
  test("every case produces the expected states, reasons, counts, ids, and truncation", () => {
    const cases = loadCases();
    const guard = installThrowingFetchGuard();
    try {
      expect(cases.length).toBeGreaterThan(0);
      expect(failuresFor(cases)).toEqual([]);
      expect(completenessFailures(cases)).toEqual([]);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("every case is deterministic across two aggregations", () => {
    for (const testCase of loadCases()) {
      const first = JSON.stringify(aggregateStatus(factsFor(testCase.scenario)));
      const second = JSON.stringify(aggregateStatus(factsFor(testCase.scenario)));
      expect(second).toBe(first);
    }
  });

  test("a corrupted expected state fails by case name", () => {
    const cases = loadCases();
    const first = cases[0];
    if (first === undefined) throw new Error("corpus is empty");
    const tracker = first.expected.sections.tracker;
    if (tracker === undefined) throw new Error("corpus case has no tracker section");
    const corrupted: CorpusCase = {
      ...first,
      expected: {
        ...first.expected,
        sections: {
          ...first.expected.sections,
          tracker: { ...tracker, state: "clear" },
        },
      },
    };
    expect(failuresFor([corrupted]).some((line) => line.startsWith(first.name))).toBe(true);
  });

  test("a corrupted count, id, or truncation flag fails by case name", () => {
    const cases = loadCases();
    const first = cases[0];
    if (first === undefined) throw new Error("corpus is empty");
    const tracker = first.expected.sections.tracker;
    const ci = first.expected.sections.ci;
    if (tracker === undefined) throw new Error("corpus case has no tracker section");
    if (ci === undefined) throw new Error("corpus case has no ci section");
    const mutations: CorpusCase[] = [
      {
        ...first,
        expected: {
          ...first.expected,
          sections: {
            ...first.expected.sections,
            tracker: { ...tracker, counts: { ...tracker.counts, total: tracker.counts.total + 1 } },
          },
        },
      },
      {
        ...first,
        expected: {
          ...first.expected,
          sections: {
            ...first.expected.sections,
            tracker: { ...tracker, orderedIds: ["planted-wrong-id"] },
          },
        },
      },
      {
        ...first,
        expected: {
          ...first.expected,
          sections: {
            ...first.expected.sections,
            ci: { ...ci, truncated: true },
          },
        },
      },
    ];
    for (const mutation of mutations) {
      expect(failuresFor([mutation]).some((line) => line.startsWith(first.name))).toBe(true);
    }
  });

  test("removing all cases fails the completeness meta-check", () => {
    expect(completenessFailures([]).length).toBeGreaterThan(0);
  });

  test("the corpus files are read-only inputs (no writes are attempted)", () => {
    const before = readFileSync(join(ROOT, CORPUS, "fully-observed", "case.json"), "utf8");
    aggregateStatus(factsFor("fully-observed"));
    expect(readFileSync(join(ROOT, CORPUS, "fully-observed", "case.json"), "utf8")).toBe(before);
  });
});
