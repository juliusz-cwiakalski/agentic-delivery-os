/**
 * TC-SLA-022 — board output, the human grid, diagnostics, and the decision
 * record carry only declared identifiers and policy values; no credential,
 * raw payload, title, body, comment, or free-form text escapes.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readOwnerGateSlaDecisions } from "../../packages/core/src/state/index";
import { SECRET_READ_ALLOWLIST } from "../../scripts/checks/secret-read-boundary";
import {
  boardData,
  boardGates,
  createBoardHarness,
  failingCollector,
} from "../fixtures/board/harness";
import {
  type GateFactInput,
  gateFact,
  HOUR_MS,
  type ownerReviewGate,
  waiverGate,
} from "../fixtures/board/matrix";
import { ledgerPath } from "../fixtures/state/harness";

const CANARIES = [
  "planted-board-title",
  "planted-board-body",
  "planted-board-comment",
  "planted-board-label",
  "planted-board-payload",
  "planted-board-credential",
];

type CanariedFact = ReturnType<typeof ownerReviewGate> & {
  readonly title: string;
  readonly body: string;
  readonly comment: string;
  readonly labels: readonly string[];
  readonly rawPayload: Record<string, string>;
  readonly credential: string;
};

const canaried = (input: GateFactInput): CanariedFact =>
  ({
    ...gateFact(input),
    title: "planted-board-title",
    body: "planted-board-body",
    comment: "planted-board-comment",
    labels: ["planted-board-label"],
    rawPayload: { secret: "planted-board-payload" },
    credential: "planted-board-credential",
  }) as unknown as CanariedFact;

const assertNoCanaries = (text: string): void => {
  for (const canary of CANARIES) {
    expect(text, canary).not.toContain(canary);
  }
};

describe("TC-SLA-022 privacy", () => {
  test("all canaries are absent from machine and human output", async () => {
    const gates = [
      canaried({ id: "GH-1401", ref: "GH-1401", ageMs: 2 * HOUR_MS }),
      canaried({ id: "GH-1402", ref: "GH-1402", kind: "waiver", ageMs: 73 * HOUR_MS }),
    ];
    const board = createBoardHarness({ gates });
    try {
      const json = await board.run([], { json: true });
      const text = await board.run([], { json: false });
      assertNoCanaries(json.stdout);
      assertNoCanaries(json.stderr);
      assertNoCanaries(text.stdout);
      assertNoCanaries(text.stderr);
    } finally {
      board.cleanup();
    }
  });

  test("only the declared DM-1 fields cross the boundary and ref is not the title", async () => {
    const gates = [canaried({ id: "GH-1403", ref: "GH-1403", ageMs: 2 * HOUR_MS })];
    const board = createBoardHarness({ gates });
    try {
      const run = await board.run([], { json: true });
      const gate = boardGates(run)[0] ?? {};
      expect(gate.ref).toBe("GH-1403");
      expect(gate.ref).not.toBe("planted-board-title");
      for (const forbidden of ["title", "body", "comment", "rawPayload", "credential", "labels"]) {
        expect(gate).not.toHaveProperty(forbidden);
      }
      expect(boardData(run)?.gates).toHaveLength(1);
    } finally {
      board.cleanup();
    }
  });

  test("the decision record carries only the declared EVT-1 fields and no canaries", async () => {
    const board = createBoardHarness({ gates: [waiverGate("GH-1404", 73 * HOUR_MS)] });
    try {
      await board.run([], { json: true });
      const read = readOwnerGateSlaDecisions(board.state.store);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.value.recordCount).toBe(1);
        const record = read.value.records[0] ?? {};
        expect(Object.keys(record).sort()).toEqual(
          [
            "appliedAt",
            "appliedDefault",
            "clockSource",
            "gateId",
            "gateKind",
            "schemaId",
            "thresholdCrossedMs",
            "workItemRef",
          ].sort(),
        );
      }
      assertNoCanaries(readFileSync(ledgerPath(board.state.identity), "utf8"));
    } finally {
      board.cleanup();
    }
  });

  test("a thrown secret is contained by the failure path and never emitted", async () => {
    const secret = "planted-fake-secret-0220";
    const board = createBoardHarness({
      secrets: [secret],
      collectors: [
        {
          id: "tracker",
          read: async () => {
            throw new Error(`synthetic failure ${secret}`);
          },
        },
      ],
    });
    try {
      const run = await board.run([], { json: true });
      expect(run.exitCode).toBe(2);
      expect(run.stdout).not.toContain(secret);
      expect(run.stderr).not.toContain(secret);
    } finally {
      board.cleanup();
    }
  });

  test("the secret-read allowlist has not grown", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
  });

  test("error prose is bounded table prose, not a raw exception message", async () => {
    const board = createBoardHarness({ collectors: [failingCollector("tracker")] });
    try {
      const run = await board.run([], { json: true });
      const error = run.envelope?.error as { summary?: string; remediationHint?: string };
      expect(error.remediationHint?.length ?? 0).toBeGreaterThan(0);
      expect(error.summary ?? "").not.toContain("Error:");
      expect(error.summary?.length ?? 0).toBeLessThanOrEqual(160);
    } finally {
      board.cleanup();
    }
  });
});
