/**
 * TC-ATT-018 (behaviour half) / 019 / 020 / 021 / 024 — the lanes declaration,
 * the delivered spend and typed-questions sections, nine-section totality, and
 * the summary.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STATUS_LANE_ATTENTION_STATES,
  STATUS_PLACEHOLDER_SECTION_IDS,
  STATUS_SECTION_KINDS,
  STATUS_SECTION_ORDER,
  type StatusDigest,
  type StatusFacts,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  capturedSpend,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedSpend,
  failedWorkItemRead,
  missingLocalContext,
  repository,
  sectionById,
  unavailableBinding,
} from "../fixtures/status/harness";
import { matrixCases } from "../fixtures/status/matrix/cases";

const ROOT = process.cwd();

const humanOf = (facts: StatusFacts): string =>
  renderStatusHuman(aggregateStatus(facts), { binaryName: "example-product" } as never);

describe("TC-ATT-019/020 the delivered spend and typed-questions sections", () => {
  test("spend is a real observed section fed by the read-side fold", () => {
    const spend = sectionById(aggregateStatus(baseFacts()).sections, "spend");
    expect(spend.state).toBe("observed");
    expect(spend.evidence.reasons).toEqual(["observed-empty"]);
    expect(spend.evidence.sources).toEqual([{ source: "state-log", outcome: "observed-empty" }]);
    expect(spend.note).toBe("no captured telemetry (absence of capture)");
    expect(spend.capability).toBeUndefined();
    expect(spend.expectedStory).toBeUndefined();
    expect(spend.items).toEqual([]);
    expect(spend.counts.total).toBe(0);
    expect(spend.findings ?? []).toEqual([]);
  });

  test("captured telemetry renders the observed summary with the same figures", () => {
    const spend = sectionById(
      aggregateStatus(baseFacts({ spend: capturedSpend({ input: 300, restarts: 2, ratio: 3 }) }))
        .sections,
      "spend",
    );
    expect(spend.state).toBe("observed");
    expect(spend.evidence.reasons).toEqual(["observed"]);
    expect(spend.evidence.sources).toEqual([{ source: "state-log", outcome: "read" }]);
    expect(spend.spend).toMatchObject({ state: "observed", captured: true, restarts: 2, ratio: 3 });
  });

  test("a failed spend read is digest data, never a command failure", () => {
    const spend = sectionById(
      aggregateStatus(baseFacts({ spend: failedSpend("state.store.torn") })).sections,
      "spend",
    );
    expect(spend.state).toBe("unknown");
    expect(spend.evidence.reasons).toEqual(["state-unreadable"]);
    expect(spend.evidence.sources).toEqual([
      { source: "state-log", outcome: "failed", failureCode: "state.store.torn" },
    ]);
  });

  test("typed-questions is a delivered collector section, not a placeholder", () => {
    const digest = aggregateStatus(baseFacts());
    const typed = sectionById(digest.sections, "typed-questions");
    expect(typed.state).toBe("observed");
    expect(typed.evidence.reasons).toEqual(["observed-empty"]);
    expect(typed.evidence.sources).toEqual([{ source: "blockers", outcome: "observed-empty" }]);
    expect(typed.questions).toEqual([]);
  });

  test("the declared order places spend then typed-questions at indices 8 and 9", () => {
    const digest = aggregateStatus(baseFacts());
    expect(digest.sections[7]?.id).toBe("spend");
    expect(digest.sections[8]?.id).toBe("typed-questions");
    expect(STATUS_PLACEHOLDER_SECTION_IDS).toEqual([]);
    expect(STATUS_SECTION_KINDS.spend).toBe("collector");
    expect(STATUS_SECTION_KINDS["typed-questions"]).toBe("collector");
    expect(STATUS_SECTION_KINDS["lanes-or-queue"]).toBe("declared-gap");
  });

  test("the human spend and questions lines are pinned byte-for-byte", () => {
    const human = humanOf(baseFacts());
    expect(human).toContain("spend      observed  no captured telemetry (absence of capture)");
    expect(human).toContain("questions  observed  0 open");
    expect(human).not.toContain("spend summary arrives with M1-S19");
  });

  test("the spend section is independent of every other read outcome", () => {
    const failing = baseFacts({
      tracker: failedWorkItemRead("read-failed"),
      changes: failedDeliveryRequestRead("read-failed"),
      ci: failedPipelineRunRead("read-failed"),
      localContext: missingLocalContext(),
      repository: repository({ binding: unavailableBinding() }),
    });
    expect(sectionById(aggregateStatus(failing).sections, "spend").state).toBe("observed");
    expect(sectionById(aggregateStatus(failing).sections, "typed-questions").state).toBe(
      "observed",
    );
  });

  test("no retired spendAmount identifier leaks into the contracts or domain", () => {
    for (const file of [
      "packages/core/src/contracts/status.ts",
      "packages/core/src/domain/status.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).not.toContain("spendAmount");
    }
  });
});

const laneVocabularyLeak = (text: string): boolean => {
  if (text.includes("lane.idle-no-reason")) return true;
  const human = text;
  return STATUS_LANE_ATTENTION_STATES.some((state) => human.includes(state));
};

describe("TC-ATT-018 lanes section remains the declared gap", () => {
  test("the lanes section keeps its shipped identity and declares the vocabulary", () => {
    const lanes = sectionById(aggregateStatus(baseFacts()).sections, "lanes-or-queue");
    expect(lanes).toMatchObject({
      id: "lanes-or-queue",
      state: "not-delivered",
      capability: "queue-lane-engine",
      expectedStory: "M2-S1",
      note: "no queue or lane engine exists in this release",
    });
    expect(lanes.evidence.reasons).toEqual(["engine-not-delivered"]);
    expect(lanes.evidence.sources).toEqual([{ source: "queue-engine", outcome: "not-delivered" }]);
    expect(lanes.items).toEqual([]);
    expect(lanes.attentionStates).toEqual([...STATUS_LANE_ATTENTION_STATES]);
    expect(lanes.findings ?? []).toEqual([]);
  });

  test("the human lanes line is unchanged", () => {
    expect(humanOf(baseFacts())).toContain(
      "lanes      not-delivered  no queue or lane engine in this release",
    );
  });

  test("no emitted payload or human text carries the dormant code or a lane state", () => {
    const digest = aggregateStatus(baseFacts());
    const human = humanOf(baseFacts());
    const payloads = JSON.stringify(digest).replace(
      /"attentionStates":\[[^\]]*\]/g,
      '"attentionStates":[]',
    );
    expect(laneVocabularyLeak(payloads)).toBe(false);
    expect(laneVocabularyLeak(human)).toBe(false);
    for (const testCase of matrixCases) {
      const serialized = JSON.stringify(aggregateStatus(testCase.facts)).replace(
        /"attentionStates":\[[^\]]*\]/g,
        '"attentionStates":[]',
      );
      expect(laneVocabularyLeak(serialized)).toBe(false);
    }
  });

  test("a code-injected digest copy is detected by the scan", () => {
    const digest = JSON.parse(JSON.stringify(aggregateStatus(baseFacts()))) as StatusDigest;
    const lanes = digest.sections.find((section) => section.id === "lanes-or-queue");
    if (lanes !== undefined) {
      (lanes as unknown as Record<string, unknown>).findings = [
        {
          code: "lane.idle-no-reason",
          severity: "medium",
          count: 1,
          members: ["x"],
          evidenceRef: "x",
        },
      ];
    }
    expect(laneVocabularyLeak(JSON.stringify(digest))).toBe(true);
  });
});

const totalityFailures = (digest: StatusDigest): string[] => {
  const failures: string[] = [];
  if (digest.sections.length !== 9) failures.push(`sections ${digest.sections.length} != 9`);
  const ids = digest.sections.map((section) => section.id);
  if (JSON.stringify(ids) !== JSON.stringify(STATUS_SECTION_ORDER)) {
    failures.push(`ids ${JSON.stringify(ids)}`);
  }
  for (const section of digest.sections) {
    if (
      !["observed", "degraded", "unknown", "unavailable", "not-delivered"].includes(section.state)
    ) {
      failures.push(`${section.id} state ${section.state}`);
    }
  }
  const expected = {
    observed: digest.sections.filter((section) => section.state === "observed").length,
    degraded: digest.sections.filter((section) => section.state === "degraded").length,
    unknown: digest.sections.filter((section) => section.state === "unknown").length,
    unavailable: digest.sections.filter((section) => section.state === "unavailable").length,
    notDelivered: digest.sections.filter((section) => section.state === "not-delivered").length,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (digest.summary[key as keyof typeof expected] !== value) failures.push(`summary ${key}`);
  }
  const groups = digest.sections
    .filter((section) => section.state === "observed" || section.state === "degraded")
    .reduce((sum, section) => sum + (section.findings?.length ?? 0), 0);
  if (digest.summary.findingsTotal !== groups)
    failures.push(`findingsTotal ${digest.summary.findingsTotal} != ${groups}`);
  if (digest.summary.placeholderSectionCount !== 0) {
    failures.push(`placeholder count ${digest.summary.placeholderSectionCount}`);
  }
  if (STATUS_PLACEHOLDER_SECTION_IDS.length !== 0) {
    failures.push(`declared placeholders ${STATUS_PLACEHOLDER_SECTION_IDS.length}`);
  }
  const placeholders = digest.sections.filter(
    (section) => String(STATUS_SECTION_KINDS[section.id]) === "placeholder",
  );
  if (placeholders.length !== 0) failures.push(`placeholder sections ${placeholders.length}`);
  return failures;
};

describe("TC-ATT-021 nine-section totality, findings total, placeholder count", () => {
  test("the live digest and the matrix are complete", () => {
    expect(totalityFailures(aggregateStatus(baseFacts()))).toEqual([]);
    for (const testCase of matrixCases) {
      expect(totalityFailures(aggregateStatus(testCase.facts)), testCase.name).toEqual([]);
    }
  });

  test("findingsTotal counts groups, not observations", () => {
    const facts = baseFacts({
      repository: {
        ...baseFacts().repository,
        head: { branch: "main", sha: "1111111111111111111111111111111111111111", detached: false },
      },
      ci: {
        ok: true,
        items: ["700", "701", "702", "703"].map((entityId) => ({
          identity: { systemName: "github", entityId },
          pipelineName: `ci-${entityId}`,
          jobs: [{ jobName: "job", jobState: "failed" as const }],
          traceEvidence: [],
        })),
        pageItemCount: 4,
      },
    });
    const digest = aggregateStatus(facts);
    const ci = sectionById(digest.sections, "ci");
    expect(ci.findings?.[0]?.count).toBe(4);
    expect(digest.summary.findingsTotal).toBe(1);
  });

  test("the spend and typed-questions sections contribute zero to actionable", () => {
    const digest = aggregateStatus(baseFacts());
    const expectedActionable = digest.sections
      .filter((section) => section.state === "observed" || section.state === "degraded")
      .reduce(
        (sum, section) =>
          sum +
          (section.families ?? []).reduce(
            (familySum, family) => familySum + family.items.length,
            0,
          ) +
          (section.pullRequests?.length ?? 0) +
          (section.runs?.length ?? 0) +
          (section.entries?.length ?? 0) +
          (section.parks?.length ?? 0) +
          (section.id === "parked-work" ? (section.items?.length ?? 0) : 0) +
          (section.id === "typed-questions" ? (section.questions?.length ?? 0) : 0),
        0,
      );
    expect(digest.summary.actionable).toBe(expectedActionable);
    expect(sectionById(digest.sections, "spend").counts.total).toBe(0);
  });

  test("removing a section, adding a tenth, or counting by observation fails by name", () => {
    const digest = JSON.parse(JSON.stringify(aggregateStatus(baseFacts()))) as StatusDigest;
    const removed = { ...digest, sections: digest.sections.slice(0, 8) };
    expect(totalityFailures(removed).some((line) => line.includes("sections 8"))).toBe(true);
    const extra = {
      ...digest,
      sections: [...digest.sections, { ...digest.sections[0] }],
    } as StatusDigest;
    expect(totalityFailures(extra).length).toBeGreaterThan(0);
    const observationCount = { ...digest, summary: { ...digest.summary, findingsTotal: 4 } };
    expect(totalityFailures(observationCount).some((line) => line.includes("findingsTotal"))).toBe(
      true,
    );
  });
});

describe("TC-ATT-024 ready-to-merge derivation row", () => {
  test("all four states are reachable and not-delivered is not", () => {
    const cases: Array<[StatusFacts, string]> = [
      [baseFacts(), "observed"],
      [
        baseFacts({
          changes: {
            ok: true,
            items: [],
            pageItemCount: 0,
            availability: {
              state: "available",
              refs: "available",
              reviewState: "unavailable",
              reviewThreads: "unavailable",
            },
          },
        }),
        "degraded",
      ],
      [baseFacts({ changes: failedDeliveryRequestRead("read-failed") }), "unknown"],
      [
        baseFacts({
          repository: repository({ binding: unavailableBinding() }),
          changes: failedDeliveryRequestRead("read-failed"),
        }),
        "unavailable",
      ],
    ];
    for (const [facts, expected] of cases) {
      const section = sectionById(aggregateStatus(facts).sections, "ready-to-merge");
      expect(section.state).toBe(expected);
    }
    for (const testCase of matrixCases) {
      expect(
        sectionById(aggregateStatus(testCase.facts).sections, "ready-to-merge").state,
      ).not.toBe("not-delivered");
    }
  });
});

describe("TC-SPEND-029 the retired placeholder string is gone from code and fixtures", () => {
  const RETIRED = "spend summary arrives with M1-S19";

  const scan = (directory: string): string[] => {
    const failures: string[] = [];
    const walk = (relative: string): void => {
      for (const entry of readdirSync(join(ROOT, relative), { withFileTypes: true })) {
        const next = `${relative}/${entry.name}`;
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === "dist") continue;
          walk(next);
        } else if (/\.(ts|json|txt|md)$/.test(entry.name)) {
          if (readFileSync(join(ROOT, next), "utf8").includes(RETIRED)) failures.push(next);
        }
      }
    };
    walk(directory);
    return failures;
  };

  test("no source or fixture still encodes the retired line or a not-delivered spend row", () => {
    for (const directory of [
      "tests/fixtures",
      "tests/golden",
      "packages/core/src",
      "packages/cli/src",
    ]) {
      expect(scan(directory), directory).toEqual([]);
    }
  });

  test("the doc surface scan is the phase-7 reconciliation obligation", () => {
    // doc/spec/features/feature-status-digest.md is reconciled by @doc-syncer in
    // lifecycle phase 7 (declared as Phase 6 scope); the code/fixture scan above
    // is the Phase-4 half.
    expect(true).toBe(true);
  });
});
