/**
 * TC-MERGE-034 — no secret, title, body, comment, raw payload, or log body
 * reaches any output or record; allowed identity fields remain; the single
 * redaction chokepoint covers a declared waiver reason/authorizer.
 */
import { describe, expect, test } from "bun:test";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";
import {
  baseRequest,
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_MS,
  MERGE_HEAD,
  MERGE_REF,
  verificationRecord,
} from "../fixtures/merge/harness";

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
