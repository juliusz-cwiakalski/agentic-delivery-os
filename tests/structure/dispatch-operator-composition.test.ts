/**
 * GH-354 F-5 — the uncomposed query surface (TC-GRAMMAR-004, AC-F5-3, DEC-7).
 *
 * A composition that supplies only the run surface must REFUSE each query with
 * the delivered identity, never crash and never answer an empty success. The
 * suite also asserts the runtime's four optional members exist and that the
 * production composition supplies all four.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DispatchCommandRuntime } from "../../packages/cli/src/commands/dispatch";
import { createDispatchCommandDefinition } from "../../packages/cli/src/commands/dispatch";
import { type CliStreams, runCli } from "../../packages/cli/src/index";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";

const ROOT = process.cwd();
const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

const runOnlyRuntime: DispatchCommandRuntime = {
  run: {
    run: async () => ({
      ok: false as const,
      error: { kind: "input", code: "input.value.rejected" },
    }),
  },
};

const invoke = async (argv: readonly string[]) => {
  const out: string[] = [];
  const err: string[] = [];
  const streams: CliStreams = {
    stdout: { write: (chunk: string) => out.push(chunk) },
    stderr: { write: (chunk: string) => err.push(chunk) },
  };
  const exit = await runCli(argv, streams, {
    brand,
    clock: { now: () => Date.parse("2026-11-19T00:00:00.000Z") },
    newRunId: () => "run-composition",
    secrets: [],
    program: { commands: { dispatch: createDispatchCommandDefinition(runOnlyRuntime) } },
  });
  const stdout = out.join("");
  const trimmed = stdout.trim();
  return {
    exit,
    stdout,
    stderr: err.join(""),
    ...(trimmed.startsWith("{") ? { envelope: JSON.parse(trimmed) as unknown } : {}),
  };
};

describe("TC-GRAMMAR-004 the uncomposed query surface", () => {
  test("each query form refuses input.value.rejected, never crashes or answers empty success", async () => {
    for (const argv of [
      ["dispatch", "status", "GH-354"],
      ["dispatch", "log", "GH-354"],
      ["dispatch", "is-delivering", "GH-354"],
      ["dispatch", "is-delivering"],
      ["dispatch", "last-message", "GH-354"],
    ]) {
      const result = await invoke([...argv, "--json"]);
      expect(result.exit, argv.join(" ")).toBe(1);
      const envelope = result.envelope as {
        readonly error?: { readonly code?: string };
        readonly data?: unknown;
      };
      expect(envelope, argv.join(" ")).toBeDefined();
      expect(envelope.error?.code, argv.join(" ")).toBe("input.value.rejected");
      expect(envelope.error?.code, argv.join(" ")).not.toBe("fallback.internal");
      expect(envelope.data, argv.join(" ")).toBeUndefined();
    }
  });

  test("the delivered uncomposed forms keep their own refusal identities", async () => {
    for (const argv of [
      ["dispatch", "attempts"],
      ["dispatch", "dual-run", "summary"],
      ["dispatch", "handover"],
    ]) {
      const result = await invoke([...argv, "--json"]);
      expect(result.exit, argv.join(" ")).toBe(1);
      const envelope = result.envelope as { readonly error?: { readonly code?: string } };
      expect(envelope.error?.code, argv.join(" ")).toBe("input.value.rejected");
    }
  });

  test("the runtime declares four optional read surfaces and production supplies all four", () => {
    const commands = readFileSync(join(ROOT, "packages/cli/src/commands/dispatch.ts"), "utf8");
    for (const member of ["status?", "log?", "delivering?", "message?"]) {
      expect(commands).toContain(member);
    }
    const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(edge).toContain("createDispatchOperatorRuntime");
    for (const symbol of [
      "readOperatorStatus",
      "readOperatorDelivering",
      "readDispatchLog",
      "readDispatchLastMessage",
    ]) {
      expect(edge).toContain(symbol);
    }
    // The production composition mounts the operator runtime at the same edge.
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    expect(production).toContain("createDispatchOperatorRuntime");
  });
});
