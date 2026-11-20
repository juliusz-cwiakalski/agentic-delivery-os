/**
 * GH-354 F-5 — the family grammar, discriminators and refusal identities
 * (TC-GRAMMAR-001, 002, 003, 005).
 *
 * The refusal cases drive the real command definition over a POISONED runtime
 * (every read raises), so "decided before any runtime call" is observable as
 * "the poison never fired". The payload cases drive the composed program (D1).
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import type { DispatchCommandRuntime } from "../../../packages/cli/src/commands/dispatch";
import { createDispatchCommandDefinition } from "../../../packages/cli/src/commands/dispatch";
import { type CliStreams, runCli } from "../../../packages/cli/src/index";
import { resolveBrandIdentity } from "../../../packages/core/src/branding/index";
import { createOperatorHarness, OPERATOR_REF } from "../../fixtures/dispatch/operator/harness";
import { materializeFamily, segmentName } from "../../fixtures/dispatch/operator/logs";
import { createTranscriptDouble } from "../../fixtures/dispatch/operator/transcript";

const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

const dataOf = (data: unknown) => data as Record<string, unknown>;

type Poisoned = {
  readonly runtime: DispatchCommandRuntime;
  readonly calls: () => number;
};

/** A runtime whose every read raises: a refusal that reaches it is observable. */
const poisonedRuntime = (): Poisoned => {
  let calls = 0;
  const poison = (): never => {
    calls += 1;
    throw new Error("poisoned runtime read");
  };
  return {
    runtime: {
      run: {
        run: async () => {
          calls += 1;
          throw new Error("poisoned runtime read");
        },
      },
      status: { read: async () => poison() },
      delivering: { read: async () => poison() },
      log: { read: async () => poison() },
      message: { read: async () => poison() },
    },
    calls: () => calls,
  };
};

const invoke = async (
  runtime: DispatchCommandRuntime,
  argv: readonly string[],
): Promise<{ readonly exit: number; readonly stdout: string; readonly envelope?: unknown }> => {
  const out: string[] = [];
  const err: string[] = [];
  const streams: CliStreams = {
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: (chunk: string) => err.push(chunk) },
  };
  const exit = await runCli(argv, streams, {
    brand,
    clock: { now: () => Date.parse("2026-11-19T00:00:00.000Z") },
    newRunId: () => "run-grammar",
    secrets: [],
    program: { commands: { dispatch: createDispatchCommandDefinition(runtime) } },
  });
  const stdout = out.join("");
  const trimmed = stdout.trim();
  return {
    exit,
    stdout,
    ...(trimmed.startsWith("{") ? { envelope: JSON.parse(trimmed) as unknown } : {}),
  };
};

describe("TC-GRAMMAR the family grammar", () => {
  test("TC-GRAMMAR-001 each form carries exactly one query discriminator and its declared key set", async () => {
    const familyRoot = join(process.cwd(), "tmp", "tmpdir", "gh354-grammar-001");
    rmSync(familyRoot, { recursive: true, force: true });
    const transcript = createTranscriptDouble({ messages: { "ses-grammar": "the final words" } });
    const h = createOperatorHarness({
      label: "grammar-001",
      artifactRoot: familyRoot,
      transcriptRead: transcript.read,
    });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "terminal",
        sessionId: "ses-grammar",
        lastToken: "pr-open",
        lastOutcome: "completed",
      });
      materializeFamily({
        familyRoot,
        ref: OPERATOR_REF,
        files: [
          {
            name: segmentName({
              recordedAt: "2026-11-19T00:00:00.000Z",
              attemptId: "attempt-grammar",
              iterationOrdinal: 1,
              streamKind: "spawn",
              segmentOrdinal: 1,
            }),
            text: "L-1\nL-2\n",
          },
        ],
      });

      const status = await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      const statusData = dataOf(status.data);
      expect(statusData.query).toBe("status");
      expect(Object.keys(statusData).sort()).toEqual(
        [
          "delivering",
          "lane",
          "marker",
          "pid",
          "probe",
          "query",
          "ref",
          "repository",
          "sessionId",
          "stale",
        ].sort(),
      );

      // The request matches the retained window, so no optional fact appears.
      const log = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "2", "--json"]);
      const logData = dataOf(log.data);
      expect(logData.query).toBe("log");
      expect(Object.keys(logData).sort()).toEqual(
        ["available", "lines", "query", "ref", "tail"].sort(),
      );

      const delivering = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
      const deliveringData = dataOf(delivering.data);
      expect(deliveringData.query).toBe("is-delivering");
      expect(Object.keys(deliveringData).sort()).toEqual(
        ["delivering", "query", "ref", "repository"].sort(),
      );

      const message = await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
      const messageData = dataOf(message.data);
      expect(messageData.query).toBe("last-message");
      expect(Object.keys(messageData).sort()).toEqual(
        ["available", "final", "message", "query", "ref", "recordedAt", "truncated"].sort(),
      );

      // The envelope is the delivered standard shape, and no answer carries a
      // delivery result token.
      for (const answer of [status, log, delivering, message]) {
        const envelope = answer.envelope as {
          readonly schemaVersion?: string;
          readonly runId?: string;
          readonly exitCode?: number;
          readonly timing?: unknown;
        };
        expect(envelope.schemaVersion).toBeDefined();
        expect(envelope.runId).toBeTruthy();
        expect(envelope.exitCode).toBe(answer.exit);
        expect(envelope.timing).toBeDefined();
        expect(answer.stdout).not.toContain('"result"');
      }

      // The human forms carry their declared key sets; `log` renders the raw tail.
      const statusHuman = await h.run(["dispatch", "status", OPERATOR_REF]);
      expect(statusHuman.stdout).toContain("marker=terminal");
      expect(statusHuman.stdout).toContain("sessionId=ses-grammar");
      const logHuman = await h.run(["dispatch", "log", OPERATOR_REF, "--tail", "2"]);
      expect(logHuman.stdout).toBe("L-1\nL-2\n");
      const deliveringHuman = await h.run(["dispatch", "is-delivering", OPERATOR_REF]);
      expect(deliveringHuman.stdout).toContain("delivering=false");
      const messageHuman = await h.run(["dispatch", "last-message", OPERATOR_REF]);
      expect(messageHuman.stdout).toContain("last_message=the final words");
    } finally {
      h.dispose();
      rmSync(familyRoot, { recursive: true, force: true });
    }
  });

  test("TC-GRAMMAR-002 a non-canonical or missing ref and an extra positional are refused before any runtime call", async () => {
    const rows = [
      ["dispatch", "status"],
      ["dispatch", "status", "gh-354"],
      ["dispatch", "status", "GH354"],
      ["dispatch", "status", "GH-354x"],
      ["dispatch", "log", "GH-354", "extra"],
      ["dispatch", "is-delivering", "GH-354", "extra"],
      ["dispatch", "last-message", "GH-354", "extra"],
      ["dispatch", "last-message", "GH-ABC"],
    ] as const;
    for (const argv of rows) {
      const poisoned = poisonedRuntime();
      const result = await invoke(poisoned.runtime, [...argv, "--json"]);
      expect(result.exit, argv.join(" ")).toBe(1);
      expect(poisoned.calls(), argv.join(" ")).toBe(0);
      const envelope = result.envelope as {
        readonly error?: { readonly code?: string };
        readonly data?: unknown;
      };
      expect(envelope.error?.code, argv.join(" ")).toBe("input.value.rejected");
      expect(envelope.data, argv.join(" ")).toBeUndefined();
    }
    // A fourth positional is the shared parser's own refusal.
    const poisoned = poisonedRuntime();
    const parserRefusal = await invoke(poisoned.runtime, [
      "dispatch",
      "status",
      "GH-354",
      "a",
      "b",
      "--json",
    ]);
    expect(parserRefusal.exit).toBe(1);
    const parserEnvelope = parserRefusal.envelope as {
      readonly error?: { readonly code?: string };
    };
    expect(parserEnvelope.error?.code).toBe("fallback.invocation");
    expect(poisoned.calls()).toBe(0);
  });

  test("TC-GRAMMAR-003 an invalid --tail value and an undeclared flag take their distinct refusal identities", async () => {
    const rows = [
      { argv: ["dispatch", "log", "GH-354", "--tail", "abc"], code: "input.value.rejected" },
      { argv: ["dispatch", "log", "GH-354", "--tail", "0"], code: "input.value.rejected" },
      { argv: ["dispatch", "log", "GH-354", "--tail", "501"], code: "input.value.rejected" },
      { argv: ["dispatch", "status", "GH-354", "--tail", "50"], code: "fallback.invocation" },
      { argv: ["dispatch", "status", "GH-354", "--revert"], code: "fallback.invocation" },
      { argv: ["dispatch", "is-delivering", "--note", "x"], code: "fallback.invocation" },
      {
        argv: ["dispatch", "last-message", "GH-354", "--harness", "opencode"],
        code: "fallback.invocation",
      },
    ] as const;
    for (const row of rows) {
      const poisoned = poisonedRuntime();
      const result = await invoke(poisoned.runtime, [...row.argv, "--json"]);
      expect(result.exit, row.argv.join(" ")).toBe(1);
      expect(poisoned.calls(), row.argv.join(" ")).toBe(0);
      const envelope = result.envelope as { readonly error?: { readonly code?: string } };
      expect(envelope.error?.code, row.argv.join(" ")).toBe(row.code);
    }
  });

  test("TC-GRAMMAR-005 no query emits a delivery result token or appends a record", async () => {
    const transcript = createTranscriptDouble({ messages: { "ses-grammar-5": "done" } });
    const h = createOperatorHarness({ label: "grammar-005", transcriptRead: transcript.read });
    try {
      h.seedLane({
        ref: OPERATOR_REF,
        state: "active",
        sessionId: "ses-grammar-5",
        attemptId: "attempt-grammar-5",
      });
      const before = h.ledgerBytes();
      for (const argv of [
        ["dispatch", "status", OPERATOR_REF, "--json"],
        ["dispatch", "log", OPERATOR_REF, "--json"],
        ["dispatch", "is-delivering", OPERATOR_REF, "--json"],
        ["dispatch", "is-delivering", "--json"],
        ["dispatch", "last-message", OPERATOR_REF, "--json"],
      ]) {
        const result = await h.run(argv);
        expect(result.stdout).not.toContain('"result"');
        expect(result.stdout).not.toContain("pr-open");
      }
      expect(h.counters.append).toBe(0);
      expect(h.counters.acquireFence).toBe(0);
      expect(h.counters.replaceDocument).toBe(0);
      expect(h.ledgerBytes()).toBe(before);
      // A later read reports exactly what it reported before the queries.
      const attempts = h.records().filter((record) => record.kind === "dispatch.attempt");
      expect(attempts).toEqual([]);
    } finally {
      h.dispose();
    }
  });
});
