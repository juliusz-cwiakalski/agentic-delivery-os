/**
 * TC-CAP-006 (completing half) / TC-CAP-013 — the closeout capsule step.
 *
 * The applied payload reports `capsule.closed`, the capsule file holds exactly
 * one terminal close with counts/event count/digest, plan mode omits the
 * capsule object, and a re-run appends nothing.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { capsuleDigest, parseCapsuleEvents } from "../../packages/core/src/domain/capsule";
import { closeoutData, runCloseoutCli } from "../fixtures/closeout/cli";
import { WORK_ITEM_REF } from "../fixtures/closeout/harness";
import { makeChangeTree } from "../fixtures/capsule/harness";
import { makeCapsuleRuntime } from "../fixtures/capsule/producer";

const makeTree = () =>
  makeChangeTree({
    ref: WORK_ITEM_REF,
    month: "2026-11",
    name: `2026-11-01--${WORK_ITEM_REF}--closeout-v1`,
  });

const sha = (file: string): string => createHash("sha256").update(readFileSync(file)).digest("hex");

describe("TC-CAP-006/013 closeout capsule close", () => {
  test("apply completes a pre-contract capsule, ingests nothing, and closes once", async () => {
    const tree = makeTree();
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      expect(data.capsule?.closed).toBe(true);
      expect(data.capsule?.candidates).toEqual([]);
      const file = join(tree.folder, "events.jsonl");
      expect(existsSync(join(tree.folder, "candidates"))).toBe(true);
      const report = parseCapsuleEvents(readFileSync(file, "utf8"));
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      const kinds = report.events.map((event) => event.kind);
      expect(kinds[0]).toBe("capsule.opened");
      expect(kinds).toContain("capsule.backfill-gap");
      expect(kinds.filter((kind) => kind === "capsule.closed").length).toBe(1);
      const last = report.events[report.events.length - 1];
      expect(last?.kind).toBe("capsule.closed");
      const preClose = report.events.slice(0, -1);
      expect(last?.payload.eventCount).toBe(preClose.length);
      expect(last?.payload.digest).toBe(capsuleDigest(preClose));
      expect(data.capsule?.events).toBe(report.events.length);
      const capsuleStep = data.steps.find((step) => step.stepId === "capsule");
      expect(capsuleStep?.outcome).toBe("applied");
    } finally {
      tree.cleanup();
    }
  });

  test("plan mode omits the capsule object and performs zero writes", async () => {
    const tree = makeTree();
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      const before = existsSync(join(tree.folder, "events.jsonl"))
        ? sha(join(tree.folder, "events.jsonl"))
        : "absent";
      const run = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF], { capsule: runtime });
      expect(run.exitCode).toBe(0);
      const data = closeoutData(run.envelope);
      expect(data.capsule).toBeUndefined();
      const capsuleStep = data.steps.find((step) => step.stepId === "capsule");
      expect(capsuleStep?.outcome).toBe("would-apply");
      const after = existsSync(join(tree.folder, "events.jsonl"))
        ? sha(join(tree.folder, "events.jsonl"))
        : "absent";
      expect(after).toBe(before);
      expect(existsSync(join(tree.folder, "candidates"))).toBe(false);
    } finally {
      tree.cleanup();
    }
  });

  test("a re-run appends no second close and leaves the bytes unchanged", async () => {
    const tree = makeTree();
    try {
      const runtime = makeCapsuleRuntime(tree.changes);
      const first = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(first.exitCode).toBe(0);
      const file = join(tree.folder, "events.jsonl");
      const before = sha(file);
      const second = await runCloseoutCli(["--json", "closeout", WORK_ITEM_REF, "--apply"], {
        capsule: runtime,
      });
      expect(second.exitCode).toBe(0);
      expect(sha(file)).toBe(before);
      const report = parseCapsuleEvents(readFileSync(file, "utf8"));
      expect(report.ok).toBe(true);
      if (!report.ok) return;
      expect(report.events.filter((event) => event.kind === "capsule.closed").length).toBe(1);
    } finally {
      tree.cleanup();
    }
  });
});
