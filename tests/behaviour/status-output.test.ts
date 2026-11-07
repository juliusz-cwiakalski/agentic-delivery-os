/**
 * TC-STATUS-005 / 006 / 007 — machine envelope bounds, human digest grammar,
 * caps/omitted/truncation, and deterministic ordering.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import {
  STATUS_HUMAN_CLAMP_MARKER,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_MACHINE_BYTES,
  STATUS_MAX_TITLE_CHARS,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
  type StatusDigest,
  type StatusFinding,
} from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  ALL_AVAILABLE,
  activeChange,
  allCapsFacts,
  baseFacts,
  blockedBy,
  createStatusRecorder,
  deliveryRequestRead,
  localContext,
  makeDeliveryRequest,
  makePipelineRun,
  makeWorkItem,
  parkView,
  pipelineRunRead,
  providerConfig,
  providerConfigRead,
  providers,
  REVIEWS_AVAILABLE,
  runStatusCli,
  statusRuntime,
  workItemRead,
} from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const section = (data: unknown, id: string): Record<string, unknown> => {
  if (!isRecord(data) || !Array.isArray(data.sections)) throw new Error("no sections");
  const found = data.sections.find((entry) => isRecord(entry) && entry.id === id);
  if (!isRecord(found)) throw new Error(`missing ${id}`);
  return found;
};

const capTitles = (prefix: string, count: number, length = STATUS_MAX_TITLE_CHARS): string =>
  Array.from({ length: count }, (_, index) =>
    `${prefix} ${index} ${"x".repeat(length)}`.slice(0, length),
  );

const trackerItems = (count: number) => [
  ...capTitles("hand-back", count).map((title, index) =>
    makeWorkItem({
      entityId: String(100 + index),
      title,
      labels: ["hand-back"],
      updatedAt: "2026-10-01T00:00:00Z",
    }),
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    makeWorkItem({
      entityId: String(200 + index),
      title: `blocked ${index}`,
      relations: [blockedBy("missing")],
    }),
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    makeWorkItem({
      entityId: String(300 + index),
      title: `stalled ${index}`,
      updatedAt: "2026-09-01T00:00:00Z",
    }),
  ),
  ...Array.from({ length: 4 }, (_, index) =>
    makeWorkItem({ entityId: String(400 + index), title: `hygiene ${index}`, labels: [] }),
  ),
];

const handBackItems = (count: number) =>
  capTitles("hand-back", count).map((title, index) =>
    makeWorkItem({
      entityId: String(1000 + index),
      title,
      labels: ["hand-back"],
      updatedAt: "2026-10-30T00:00:00Z",
    }),
  );

const pullRequests = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    makeDeliveryRequest({
      entityId: String(500 + index),
      reviewState: index % 2 === 0 ? "open" : "draft",
    }),
  );

const runs = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    makePipelineRun({
      entityId: String(700 + index),
      pipelineName: `ci-${index}`,
      jobs: [{ jobName: "job", jobState: index === 0 ? "failed" : "succeeded" }],
    }),
  );

const providerFacts = (entryCount: number, parkCount: number) => {
  const names = Array.from({ length: entryCount }, (_, index) => `p${index}`);
  return providers({
    config: providerConfigRead(
      providerConfig({
        defaultChain: "primary",
        entries: Object.fromEntries(
          names.map((name) => [name, { name, class: "subscription", enabled: true }]),
        ),
        chains: { primary: { name: "primary", entries: names, allowPaidFallback: false } },
      }),
    ),
    parks: {
      ok: true,
      parks: Array.from({ length: parkCount }, (_, index) =>
        parkView({
          name: `provider:p${index}`,
          subjectName: `p${index}`,
          expiresAt: `2026-11-0${(index % 9) + 1}T00:00:00Z`,
        }),
      ),
    },
  });
};

const capFacts = (overrides: Parameters<typeof baseFacts>[0] = {}) =>
  baseFacts({
    tracker: workItemRead(trackerItems(4)),
    changes: deliveryRequestRead(pullRequests(8), REVIEWS_AVAILABLE),
    ci: pipelineRunRead(runs(8)),
    providers: providerFacts(8, 8),
    localContext: localContext({
      activeChange: activeChange(),
      parkedChanges: Array.from({ length: 8 }, (_, index) => ({
        workItemRef: `GH-${800 + index}`,
        parkedAt: `2026-10-0${(index % 9) + 1}T00:00:00Z`,
      })),
    }),
    ...overrides,
  });

const runJson = async (facts: ReturnType<typeof baseFacts>) => {
  const run = await runStatusCli(["--json", "status"], statusRuntime(facts));
  expect(run.exitCode).toBe(0);
  return JSON.parse(run.stdout) as Record<string, unknown>;
};

describe("TC-STATUS-005 machine envelope and 64 KiB bound", () => {
  test("the machine digest carries the pinned structure and stays under 64 KiB", async () => {
    const envelope = await runJson(capFacts());
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    expect(Object.keys(envelope).sort()).toEqual(
      ["data", "exitCode", "runId", "schemaVersion", "timing"].sort(),
    );
    expect(envelope).not.toHaveProperty("error");
    const data = envelope.data;
    if (!isRecord(data)) throw new Error("data missing");
    expect(data.schemaVersion).toBe("delivery.status.v1");
    expect(String(data.generatedAt)).toMatch(/Z$/);
    expect(isRecord(data.repository)).toBe(true);
    if (!isRecord(data.summary)) throw new Error("summary missing");
    expect(Object.keys(data.summary).sort()).toEqual(
      [
        "actionable",
        "degraded",
        "findingsTotal",
        "notDelivered",
        "observed",
        "placeholderSectionCount",
        "sections",
        "unavailable",
        "unknown",
      ].sort(),
    );
    expect(data.summary.sections).toBe(9);
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(65536);
    const expectedKeys: Record<string, string[]> = {
      tracker: ["counts", "evidence", "families", "findings", "id", "state", "title", "truncated"],
      "changes-and-prs": [
        "activeChange",
        "counts",
        "evidence",
        "id",
        "pullRequests",
        "state",
        "title",
        "truncated",
      ],
      ci: ["commit", "counts", "evidence", "id", "result", "runs", "state", "title", "truncated"],
      "lanes-or-queue": [
        "attentionStates",
        "capability",
        "counts",
        "evidence",
        "expectedStory",
        "id",
        "items",
        "note",
        "state",
        "title",
        "truncated",
      ],
      providers: [
        "chain",
        "counts",
        "entries",
        "evidence",
        "id",
        "parks",
        "state",
        "title",
        "truncated",
      ],
      "parked-work": ["counts", "evidence", "id", "items", "source", "state", "title", "truncated"],
      "ready-to-merge": ["counts", "evidence", "id", "items", "state", "title", "truncated"],
      spend: ["counts", "evidence", "id", "items", "note", "spend", "state", "title", "truncated"],
      "typed-questions": ["counts", "evidence", "id", "questions", "state", "title", "truncated"],
    };
    for (const [id, keys] of Object.entries(expectedKeys)) {
      expect(Object.keys(section(data, id)).sort()).toEqual([...keys].sort());
    }
  });

  test("an over-cap input is capped and sanitized, not unbounded", async () => {
    const envelope = await runJson(
      capFacts({
        changes: deliveryRequestRead(pullRequests(9), REVIEWS_AVAILABLE),
        tracker: workItemRead(trackerItems(9)),
      }),
    );
    const data = envelope.data;
    if (!isRecord(data)) throw new Error("data missing");
    expect((section(data, "changes-and-prs").pullRequests as unknown[]).length).toBe(8);
    const families = section(data, "tracker").families as unknown[];
    for (const family of families) {
      if (isRecord(family) && Array.isArray(family.items)) {
        expect(family.items.length).toBeLessThanOrEqual(4);
        for (const item of family.items) {
          if (isRecord(item) && typeof item.title === "string") {
            expect(item.title.length).toBeLessThanOrEqual(STATUS_MAX_TITLE_CHARS);
          }
        }
      }
    }
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(65536);
  });
});

describe("TC-STATUS-006 human digest grammar and bounds", () => {
  test("human mode renders six state-bearing lines within bounds and no titles/secrets", async () => {
    const facts = capFacts({
      changes: deliveryRequestRead(pullRequests(9), REVIEWS_AVAILABLE),
      tracker: workItemRead([
        makeWorkItem({
          entityId: "900",
          title: "planted-status-title-canary",
          labels: ["hand-back"],
        }),
      ]),
      localContext: localContext({
        activeChange: activeChange(),
        parkedChanges: [{ workItemRef: "GH-901", reason: "planted-status-notes-canary" }],
      }),
    });
    const run = await runStatusCli(["status"], statusRuntime(facts), {
      secrets: ["planted-fake-secret-0901"],
    });
    expect(run.exitCode).toBe(0);
    const lines = run.stdout.split("\n").filter((line) => line.length > 0);
    expect(lines[0]).toContain(
      `${SYNTHETIC_BRAND.binaryName} status owner-placeholder/project-placeholder`,
    );
    expect(lines.some((line) => line.startsWith("tracker"))).toBe(true);
    expect(lines.some((line) => line.startsWith("changes"))).toBe(true);
    expect(lines.some((line) => line.startsWith("ci"))).toBe(true);
    expect(lines.some((line) => line.startsWith("lanes      not-delivered"))).toBe(true);
    expect(lines.some((line) => line.startsWith("providers"))).toBe(true);
    expect(lines.some((line) => line.startsWith("parked"))).toBe(true);
    expect(lines.some((line) => line.startsWith("ready"))).toBe(true);
    expect(lines.some((line) => line.startsWith("spend"))).toBe(true);
    expect(lines.some((line) => line.startsWith("questions"))).toBe(true);
    expect(lines.some((line) => line.startsWith("attention"))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(32);
    expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(6144);
    expect(run.stdout).toContain("+1");
    expect(run.stdout).not.toContain("planted-status-title-canary");
    expect(run.stdout).not.toContain("planted-status-notes-canary");
    expect(run.stdout).not.toContain("planted-fake-secret-0901");
    expect(run.stdout).not.toContain("2026-10-31T00:00:00Z");
    expect(run.stdout).not.toContain("ados");
    expect(run.stdout).not.toContain("ADOS_");
    expect(run.stdout).not.toContain("available");
  });

  test("rendering performs no extra reads and agrees with the JSON digest", async () => {
    const facts = capFacts();
    const jsonRecorder = createStatusRecorder();
    const json = await runStatusCli(["--json", "status"], statusRuntime(facts, jsonRecorder));
    const humanRecorder = createStatusRecorder();
    const human = await runStatusCli(["status"], statusRuntime(facts, humanRecorder));
    expect(humanRecorder.calls).toEqual(jsonRecorder.calls);
    const envelope = JSON.parse(json.stdout) as Record<string, unknown>;
    if (!isRecord(envelope.data)) throw new Error("data missing");
    for (const id of ["tracker", "changes-and-prs", "ci", "providers", "parked-work"]) {
      const state = section(envelope.data, id).state as string;
      expect(human.stdout).toContain(state);
    }
  });
});

describe("TC-STATUS-007 caps, omitted, truncation, and ordering", () => {
  test("each rendered list respects its cap and records omitted", async () => {
    const facts = capFacts({
      tracker: workItemRead(handBackItems(5)),
      changes: deliveryRequestRead(pullRequests(9), REVIEWS_AVAILABLE),
      ci: pipelineRunRead(runs(9)),
      providers: providerFacts(9, 9),
      localContext: localContext({
        activeChange: activeChange(),
        parkedChanges: Array.from({ length: 9 }, (_, index) => ({
          workItemRef: `GH-${900 + index}`,
          parkedAt: `2026-10-0${(index % 9) + 1}T00:00:00Z`,
        })),
      }),
    });
    const envelope = await runJson(facts);
    const data = envelope.data;
    if (!isRecord(data)) throw new Error("data missing");
    const tracker = section(data, "tracker");
    expect(tracker.counts).toMatchObject({ omitted: 1 });
    expect(tracker.truncated).toBe(true);
    expect((section(data, "changes-and-prs").pullRequests as unknown[]).length).toBe(8);
    expect(section(data, "changes-and-prs").counts).toMatchObject({ omitted: 1 });
    expect((section(data, "ci").runs as unknown[]).length).toBe(8);
    expect(section(data, "ci").counts).toMatchObject({ omitted: 1 });
    expect((section(data, "providers").entries as unknown[]).length).toBe(8);
    expect((section(data, "providers").parks as unknown[]).length).toBe(8);
    expect(section(data, "providers").counts).toMatchObject({ omitted: 2 });
    expect((section(data, "parked-work").items as unknown[]).length).toBe(8);
    expect(section(data, "parked-work").counts).toMatchObject({ omitted: 1 });
  });

  test("the raw source page at the declared limit marks source-truncated", async () => {
    const atLimitPr = await runJson(
      baseFacts({
        changes: deliveryRequestRead(pullRequests(2), REVIEWS_AVAILABLE, STATUS_SOURCE_ITEM_LIMIT),
      }),
    );
    const atPrData = atLimitPr.data;
    if (!isRecord(atPrData)) throw new Error("data missing");
    expect(section(atPrData, "changes-and-prs").truncated).toBe(true);
    expect(section(atPrData, "changes-and-prs").evidence).toMatchObject({
      reasons: expect.arrayContaining(["source-truncated"]),
    });

    const belowPr = await runJson(
      baseFacts({
        changes: deliveryRequestRead(
          pullRequests(2),
          REVIEWS_AVAILABLE,
          STATUS_SOURCE_ITEM_LIMIT - 1,
        ),
      }),
    );
    const belowPrData = belowPr.data;
    if (!isRecord(belowPrData)) throw new Error("data missing");
    expect(section(belowPrData, "changes-and-prs").truncated).toBe(false);

    const atLimitCi = await runJson(
      baseFacts({ ci: pipelineRunRead(runs(2), STATUS_SOURCE_PIPELINE_LIMIT) }),
    );
    const atCiData = atLimitCi.data;
    if (!isRecord(atCiData)) throw new Error("data missing");
    expect(section(atCiData, "ci").truncated).toBe(true);
    expect(section(atCiData, "ci").evidence).toMatchObject({
      reasons: expect.arrayContaining(["source-truncated"]),
    });

    const belowCi = await runJson(
      baseFacts({ ci: pipelineRunRead(runs(2), STATUS_SOURCE_PIPELINE_LIMIT - 1) }),
    );
    const belowCiData = belowCi.data;
    if (!isRecord(belowCiData)) throw new Error("data missing");
    expect(section(belowCiData, "ci").truncated).toBe(false);

    const atLimitIssues = await runJson(
      baseFacts({
        tracker: workItemRead(handBackItems(2), ALL_AVAILABLE, STATUS_SOURCE_ITEM_LIMIT),
      }),
    );
    const atIssuesData = atLimitIssues.data;
    if (!isRecord(atIssuesData)) throw new Error("data missing");
    expect(section(atIssuesData, "tracker").truncated).toBe(true);
    expect(section(atIssuesData, "tracker").evidence).toMatchObject({
      reasons: expect.arrayContaining(["source-truncated"]),
    });

    const belowIssues = await runJson(
      baseFacts({
        tracker: workItemRead(handBackItems(2), ALL_AVAILABLE, STATUS_SOURCE_ITEM_LIMIT - 1),
      }),
    );
    const belowIssuesData = belowIssues.data;
    if (!isRecord(belowIssuesData)) throw new Error("data missing");
    expect(section(belowIssuesData, "tracker").truncated).toBe(false);
  });

  test("non-numeric run identities tie lexically ascending; numeric ones descend", async () => {
    const nonNumeric = await runJson(
      baseFacts({
        ci: pipelineRunRead([
          makePipelineRun({ entityId: "gamma:3" }),
          makePipelineRun({ entityId: "alpha:1" }),
          makePipelineRun({ entityId: "beta:2" }),
        ]),
      }),
    );
    const nonNumericData = nonNumeric.data;
    if (!isRecord(nonNumericData)) throw new Error("data missing");
    expect(
      (section(nonNumericData, "ci").runs as { identity: { entityId: string } }[]).map(
        (run) => run.identity.entityId,
      ),
    ).toEqual(["alpha:1", "beta:2", "gamma:3"]);

    const numeric = await runJson(
      baseFacts({
        ci: pipelineRunRead([
          makePipelineRun({ entityId: "9" }),
          makePipelineRun({ entityId: "11" }),
          makePipelineRun({ entityId: "10" }),
        ]),
      }),
    );
    const numericData = numeric.data;
    if (!isRecord(numericData)) throw new Error("data missing");
    expect(
      (section(numericData, "ci").runs as { identity: { entityId: string } }[]).map(
        (run) => run.identity.entityId,
      ),
    ).toEqual(["11", "10", "9"]);
  });

  test("reversed input order yields identical rendered identities", async () => {
    const forward = await runJson(capFacts());
    const reversed = await runJson(
      baseFacts({
        tracker: workItemRead([...trackerItems(4)].reverse()),
        changes: deliveryRequestRead([...pullRequests(8)].reverse(), REVIEWS_AVAILABLE),
        ci: pipelineRunRead([...runs(8)].reverse()),
        providers: providerFacts(8, 8),
        localContext: localContext({
          activeChange: activeChange(),
          parkedChanges: [
            ...Array.from({ length: 8 }, (_, index) => ({
              workItemRef: `GH-${800 + index}`,
              parkedAt: `2026-10-0${(index % 9) + 1}T00:00:00Z`,
            })),
          ].reverse(),
        }),
      }),
    );
    const identity = (envelope: Record<string, unknown>): string => {
      const data = envelope.data;
      if (!isRecord(data)) return "";
      return JSON.stringify({
        prs: (section(data, "changes-and-prs").pullRequests as { entityId: string }[]).map(
          (item) => item.entityId,
        ),
        runs: (section(data, "ci").runs as { identity: { entityId: string } }[]).map(
          (item) => item.identity.entityId,
        ),
        parked: (section(data, "parked-work").items as { workItemRef?: string }[]).map(
          (item) => item.workItemRef,
        ),
        families: section(data, "tracker").families,
      });
    };
    expect(identity(reversed)).toEqual(identity(forward));
    const forwardData = forward.data;
    if (isRecord(forwardData) && Array.isArray(forwardData.sections)) {
      expect(forwardData.sections).toHaveLength(9);
    }
  });
});

const digestWithFindings = (findings: readonly StatusFinding[]): StatusDigest => {
  const digest = aggregateStatus(baseFacts());
  return {
    ...digest,
    sections: digest.sections.map((section) =>
      section.id === "tracker" ? { ...section, findings } : section,
    ),
  };
};

const finding = (
  code: string,
  count: number,
  severity: StatusFinding["severity"] = "low",
): StatusFinding => ({
  code: code as StatusFinding["code"],
  severity,
  count,
  members: ["member-1"],
  evidenceRef: "member-1",
});

const attentionOf = (digest: StatusDigest): string => {
  const line = renderStatusHuman(digest, SYNTHETIC_BRAND)
    .split("\n")
    .find((entry) => entry.startsWith("attention"));
  return line ?? "missing";
};

describe("TC-ATT-026 extended human grammar", () => {
  test("the exact line order is header, nine sections, attention", () => {
    const human = renderStatusHuman(aggregateStatus(baseFacts()), SYNTHETIC_BRAND);
    const labels = human
      .split("\n")
      .filter((line) => line.length > 0)
      .map((line) => (line.startsWith(SYNTHETIC_BRAND.binaryName) ? "header" : line.split(" ")[0]));
    expect(labels).toEqual([
      "header",
      "tracker",
      "changes",
      "ci",
      "lanes",
      "providers",
      "parked",
      "ready",
      "spend",
      "questions",
      "attention",
    ]);
  });

  test("the header is absent without an observed binding", () => {
    const facts = baseFacts({
      repository: {
        binding: { state: "unavailable", reason: "addressing-unresolved" },
        head: { detached: true },
      },
    });
    const human = renderStatusHuman(aggregateStatus(facts), SYNTHETIC_BRAND);
    expect(human.startsWith("tracker")).toBe(true);
    expect(human).not.toContain(SYNTHETIC_BRAND.binaryName);
  });

  test("the tracker line carries the gates and assertion-unknown fragments", () => {
    const human = renderStatusHuman(aggregateStatus(baseFacts()), SYNTHETIC_BRAND);
    expect(human).toContain("gates 0 escalated");
    expect(human).toContain("hygiene 0 (0 unknown)");
  });

  test("the five unchanged lines are byte-identical to the shipped grammar", () => {
    const human = renderStatusHuman(aggregateStatus(baseFacts()), SYNTHETIC_BRAND);
    expect(human).toContain("changes    observed  active GH-175 | PRs 0 (review state observed)");
    expect(human).toContain("ci         observed  none-reported (0/0 jobs)");
    expect(human).toContain("lanes      not-delivered  no queue or lane engine in this release");
    expect(human).toContain("providers  observed  chain primary | active parks 0 | 1 entries");
    expect(human).toContain("parked     observed  0 parked changes (git-ignored local state)");
  });

  test("the ready, spend, questions, and attention lines are pinned", () => {
    const human = renderStatusHuman(aggregateStatus(baseFacts()), SYNTHETIC_BRAND);
    expect(human).toContain("ready      observed  0 ready-to-merge (merge-ready 0)");
    expect(human).toContain("spend      observed  no captured telemetry (absence of capture)");
    expect(human).toContain("questions  observed  0 open");
    expect(human).toContain("attention  0 findings ()");
  });

  test("rendering derives from the digest only and writes nothing", () => {
    const digest = digestWithFindings([finding("tracker.stalled-ticket", 2, "medium")]);
    expect(attentionOf(digest)).toBe("attention  1 findings (tracker.stalled-ticket×2)");
    const restored = digestWithFindings([]);
    expect(attentionOf(restored)).toBe("attention  0 findings ()");
  });
});

describe("TC-ATT-027 attention rollup", () => {
  test("zero, one, two, and three groups preview without +N", () => {
    const groups: Array<[StatusFinding[], string]> = [
      [[], "attention  0 findings ()"],
      [
        [finding("tracker.hygiene.missing-title", 1)],
        "attention  1 findings (tracker.hygiene.missing-title×1)",
      ],
      [
        [
          finding("tracker.hygiene.missing-title", 1),
          finding("tracker.stalled-ticket", 2, "medium"),
        ],
        "attention  2 findings (tracker.stalled-ticket×2, tracker.hygiene.missing-title×1)",
      ],
      [
        [
          finding("tracker.hygiene.missing-title", 1),
          finding("tracker.stalled-ticket", 2, "medium"),
          finding("ci.red-on-main", 4, "high"),
        ],
        "attention  3 findings (ci.red-on-main×4, tracker.stalled-ticket×2, tracker.hygiene.missing-title×1)",
      ],
    ];
    for (const [findings, expected] of groups) {
      expect(attentionOf(digestWithFindings(findings))).toBe(expected);
    }
  });

  test("four, six, and nine groups preview three and append +N of grouped findings", () => {
    const codes = [
      "ci.red-on-main",
      "tracker.owner-gate-escalated",
      "tracker.stalled-ticket",
      "tracker.hygiene.missing-title",
      "tracker.hygiene.missing-labels",
      "tracker.hygiene.epic-membership",
      "tracker.hygiene.story-points",
      "tracker.hygiene.in-sprint",
      "parked.stale-no-condition",
    ] as const;
    for (const count of [4, 6, 9]) {
      const findings = codes.slice(0, count).map((code, index) => finding(code, index + 1));
      const line = attentionOf(digestWithFindings(findings));
      expect(line.startsWith(`attention  ${count} findings (`)).toBe(true);
      expect(line).toMatch(/\+\d+\)$/);
      const match = /\+(\d+)\)$/.exec(line);
      expect(Number(match?.[1])).toBe(count - 3);
    }
  });

  test("multi-count groups count groups, never observations", () => {
    const line = attentionOf(
      digestWithFindings([
        finding("tracker.hygiene.missing-title", 20),
        finding("tracker.hygiene.missing-labels", 3),
        finding("tracker.stalled-ticket", 2, "medium"),
        finding("ci.red-on-main", 1, "high"),
      ]),
    );
    expect(line).toBe(
      "attention  4 findings (ci.red-on-main×1, tracker.stalled-ticket×2, tracker.hygiene.missing-title×20+1)",
    );
    expect(line).not.toContain("+26");
    expect(line).not.toContain("+22");
  });

  test("the preview is severity-ordered and permutation-invariant", () => {
    const forward = digestWithFindings([
      finding("tracker.hygiene.missing-title", 20),
      finding("tracker.stalled-ticket", 2, "medium"),
      finding("ci.red-on-main", 1, "high"),
      finding("tracker.hygiene.missing-labels", 3),
    ]);
    const reversed = digestWithFindings([
      finding("tracker.hygiene.missing-labels", 3),
      finding("ci.red-on-main", 1, "high"),
      finding("tracker.stalled-ticket", 2, "medium"),
      finding("tracker.hygiene.missing-title", 20),
    ]);
    expect(attentionOf(reversed)).toBe(attentionOf(forward));
  });

  test("the rollup lists no member identity", () => {
    const human = renderStatusHuman(
      digestWithFindings([finding("ci.red-on-main", 4, "high")]),
      SYNTHETIC_BRAND,
    );
    expect(human).not.toContain("member-1");
  });
});

describe("TC-ATT-028 human bounds", () => {
  test("the structural worst case is 11 lines under the 32-line defensive cap", () => {
    const human = renderStatusHuman(aggregateStatus(baseFacts()), SYNTHETIC_BRAND);
    expect(human.split("\n").filter((line) => line.length > 0)).toHaveLength(11);
    expect(STATUS_MAX_HUMAN_LINES).toBe(32);
    expect(STATUS_MAX_HUMAN_BYTES).toBe(6144);
  });

  test("the 6144-byte cap is the operative bound and clamps with the declared marker", () => {
    const digest = aggregateStatus(baseFacts());
    const withLongChain: StatusDigest = {
      ...digest,
      sections: digest.sections.map((section) =>
        section.id === "providers"
          ? { ...section, chain: { state: "declared", name: "x".repeat(7000), entries: [] } }
          : section,
      ),
    };
    const human = renderStatusHuman(withLongChain, SYNTHETIC_BRAND);
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(STATUS_MAX_HUMAN_BYTES);
    expect(human.endsWith(STATUS_HUMAN_CLAMP_MARKER)).toBe(true);
  });

  test("the retired 24/4096 bounds no longer bind", () => {
    expect(STATUS_MAX_HUMAN_LINES).not.toBe(24);
    expect(STATUS_MAX_HUMAN_BYTES).not.toBe(4096);
    const human = renderStatusHuman(aggregateStatus(baseFacts()), SYNTHETIC_BRAND);
    expect(human).not.toMatch(/\+\n$/);
  });
});

describe("TC-ATT-029 machine bound with every surface at cap", () => {
  test("the all-caps digest stays within 65 536 bytes and populates every surface", async () => {
    const facts = allCapsFacts();
    const envelope = await runStatusCli(["--json", "status"], statusRuntime(facts));
    expect(envelope.exitCode).toBe(0);
    const parsed = JSON.parse(envelope.stdout) as unknown;
    expect(assertEnvelopeContract(parsed)).toEqual([]);
    if (!isRecord(parsed) || !isRecord(parsed.data)) throw new Error("data missing");
    const data = parsed.data;
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(
      STATUS_MAX_MACHINE_BYTES,
    );
    expect(parsed).not.toHaveProperty("error");
    const sections = data.sections as Array<Record<string, unknown>>;
    expect(sections).toHaveLength(9);
    const tracker = section(data, "tracker");
    expect((tracker.findings as unknown[]).length).toBe(7);
    for (const finding of tracker.findings as Array<{ members: unknown[] }>) {
      expect(finding.members.length).toBeLessThanOrEqual(8);
    }
    expect((section(data, "ci").runs as unknown[]).length).toBe(8);
    expect((section(data, "changes-and-prs").pullRequests as unknown[]).length).toBe(8);
    expect((section(data, "ready-to-merge").items as unknown[]).length).toBe(8);
    expect((section(data, "providers").entries as unknown[]).length).toBe(8);
    expect((section(data, "parked-work").items as unknown[]).length).toBe(8);
    expect((section(data, "spend").items as unknown[]).length).toBe(0);
    expect((section(data, "typed-questions").questions as unknown[]).length).toBe(0);
  });

  test("the corpus carries the same all-caps case name", () => {
    const cases = readdirSync("tests/fixtures/status/corpus");
    expect(cases).toContain("all-caps-bound");
  });
});
