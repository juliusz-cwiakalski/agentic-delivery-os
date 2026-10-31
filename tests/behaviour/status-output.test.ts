/**
 * TC-STATUS-005 / 006 / 007 — machine envelope bounds, human digest grammar,
 * caps/omitted/truncation, and deterministic ordering.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_MAX_TITLE_CHARS,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
} from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  ALL_AVAILABLE,
  activeChange,
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
        "notDelivered",
        "observed",
        "sections",
        "unavailable",
        "unknown",
      ].sort(),
    );
    expect(data.summary.sections).toBe(6);
    expect(JSON.stringify(data).length).toBeLessThanOrEqual(65536);
    const expectedKeys: Record<string, string[]> = {
      tracker: ["counts", "evidence", "families", "id", "state", "title", "truncated"],
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
    expect(lines.length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(4096);
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
      expect(forwardData.sections).toHaveLength(6);
    }
  });
});
