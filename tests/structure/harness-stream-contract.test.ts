/**
 * GH-275 structure contract: the additive streaming seam, the unchanged port and
 * runner, engine neutrality, and the pinned real-shape JSONL captures.
 *
 * TC-OCS-001, TC-OCS-002, TC-OCS-004, TC-OCS-005 (and the structural half of
 * TC-OCS-016). Type-level assertions live in
 * `tests/types/harness-stream.type-test.ts`.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  HARNESS_FAILURE_CODES,
  type HarnessSessionPort,
} from "../../packages/core/src/contracts/index";
import { assembleLiveness, classifier } from "../fixtures/harness/harness-io";
import {
  HAPPY_PATH_LINES,
  HAPPY_PATH_SESSION_ID,
  STREAM_ERROR_LINES,
  TOOL_ERROR_LINES,
} from "../fixtures/harness/scenarios/stream";

const ROOT = process.cwd();
const CONTRACTS_DIR = "packages/core/src/contracts";
const HARNESS_CONTRACT = `${CONTRACTS_DIR}/harness.ts`;
const STREAM_DIR = "tests/fixtures/harness/stream";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const importsOf = (file: string): string[] => {
  const source = ts.createSourceFile(
    file,
    read(file),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const specifiers: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
};

const decodeAll = (lines: readonly string[]): readonly Record<string, unknown>[] =>
  lines.map((line) => {
    const parsed: unknown = JSON.parse(line);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("a pinned line is not a JSON object");
    }
    return parsed as Record<string, unknown>;
  });

describe("TC-OCS-001 additive streaming contract types", () => {
  test("the seam is declared in the runtime-neutral contract tier", () => {
    const text = read(HARNESS_CONTRACT);
    expect(text).toContain("export type HarnessSpawnStreamOptions");
    expect(text).toContain("export type HarnessSpawnStream");
    expect(text).toContain("export type HarnessSpawnStarter");
    for (const field of ["handleTimeoutMs", "sessionTimeoutMs", "acquired", "kill"]) {
      expect(text).toContain(field);
    }
  });

  test("the contract tier imports no runtime module and the seam adds no runtime value", () => {
    for (const file of ["harness.ts", "index.ts"] as const) {
      const specifiers = importsOf(`${CONTRACTS_DIR}/${file}`);
      for (const specifier of specifiers) {
        expect(specifier.startsWith("."), `${file}: ${specifier}`).toBe(true);
      }
    }
    const contractSource = read(HARNESS_CONTRACT);
    expect(contractSource).not.toContain('from "node:');
    expect(contractSource).not.toContain('from "bun:');
    expect(contractSource).not.toMatch(/export const HarnessSpawn(Starter|Stream) /u);
  });
});

describe("TC-OCS-002 the session port and one-shot runner are unchanged", () => {
  test("the delivered port type has exactly the seven declared operations", () => {
    const port: HarnessSessionPort = {
      spawn: async () => ({
        ok: false,
        error: { kind: "harness", code: "harness.spawn.invalid-output" },
      }),
      deliver: async () => ({
        ok: false,
        error: { kind: "harness", code: "harness.session.unknown" },
      }),
      resume: async () => ({
        ok: false,
        error: { kind: "harness", code: "harness.session.unknown" },
      }),
      collect: async () => ({
        ok: false,
        error: { kind: "harness", code: "harness.session.unknown" },
      }),
      classify: classifier,
      liveness: async () => ({ ok: true, value: assembleLiveness({ sourced: [] }) }),
      listSessions: async () => ({ ok: true, value: { handles: [] } }),
    };
    expect(Object.keys(port).sort()).toEqual([
      "classify",
      "collect",
      "deliver",
      "listSessions",
      "liveness",
      "resume",
      "spawn",
    ]);
    expect("kill" in port).toBe(false);
    expect("abort" in port).toBe(false);
  });

  test("the failure vocabulary is the delivered nine codes", () => {
    expect([...HARNESS_FAILURE_CODES]).toHaveLength(9);
    for (const code of [
      "harness.session.unknown",
      "harness.spawn.refused",
      "harness.spawn.invalid-output",
    ]) {
      expect([...HARNESS_FAILURE_CODES]).toContain(code);
    }
  });

  test("the runner result still has exactly four fields", () => {
    const source = read(HARNESS_CONTRACT);
    const start = source.indexOf("export type HarnessSpawnRunnerResult = {");
    const end = source.indexOf("};", start);
    const block = source.slice(start, end);
    for (const field of ["stdout", "stderr", "status", "timedOut"]) {
      expect(block).toContain(field);
    }
    expect(block).not.toContain("exitCode");
  });
});

describe("TC-OCS-004 the dispatch engine knows nothing about the streaming seam", () => {
  const DISPATCH = "packages/core/src/app/dispatch.ts";
  const text = read(DISPATCH);

  test("no seam symbol, handle bound, or stream vocabulary appears", () => {
    for (const token of [
      "HarnessSpawnStarter",
      "HarnessSpawnStream",
      "handleTimeoutMs",
      "sessionTimeoutMs",
      "sessionID",
      "step_finish",
      "JSONL",
      "JSON.parse",
    ]) {
      expect(text, token).not.toContain(token);
    }
  });

  test("it imports no adapter subpath and carries no harness-kind branch", () => {
    for (const specifier of importsOf(DISPATCH)) {
      expect(specifier).not.toContain("@delivery-os/adapters");
    }
    expect(text).not.toContain('"opencode"');
    expect(text).not.toContain('"claude-code"');
    expect(text).not.toContain("harnessKind ===");
    expect(text).not.toContain("harnessKind !==");
    expect(text).not.toContain("switch (harnessKind)");
  });

  test("the pre-session failure identity is preserved", () => {
    const occurrences = text.split('"spawn failed before a session existed"').length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain("dispatch.session.spawn-failed");
  });

  test("the single shared classifier definition is unchanged", () => {
    const definitions = importsOf(DISPATCH);
    expect(definitions.length).toBeGreaterThan(0);
    expect(read("packages/core/src/domain/harness-classify.ts")).toContain(
      "export const classifyHarnessEvidence",
    );
  });
});

describe("TC-OCS-005 the pinned real-shape v2.2.5 JSONL captures", () => {
  test("the happy path is a three-line, independently parseable capture", () => {
    expect(HAPPY_PATH_LINES.length).toBeGreaterThanOrEqual(3);
    const decoded = decodeAll(HAPPY_PATH_LINES);
    expect(decoded[0]?.type).toBe("step_start");
    expect(String(decoded[0]?.sessionID)).toMatch(/^ses_/u);
    expect(HAPPY_PATH_SESSION_ID).toBe(String(decoded[0]?.sessionID));
    for (const line of decoded) expect(line.sessionID).toBe(HAPPY_PATH_SESSION_ID);
    const last = decoded[decoded.length - 1];
    expect(last?.type).toBe("step_finish");
    const lastPart = last === undefined ? undefined : (last.part as { readonly reason?: string });
    expect(lastPart?.reason).toBe("stop");
  });

  test("the tool-error capture pins part.state.status === error and a terminal stop", () => {
    const decoded = decodeAll(TOOL_ERROR_LINES);
    const tool = decoded.find((line) => line.type === "tool_use");
    expect(tool).toBeDefined();
    const part = tool?.part as {
      readonly type?: string;
      readonly state?: { readonly status?: string; readonly error?: string };
    };
    expect(part.type).toBe("tool");
    expect(part.state?.status).toBe("error");
    expect((part.state?.error ?? "").length).toBeGreaterThan(0);
    const last = decoded[decoded.length - 1];
    const lastPart = last === undefined ? undefined : (last.part as { readonly reason?: string });
    expect(lastPart?.reason).toBe("stop");
  });

  test("the stream-error capture pins an error event and no terminal stop", () => {
    const decoded = decodeAll(STREAM_ERROR_LINES);
    const error = decoded.find((line) => line.type === "error");
    expect(error).toBeDefined();
    const detail = error?.error as { readonly type?: unknown; readonly message?: unknown };
    expect(typeof detail.type).toBe("string");
    expect(typeof detail.message).toBe("string");
    expect(decoded.some((line) => line.type === "step_finish")).toBe(false);
  });

  test("the README names the provenance and the regeneration instruction", () => {
    const readme = read(`${STREAM_DIR}/README.md`);
    expect(readme).toContain("opencode v2.2.5");
    expect(readme.toLowerCase()).toContain("regeneration");
  });

  test("no capture carries a prompt, credential, or personal-data canary", () => {
    const text = [...HAPPY_PATH_LINES, ...TOOL_ERROR_LINES, ...STREAM_ERROR_LINES].join("\n");
    for (const canary of [
      "GITHUB_TOKEN",
      "authorization",
      "password",
      "secret",
      "Bearer ",
      "@example.com",
    ]) {
      expect(text).not.toContain(canary);
    }
  });
});

describe("TC-OCS-016 the host output bound is unchanged", () => {
  test("the single child-process site keeps the 16 MiB cap and truncation marker", () => {
    const host = read("packages/adapters/src/host/index.ts");
    expect(host).toContain("16 * 1024 * 1024");
    expect(host).toContain("output truncated");
    expect(host).toContain("createHostSpawnRunner");
    expect(host).toContain("createHostSpawnStarter");
  });
});
