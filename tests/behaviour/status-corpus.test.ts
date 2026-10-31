/**
 * TC-STATUS-030 — the committed corpus drives every section and state edge with
 * zero live calls, expected states/reasons, deterministic bytes, and a
 * completeness meta-check.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { StatusFacts, StatusSectionId } from "../../packages/core/src/contracts/index";
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
  missingLocalContext,
  parkView,
  providerConfig,
  providerConfigRead,
  providers,
  workItemRead,
} from "../fixtures/status/harness";
import { installThrowingFetchGuard } from "./providers/support";

const ROOT = process.cwd();
const CORPUS = "tests/fixtures/status/corpus";

type CorpusCase = {
  readonly name: string;
  readonly scenario: string;
  readonly expected: {
    readonly states: Record<string, string>;
    readonly reasons: Record<string, readonly string[]>;
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
    case "active-park":
      return baseFacts({
        providers: providers({
          config: providerConfigRead(providerConfig()),
          parks: { ok: true, parks: [parkView()] },
        }),
      });
    default:
      throw new Error(`unknown corpus scenario ${scenario}`);
  }
};

const failuresFor = (cases: readonly CorpusCase[]): string[] => {
  const failures: string[] = [];
  for (const testCase of cases) {
    const digest = aggregateStatus(factsFor(testCase.scenario));
    for (const [id, state] of Object.entries(testCase.expected.states)) {
      const section = digest.sections.find((entry) => entry.id === id);
      if (section === undefined) {
        failures.push(`${testCase.name}: missing section ${id}`);
        continue;
      }
      if (section.state !== state)
        failures.push(`${testCase.name}: ${id} ${section.state} != ${state}`);
      for (const reason of testCase.expected.reasons[id] ?? []) {
        if (!section.evidence.reasons.includes(reason as never)) {
          failures.push(`${testCase.name}: ${id} missing reason ${reason}`);
        }
      }
    }
  }
  return failures;
};

const completenessFailures = (cases: readonly CorpusCase[]): string[] => {
  const failures: string[] = [];
  const states = new Set<string>();
  const sections = new Set<string>();
  for (const testCase of cases) {
    for (const [id, state] of Object.entries(testCase.expected.states)) {
      sections.add(id);
      states.add(state);
    }
  }
  for (const required of ["observed", "degraded", "unknown", "unavailable", "not-delivered"]) {
    if (!states.has(required)) failures.push(`corpus has no ${required} state`);
  }
  for (const id of [
    "tracker",
    "changes-and-prs",
    "ci",
    "lanes-or-queue",
    "providers",
    "parked-work",
  ] as StatusSectionId[]) {
    if (!sections.has(id)) failures.push(`corpus has no section ${id}`);
  }
  return failures;
};

describe("TC-STATUS-030 committed corpus", () => {
  test("every case produces the expected states and reasons with zero live calls", () => {
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
    const corrupted: CorpusCase = {
      ...first,
      expected: { ...first.expected, states: { ...first.expected.states, tracker: "clear" } },
    };
    expect(failuresFor([corrupted]).some((line) => line.startsWith(first.name))).toBe(true);
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
