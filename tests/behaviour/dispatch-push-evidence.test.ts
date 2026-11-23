/**
 * GH-386 — the terminal parity evidence (TC-PUSH-014's reservation and budget,
 * TC-BND-001's added-cost bound, TC-PUSH-015/016's behaviour halves, and the
 * lane-append reservation pairing).
 *
 * The production-composed cases drive the real command path over injected
 * facts; the disclosure-stress case drives the real engine (runDispatch) over a
 * scripted stall ladder so the evidence slice genuinely overflows the delivered
 * 16-reference budget and the reservation is observed holding.
 */
import { describe, expect, test } from "bun:test";
import { runDispatch } from "../../packages/core/src/app/dispatch";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_ATTEMPT_PAYLOAD_SCHEMA,
  type DispatchPushParityReading,
  type HarnessEvidence,
  type HarnessResult,
  type HarnessSessionHandle,
  type HarnessSessionPort,
} from "../../packages/core/src/contracts/index";
import { classifyHarnessEvidence } from "../../packages/core/src/domain/harness-classify";
import { readsFrom } from "../fixtures/dispatch/golden/harness";
import { createDispatchState } from "../fixtures/dispatch/harness";
import {
  createParityHarness,
  type ParityObservation,
  readableParityTransport,
} from "../fixtures/dispatch/parity/harness";
import { PARITY_LOCAL_HEAD } from "../fixtures/dispatch/truth";

const LOCAL_HEAD = "0123456789abcdef";
const REMOTE_HEAD = "fedcba9876543210";
const BRANCH = "feat/GH-347/parity";

const openPull = (sha: string): unknown => ({
  number: 501,
  state: "open",
  head: { ref: BRANCH, sha },
  base: { ref: "main-tools" },
});

const pushedParity = (): DispatchPushParityReading => ({
  ok: true,
  facts: {
    localHead: PARITY_LOCAL_HEAD,
    remoteHead: PARITY_LOCAL_HEAD,
    verdict: "pushed",
    parity: true,
  },
});

/**
 * One scripted port whose collect reports a harness timeout for the declared
 * call count (the restart-eligible stall), then completes.
 */
const createStallLadderPort = (
  timedOutCollects: number,
  evidence: HarnessEvidence,
): { readonly port: HarnessSessionPort; readonly calls: readonly string[] } => {
  const calls: string[] = [];
  let collects = 0;
  const handle: HarnessSessionHandle = {
    harnessKind: "opencode",
    sessionId: "session-ladder",
    treeRoot: "/tmp/session-ladder",
    workItemRef: "GH-301",
  };
  const port: HarnessSessionPort = {
    spawn: async () => {
      calls.push("spawn");
      return { ok: true, value: handle };
    },
    resume: async () => {
      calls.push("resume");
      return { ok: true, value: handle };
    },
    collect: async (): Promise<HarnessResult<HarnessEvidence>> => {
      calls.push("collect");
      collects += 1;
      return {
        ok: true,
        value:
          collects <= timedOutCollects
            ? {
                completionMarker: false,
                exitStatus: null,
                timedOut: true,
                spawnRefused: false,
                failureReported: false,
                toolFailure: false,
              }
            : evidence,
      };
    },
    classify: (input) => classifyHarnessEvidence(input),
    liveness: async () => {
      calls.push("liveness");
      return {
        ok: true,
        value: {
          readings: [
            {
              kind: "session-traffic",
              status: "sourced",
              value: 1,
              observedAt: "2026-11-08T10:00:00.000Z",
            },
          ],
        },
      };
    },
    listSessions: async () => ({ ok: true, value: { handles: [handle] } }),
  };
  return { port, calls };
};

describe("TC-PUSH-014 the push reference is reserved ahead of the evidence slice", () => {
  test("with the slice overflowing, the disclosure survives and the budget holds", async () => {
    const state = createDispatchState("push-014-stress");
    try {
      // Seventeen stalled iterations: seventeen carried liveness references,
      // so the terminal classification's slice genuinely overflows. Each stall
      // path reads truth with NO decisive artifact (the ladder must restart,
      // never short-circuit); the final classification reads the open PR.
      const { port } = createStallLadderPort(17, {
        completionMarker: true,
        exitStatus: 0,
        timedOut: false,
        spawnRefused: false,
        failureReported: false,
        toolFailure: false,
      });
      let truthCalls = 0;
      const result = await runDispatch({
        store: state.store,
        fenceToken: state.fenceToken,
        harness: port,
        harnessKind: "opencode",
        descriptor: { kind: "host", workDirectory: state.root, environment: [] },
        prompt: "deliver GH-301",
        ref: "GH-301",
        evidenceClass: "pilot",
        repository: "github.com/owner/repo",
        handoverState: "dual-run",
        nowIso: () => "2026-11-08T10:00:00.000Z",
        newAttemptId: () => "attempt-push-014",
        newDivergenceId: () => "DIV-push-014",
        readTruth: async () => {
          truthCalls += 1;
          // The stall paths (calls 1..17) see no pull request and no decisive
          // tracker verdict, so the ladder restarts; the final classification
          // reads the open pull request and reaches arm 8.
          return truthCalls <= 17
            ? readsFrom({
                artifacts: {
                  ok: true,
                  value: {
                    branchCommits: 2,
                    pr: { state: "none", url: null, mergeReady: false },
                    pmNotes: "complete",
                  },
                },
              })
            : readsFrom();
        },
        claimLease: () => ({ ok: true, leaseId: "lease" }),
        releaseLease: () => true,
        phaseLedger: { completed: 3, total: 9, variant: "full" },
        restartBudget: 24,
        pushParity: async () => pushedParity(),
      });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.result).toBe("pr-open");
      expect(result.data.push).toEqual({
        verdict: "pushed",
        localHead: PARITY_LOCAL_HEAD,
        remoteHead: PARITY_LOCAL_HEAD,
        parity: true,
      });
      // The reservation held: the disclosure is the slice's FIRST reference and
      // the delivered 16-reference budget is never exceeded.
      const refs = result.attempt.evidenceRefs;
      expect(refs.length).toBe(16);
      expect(refs[0]).toBe("push:pushed");
      expect(refs[1]).toBe("attempt:attempt-push-014");
      // The tail the reservation displaced is a carried liveness verdict, and
      // the final iteration's own reference did not survive over the disclosure.
      expect(
        refs.some(
          (ref) =>
            !ref.startsWith("liveness:") && ref !== "push:pushed" && !ref.startsWith("attempt:"),
        ),
      ).toBe(false);
      const read = readDispatchAttempts(state.store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records[0]?.evidenceRefs).toEqual(refs);
    } finally {
      state.dispose();
    }
  });

  test("each evaluating verdict carries exactly one push reference, identifiers only", async () => {
    const observation = await runProduction({
      label: "push-014-per-verdict",
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, LOCAL_HEAD],
      push: () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
    });
    const refs = observation.attempts[0]?.evidenceRefs ?? [];
    expect(refs.filter((ref) => ref.startsWith("push:"))).toEqual(["push:pushed"]);
    expect(refs.length).toBeLessThanOrEqual(16);
    for (const ref of refs) {
      expect(ref).not.toContain("\n");
      expect(ref.trim()).toBe(ref);
    }
  });
});

/** One production-composed pr-open run over the declared head facts. */
const runProduction = async (input: {
  readonly label: string;
  readonly pullHeadCalls?: readonly (string | "unreadable")[];
  readonly push?: () => {
    readonly stdout: string;
    readonly stderr: string;
    readonly status: number;
    readonly timedOut: boolean;
  };
}): Promise<ParityObservation> => {
  const h = createParityHarness({
    label: input.label,
    ...(input.push === undefined ? {} : { push: input.push }),
    ...(input.pullHeadCalls === undefined ? {} : { pullHeadCalls: input.pullHeadCalls }),
    transport: readableParityTransport({
      openPulls: [openPull(input.pullHeadCalls?.[0] ?? LOCAL_HEAD)],
    }),
  });
  try {
    await h.run();
    return h.observe();
  } finally {
    h.dispose();
  }
};

describe("TC-PUSH-014 the reservation pairs beside the lane-append disclosure", () => {
  test("a failed lane append and the push verdict lead the slice together", async () => {
    const { failLaneAppends } = await import("../fixtures/dispatch/parity/lane");
    const h = createParityHarness({
      label: "push-014-lane-pair",
      storeWrap: (store) => failLaneAppends(store),
      transport: readableParityTransport({ openPulls: [openPull(LOCAL_HEAD)] }),
    });
    try {
      await h.run();
      const observation = h.observe();
      expect(observation.token).toBe("pr-open");
      const refs = observation.attempts[0]?.evidenceRefs ?? [];
      // Both reserved references precede the slice: the append disclosure and
      // the parity verdict, in reservation order.
      expect(refs[0]).toBe("lane:append-failed");
      expect(refs[1]).toBe("push:clean");
      expect(refs.length).toBeLessThanOrEqual(16);
    } finally {
      h.dispose();
    }
  });
});

describe("TC-BND-001 the added classification cost is exactly the declared bound", () => {
  test("equal heads add one parity read and no new provider read class", async () => {
    const requests: string[] = [];
    const observation = await runProductionRequests({
      label: "bnd-001-clean",
      requests,
    });
    expect(observation.token).toBe("pr-open");
    const pulls = requests.filter((url) => url.includes("/pulls?state=open"));
    const closed = requests.filter((url) => url.includes("/pulls?state=closed"));
    const others = requests.filter(
      (url) => !url.includes("/pulls?") && !url.includes("/issues") && !url.includes("/check-runs"),
    );
    // Truth read (one matched open-request read) plus the parity read's one
    // open-request read; no provider read class beyond the delivered
    // truth-read family appears.
    expect(pulls).toHaveLength(2);
    expect(closed).toHaveLength(0);
    expect(others).toHaveLength(0);
  });

  test("a performed push adds exactly one re-read and nothing else", async () => {
    const requests: string[] = [];
    const observation = await runProductionRequests({
      label: "bnd-001-ahead",
      requests,
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD, LOCAL_HEAD],
      push: () => ({ stdout: "", stderr: "", status: 0, timedOut: false }),
    });
    expect(observation.token).toBe("pr-open");
    expect(observation.attempts[0]?.evidenceRefs).toContain("push:pushed");
    const pulls = requests.filter((url) => url.includes("/pulls?state=open"));
    // Truth read + parity read + exactly one re-read.
    expect(pulls).toHaveLength(3);
  });

  test("no new configuration key exists on any path", async () => {
    const { resolveConfig, PRODUCTION_CATALOG } = await import("../../packages/core/src/index");
    const resolved = resolveConfig({ sources: [] });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const serialized = JSON.stringify(resolved.value.values);
    for (const forbidden of ["push-timeout", "pushTimeout", "ensure-push", "parity"]) {
      expect(serialized.toLowerCase()).not.toContain(forbidden);
    }
    expect(JSON.stringify(PRODUCTION_CATALOG).toLowerCase()).not.toContain("push-timeout");
  });
});

const runProductionRequests = async (input: {
  readonly label: string;
  readonly requests: string[];
  readonly pullHeadCalls?: readonly (string | "unreadable")[];
  readonly push?: () => {
    readonly stdout: string;
    readonly stderr: string;
    readonly status: number;
    readonly timedOut: boolean;
  };
}): Promise<ParityObservation> => {
  const h = createParityHarness({
    label: input.label,
    ...(input.push === undefined ? {} : { push: input.push }),
    ...(input.pullHeadCalls === undefined ? {} : { pullHeadCalls: input.pullHeadCalls }),
    transport: readableParityTransport({
      openPulls: [openPull(input.pullHeadCalls?.[0] ?? LOCAL_HEAD)],
      requests: input.requests,
    }),
  });
  try {
    await h.run();
    return h.observe();
  } finally {
    h.dispose();
  }
};

describe("TC-PUSH-015/016 the envelope block rides the machine data only (behaviour)", () => {
  test("the typed failure's block names both heads with parity false, text mode never sees it", async () => {
    const h = createParityHarness({
      label: "push-015-failure-block",
      transport: readableParityTransport({ openPulls: [openPull(REMOTE_HEAD)] }),
      pullHeadCalls: [REMOTE_HEAD, REMOTE_HEAD],
      push: () => ({ stdout: "", stderr: "! [rejected]", status: 1, timedOut: false }),
    });
    try {
      const result = await h.run(["dispatch", "GH-347"]);
      // Text mode carries the four keys only; the parity facts never enter it.
      const lines = result.stdout.split("\n").filter((line) => line.length > 0);
      expect(lines.map((line) => line.split("=")[0])).toEqual([
        "result",
        "pr_url",
        "exit_code",
        "last_message",
      ]);
      expect(result.stdout).toContain("result=failed");
      expect(result.stdout).toContain("pr_url=https://github.com/owner/repo/pull/501");
      expect(result.stdout).not.toContain(LOCAL_HEAD);
      expect(result.stdout).not.toContain(REMOTE_HEAD);
      expect(result.stdout).not.toContain("push=");
      // The machine data of the same classification carries the block.
      const machine = await h.run(["dispatch", "GH-347", "--json"]);
      const data = machine.envelope?.data;
      expect(data?.result).toBe("failed");
      expect(data?.push).toEqual({
        verdict: "failed",
        localHead: LOCAL_HEAD,
        remoteHead: REMOTE_HEAD,
        parity: false,
      });
      // The whole block is bounded single-line members within the delivered
      // 256-character dispatch bound (NFR-4).
      const serialized = JSON.stringify(data?.push) ?? "";
      expect(serialized.length).toBeLessThanOrEqual(256);
      expect(serialized).not.toContain("\n");
    } finally {
      h.dispose();
    }
  });

  test("the attempt record gains no schema field; parity evidence rides the refs", async () => {
    const observation = await runProduction({
      label: "push-015-record-shape",
    });
    const attempt = observation.attempts[0];
    const keys = Object.keys(attempt ?? {}).sort();
    expect(keys).not.toContain("push");
    expect(keys).not.toContain("pushVerdict");
    expect(attempt?.schema).toBe(DISPATCH_ATTEMPT_PAYLOAD_SCHEMA);
    expect(attempt?.evidenceRefs).toContain("push:clean");
  });
});
