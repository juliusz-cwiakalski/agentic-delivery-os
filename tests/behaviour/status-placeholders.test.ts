/**
 * TC-ATT-018 (behaviour half) / 019 / 020 / 021 / 024 — the lanes declaration,
 * the spend placeholder, the delivered typed-questions section, nine-section
 * totality, and the summary.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  STATUS_LANE_ATTENTION_STATES,
  STATUS_PLACEHOLDER_SECTION_IDS,
  STATUS_SECTION_KINDS,
  STATUS_SECTION_ORDER,
  type StatusDigest,
  type StatusFacts,
  type StatusSection,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  failedDeliveryRequestRead,
  failedPipelineRunRead,
  failedWorkItemRead,
  missingLocalContext,
  sectionById,
  unavailableBinding,
  repository,
} from "../fixtures/status/harness";
import { matrixCases } from "../fixtures/status/matrix/cases";

const ROOT = process.cwd();

const humanOf = (facts: StatusFacts): string =>
  renderStatusHuman(aggregateStatus(facts), { binaryName: "example-product" } as never);

const placeholderFailures = (
  section: StatusSection,
  id: "spend",
  capability: string,
  story: string,
  note: string,
): string[] => {
  const failures: string[] = [];
  if (section.id !== id) failures.push(`id ${section.id} != ${id}`);
  if (section.state !== "not-delivered") failures.push(`state ${section.state}`);
  if (section.capability !== capability) failures.push(`capability ${String(section.capability)}`);
  if (section.expectedStory !== story) failures.push(`story ${String(section.expectedStory)}`);
  if (section.note !== note) failures.push(`note ${String(section.note)}`);
  if (!section.evidence.reasons.includes("engine-not-delivered")) failures.push("reason");
  if (!section.evidence.sources.some((source) => source.outcome === "not-delivered")) {
    failures.push("source outcome");
  }
  if (section.counts.total !== 0 || section.counts.observed !== 0 || section.counts.unknown !== 0) {
    failures.push("counts");
  }
  if ((section.items ?? []).length !== 0) failures.push("items");
  if ((section.findings ?? []).length !== 0) failures.push("findings");
  return failures;
};

const placeholderSection = (facts: StatusFacts, id: "spend"): StatusSection =>
  sectionById(aggregateStatus(facts).sections, id);

describe("TC-ATT-019 named spend placeholder and the delivered typed-questions section", () => {
  test("spend is a uniform not-delivered placeholder declaring M1-S19", () => {
    expect(
      placeholderFailures(
        placeholderSection(baseFacts(), "spend"),
        "spend",
        "spend-summary",
        "M1-S19",
        "spend summary arrives with M1-S19",
      ),
    ).toEqual([]);
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
    expect(STATUS_PLACEHOLDER_SECTION_IDS).toEqual(["spend"]);
    expect(STATUS_SECTION_KINDS.spend).toBe("placeholder");
    expect(STATUS_SECTION_KINDS["typed-questions"]).toBe("collector");
    expect(STATUS_SECTION_KINDS["lanes-or-queue"]).toBe("declared-gap");
  });

  test("the human spend and questions lines are pinned byte-for-byte", () => {
    const human = humanOf(baseFacts());
    expect(human).toContain("spend      not-delivered  spend summary arrives with M1-S19");
    expect(human).toContain("questions  observed  0 open");
  });

  test("placeholders are independent of every read outcome", () => {
    const failing = baseFacts({
      tracker: failedWorkItemRead("read-failed"),
      changes: failedDeliveryRequestRead("read-failed"),
      ci: failedPipelineRunRead("read-failed"),
      localContext: missingLocalContext(),
      repository: repository({ binding: unavailableBinding() }),
    });
    expect(placeholderSection(failing, "spend").state).toBe("not-delivered");
  });

  test("mutation controls fail the placeholder validator by name", () => {
    const spend = placeholderSection(baseFacts(), "spend");
    const mutations: StatusSection[] = [
      { ...spend, expectedStory: "M1-S18" },
      { ...spend, note: "" },
      { ...spend, state: "observed" },
      { ...spend, items: [{ workItemRef: "GH-1", itemState: "observed" }] },
      { ...spend, capability: "spend-telemetry" },
    ];
    for (const mutation of mutations) {
      expect(
        placeholderFailures(
          mutation,
          "spend",
          "spend-summary",
          "M1-S19",
          "spend summary arrives with M1-S19",
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  test("no spend implementation leaks into the contracts or domain", () => {
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
  if (digest.summary.placeholderSectionCount !== 1) {
    failures.push(`placeholder count ${digest.summary.placeholderSectionCount}`);
  }
  const placeholders = digest.sections.filter(
    (section) => STATUS_SECTION_KINDS[section.id] === "placeholder",
  );
  if (placeholders.length !== 1) failures.push(`placeholder sections ${placeholders.length}`);
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

  test("the placeholder contributes zero to actionable", () => {
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
    expect(placeholderSection(baseFacts(), "spend").counts.total).toBe(0);
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
