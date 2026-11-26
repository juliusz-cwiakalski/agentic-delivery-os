/**
 * GH-354 F-6 — the read-only and shell-free posture (TC-RO-001..004,
 * TC-SHELL-002..004).
 *
 * Every declared read count is a MEASUREMENT: the counted store, the recording
 * filesystem edge, the transcript call recorder, and the guarded runner report
 * what happened. Byte/mode/mtime snapshots make "unchanged" observable, and a
 * deliberately over-retained third file makes "0 deletions" non-vacuous.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  decoyFiles,
  fingerprintDrift,
  plantShellArtifacts,
  removeShellArtifacts,
} from "../../fixtures/dispatch/operator/decoys";
import {
  createOperatorHarness,
  createRecordingLogFs,
  OPERATOR_REF,
} from "../../fixtures/dispatch/operator/harness";
import {
  familySnapshot,
  materializeFamily,
  segmentName,
} from "../../fixtures/dispatch/operator/logs";
import { createTranscriptDouble } from "../../fixtures/dispatch/operator/transcript";
import { createGuardedRunner } from "../../fixtures/dispatch/parity/process-runner";

const FIRST_SEGMENT = (attempt: string, segment: number): string =>
  segmentName({
    recordedAt: "2026-11-19T00:00:00.000Z",
    attemptId: attempt,
    iterationOrdinal: 1,
    streamKind: "spawn",
    segmentOrdinal: segment,
  });

const ALL_QUERIES: readonly (readonly string[])[] = [
  ["dispatch", "status", OPERATOR_REF, "--json"],
  ["dispatch", "status", OPERATOR_REF],
  ["dispatch", "log", OPERATOR_REF, "--json"],
  ["dispatch", "log", OPERATOR_REF],
  ["dispatch", "is-delivering", OPERATOR_REF, "--json"],
  ["dispatch", "is-delivering"],
  ["dispatch", "last-message", OPERATOR_REF, "--json"],
  ["dispatch", "last-message", OPERATOR_REF],
];

describe("TC-RO the read-only posture", () => {
  test("TC-RO-001 store bytes, lane records, the identity marker and the artifact set are unchanged", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-ro": "done" } });
    const guarded = createGuardedRunner();
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-posture-ro-001");
    rmSync(familyRoot, { recursive: true, force: true });
    const h = createOperatorHarness({
      label: "posture-ro-001",
      transcriptRead: transcript.read,
      guarded,
      artifactRoot: familyRoot,
    });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "active", sessionId: "ses-ro" });
      h.seedLane({ ref: "GH-355", state: "terminal", sessionId: "ses-355" });
      // A deliberately over-retained third file: a read that "tidies" the family
      // must fail here.
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [
          { name: FIRST_SEGMENT("over", 1), text: "OVER-1\n" },
          { name: FIRST_SEGMENT("over", 2), text: "OVER-2\n" },
          { name: FIRST_SEGMENT("over", 3), text: "OVER-3\n" },
        ],
      });
      const ledgerBefore = h.ledgerBytes();
      const recordsBefore = h.records();
      const familyBefore = familySnapshot(familyRoot, OPERATOR_REF);
      expect(familyBefore).toHaveLength(3);

      for (const argv of ALL_QUERIES) await h.run(argv);

      expect(h.ledgerBytes()).toBe(ledgerBefore);
      expect(h.records()).toEqual(recordsBefore);
      expect(h.counters.append).toBe(0);
      expect(h.counters.acquireFence).toBe(0);
      expect(h.counters.releaseFence).toBe(0);
      expect(h.counters.replaceDocument).toBe(0);
      // No file was created anywhere under the state root.
      expect(familySnapshot(familyRoot, OPERATOR_REF)).toEqual(familyBefore);
      expect(guarded.spawns).toBe(0);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-RO-002 planted shell artifacts change no answer and stay byte- and mtime-identical", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-decoy": "TYPED-REAL-MESSAGE" } });
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-posture-ro-002");
    rmSync(familyRoot, { recursive: true, force: true });
    const clean = createOperatorHarness({
      label: "posture-ro-002-clean",
      transcriptRead: transcript.read,
      artifactRoot: familyRoot,
    });
    const planted = createOperatorHarness({
      label: "posture-ro-002-planted",
      transcriptRead: transcript.read,
      artifactRoot: familyRoot,
    });
    try {
      for (const h of [clean, planted]) {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "terminal",
          sessionId: "ses-decoy",
          lastToken: "pr-open",
          lastOutcome: "completed",
        });
      }
      const before = plantShellArtifacts(planted.checkout, OPERATOR_REF);
      for (const file of decoyFiles(OPERATOR_REF)) {
        expect(existsSync(join(planted.checkout, file.path))).toBe(true);
      }

      for (const argv of ALL_QUERIES) {
        const withDecoys = await planted.run(argv);
        const without = await clean.run(argv);
        expect(withDecoys.exit, argv.join(" ")).toBe(without.exit);
        expect(withDecoys.stdout, argv.join(" ")).toBe(without.stdout);
        expect(withDecoys.stdout).not.toContain("SHELL-");
      }
      expect(fingerprintDrift(planted.checkout, before)).toEqual([]);

      // The log answer never carries the shell's decoy lines.
      const log = await planted.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      expect(log.stdout).not.toContain("SHELL-DECOY-LINE");
    } finally {
      removeShellArtifacts(planted.checkout, OPERATOR_REF);
      clean.dispose();
      planted.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-RO-003 zero child processes and zero network reads across every query", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-noop": "done" } });
    const guarded = createGuardedRunner();
    const h = createOperatorHarness({
      label: "posture-ro-003",
      transcriptRead: transcript.read,
      guarded,
    });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-noop" });
      for (const argv of ALL_QUERIES) {
        const result = await h.run(argv);
        expect(result.stderr).not.toContain("ENOENT");
      }
      expect(guarded.spawns).toBe(0);
      expect(guarded.resumes).toBe(0);
      expect(guarded.violations).toEqual([]);
      expect(guarded.realChildStarts).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("TC-RO-004 each query performs exactly the declared read count and no second read", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-budget": "done" } });
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-posture-ro-004");
    rmSync(familyRoot, { recursive: true, force: true });
    const logFs = createRecordingLogFs({ familyRoot });
    const h = createOperatorHarness({
      label: "posture-ro-004",
      transcriptRead: transcript.read,
      artifactRoot: familyRoot,
      artifactFs: logFs.fs,
    });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-budget" });
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: FIRST_SEGMENT("budget", 1), text: "B-1\n" }],
      });

      const statusBefore = h.counters.readRecords;
      await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      // GH-413: one bounded lane read plus one bounded park read.
      expect(h.counters.readRecords - statusBefore).toBe(2);
      expect(logFs.records.filter((record) => record.op === "list")).toHaveLength(0);
      expect(transcript.calls).toHaveLength(0);

      const logBefore = h.counters.readRecords;
      logFs.clear();
      await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      // `log` reads ONLY the addressed directory: no lane read is needed.
      expect(h.counters.readRecords - logBefore).toBe(0);
      expect(logFs.records.filter((record) => record.op === "list")).toHaveLength(1);
      expect(logFs.records.filter((record) => record.op === "read").length).toBeLessThanOrEqual(2);
      expect(transcript.calls).toHaveLength(0);

      const deliveringBefore = h.counters.readRecords;
      await h.run(["dispatch", "is-delivering", "--json"]);
      expect(h.counters.readRecords - deliveringBefore).toBe(1);

      const messageBefore = h.counters.readRecords;
      await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(h.counters.readRecords - messageBefore).toBe(1);
      expect(transcript.calls).toHaveLength(1);
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });
});

describe("TC-SHELL the shell-free posture", () => {
  test("TC-SHELL-002 the whole query battery records zero shell invocations and zero script paths", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-shell": "done" } });
    const guarded = createGuardedRunner();
    const h = createOperatorHarness({
      label: "posture-shell-002",
      transcriptRead: transcript.read,
      guarded,
    });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-shell" });
      for (const argv of ALL_QUERIES) {
        await h.run(argv);
      }
      expect(guarded.violations).toEqual([]);
      expect(guarded.records).toEqual([]);
      expect(guarded.invocations).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("TC-SHELL-003 a checkout with no shell entry points answers all four queries", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-na": "the message" } });
    const h = createOperatorHarness({
      label: "posture-shell-003",
      transcriptRead: transcript.read,
    });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: "ses-na",
        lastToken: "pr-open",
        lastOutcome: "completed",
      });
      // The temp checkout has no scripts/ and no tools/ directories at all.
      expect(existsSync(join(h.checkout, "scripts"))).toBe(false);
      expect(existsSync(join(h.checkout, "tools"))).toBe(false);
      for (const argv of ALL_QUERIES) {
        const result = await h.run(argv);
        expect(result.stderr, argv.join(" ")).not.toContain("ENOENT");
        expect(result.stderr, argv.join(" ")).not.toContain("not found");
        expect(result.stdout, argv.join(" ")).not.toContain("fallback.internal");
        expect([0, 1]).toContain(result.exit);
      }
      // The four positive answers are their declared shapes.
      const status = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      const log = await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      const delivering = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
      const message = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect(status.exit).toBe(0);
      expect(log.exit).toBe(0);
      // A terminal lane is not in progress: the declared 0/1 convention.
      expect(delivering.exit).toBe(1);
      expect(message.exit).toBe(0);
      expect((message.data as { readonly message?: string }).message).toBe("the message");
    } finally {
      h.dispose();
    }
  });

  test("TC-SHELL-004 planted shell content can never steer a typed answer", async () => {
    const transcript = createTranscriptDouble({
      messages: { "ses-provenance": "TYPED-REAL-MESSAGE" },
    });
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-posture-shell-004");
    rmSync(familyRoot, { recursive: true, force: true });
    const logFs = createRecordingLogFs({ familyRoot });
    const h = createOperatorHarness({
      label: "posture-shell-004",
      transcriptRead: transcript.read,
      artifactRoot: familyRoot,
      artifactFs: logFs.fs,
    });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: "ses-provenance",
        lastToken: "pr-open",
        lastOutcome: "completed",
        processId: 1111,
      });
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [{ name: FIRST_SEGMENT("provenance", 1), text: "TYPED-REAL-LINE-1\n" }],
      });
      plantShellArtifacts(h.checkout, OPERATOR_REF);

      const status = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      const statusData = status.data as { readonly pid?: number; readonly marker?: string };
      // The recorded pid answers, not the planted PID file's 4242.
      expect(statusData.pid).toBe(1111);
      expect(statusData.marker).toBe("terminal");

      const log = await h.run(["dispatch", "log", OPERATOR_REF, "--json"]);
      const lines = (log.data as { readonly lines?: readonly string[] }).lines ?? [];
      expect(lines).toEqual(["TYPED-REAL-LINE-1"]);
      expect(log.stdout).not.toContain("SHELL-DECOY-LINE");

      const message = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      expect((message.data as { readonly message?: string }).message).toBe("TYPED-REAL-MESSAGE");
      expect(message.stdout).not.toContain("SHELL-DECOY-MESSAGE");

      // The filesystem edge recorded no shell-owned path.
      for (const record of logFs.records) {
        expect(record.path).not.toContain("deliver-ticket");
        expect(record.path).not.toContain(".ai/local/delivery");
      }
      expect(logFs.violations).toEqual([]);
    } finally {
      removeShellArtifacts(h.checkout, OPERATOR_REF);
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });
});
