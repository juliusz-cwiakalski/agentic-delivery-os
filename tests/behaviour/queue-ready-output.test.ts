/**
 * TC-QREADY-018 / 019 / 020 / 034 / 035 / 038 — machine payload, bounds, human
 * digest, reason order, truncation flags, and provider-derived caps.
 */
import { describe, expect, test } from "bun:test";
import {
  QUEUE_READY_MAX_BRANCH_CHARS,
  QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES,
  QUEUE_READY_MAX_IDENTITY_CHARS,
  QUEUE_READY_MAX_LABEL_CHARS,
  QUEUE_READY_MAX_LABELS,
  QUEUE_READY_MAX_OWNER_CHARS,
  QUEUE_READY_MAX_REF_CHARS,
  QUEUE_READY_MAX_RELATIONS,
  QUEUE_READY_MAX_REPO_NAME_CHARS,
  QUEUE_READY_MAX_TIMESTAMP_CHARS,
  QUEUE_READY_SOURCE_FAILURE_REASONS,
  type QueueReadyCandidate,
  type QueueReadyCloseClass,
  type QueueReadyCondition,
  type QueueReadyPayload,
} from "../../packages/core/src/contracts/index";
import {
  evaluateQueueReady,
  renderQueueReadyHuman,
} from "../../packages/core/src/domain/queue-ready";
import {
  astral,
  astralAtCap,
  astralAtCapFacts,
  astralOverCap,
  astralOverCapFacts,
} from "../fixtures/queue-ready/caps/astral";
import {
  nonAsciiByteBudgetControlFacts,
  nonAsciiByteBudgetFacts,
} from "../fixtures/queue-ready/caps/non-ascii-byte-budget";
import {
  humanAstral8,
  humanAstral8Facts,
  humanAstral8Refs,
} from "../fixtures/queue-ready/caps/human-astral-8/facts";
import {
  HUMAN_OVER_BUDGET_BRAND,
  humanOverBudgetFacts,
  humanOverBudgetRefs,
} from "../fixtures/queue-ready/caps/human-over-budget/facts";
import {
  baseFacts,
  blockedBy,
  deliveryRequestRead,
  evaluate,
  failedDeliveryRequestRead,
  job,
  localContext,
  makeDeliveryRequest,
  makePipelineRun,
  makeWorkItem,
  missingLocalContext,
  NOW_ISO,
  pipelineRunRead,
  providerConfig,
  providerConfigFailed,
  providerConfigRead,
  providers,
  queueRuntime,
  REVIEWS_AVAILABLE,
  REVIEWS_UNAVAILABLE,
  runQueueReadyCli,
  SHA,
  SYNTHETIC_BRAND,
  workItemRead,
} from "../fixtures/queue-ready/harness";

const payloadOf = (stdout: string): QueueReadyPayload => {
  const envelope = JSON.parse(stdout) as { readonly data?: QueueReadyPayload };
  if (envelope.data === undefined) throw new Error("no data");
  return envelope.data;
};

const item = (entityId: string, extra: Partial<Parameters<typeof makeWorkItem>[0]> = {}) =>
  makeWorkItem({ entityId, labels: ["priority:high"], ...extra });

const pr = (entityId: string, sourceRef = `feat/GH-176/slug-${entityId}`) =>
  makeDeliveryRequest({ entityId, sourceRef });

/* ------------------------------- TC-QREADY-018 ---------------------------- */

describe("TC-QREADY-018 machine payload", () => {
  test("one envelope with the exact key order, schema, summary, and no forbidden material", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(
        baseFacts({ tracker: workItemRead([item("176", { title: "planted-title-canary" })]) }),
      ),
    );
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as {
      readonly data?: QueueReadyPayload;
      readonly error?: unknown;
    };
    expect(envelope.error).toBeUndefined();
    const data = payloadOf(run.stdout);
    expect(Object.keys(data)).toEqual([
      "schemaVersion",
      "generatedAt",
      "repository",
      "head",
      "candidates",
      "summary",
      "reasons",
      "truncated",
    ]);
    expect(data.schemaVersion).toBe("delivery.queue-ready.v1");
    expect(data.generatedAt).toBe(NOW_ISO);
    expect(Object.keys(data.summary)).toEqual([
      "candidates",
      "ready",
      "notReady",
      "mergeReady",
      "reviewPending",
      "newStart",
      "unknownClose",
    ]);
    const candidate = data.candidates[0];
    expect(candidate).toBeDefined();
    if (candidate === undefined) return;
    expect(Object.keys(candidate)).toEqual([
      "workItemRef",
      "rank",
      "ready",
      "closeClass",
      "workItem",
      "close",
      "conditions",
      "blockingConditions",
      "truncated",
    ]);
    for (const condition of candidate.conditions) {
      expect(Object.keys(condition)).toEqual(["id", "state", "evidence"]);
      for (const record of condition.evidence) {
        expect(Object.keys(record)[0]).toBe("source");
        expect(Object.keys(record)[1]).toBe("reason");
      }
    }
    const text = JSON.stringify(data);
    expect(text.includes("planted-title-canary")).toBe(false);
    expect(text.includes("systemName")).toBe(false);
    expect(text.includes('"title"')).toBe(false);
    expect(text.includes("reviewDecision")).toBe(false);
    expect(text.includes("check_suite")).toBe(false);
    expect(text.includes("updated_at")).toBe(false);
    expect(data.reasons).toEqual([...new Set(data.reasons)]);
    expect(data.reasons.length).toBeLessThanOrEqual(6);
  });

  test("missing required fields fail by name", () => {
    const data = evaluate();
    const broken = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
    delete broken.schemaVersion;
    expect(payloadViolations(broken).join("\n")).toContain("schemaVersion");
  });
});

/* ------------------------------- TC-QREADY-019 ---------------------------- */

describe("TC-QREADY-019 payload bounds", () => {
  test("cap-sized payloads stay within 65 536 bytes", () => {
    for (const count of [1, 8]) {
      const refs = Array.from({ length: count }, (_, index) => `GH-${index + 1}`);
      const payload = evaluate({
        candidates: refs,
        tracker: workItemRead(refs.map((ref) => item(ref.replace(/^.*-/, "")))),
      });
      expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(65536);
    }
  });

  test("a non-ASCII cap-sized payload is reduced to the UTF-8 byte bound", () => {
    const facts = nonAsciiByteBudgetFacts();
    const rawItems = facts.tracker.ok ? facts.tracker.items : [];
    const rawProjection = rawItems.map((rawItem) => ({
      labels: rawItem.labels.slice(0, QUEUE_READY_MAX_LABELS),
      relations: rawItem.relations
        .filter((relation) => relation.relationKind === "blocked-by")
        .slice(0, QUEUE_READY_MAX_RELATIONS)
        .map((relation) => relation.target.entityId),
    }));
    const rawJson = JSON.stringify(rawProjection);
    // The fixture reaches the defect: under the UTF-16 `.length` cap, over the
    // UTF-8 byte cap before reduction.
    expect(rawJson.length).toBeLessThanOrEqual(65536);
    expect(Buffer.byteLength(rawJson)).toBeGreaterThan(65536);

    const payload = evaluateQueueReady(facts);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(65536);
    expect(payload.truncated).toBe(true);
    expect(payload.reasons.filter((reason) => reason === "value-clamped")).toHaveLength(1);
    const remainingRelations = payload.candidates.reduce(
      (total, entry) =>
        total + (entry.workItem.state === "observed" ? (entry.workItem.relations?.length ?? 0) : 0),
      0,
    );
    expect(remainingRelations).toBeLessThan(rawItems.length * QUEUE_READY_MAX_RELATIONS);

    const verdictOf = (value: QueueReadyPayload) =>
      value.candidates.map((entry) => ({
        ref: entry.workItemRef,
        ready: entry.ready,
        closeClass: entry.closeClass,
        states: entry.conditions.map((condition) => condition.state),
        blocking: entry.blockingConditions,
      }));
    expect(verdictOf(payload)).toEqual(
      verdictOf(evaluateQueueReady(nonAsciiByteBudgetControlFacts())),
    );

    const human = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    expect(Buffer.byteLength(human)).toBeLessThanOrEqual(4096);
    expect(human.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
  });

  test("an oversized injected brand no longer throws and stays within the bound", async () => {
    const payload = evaluate();
    const oversized = { ...SYNTHETIC_BRAND, binaryName: "x".repeat(5000) };
    const human = renderQueueReadyHuman(payload, oversized);
    expect(Buffer.byteLength(human)).toBeLessThanOrEqual(4096);
    expect(human.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
    expect(human).toContain("ready ");
    expect(human).not.toContain("x".repeat(5000));

    const run = await runQueueReadyCli(["queue", "ready", "GH-176"], queueRuntime(baseFacts()), {
      brand: oversized,
    });
    expect(run.exitCode).toBe(0);
    expect(run.stderr).not.toContain("fallback.internal");
    expect(Buffer.byteLength(run.stdout)).toBeLessThanOrEqual(4096);
  });

  test("a 9th candidate injected in memory fails the bound by name", () => {
    const payload = evaluate();
    const withNine = JSON.parse(JSON.stringify(payload)) as {
      candidates: QueueReadyCandidate[];
      summary: { candidates: number };
    };
    const extra = JSON.parse(JSON.stringify(payload.candidates[0])) as QueueReadyCandidate;
    withNine.candidates.push(extra);
    withNine.summary.candidates = 9;
    expect(payloadViolations(withNine).some((line) => line.includes("candidates"))).toBe(true);
  });

  test("a derived detail over 160 characters is clamped without any flag", () => {
    const longRef = `GH-${"9".repeat(300)}`;
    const payload = evaluate({
      localContext: localContext({ activeChange: { workItemRef: longRef } }),
    });
    const repo = payload.candidates[0]?.conditions.find((entry) => entry.id === "repo-free");
    expect(repo?.evidence[0]?.detail?.length).toBe(160);
    expect(JSON.stringify(payload).includes(longRef)).toBe(false);
    expect(payload.truncated).toBe(false);
    expect(payload.candidates[0]?.truncated).toBe(false);
    expect(payload.reasons).not.toContain("source-truncated");
    expect(payload.reasons).not.toContain("value-clamped");
  });

  test("an over-budget synthetic payload is rejected by the machine-bound contract", () => {
    const payload = evaluate();
    const oversized = JSON.parse(JSON.stringify(payload)) as QueueReadyPayload;
    const text = JSON.stringify({ ...oversized, blob: "x".repeat(66000) });
    expect(Buffer.byteLength(text)).toBeGreaterThan(65536);
    expect(
      boundViolations({
        ...oversized,
        blob: "x".repeat(66000),
      } as unknown as QueueReadyPayload).join("\n"),
    ).toContain("65536");
  });
});

/* -------------------------- astral code-point caps ------------------------ */

const LONE_HIGH_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/;
const LONE_LOW_SURROGATE = /(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const expectValidText = (value: string): void => {
  expect(LONE_HIGH_SURROGATE.test(value)).toBe(false);
  expect(LONE_LOW_SURROGATE.test(value)).toBe(false);
  expect(new TextDecoder().decode(new TextEncoder().encode(value))).toBe(value);
};

describe("astral code-point caps", () => {
  test("astral values at their cap are preserved and not value-clamped", () => {
    const payload = evaluateQueueReady(astralAtCapFacts());
    expect(payload.truncated).toBe(false);
    expect(payload.reasons).not.toContain("value-clamped");
    const entry = payload.candidates[0];
    if (entry?.workItem.state !== "observed") throw new Error("expected observed work item");
    expect(entry.workItem.labels?.[1]).toBe(astralAtCap.label);
    expect(entry.workItem.relations?.[0]?.target.entityId).toBe(astralAtCap.identity);
    expect(entry.workItem.updatedAt).toBe(astralAtCap.timestamp);
    expect(payload.head.branch).toBe(astralAtCap.branch);
    expect(payload.repository.state).toBe("observed");
    if (payload.repository.state === "observed") {
      expect(payload.repository.owner).toBe(astralAtCap.owner);
      expect(payload.repository.name).toBe(astralAtCap.name);
    }
    expect(entry.close.pullRequest?.entityId).toBe(astralAtCap.identity);
    expect(entry.close.pullRequest?.sourceRef).toBe(astralAtCap.sourceRef);
    expect(entry.close.pullRequest?.targetRef).toBe(astralAtCap.ref);
    for (const value of Object.values(astralAtCap)) expectValidText(value);
  });

  test("over-cap astral values truncate on code points with valid text", () => {
    const payload = evaluateQueueReady(astralOverCapFacts());
    expect(payload.truncated).toBe(true);
    expect(payload.reasons).toContain("value-clamped");
    const entry = payload.candidates[0];
    if (entry?.workItem.state !== "observed") throw new Error("expected observed work item");
    const label = entry.workItem.labels?.[1] ?? "";
    expect(Array.from(label)).toHaveLength(QUEUE_READY_MAX_LABEL_CHARS);
    expect(label).toBe(astral(QUEUE_READY_MAX_LABEL_CHARS));
    const target = entry.workItem.relations?.[0]?.target.entityId ?? "";
    expect(Array.from(target)).toHaveLength(QUEUE_READY_MAX_IDENTITY_CHARS);
    expect(target).toBe(astral(QUEUE_READY_MAX_IDENTITY_CHARS));
    expect(Array.from(entry.workItem.updatedAt ?? "")).toHaveLength(
      QUEUE_READY_MAX_TIMESTAMP_CHARS,
    );
    const pullRequest = entry.close.pullRequest;
    expect(Array.from(pullRequest?.entityId ?? "")).toHaveLength(QUEUE_READY_MAX_IDENTITY_CHARS);
    expect(Array.from(pullRequest?.sourceRef ?? "")).toHaveLength(QUEUE_READY_MAX_REF_CHARS);
    expect(Array.from(pullRequest?.targetRef ?? "")).toHaveLength(QUEUE_READY_MAX_REF_CHARS);
    if (payload.repository.state === "observed") {
      expect(Array.from(payload.repository.owner)).toHaveLength(QUEUE_READY_MAX_OWNER_CHARS);
      expect(Array.from(payload.repository.name)).toHaveLength(QUEUE_READY_MAX_REPO_NAME_CHARS);
    }
    expect(Array.from(payload.head.branch ?? "")).toHaveLength(QUEUE_READY_MAX_BRANCH_CHARS);
    for (const value of [
      label,
      target,
      entry.workItem.updatedAt ?? "",
      payload.repository.state === "observed" ? payload.repository.owner : "",
      payload.repository.state === "observed" ? payload.repository.name : "",
      payload.head.branch ?? "",
      pullRequest?.entityId ?? "",
      pullRequest?.sourceRef ?? "",
      pullRequest?.targetRef ?? "",
    ]) {
      expectValidText(value);
    }

    const atCap = evaluateQueueReady(astralAtCapFacts());
    const atCapEntry = atCap.candidates[0];
    expect(entry.ready).toBe(atCapEntry?.ready);
    expect(entry.closeClass).toBe(atCapEntry?.closeClass);
    expect(entry.rank).toBe(atCapEntry?.rank);
    expect(entry.conditions.map((condition) => condition.state)).toEqual(
      atCapEntry?.conditions.map((condition) => condition.state),
    );
    expect(entry.blockingConditions).toEqual(atCapEntry?.blockingConditions);

    const human = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    expectValidText(human);
    expect(Buffer.byteLength(human)).toBeLessThanOrEqual(4096);
    expect(human.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
    const segments = [...human.matchAll(/PR #[^ ]+|feat\/GH-176\/[^ ]+/g)].map((match) => match[0]);
    expect(segments.length).toBeGreaterThanOrEqual(2);
    for (const segment of segments) {
      expect(Buffer.byteLength(segment)).toBeLessThanOrEqual(QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES);
      expect(segment.endsWith("+")).toBe(true);
    }
  });
});

/* ------------------------------- TC-QREADY-020 ---------------------------- */

const candidate = (input: {
  readonly ref: string;
  readonly rank: number;
  readonly ready: boolean;
  readonly closeClass: QueueReadyCloseClass;
  readonly association?: "associated" | "not-associated" | "unknown";
  readonly pullRequest?: { entityId: string; sourceRef: string };
  readonly blocking?: readonly { id: string; state: string }[];
  readonly truncated?: boolean;
}): QueueReadyCandidate => {
  const association =
    input.association ?? (input.pullRequest === undefined ? "not-associated" : "associated");
  const reason =
    association === "associated"
      ? "pr-associated"
      : association === "unknown"
        ? "pr-association-unknown"
        : "pr-not-associated";
  const conditions: QueueReadyCondition[] = [
    "deps-satisfied",
    "repo-free",
    "tier-known",
    "no-owner-gate",
    "ci-healthy",
    "provider-available",
  ].map((id, index) => ({
    id: id as QueueReadyCondition["id"],
    state: input.blocking?.some((entry) => entry.id === id) === true ? "unknown" : "satisfied",
    evidence: [
      {
        source: index === 5 ? "provider-parks" : "tracker",
        reason: index === 5 ? "no-active-park" : "no-owner-labels",
      },
    ],
  }));
  return {
    workItemRef: input.ref,
    rank: input.rank,
    ready: input.ready,
    closeClass: input.closeClass,
    workItem: { state: "unknown", reason: "work-item-unobserved" },
    close: {
      association,
      associatedCount: input.pullRequest === undefined ? 0 : 1,
      ...(input.pullRequest === undefined
        ? {}
        : {
            pullRequest: {
              entityId: input.pullRequest.entityId,
              sourceRef: input.pullRequest.sourceRef,
              targetRef: "main-tools",
              draft: false,
              reviewStateObserved: false,
            },
          }),
      reason: reason as QueueReadyCandidate["close"]["reason"],
    },
    conditions,
    blockingConditions:
      input.blocking?.map((entry) => ({
        id: entry.id as QueueReadyCondition["id"],
        state: entry.state as QueueReadyCondition["state"],
      })) ?? [],
    truncated: input.truncated ?? false,
  };
};

const summaryOf = (candidates: readonly QueueReadyCandidate[]) => ({
  candidates: candidates.length,
  ready: candidates.filter((entry) => entry.ready).length,
  notReady: candidates.filter((entry) => !entry.ready).length,
  mergeReady: candidates.filter((entry) => entry.closeClass === "merge-ready").length,
  reviewPending: candidates.filter((entry) => entry.closeClass === "review-pending").length,
  newStart: candidates.filter((entry) => entry.closeClass === "new-start").length,
  unknownClose: candidates.filter((entry) => entry.closeClass === "unknown").length,
});

const syntheticPayload = (overrides: Partial<QueueReadyPayload> = {}): QueueReadyPayload => {
  const candidates = overrides.candidates ?? [
    candidate({
      ref: "GH-175",
      rank: 1,
      ready: true,
      closeClass: "merge-ready",
      pullRequest: { entityId: "201", sourceRef: "feat/GH-175/status-v1" },
    }),
    candidate({
      ref: "GH-179",
      rank: 2,
      ready: false,
      closeClass: "review-pending",
      pullRequest: { entityId: "209", sourceRef: "feat/GH-179/pending" },
      blocking: [{ id: "ci-healthy", state: "unsatisfied" }],
    }),
    candidate({ ref: "GH-170", rank: 3, ready: true, closeClass: "new-start" }),
    candidate({
      ref: "GH-180",
      rank: 4,
      ready: true,
      closeClass: "unknown",
      association: "unknown",
    }),
    candidate({
      ref: "GH-181",
      rank: 5,
      ready: false,
      closeClass: "not-ready",
      blocking: [{ id: "tier-known", state: "unknown" }],
    }),
  ];
  return {
    schemaVersion: "delivery.queue-ready.v1",
    generatedAt: NOW_ISO,
    repository: {
      state: "observed",
      host: "github.com",
      owner: "owner",
      name: "repo",
      remoteName: "origin",
    },
    head: { branch: "feat/GH-176/queue-ready", sha: SHA },
    candidates,
    summary: summaryOf(candidates),
    reasons: [],
    truncated: false,
    ...overrides,
  };
};

const characterCappedShorten = (value: string): string => {
  const points = Array.from(value);
  return points.length <= 32 ? value : `${points.slice(0, 31).join("")}+`;
};

const characterCappedDetail = (entry: QueueReadyCandidate): string => {
  const blocking =
    entry.blockingConditions.length === 0
      ? undefined
      : `blocking: ${entry.blockingConditions.map((condition) => `${condition.id}=${condition.state}`).join(", ")}`;
  const pullRequest = entry.close.pullRequest;
  if (pullRequest !== undefined) {
    const closeEvidence = `${characterCappedShorten(`PR #${pullRequest.entityId}`)} ${characterCappedShorten(pullRequest.sourceRef)}`;
    return blocking === undefined ? closeEvidence : `${closeEvidence} | ${blocking}`;
  }
  if (entry.ready && entry.close.association === "not-associated") {
    return "all six readiness conditions satisfied";
  }
  if (entry.ready && entry.close.association === "unknown") {
    return "close association unknown";
  }
  return blocking ?? "blocking: none";
};

/** The delivered character-capped renderer, kept local to prove the defect. */
const characterCappedRender = (
  payload: QueueReadyPayload,
  brand: { readonly binaryName: string },
): string => {
  const lines: string[] = [];
  if (payload.repository.state === "observed" && payload.head.sha !== undefined) {
    lines.push(
      `${brand.binaryName} queue ready ${payload.repository.owner}/${payload.repository.name} @ ${payload.head.branch ?? "detached"} ${payload.head.sha.slice(0, 7)}`,
    );
  }
  lines.push(
    `ready ${payload.summary.ready} | not-ready ${payload.summary.notReady} | merge-ready ${payload.summary.mergeReady} | review-pending ${payload.summary.reviewPending} | unknown-close ${payload.summary.unknownClose}${payload.truncated ? "+more" : ""}`,
  );
  for (const entry of payload.candidates) {
    lines.push(
      `${entry.rank}. ${entry.workItemRef}  ${entry.closeClass}  ${characterCappedDetail(entry)}  [repo:local-context; tier:priority-label]`,
    );
  }
  return `${lines.join("\n")}\n`;
};

describe("TC-QREADY-020 human digest grammar and bounds", () => {
  test("summary and one line per candidate in rank order, each with the fixed suffix", () => {
    const payload = syntheticPayload();
    const text = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    const lines = text.trimEnd().split("\n");
    expect(lines[0]).toContain(SYNTHETIC_BRAND.binaryName);
    expect(lines[1]).toBe(
      "ready 3 | not-ready 2 | merge-ready 1 | review-pending 1 | unknown-close 1",
    );
    expect(lines).toHaveLength(2 + payload.candidates.length);
    for (const [index, entry] of payload.candidates.entries()) {
      const line = lines[index + 2] ?? "";
      expect(line.startsWith(`${entry.rank}. ${entry.workItemRef}  ${entry.closeClass}`)).toBe(
        true,
      );
      expect(line.endsWith("[repo:local-context; tier:priority-label]")).toBe(true);
    }
    expect(text).toContain("PR #201 feat/GH-175/status-v1");
    expect(text).toContain("all six readiness conditions satisfied");
    expect(text).toContain("close association unknown");
    expect(text).toContain("blocking: ci-healthy=unsatisfied");
    expect(text).toContain("PR #209 feat/GH-179/pending | blocking: ci-healthy=unsatisfied");
  });

  test("+more follows the summary only on payload truncation", () => {
    expect(renderQueueReadyHuman(syntheticPayload(), SYNTHETIC_BRAND)).not.toContain("+more");
    expect(renderQueueReadyHuman(syntheticPayload({ truncated: true }), SYNTHETIC_BRAND)).toContain(
      "ready 3 | not-ready 2 | merge-ready 1 | review-pending 1 | unknown-close 1+more",
    );
  });

  test("the header is omitted when the binding is unavailable or the SHA is unresolved", () => {
    const down = syntheticPayload({
      repository: { state: "unavailable", reason: "addressing-unresolved" },
    });
    expect(renderQueueReadyHuman(down, SYNTHETIC_BRAND).split("\n")[0]).not.toContain(
      "queue ready",
    );
    const noSha = syntheticPayload({ head: { branch: "x" } });
    expect(renderQueueReadyHuman(noSha, SYNTHETIC_BRAND).split("\n")[0]).not.toContain(
      "queue ready",
    );
  });

  test("per-candidate provider segments are shortened to 32 characters with a trailing +", () => {
    const longId = "1".repeat(200);
    const longRef = `feat/GH-175/${"a".repeat(200)}`;
    const payload = syntheticPayload({
      candidates: [
        candidate({
          ref: "GH-175",
          rank: 1,
          ready: true,
          closeClass: "merge-ready",
          pullRequest: { entityId: longId, sourceRef: longRef },
        }),
      ],
    });
    const text = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    const prSegment = /PR #[^ ]+/.exec(text)?.[0];
    const refSegment = /feat\/GH-175\/[^ ]+/.exec(text)?.[0];
    expect(prSegment).toBeDefined();
    expect(refSegment).toBeDefined();
    for (const segment of [prSegment ?? "", refSegment ?? ""]) {
      expect(Array.from(segment).length).toBeLessThanOrEqual(32);
      expect(segment.endsWith("+")).toBe(true);
    }
    expect(text.endsWith("[repo:local-context; tier:priority-label]\n")).toBe(true);
  });

  test("the digest is bounded and carries no title, timestamp, or secret", () => {
    const payload = syntheticPayload({ truncated: true });
    const text = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    expect(text.trimEnd().split("\n").length).toBeLessThanOrEqual(16);
    expect(Buffer.byteLength(text)).toBeLessThanOrEqual(4096);
    expect(text.includes("planted")).toBe(false);
    expect(text.includes("planted-fake-secret")).toBe(false);
    expect(text.includes('"')).toBe(false);
  });

  test("the eight-candidate astral worst case renders a bounded digest and exits 0", async () => {
    const facts = humanAstral8Facts();
    const argv = ["queue", "ready", ...humanAstral8Refs];
    const human = await runQueueReadyCli(argv, queueRuntime(facts));
    expect(human.exitCode).toBe(0);
    expect(human.stderr).not.toContain("fallback.internal");
    expect(human.stdout.length).toBeGreaterThan(0);
    expect(human.stdout).not.toContain("RangeError");
    expect(Buffer.byteLength(human.stdout)).toBeLessThanOrEqual(4096);
    expect(human.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(16);

    const json = await runQueueReadyCli([...argv, "--json"], queueRuntime(facts));
    expect(json.exitCode).toBe(0);
    const payload = payloadOf(json.stdout);
    expect(JSON.stringify(payload)).toBe(JSON.stringify(evaluateQueueReady(facts)));
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(65536);
    expect(payload.candidates).toHaveLength(8);
    expect(payload.truncated).toBe(false);
    expect(payload.reasons).not.toContain("value-clamped");
    // Every condition and close field survives; only the render is byte-capped.
    expect(human.stdout.trimEnd().split("\n")).toHaveLength(2 + payload.candidates.length);
    for (const candidate of payload.candidates) {
      expect(candidate.conditions).toHaveLength(6);
      expect(candidate.blockingConditions).toHaveLength(6);
    }
  });

  test("the astral fixture reaches the defect: a character-capped render exceeds 4 096 bytes", () => {
    const payload = evaluateQueueReady(humanAstral8Facts());
    const characterCapped = characterCappedRender(payload, SYNTHETIC_BRAND);
    expect(Buffer.byteLength(characterCapped)).toBeGreaterThan(4096);
    const byteAware = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    expect(Buffer.byteLength(byteAware)).toBeLessThanOrEqual(4096);
  });

  test("every provider segment is at most 32 UTF-8 bytes with no split code point", () => {
    const text = renderQueueReadyHuman(evaluateQueueReady(humanAstral8Facts()), SYNTHETIC_BRAND);
    const segments = [
      ...text.matchAll(/PR #[^ ]+/g),
      ...text.matchAll(/feat\/GH-1[0-9][0-9]\/[^ ]+/g),
    ].map((match) => match[0]);
    expect(segments.length).toBeGreaterThanOrEqual(16);
    for (const segment of segments) {
      expect(Buffer.byteLength(segment)).toBeLessThanOrEqual(32);
      expect(segment.endsWith("+")).toBe(true);
      expect(new TextDecoder().decode(new TextEncoder().encode(segment))).toBe(segment);
      expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(segment)).toBe(false);
      expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(segment)).toBe(false);
    }
  });

  test("header fields are byte-capped and header plus summary stays within 620 bytes", () => {
    const capped = syntheticPayload({
      repository: {
        state: "observed",
        host: "github.com",
        owner: "o".repeat(200),
        name: "n".repeat(200),
        remoteName: "origin",
      },
      head: { branch: "b".repeat(300), sha: SHA },
      candidates: [candidate({ ref: "GH-175", rank: 1, ready: true, closeClass: "new-start" })],
    });
    const text = renderQueueReadyHuman(capped, SYNTHETIC_BRAND);
    const [header, summary, ...candidateLines] = text.trimEnd().split("\n");
    expect(header).toBeDefined();
    expect(summary).toBeDefined();
    const tail = (header ?? "").slice(SYNTHETIC_BRAND.binaryName.length);
    const match = /^ queue ready (o+\+?)\/(n+\+?) @ (b+\+?) ([0-9a-f]{7})$/.exec(tail);
    expect(match).not.toBeNull();
    expect(Buffer.byteLength(match?.[1] ?? "")).toBeLessThanOrEqual(128);
    expect(Buffer.byteLength(match?.[2] ?? "")).toBeLessThanOrEqual(128);
    expect(Buffer.byteLength(match?.[3] ?? "")).toBeLessThanOrEqual(256);
    expect(match?.[1]?.endsWith("+")).toBe(true);
    expect(match?.[2]?.endsWith("+")).toBe(true);
    expect(match?.[3]?.endsWith("+")).toBe(true);
    expect(Buffer.byteLength(`${tail}\n${summary ?? ""}`)).toBeLessThanOrEqual(620);
    for (const line of candidateLines) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(400);
    }

    const astral = renderQueueReadyHuman(evaluateQueueReady(humanAstral8Facts()), SYNTHETIC_BRAND);
    const astralLines = astral.trimEnd().split("\n");
    const astralTail = (astralLines[0] ?? "").slice(SYNTHETIC_BRAND.binaryName.length);
    expect(Buffer.byteLength(`${astralTail}\n${astralLines[1] ?? ""}`)).toBeLessThanOrEqual(620);
  });

  test("the over-budget brand drops trailing candidate lines in reverse rank order", async () => {
    const facts = humanOverBudgetFacts();
    const payload = evaluateQueueReady(facts);
    const before = JSON.stringify(payload);
    const run = await runQueueReadyCli(
      ["queue", "ready", ...humanOverBudgetRefs],
      queueRuntime(facts),
      { brand: HUMAN_OVER_BUDGET_BRAND },
    );
    expect(run.exitCode).toBe(0);
    expect(run.stderr).not.toContain("fallback.internal");
    const lines = run.stdout.trimEnd().split("\n");
    expect(lines.length).toBeGreaterThan(2);
    expect(lines.length).toBeLessThan(2 + payload.candidates.length);
    const [header, summary, ...survivors] = lines;
    expect(header).toContain(HUMAN_OVER_BUDGET_BRAND.binaryName);
    expect(summary?.endsWith("+more")).toBe(true);
    for (const [index, line] of survivors.entries()) {
      const expected = payload.candidates[index];
      expect(expected).toBeDefined();
      expect(line.startsWith(`${expected?.rank}. ${expected?.workItemRef}`)).toBe(true);
    }
    expect(Buffer.byteLength(run.stdout)).toBeLessThanOrEqual(4096);
    expect(lines.length).toBeLessThanOrEqual(16);

    // The payload is untouched by the renderer-only drop.
    expect(JSON.stringify(payload)).toBe(before);
    expect(payload.truncated).toBe(false);
    expect(payload.reasons).toEqual([]);

    // Stop at the first fit: restoring the next dropped line exceeds the bound.
    const nextDropped = payload.candidates[survivors.length];
    expect(nextDropped).toBeDefined();
    const restored = [
      header ?? "",
      summary ?? "",
      ...survivors,
      `${nextDropped?.rank}. ${nextDropped?.workItemRef}  ${nextDropped?.closeClass}  PR #201 feat/${nextDropped?.workItemRef}/${"a".repeat(116)}  [repo:local-context; tier:priority-label]`,
    ]
      .join("\n")
      .concat("\n");
    expect(Buffer.byteLength(restored)).toBeGreaterThan(4096);
  });

  test("the byte-cap boundary cases never split a code point", () => {
    const segmentFor = (sourceRef: string): string => {
      const payload = syntheticPayload({
        candidates: [
          candidate({
            ref: "GH-175",
            rank: 1,
            ready: true,
            closeClass: "merge-ready",
            pullRequest: { entityId: "201", sourceRef },
          }),
        ],
      });
      const match = /PR #201 (\S+)/.exec(renderQueueReadyHuman(payload, SYNTHETIC_BRAND));
      if (match?.[1] === undefined) throw new Error("source-ref segment missing");
      return match[1];
    };

    const ascii32 = segmentFor("x".repeat(32));
    expect(Buffer.byteLength(ascii32)).toBe(32);
    expect(ascii32.endsWith("+")).toBe(false);
    const ascii33 = segmentFor("x".repeat(33));
    expect(Buffer.byteLength(ascii33)).toBe(32);
    expect(ascii33.endsWith("+")).toBe(true);

    const cjk10 = segmentFor("汉".repeat(10));
    expect(Buffer.byteLength(cjk10)).toBe(30);
    expect(cjk10.endsWith("+")).toBe(false);
    const cjk11 = segmentFor("汉".repeat(11));
    expect(Buffer.byteLength(cjk11)).toBeLessThanOrEqual(32);
    expect(cjk11.endsWith("+")).toBe(true);

    const astral8 = segmentFor(humanAstral8(8));
    expect(Buffer.byteLength(astral8)).toBe(32);
    expect(astral8.endsWith("+")).toBe(false);
    const astral9 = segmentFor(humanAstral8(9));
    expect(astral9).toBe(`${humanAstral8(7)}+`);
    expect(Buffer.byteLength(astral9)).toBe(29);

    const crossing = segmentFor(`${"x".repeat(31)}${humanAstral8(1)}`);
    expect(Buffer.byteLength(crossing)).toBe(32);
    expect(crossing).toBe(`${"x".repeat(31)}+`);
    expect(crossing.includes("😀")).toBe(false);
  });
});

/* ------------------------------- reason helper ---------------------------- */

const overLongReasonsFixture = () =>
  baseFacts({
    tracker: workItemRead(
      [
        makeWorkItem({
          entityId: "176",
          labels: ["priority:high", "x".repeat(200)],
        }),
      ],
      {
        ownerHandBacks: "unavailable",
        blockedDependencies: "available",
        stalls: "available",
        hygiene: "available",
      },
      100,
    ),
    changes: failedDeliveryRequestRead("read-failed"),
    providers: providers({
      config: providerConfigFailed("config-invalid"),
      parks: { ok: false, reason: "state-unreadable" },
    }),
    localContext: missingLocalContext(),
  });

/* ------------------------------- TC-QREADY-034 ---------------------------- */

describe("TC-QREADY-034 top-level reasons", () => {
  test("group 2 markers precede config/park/source failures and the cap drops the seventh", () => {
    const payload = evaluate(overLongReasonsFixture());
    expect(payload.reasons).toEqual([
      "source-truncated",
      "value-clamped",
      "config-invalid",
      "state-unreadable",
      "local-context-missing",
      "signal-unavailable",
    ]);
    expect(payload.reasons).toHaveLength(6);
    expect(payload.truncated).toBe(true);
    expect(payload.candidates[0]?.truncated).toBe(false);
    expect(payload.reasons).not.toContain("pr-association-unknown");
  });

  test("group 5 follows the candidate → condition → evidence walk, not array order", () => {
    const availability = {
      ownerHandBacks: "unavailable" as const,
      blockedDependencies: "available" as const,
      stalls: "available" as const,
      hygiene: "available" as const,
    };
    const forward = evaluate({
      tracker: workItemRead([item("176")], availability),
      localContext: missingLocalContext(),
      candidates: ["GH-176", "GH-177"],
    });
    // Rank order GH-176 → GH-177; conditions in QUEUE_READY_CONDITION_ORDER:
    // repo-free (local-context-missing), tier-known (signal-unavailable), then
    // GH-177 deps-satisfied (work-item-unobserved).
    expect(forward.reasons).toEqual([
      "local-context-missing",
      "signal-unavailable",
      "work-item-unobserved",
    ]);
    const arrayOrder = QUEUE_READY_SOURCE_FAILURE_REASONS.filter((reason) =>
      forward.reasons.includes(reason),
    );
    expect(arrayOrder).toEqual([
      "signal-unavailable",
      "work-item-unobserved",
      "local-context-missing",
    ]);
    expect(forward.reasons).not.toEqual([...arrayOrder]);
    const shuffled = evaluate({
      tracker: workItemRead([item("176")], availability),
      localContext: missingLocalContext(),
      candidates: ["GH-177", "GH-176"],
    });
    expect(JSON.stringify(shuffled.reasons)).toBe(JSON.stringify(forward.reasons));
  });

  test("an under-cap run sets no overflow flag", () => {
    const payload = evaluate(
      baseFacts({
        tracker: workItemRead([item("176")], undefined, 100),
        changes: failedDeliveryRequestRead("read-failed"),
        providers: providers({
          config: providerConfigFailed("config-invalid"),
          parks: { ok: false, reason: "state-unreadable" },
        }),
        localContext: missingLocalContext(),
      }),
    );
    expect(payload.reasons).toEqual([
      "source-truncated",
      "config-invalid",
      "state-unreadable",
      "local-context-missing",
      "pr-association-unknown",
    ]);
    expect(payload.truncated).toBe(true);
  });

  test("the binding outcome is first and verdict reasons never leak", () => {
    const payload = evaluate({
      repository: {
        binding: { state: "unavailable", reason: "remote-unsupported" },
        head: { branch: "x", detached: false },
      },
      ci: pipelineRunRead([]),
      localContext: localContext(),
    });
    expect(payload.reasons[0]).toBe("remote-unsupported");
    for (const verdict of [
      "ci-pending",
      "ci-none",
      "tier-conflict",
      "dependency-open",
      "pr-not-associated",
      "no-owner-labels",
    ]) {
      expect(payload.reasons).not.toContain(verdict as never);
    }
  });

  test("first occurrence wins and scrambled input order does not change reasons", () => {
    const facts = baseFacts({
      tracker: workItemRead(
        [makeWorkItem({ entityId: "177" }), makeWorkItem({ entityId: "178" })],
        undefined,
        100,
      ),
      changes: failedDeliveryRequestRead("read-failed"),
    });
    const forward = evaluate(facts);
    const reversed = evaluate({
      ...facts,
      tracker: workItemRead(
        [...(facts.tracker.ok ? facts.tracker.items : [])].reverse(),
        undefined,
        100,
      ),
    });
    expect(reversed.reasons).toEqual(forward.reasons);
    expect(forward.reasons.filter((reason) => reason === "work-item-unobserved")).toHaveLength(1);
  });

  test("the payload markers are never condition or close evidence", () => {
    const payload = evaluate(overLongReasonsFixture());
    for (const entry of payload.candidates) {
      for (const condition of entry.conditions) {
        for (const record of condition.evidence) {
          expect(["source-truncated", "value-clamped"]).not.toContain(record.reason);
        }
      }
      expect(["source-truncated", "value-clamped"]).not.toContain(entry.close.reason);
    }
  });
});

/* ------------------------------- TC-QREADY-035 ---------------------------- */

describe("TC-QREADY-035 truncation flag scope", () => {
  test("issues at-limit sets payload only; 99 does not", () => {
    const atLimit = evaluate({ tracker: workItemRead([item("176")], undefined, 100) });
    const below = evaluate({ tracker: workItemRead([item("176")], undefined, 99) });
    expect(atLimit.reasons).toContain("source-truncated");
    expect(atLimit.truncated).toBe(true);
    expect(atLimit.candidates[0]?.truncated).toBe(false);
    expect(below.reasons).not.toContain("source-truncated");
    expect(below.truncated).toBe(false);
    expect(atLimit.candidates[0]?.conditions).toEqual(below.candidates[0]?.conditions ?? []);
  });

  test("a check-runs page of 20 is verdict-neutral", () => {
    const runs = (count: number) =>
      pipelineRunRead(
        [
          makePipelineRun({ entityId: "1", jobs: [job("build", "succeeded")] }),
          ...Array.from({ length: count - 1 }, (_, index) =>
            makePipelineRun({ entityId: String(index + 2), jobs: [job("build", "skipped")] }),
          ),
        ],
        count,
      );
    const at19 = evaluate({ ci: runs(19) });
    const at20 = evaluate({ ci: runs(20) });
    expect(at20.candidates[0]?.conditions).toEqual(at19.candidates[0]?.conditions ?? []);
    expect(at20.candidates[0]?.blockingConditions).toEqual(
      at19.candidates[0]?.blockingConditions ?? [],
    );
    expect(at20.reasons).toContain("source-truncated");
    expect(at19.reasons).not.toContain("source-truncated");
  });

  test("a provider clamp sets payload only and keeps verdicts identical", () => {
    const overLong = evaluate({
      tracker: workItemRead([
        makeWorkItem({ entityId: "176", labels: ["priority:high", "x".repeat(200)] }),
      ]),
    });
    expect(overLong.truncated).toBe(true);
    expect(overLong.reasons).toContain("value-clamped");
    expect(overLong.candidates[0]?.truncated).toBe(false);
    const control = evaluate({ tracker: workItemRead([item("176")]) });
    expect(overLong.candidates[0]?.conditions.map((entry) => entry.state)).toEqual(
      control.candidates[0]?.conditions.map((entry) => entry.state),
    );
  });

  test("a synthetic evidence-cap candidate shows +more without changing conditions", () => {
    const payload = syntheticPayload({
      candidates: [
        candidate({
          ref: "GH-176",
          rank: 1,
          ready: false,
          closeClass: "not-ready",
          blocking: [{ id: "tier-known", state: "unknown" }],
          truncated: true,
        }),
      ],
      truncated: true,
    });
    const text = renderQueueReadyHuman(payload, SYNTHETIC_BRAND);
    expect(text).toContain("+more");
    expect(payload.candidates[0]?.conditions).toHaveLength(6);
  });

  test("the exact flag combinations are asserted per cause", () => {
    expect(payloadFlags({ candidateTruncated: false, payloadTruncated: false })).toBe("none");
    expect(payloadFlags({ candidateTruncated: true, payloadTruncated: true })).toBe("both");
    expect(payloadFlags({ candidateTruncated: false, payloadTruncated: true })).toBe("payload");
  });
});

const payloadFlags = (input: {
  readonly candidateTruncated: boolean;
  readonly payloadTruncated: boolean;
}): string => {
  if (input.candidateTruncated && input.payloadTruncated) return "both";
  if (input.payloadTruncated) return "payload";
  if (input.candidateTruncated) return "candidate";
  return "none";
};

/* ------------------------------- TC-QREADY-038 ---------------------------- */

const overLongFacts = () => {
  const long = (char: string, length = 200) => char.repeat(length);
  const labels = Array.from({ length: 20 }, (_, index) => `${long("l")}${index}`);
  labels[17] = "priority:high";
  labels[18] = "hand-back";
  const relations = Array.from({ length: 20 }, (_, index) => ({
    relationKind: "blocked-by" as const,
    target: { systemName: long("s"), entityId: `${long("9")}${index}` },
  }));
  const mixed = [
    ...relations,
    { relationKind: "blocks" as const, target: { systemName: long("s"), entityId: "1" } },
    { relationKind: "parent" as const, target: { systemName: long("s"), entityId: "2" } },
  ];
  const prs = Array.from({ length: 3 }, (_, index) =>
    makeDeliveryRequest({
      entityId: long("8"),
      systemName: long("s"),
      sourceRef: `feat/GH-176/${long("r")}`,
      targetRef: long("t"),
      reviewState: "open",
    }),
  );
  return baseFacts({
    repository: {
      binding: {
        state: "observed",
        host: "github.com",
        owner: long("o"),
        name: long("n"),
        remoteName: "origin",
      },
      head: { branch: long("b", 300), sha: SHA, detached: false },
    },
    tracker: workItemRead([
      makeWorkItem({
        entityId: "176",
        labels,
        relations: mixed,
        updatedAt: long("u", 60),
      }),
    ]),
    changes: deliveryRequestRead(prs, REVIEWS_UNAVAILABLE),
  });
};

const shortTwinFacts = () =>
  baseFacts({
    tracker: workItemRead([
      makeWorkItem({
        entityId: "176",
        labels: ["priority:high", "hand-back"],
        relations: Array.from({ length: 20 }, (_, index) => blockedBy(`999${index}`)),
      }),
    ]),
    changes: deliveryRequestRead(
      Array.from({ length: 3 }, (_, index) => pr(String(index + 1))),
      REVIEWS_UNAVAILABLE,
    ),
  });

describe("TC-QREADY-038 provider-derived caps", () => {
  test("all nine caps are applied with entityId-only identities and value-clamped", async () => {
    const run = await runQueueReadyCli(
      ["queue", "ready", "GH-176", "--json"],
      queueRuntime(overLongFacts()),
    );
    expect(run.exitCode).toBe(0);
    const data = payloadOf(run.stdout);
    const entry = data.candidates[0];
    expect(entry).toBeDefined();
    if (entry === undefined) return;
    expect(entry.workItem.state).toBe("observed");
    if (entry.workItem.state !== "observed") return;
    expect(entry.workItem.labels?.length).toBe(16);
    for (const label of entry.workItem.labels ?? []) expect(label.length).toBeLessThanOrEqual(128);
    expect(entry.workItem.updatedAt?.length).toBe(40);
    expect(entry.workItem.relations?.length).toBe(16);
    for (const relation of entry.workItem.relations ?? []) {
      expect(relation.relationKind).toBe("blocked-by");
      expect(Object.keys(relation.target)).toEqual(["entityId"]);
      expect(relation.target.entityId.length).toBeLessThanOrEqual(128);
    }
    const text = JSON.stringify(data);
    expect(text.includes("systemName")).toBe(false);
    expect(text.includes("s".repeat(200))).toBe(false);
    expect(text.includes('"blocks"')).toBe(false);
    expect(text.includes('"parent"')).toBe(false);
    expect(text.includes("r".repeat(200))).toBe(false);
    if (data.repository.state === "observed") {
      expect(data.repository.owner.length).toBeLessThanOrEqual(128);
      expect(data.repository.name.length).toBeLessThanOrEqual(128);
    }
    expect(data.head.branch?.length).toBeLessThanOrEqual(256);
    const pullRequest = entry.close.pullRequest;
    expect(pullRequest?.entityId.length).toBeLessThanOrEqual(128);
    expect(pullRequest?.sourceRef.length).toBeLessThanOrEqual(128);
    expect(pullRequest?.targetRef.length).toBeLessThanOrEqual(128);
    expect(data.truncated).toBe(true);
    expect(data.reasons).toContain("value-clamped");
    expect(entry.truncated).toBe(false);
    expect(Buffer.byteLength(JSON.stringify(data))).toBeLessThanOrEqual(65536);
    const human = renderQueueReadyHuman(data, SYNTHETIC_BRAND);
    expect(Buffer.byteLength(human)).toBeLessThanOrEqual(4096);
  });

  test("the clamped verdicts equal the short no-caps oracle twin", () => {
    const capped = evaluate(overLongFacts());
    const oracle = evaluate(shortTwinFacts());
    const cappedCandidate = capped.candidates[0];
    const oracleCandidate = oracle.candidates[0];
    expect(cappedCandidate?.conditions.map((entry) => [entry.id, entry.state])).toEqual(
      oracleCandidate?.conditions.map((entry) => [entry.id, entry.state]),
    );
    expect(cappedCandidate?.blockingConditions).toEqual(oracleCandidate?.blockingConditions ?? []);
    expect(cappedCandidate?.closeClass).toBe(oracleCandidate?.closeClass);
    expect(cappedCandidate?.rank).toBe(oracleCandidate?.rank);
    expect(cappedCandidate?.close.associatedCount).toBe(oracleCandidate?.close.associatedCount);
    expect(capped.summary).toEqual(oracle.summary);
  });

  test("the over-long label beyond index 16 still decides tier and owner", () => {
    const payload = evaluate(overLongFacts());
    const conditions = payload.candidates[0]?.conditions ?? [];
    expect(conditions.find((entry) => entry.id === "tier-known")?.state).toBe("satisfied");
    expect(conditions.find((entry) => entry.id === "no-owner-gate")?.state).toBe("unsatisfied");
  });
});

/* ------------------------------- helpers ---------------------------------- */

const payloadViolations = (value: unknown): string[] => {
  const failures: string[] = [];
  if (typeof value !== "object" || value === null) return ["payload is not an object"];
  const payload = value as Record<string, unknown>;
  for (const key of [
    "schemaVersion",
    "generatedAt",
    "repository",
    "head",
    "candidates",
    "summary",
    "reasons",
    "truncated",
  ]) {
    if (!Object.hasOwn(payload, key)) failures.push(`missing ${key}`);
  }
  const candidates = payload.candidates;
  if (!Array.isArray(candidates)) {
    failures.push("candidates is not an array");
    return failures;
  }
  if (candidates.length > 8) failures.push(`candidates ${candidates.length} > 8`);
  const summary = payload.summary as { readonly candidates?: number } | undefined;
  if (summary?.candidates !== candidates.length) failures.push("summary.candidates mismatch");
  return failures;
};

const boundViolations = (payload: QueueReadyPayload): string[] => {
  const failures: string[] = [];
  const bytes = Buffer.byteLength(JSON.stringify(payload));
  if (bytes > 65536) failures.push(`serialized data ${bytes} > 65536`);
  return failures;
};

export const machinePayloadViolations = payloadViolations;
export const machineBoundViolations = boundViolations;
