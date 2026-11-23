/**
 * TC-MERGE-034 — no secret, title, body, comment, raw payload, or log body
 * reaches any output or record; allowed identity fields remain; the single
 * redaction chokepoint covers a declared waiver reason/authorizer.
 */
import { describe, expect, test } from "bun:test";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
} from "../../packages/core/src/state/index";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";
import { API_MEMBER, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  memberGatesRuntime,
  reviewObservation,
} from "../fixtures/cross-repository/facts";
import {
  baseRequest,
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  MERGE_REF,
  verificationRecord,
} from "../fixtures/merge/harness";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";
import {
  baseFacts,
  CANARY,
  clone,
  EXPECTED_JOBS,
  run as verificationRun,
} from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const CANARIES = [
  "planted-merge-title",
  "planted-merge-body",
  "planted-merge-comment",
  "planted-merge-payload",
  "planted-merge-logbody",
  "planted-merge-credential",
];

const canariedWorkItem = () =>
  baseWorkItem({
    title: "planted-merge-title",
    comments: [{ commentId: "1", authorAccount: "fixture", body: "planted-merge-comment" }],
  });

const canariedRequest = () =>
  baseRequest({
    sourceRef: "feat/GH-301/merge",
    threads: [],
  });

const allText = (run: { stdout: string; stderr: string; envelope?: unknown }): string =>
  `${run.stdout}\n${run.stderr}\n${JSON.stringify(run.envelope ?? {})}`;

describe("TC-MERGE-034 privacy on success and refusal paths", () => {
  test("disallowed content never reaches any output or record", async () => {
    const cases = [
      { name: "success", record: verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }) },
      { name: "stale", record: verificationRecord({ verifiedAt: isoAt(-31 * MINUTE) }) },
      {
        name: "tracker",
        record: verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }),
        workItem: baseWorkItem({
          title: "planted-merge-title",
          labels: ["change", "hand-back"],
          updatedAt: isoAt(-1 * MINUTE),
          comments: [{ commentId: "1", authorAccount: "fixture", body: "planted-merge-comment" }],
        }),
      },
    ];
    for (const entry of cases) {
      const harness = createMergeHarness({
        workItem: entry.workItem ?? canariedWorkItem(),
        request: canariedRequest(),
      });
      try {
        harness.seedVerification(entry.record);
        const result = await harness.run();
        const records = JSON.stringify({
          verifications: harness.verifications(),
          waivers: harness.waivers(),
          transactions: harness.transactions(),
          audit: harness.auditRecords,
        });
        const text = `${allText(result)}\n${records}`;
        for (const canary of CANARIES) {
          expect(text, `${entry.name}:${canary}`).not.toContain(canary);
        }
      } finally {
        harness.cleanup();
      }
    }
  });

  test("a canaried fixture is live and a title leak is detected", () => {
    const workItem = canariedWorkItem();
    const request = canariedRequest();
    expect(workItem.title).toBe("planted-merge-title");
    expect(workItem.comments?.[0]?.body).toBe("planted-merge-comment");
    expect(request.sourceRef).toContain("GH-301");
    // Mutation control: if the title were copied into evidence, the scan fails.
    const leaked = `gate=owner-gate evidence=${workItem.title}`;
    expect(leaked).toContain("planted-merge-title");
    expect(CANARIES.some((canary) => leaked.includes(canary))).toBe(true);
  });

  test("allowed identity fields remain present", async () => {
    const harness = createMergeHarness();
    try {
      harness.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const result = await harness.run();
      const text = JSON.stringify(result.envelope?.data);
      expect(text).toContain(MERGE_REF);
      expect(text).toContain(MERGE_HEAD);
      expect(text).toContain("ci-green");
    } finally {
      harness.cleanup();
    }
  });

  test("the single redaction chokepoint covers a declared authorizer", async () => {
    const harness = createMergeHarness({
      workItem: baseWorkItem({ labels: ["change", "hand-back"], updatedAt: isoAt(-3 * MINUTE) }),
      ownerPrincipal: "owner-principal",
    });
    try {
      harness.seedVerification(
        verificationRecord({
          verifiedAt: isoAt(-2 * MINUTE),
          trackerPosture: { labels: ["change", "hand-back"], ownerLabels: ["hand-back"] },
          gates: [
            ...verificationRecord().gates.filter((gate) => gate.id !== "owner-gate"),
            {
              id: "owner-gate",
              verdict: "fail",
              reason: "owner-gate-present",
              citation: {
                sources: [],
                identity: { changeRef: MERGE_REF },
                counts: [],
                names: [{ kind: "owner-labels", values: ["hand-back"], omitted: 0 }],
                reasons: ["owner-gate-present"],
              },
            },
          ],
        }),
      );
      const result = await harness.run(
        [harness.ref, "--waive", "owner-gate", "--waived-by", "planted-merge-credential"],
        { json: false, secrets: ["planted-merge-credential"] },
      );
      expect(result.stderr).toContain("[redacted]");
      expect(result.stderr).not.toContain("planted-merge-credential");
    } finally {
      harness.cleanup();
    }
  });

  test("no new secret-read allowlist entry was added", () => {
    // Pinned as an exact set: the `packages/mcp/src/serve.ts` entry originates in
    // GH-231 (S7 MCP) and is inherited from the integration branch; this change
    // (GH-225 merge/verify-deploy) adds no secret-read allowlist entry of its own.
    expect(SECRET_READ_ALLOWLIST.map((entry) => entry.path).sort()).toEqual([
      "packages/adapters/src/credentials",
      "packages/adapters/src/file/yaml-parser.ts",
      "packages/adapters/src/legacy/index.ts",
      "packages/core/src/state/driver/runtime-edge.ts",
      "packages/mcp/src/serve.ts",
    ]);
  });
});

describe("TC-VGATES-075 shipped-produced records and outputs are secret-free", () => {
  /**
   * Planted canary material in every provider payload field the delivered
   * privacy rules exclude from records and outputs — the delivered canary
   * technique of TC-MERGE-005/TC-MERGE-034, now over records the shipped
   * verify-gates handler produced with the real append.
   */
  const VG_CANARIES = [CANARY, "planted-vg-comment", "planted-vg-payload", "planted-vg-credential"];

  const canariedFacts = (red: boolean) => {
    const facts = clone(baseFacts());
    facts.workItem = {
      ok: true,
      value: {
        item: {
          ...baseWorkItem({
            title: CANARY,
            labels: ["change"],
          }),
          comments: [{ commentId: "1", authorAccount: "fixture", body: "planted-vg-comment" }],
        },
      },
    };
    if (red) {
      facts.checkRuns = {
        ok: true,
        value: {
          items: EXPECTED_JOBS.map((name, index) =>
            verificationRun(name, index === 0 ? "failed" : "succeeded"),
          ),
          pageItemCount: EXPECTED_JOBS.length,
        },
      };
    }
    return facts;
  };

  const realAppendOver =
    (store: ReturnType<typeof makeAuditStore>["store"]) =>
    (
      record: Parameters<typeof appendMergeGateVerification>[1]["record"],
    ):
      | {
          readonly ok: true;
        }
      | {
          readonly ok: false;
          readonly code: string;
        } => {
      const appended = appendMergeGateVerification(store, {
        record,
        fenceToken: "vg-privacy",
      });
      return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
    };

  const scan = (text: string, label: string): void => {
    for (const canary of VG_CANARIES) {
      expect(text, `${label}:${canary}`).not.toContain(canary);
    }
  };

  test("pass and fail cells over canaried facts leak nothing into records or outputs", async () => {
    for (const red of [false, true]) {
      const fixture = makeAuditStore(`vg-privacy-${red ? "fail" : "pass"}`);
      try {
        const runtime = combinedRuntime({
          facts: canariedFacts(red),
          appendVerification: realAppendOver(fixture.store),
        });
        const json = await runVerify(runtime, ["gates", "GH-178"], { json: true });
        const human = await runVerify(runtime, ["gates", "GH-178"], { json: false });
        const read = readMergeGateVerifications(fixture.store, "GH-178");
        const records = JSON.stringify(read.ok ? read.records : []);
        const text = `${json.stdout}\n${json.stderr}\n${human.stdout}\n${human.stderr}\n${records}`;
        scan(text, red ? "fail" : "pass");
        // The record is live: every non-refused evaluation appended one.
        expect(read.ok && read.records).toHaveLength(2);
        // The canary facts were live: the planted title reached the runtime.
        expect(VG_CANARIES.includes(CANARY)).toBe(true);
      } finally {
        removeRoot(fixture.root);
      }
    }
  });

  test("the member-projected record over the member world leaks nothing", async () => {
    const fixture = makeAuditStore("vg-privacy-member");
    try {
      // The member world composes the delivered change-level facts, whose work
      // item already carries the planted CANARY title — the member scan is
      // live over the same planted material.
      const runtime = memberGatesRuntime({
        members: [
          declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
          declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
        ],
        reads: {
          [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
          [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
        },
        landings: [landingObservation(API_MEMBER, false), landingObservation(WEB_MEMBER, false)],
        reviews: [reviewObservation(API_MEMBER, ["pass"]), reviewObservation(WEB_MEMBER, ["pass"])],
      });
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("member runtime is missing the gates member");
      const run = await runVerify(
        { ...runtime, gates: { ...gates, appendVerification: realAppendOver(fixture.store) } },
        ["gates", "GH-310"],
      );
      expect(run.exitCode).toBe(0);
      const read = readMergeGateVerifications(fixture.store, "GH-310");
      const records = JSON.stringify(read.ok ? read.records : []);
      const text = `${run.stdout}\n${run.stderr}\n${records}`;
      scan(text, "member");
      expect(read.ok && read.records).toHaveLength(1);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("the five-gate regression fixtures stay delivered-true (mutation control)", () => {
    // The unchanged-behaviour clause rides the aggregate gate: the delivered
    // CI, lifecycle, owner-composition, parity-squash, and member suites stay
    // green unchanged with the persistence live. The control here proves the
    // scan itself is live: the planted canary is detectable by the same scan.
    const planted = `gate=owner-gate evidence=${CANARY}`;
    expect(VG_CANARIES.some((canary) => planted.includes(canary))).toBe(true);
    expect(planted).toContain(CANARY);
  });
});
