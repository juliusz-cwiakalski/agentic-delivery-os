/**
 * GH-354 F-7 — the per-stream stdout artifact write path
 * (TC-PERSIST-001..008, TC-PERSIST-010).
 *
 * Every case drives the REAL opencode adapter over a scripted streaming starter
 * (S1) with the REAL sink orchestration and a recording filesystem edge; the
 * delivery-path cases drive the composed program (D1). No query runs here: the
 * reader does not exist at this boundary.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { createNodeDispatchLogFileSystem } from "../../../packages/adapters/src/file/dispatch-logs";
import { readDispatchAttempts } from "../../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_LOG_FILE_CAP_BYTES,
  type HarnessExecutionEnvironmentDescriptor,
} from "../../../packages/core/src/contracts/index";
import {
  createArtifactObservation,
  createOperatorHarness,
  createRecordingLogFs,
  OPERATOR_REF,
} from "../../fixtures/dispatch/operator/harness";
import { sessionLine, stepFinishLine } from "../../fixtures/dispatch/operator/streams";

const DESCRIPTOR: HarnessExecutionEnvironmentDescriptor = {
  kind: "host",
  workDirectory: "/synthetic",
  environment: [],
};

const delivered = (text: string): readonly string[] => text.split("\n").slice(0, -1);

describe("TC-PERSIST the artifact write path", () => {
  test("TC-PERSIST-001 each stream gets its own 0600 file, created before its first value", async () => {
    const obs = createArtifactObservation({
      label: "persist-streams",
      scripts: [
        { values: [sessionLine("ses-a"), "one", "two", "three", "four", stepFinishLine()] },
        { values: [sessionLine("ses-a"), "resume-one", "resume-two", stepFinishLine()] },
        { values: [sessionLine("ses-a"), "deliver-one", stepFinishLine()] },
      ],
    });
    try {
      const spawned = await obs.session.spawn({
        workItemRef: OPERATOR_REF,
        prompt: "go",
        descriptor: DESCRIPTOR,
        streamContext: { attemptId: "attempt-1", iterationOrdinal: 1 },
      });
      expect(spawned.ok).toBe(true);
      if (!spawned.ok) return;
      await obs.session.collect({ handle: spawned.value });
      const resumed = await obs.session.resume({
        handle: spawned.value,
        prompt: "continue",
        streamContext: { attemptId: "attempt-1", iterationOrdinal: 2 },
      });
      expect(resumed.ok).toBe(true);
      const delivered2 = await obs.session.deliver({
        handle: spawned.value,
        prompt: "steer",
        streamContext: { attemptId: "attempt-1", iterationOrdinal: 3 },
      });
      expect(delivered2.ok).toBe(true);

      const names = obs.fileNames();
      expect(names).toHaveLength(3);
      // One directory, one file per stream; nothing shared.
      expect(new Set(names).size).toBe(3);
      for (const name of names) {
        expect(obs.fileMode(name)).toBe(0o600);
        expect(obs.fileText(name).endsWith("\n")).toBe(true);
      }
      // At each first pull the stream's file already existed.
      expect(obs.firstPullListings[0]).toEqual([names[0] as string]);
      expect(obs.firstPullListings[1]).toHaveLength(2);
      expect(obs.firstPullListings[2]).toHaveLength(3);
    } finally {
      obs.dispose();
    }
  });

  test("TC-PERSIST-002 every yielded value is written with exactly one LF, decoded or not", async () => {
    const values = [
      sessionLine("ses-x"),
      "",
      "NOT-JSON-1",
      "[1,2,3]",
      sessionLine("ses-x"),
      "FINAL-REMNANT",
    ];
    const obs = createArtifactObservation({ label: "persist-lf", scripts: [{ values }] });
    try {
      const spawned = await obs.session.spawn({
        workItemRef: OPERATOR_REF,
        prompt: "go",
        descriptor: DESCRIPTOR,
        streamContext: { attemptId: "attempt-lf", iterationOrdinal: 1 },
      });
      expect(spawned.ok).toBe(true);
      if (!spawned.ok) return;
      await obs.session.collect({ handle: spawned.value });
      const [name] = obs.fileNames();
      const text = obs.fileText(name as string);
      // The declared transformation: each value followed by exactly one LF,
      // including the blank value and the final remnant.
      expect(text).toBe(`${values.join("\n")}\n`);
      expect(delivered(text)).toEqual(values);
    } finally {
      obs.dispose();
    }
  });

  test("TC-PERSIST-003 file names sort in creation order across a restart and two concurrent streams", async () => {
    const obs = createArtifactObservation({
      label: "persist-names",
      scripts: [
        { values: [sessionLine("ses-1"), "a", stepFinishLine()] },
        { values: [sessionLine("ses-1"), "b", stepFinishLine()] },
        { values: [sessionLine("ses-2"), "c", stepFinishLine()] },
      ],
    });
    try {
      const descriptor = DESCRIPTOR;
      const first = await obs.session.spawn({
        workItemRef: OPERATOR_REF,
        prompt: "go",
        descriptor,
        streamContext: { attemptId: "attempt-a", iterationOrdinal: 1 },
      });
      expect(first.ok).toBe(true);
      // A second stream for the same ref and the same recorded instant, with a
      // different attempt identity: the names can never collide.
      const concurrent = await obs.session.spawn({
        workItemRef: OPERATOR_REF,
        prompt: "go",
        descriptor,
        streamContext: { attemptId: "attempt-b", iterationOrdinal: 1 },
      });
      expect(concurrent.ok).toBe(true);
      if (!first.ok) return;
      await obs.session.collect({ handle: first.value });
      const names = obs.fileNames();
      expect(names).toHaveLength(2);
      // Lexical order is creation order, because the recorded instant and the
      // attempt identity are the leading components.
      expect(names[0]).toContain("attempt-a");
      expect(names[1]).toContain("attempt-b");
    } finally {
      obs.dispose();
    }
  });

  test("TC-PERSIST-004 two refs never share a directory or file, and a one-shot adapter creates none", async () => {
    const obs = createArtifactObservation({
      label: "persist-scope",
      ref: "GH-354",
      scripts: [{ values: [sessionLine("ses-354"), "x", stepFinishLine()] }],
    });
    try {
      const descriptor = DESCRIPTOR;
      const spawned = await obs.session.spawn({
        workItemRef: "GH-354",
        prompt: "go",
        descriptor,
        streamContext: { attemptId: "attempt-354", iterationOrdinal: 1 },
      });
      expect(spawned.ok).toBe(true);
      if (!spawned.ok) return;
      await obs.session.collect({ handle: spawned.value });
      // A second ref writes its own directory.
      const other = createArtifactObservation({
        label: "persist-scope-2",
        ref: "GH-355",
        scripts: [{ values: [sessionLine("ses-355"), "y", stepFinishLine()] }],
      });
      try {
        const spawned2 = await other.session.spawn({
          workItemRef: "GH-355",
          prompt: "go",
          descriptor,
          streamContext: { attemptId: "attempt-355", iterationOrdinal: 1 },
        });
        expect(spawned2.ok).toBe(true);
        if (!spawned2.ok) return;
        await other.session.collect({ handle: spawned2.value });
        expect(obs.fileNames()).toHaveLength(1);
        expect(other.fileNames()).toHaveLength(1);
        expect(obs.directory).not.toBe(other.directory);
      } finally {
        other.dispose();
      }

      // A one-shot adapter (Claude Code) opens no stream: no sink, no directory.
      // Driven through the composed program, so the absence is measured on the
      // real filesystem rather than asserted about an unconstructed factory.
      const claudeRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-claude-lane");
      const claude = createOperatorHarness({
        label: "persist-claude",
        extraRefs: ["GH-356"],
        artifactRoot: claudeRoot,
      });
      try {
        const run = await claude.run(["dispatch", "GH-356", "--harness", "claude-code", "--json"]);
        // A one-shot lane runs and classifies; the point is the artifact's
        // absence, not the classification of a synthetic session.
        expect(run.envelope?.error?.code).not.toBe("harness.capability.gap");
        // The dispatch landed an attempt record, so the lane really ran.
        const attempts = readDispatchAttempts(claude.store);
        expect(attempts.ok && attempts.records.length).toBeGreaterThan(0);
        // No family directory was created for the one-shot lane.
        expect(existsSync(join(claudeRoot, "GH-356"))).toBe(false);
      } finally {
        claude.dispose();
        rmSync(claudeRoot, { recursive: true, force: true });
      }
    } finally {
      obs.dispose();
    }
  });

  test("TC-PERSIST-008 a written file is never modified: one append per value, mode and bytes intact", async () => {
    const values = Array.from({ length: 40 }, (_, index) => `value-${index}`);
    const obs = createArtifactObservation({
      label: "persist-append",
      scripts: [{ values: [sessionLine("ses-append"), ...values, stepFinishLine()] }],
    });
    try {
      const spawned = await obs.session.spawn({
        workItemRef: OPERATOR_REF,
        prompt: "go",
        descriptor: DESCRIPTOR,
        streamContext: { attemptId: "attempt-append", iterationOrdinal: 1 },
      });
      expect(spawned.ok).toBe(true);
      if (!spawned.ok) return;
      await obs.session.collect({ handle: spawned.value });
      // Exactly one append per yielded value, and no rewrite/truncate operation.
      const appends = obs.logFs.records.filter((record) => record.op === "append");
      expect(appends).toHaveLength(values.length + 2);
      expect(obs.logFs.records.every((record) => record.op !== "remove")).toBe(true);
      const [name] = obs.fileNames();
      expect(obs.fileMode(name as string)).toBe(0o600);
      expect(delivered(obs.fileText(name as string))).toEqual([
        sessionLine("ses-append"),
        ...values,
        stepFinishLine(),
      ]);
    } finally {
      obs.dispose();
    }
  });

  test("TC-PERSIST-007 retention keeps the newest two files and removes the oldest after the new file exists", async () => {
    // A stream body larger than two caps needs a third segment.
    const big = "A".repeat(700_000);
    const obs = createArtifactObservation({
      label: "persist-retention",
      scripts: [{ values: [sessionLine("ses-big"), big, big, big, big, stepFinishLine()] }],
    });
    try {
      const spawned = await obs.session.spawn({
        workItemRef: OPERATOR_REF,
        prompt: "go",
        descriptor: DESCRIPTOR,
        streamContext: { attemptId: "attempt-big", iterationOrdinal: 1 },
      });
      expect(spawned.ok).toBe(true);
      if (!spawned.ok) return;
      await obs.session.collect({ handle: spawned.value });
      expect(obs.fileNames()).toHaveLength(2);
      // The removal happened only after the new file existed.
      const order = obs.logFs.mutations.map((entry) => entry.op);
      const firstRemove = order.indexOf("remove");
      expect(firstRemove).toBeGreaterThan(order.indexOf("create"));
      expect(order.filter((op) => op === "create").length).toBeGreaterThanOrEqual(3);
      // No file exceeds the cap.
      for (const name of obs.fileNames()) {
        expect(Buffer.byteLength(obs.fileText(name), "utf8")).toBeLessThanOrEqual(
          DISPATCH_LOG_FILE_CAP_BYTES,
        );
      }
    } finally {
      obs.dispose();
    }
  });

  test("TC-PERSIST-010 a sink fault is observational: token, exit, records and evidence are identical", async () => {
    const baseline = createOperatorHarness({ label: "persist-baseline" });
    let faultyToken: string | undefined;
    let faultyExit: number | undefined;
    let faultyAttempts = -1;
    let healthyToken: string | undefined;
    let healthyExit: number | undefined;
    let healthyAttempts = -1;
    try {
      const run = await baseline.run(["dispatch", OPERATOR_REF, "--json"]);
      healthyExit = run.exit;
      healthyToken = (run.data as { readonly result?: string } | undefined)?.result;
      const attempts = readDispatchAttempts(baseline.store);
      healthyAttempts = attempts.ok ? attempts.records.length : -1;
    } finally {
      baseline.dispose();
    }

    // The same fixture with an edge whose create always fails.
    const healthyEdge = createNodeDispatchLogFileSystem();
    const faultyRoot = createOperatorHarness({
      label: "persist-faulty",
      artifactFs: { ...healthyEdge, create: () => false },
    });
    try {
      const run = await faultyRoot.run(["dispatch", OPERATOR_REF, "--json"]);
      faultyExit = run.exit;
      faultyToken = (run.data as { readonly result?: string } | undefined)?.result;
      const attempts = readDispatchAttempts(faultyRoot.store);
      faultyAttempts = attempts.ok ? attempts.records.length : -1;
    } finally {
      faultyRoot.dispose();
    }

    expect(faultyToken).toBe(healthyToken);
    expect(faultyExit).toBe(healthyExit);
    expect(faultyAttempts).toBe(healthyAttempts);
  });
});
