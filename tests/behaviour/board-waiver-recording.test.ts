/**
 * TC-MERGE-020 — the board consumes recorded waivers: a gate with a recorded
 * authorized waiver is collected as waiver-kind with its recorded authorizer
 * (the GH-229 GAP-9 flip), while an unwaived gate stays owner-review/null. The
 * payload schema and the unwaived escalation posture are unchanged.
 */
import { describe, expect, test } from "bun:test";
import { nodeRepositoryIo } from "../../packages/adapters/src/repo/index";
import { createBoardCommandDefinition } from "../../packages/cli/src/commands/board";
import { createBoardCommandRuntime, type StatusTransport } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import {
  type ExternalSystemInstance,
  MERGE_WAIVER_SCHEMA,
} from "../../packages/core/src/contracts/index";
import { appendMergeWaiver } from "../../packages/core/src/state/index";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const NOW_ISO = "2026-11-06T12:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const HOUR_MS = 3_600_000;

const github = (): ExternalSystemInstance => ({
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: { referenceName: "read", sourceKey: { style: "literal", name: "TOKEN" } },
  },
});

const issue = (number: number, labels: readonly string[], updatedAt: string) => ({
  number,
  title: `Issue ${number}`,
  state: "open",
  labels: labels.map((name) => ({ name })),
  updated_at: updatedAt,
});

const transport = (): StatusTransport => ({
  send: async () => ({
    status: 200,
    body: [
      issue(301, ["hand-back"], new Date(NOW_MS - 2 * HOUR_MS).toISOString()),
      issue(302, ["hand-back"], new Date(NOW_MS - 26 * HOUR_MS).toISOString()),
    ],
  }),
});

const credential = () => ({
  resolve: () => ({ ok: true as const, material: { value: "fixture-token" } }),
});

const runBoard = async (store: ReturnType<typeof makeAuditStore>["store"], seed = true) => {
  if (seed) {
    const appended = appendMergeWaiver(store, {
      fenceToken: "fixture-board-waiver",
      record: {
        schema: MERGE_WAIVER_SCHEMA,
        changeRef: "GH-301",
        gateId: "owner-gate",
        gateClass: "owner-review",
        authorizer: "owner-principal",
        authorizedAt: NOW_ISO,
      },
    });
    if (!appended.ok) throw new Error(appended.error.code);
  }
  const runtime = createBoardCommandRuntime({
    store,
    repository: { cwd: process.cwd(), io: nodeRepositoryIo() },
    github: {
      instance: github(),
      credentials: credential() as never,
      transport: transport(),
    },
    nowIso: () => NOW_ISO,
    nowMs: () => NOW_MS,
    newFenceToken: () => `board-${Math.random().toString(16).slice(2)}`,
  });
  const stdout = bufferSink();
  const stderr = bufferSink();
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => NOW_MS },
    newRunId: () => "run-board-waiver",
    secrets: [],
    program: { commands: { board: createBoardCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(["--json", "board"], { stdout, stderr }, deps);
  const envelope = JSON.parse(stdout.value) as {
    data?: {
      schemaVersion?: string;
      gates?: readonly {
        id: string;
        kind: string;
        waivedBy: string | null;
        slaState: string;
      }[];
      [key: string]: unknown;
    };
  };
  return { exitCode, envelope };
};

describe("TC-MERGE-020 board consumes recorded waivers", () => {
  test("a recorded waiver flips the gate to waiver-kind with its authorizer", async () => {
    const fixture = makeAuditStore("board-waiver");
    try {
      const first = await runBoard(fixture.store);
      expect(first.exitCode).toBe(0);
      const gates = first.envelope.data?.gates ?? [];
      const waived = gates.find((gate) => gate.id.startsWith("301:"));
      const unwaived = gates.find((gate) => gate.id.startsWith("302:"));
      expect(waived?.kind).toBe("waiver");
      expect(waived?.waivedBy).toBe("owner-principal");
      expect(unwaived?.kind).toBe("owner-review");
      expect(unwaived?.waivedBy).toBeNull();
      // The payload schema is unchanged: the flip is data population.
      expect(Object.keys(first.envelope.data ?? {}).sort()).toEqual([
        "audience",
        "collectors",
        "gates",
        "omitted",
        "schemaVersion",
        "truncated",
      ]);
      // The unwaived never-merge gate keeps its escalation posture.
      expect(unwaived?.slaState).toBe("escalated");
      // Determinism.
      const second = await runBoard(fixture.store);
      expect(second.envelope.data).toEqual(first.envelope.data);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("no recorded waiver leaves waivedBy null (no synthesis)", async () => {
    const fixture = makeAuditStore("board-waiver-absent");
    try {
      const result = await runBoard(fixture.store, false);
      const gates = result.envelope.data?.gates ?? [];
      expect(gates.every((gate) => gate.waivedBy === null)).toBe(true);
      expect(gates.every((gate) => gate.kind === "owner-review")).toBe(true);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a waiver record never authorizes a merge by itself", async () => {
    const fixture = makeAuditStore("board-waiver-only");
    try {
      await runBoard(fixture.store);
      // The board render is a read; it performs no merge and writes no
      // transaction record.
      const before = fixture.store.readRecords();
      expect(before.ok).toBe(true);
      if (before.ok) {
        expect(
          before.value.records.filter((record) => record.kind === "merge.transaction"),
        ).toHaveLength(0);
      }
    } finally {
      removeRoot(fixture.root);
    }
  });
});
