/**
 * TC-HARN-006 / TC-HARN-007 — harness-agnostic liveness shape, declared
 * absences, and the unchanged zero-source watchdog boundary.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  HARNESS_LIVENESS_KINDS,
  type HarnessSessionPort,
} from "../../packages/core/src/contracts/index";
import {
  canonicalHarnessJson,
  classifyWatchdogLiveness,
  harnessLivenessToWatchdogSignals,
} from "../../packages/core/src/domain/index";
import {
  HARNESS_CONFORMANCE_REGISTRY,
  type HarnessConformanceDeps,
  type HarnessConformanceIo,
  type HarnessConformanceRegistration,
} from "../../packages/testkit/src/conformance/harness";
import {
  assembleLiveness,
  CLAUDE_COMMAND,
  CLAUDE_HEADLESS_ARGS,
  classifier,
  createFakeCredentialPort,
  declaredBuildEnvironment,
  HARNESS_COMMAND,
  LIST_ARGS,
  RESUME_ARGS,
  SPAWN_ARGS,
  TIMEOUT_MS,
} from "../fixtures/harness/harness-io";
import { LIVENESS_FACTS } from "../fixtures/harness/scenarios/classification";

const ROOT = process.cwd();

const deps = (command: string, spawnArgs: readonly string[]): HarnessConformanceDeps => ({
  command,
  spawnArgs,
  resumeArgs: RESUME_ARGS,
  listArgs: LIST_ARGS,
  buildEnvironment: declaredBuildEnvironment(createFakeCredentialPort()),
  classify: classifier,
  assembleLiveness,
  now: () => "2026-11-06T00:00:00Z",
  timeoutMs: TIMEOUT_MS,
});

const registration = (kind: "opencode" | "claude-code"): HarnessConformanceRegistration => {
  const found = HARNESS_CONFORMANCE_REGISTRY.find((entry) => entry.kind === kind);
  if (found === undefined) throw new Error(`missing registration ${kind}`);
  return found;
};

const COMPLETED_OUTPUT = JSON.stringify({
  session: { id: "ses_live" },
  result: { completion: "complete" },
});
const CLAUDE_COMPLETED = JSON.stringify({
  type: "result",
  subtype: "success",
  session_id: "cc_live",
  usage: {},
});

const openSession = async (
  kind: "opencode" | "claude-code",
  io: HarnessConformanceIo,
): Promise<HarnessSessionPort> => {
  const entry = registration(kind);
  const session = entry.build(
    io,
    deps(
      kind === "opencode" ? HARNESS_COMMAND : CLAUDE_COMMAND,
      kind === "opencode" ? SPAWN_ARGS : CLAUDE_HEADLESS_ARGS,
    ),
  );
  const spawned = await session.spawn({
    workItemRef: "GH-233",
    prompt: "liveness",
    descriptor: { kind: "host", workDirectory: "/synthetic/work", environment: [] },
  });
  expect(spawned.ok).toBe(true);
  return session;
};

describe("TC-HARN-006 harness-agnostic liveness shape", () => {
  test("both adapters expose the same neutral key set and order for the same subset", async () => {
    const opencode = await openSession("opencode", {
      spawnStdout: COMPLETED_OUTPUT,
      spawnStatus: 0,
      spawnTimedOut: false,
      livenessFacts: LIVENESS_FACTS,
    });
    const claude = await openSession("claude-code", {
      spawnStdout: CLAUDE_COMPLETED,
      spawnStatus: 0,
      spawnTimedOut: false,
    });
    const opencodeReport = await opencode.liveness({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_live",
        treeRoot: "ses_live",
        workItemRef: "GH-233",
      },
    });
    const claudeReport = await claude.liveness({
      handle: {
        harnessKind: "claude-code",
        sessionId: "cc_live",
        treeRoot: "cc_live",
        workItemRef: "GH-233",
      },
    });
    expect(opencodeReport.ok && claudeReport.ok).toBe(true);
    if (!opencodeReport.ok || !claudeReport.ok) return;
    expect(opencodeReport.value.readings.map((reading) => reading.kind)).toEqual([
      ...HARNESS_LIVENESS_KINDS,
    ]);
    expect(claudeReport.value.readings.map((reading) => reading.kind)).toEqual([
      ...HARNESS_LIVENESS_KINDS,
    ]);
    for (const reading of opencodeReport.value.readings) {
      expect(Object.keys(reading).sort()).not.toContain("harness");
    }
  });

  test("sourced values equal the injected facts and carry the injected timestamp", async () => {
    const session = await openSession("opencode", {
      spawnStdout: COMPLETED_OUTPUT,
      spawnStatus: 0,
      spawnTimedOut: false,
      livenessFacts: LIVENESS_FACTS,
    });
    const report = await session.liveness({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_live",
        treeRoot: "ses_live",
        workItemRef: "GH-233",
      },
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    const readings = new Map(report.value.readings.map((reading) => [reading.kind, reading]));
    expect(readings.get("session-traffic")).toEqual({
      kind: "session-traffic",
      status: "sourced",
      value: 11,
      observedAt: "2026-11-06T00:00:09Z",
    });
    expect(readings.get("process")).toMatchObject({ status: "sourced", value: 1 });
    const worktree = readings.get("worktree-activity");
    expect(worktree?.status).toBe("absent");
    if (worktree?.status === "absent") expect(worktree.reason).toBe("harness-unsupported");
    expect(canonicalHarnessJson(report.value)).toBe(canonicalHarnessJson(report.value));
  });

  test("a declared-absent kind carries no zero, false, empty string, or invented time", async () => {
    const session = await openSession("claude-code", {
      spawnStdout: CLAUDE_COMPLETED,
      spawnStatus: 0,
      spawnTimedOut: false,
    });
    const report = await session.liveness({
      handle: {
        harnessKind: "claude-code",
        sessionId: "cc_live",
        treeRoot: "cc_live",
        workItemRef: "GH-233",
      },
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    for (const reading of report.value.readings) {
      expect(reading.status).toBe("absent");
      if (reading.status === "absent") {
        expect(Object.hasOwn(reading, "value")).toBe(false);
        expect(Object.hasOwn(reading, "observedAt")).toBe(false);
        expect(reading.reason.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("TC-HARN-007 all-absent liveness and the zero-source watchdog", () => {
  test("an all-absent read yields three present absences and an absent watchdog mapping", async () => {
    const session = await openSession("opencode", {
      spawnStdout: COMPLETED_OUTPUT,
      spawnStatus: 0,
      spawnTimedOut: false,
      livenessFacts: [],
    });
    const report = await session.liveness({
      handle: {
        harnessKind: "opencode",
        sessionId: "ses_live",
        treeRoot: "ses_live",
        workItemRef: "GH-233",
      },
    });
    expect(report.ok).toBe(true);
    if (!report.ok) return;
    expect(report.value.readings).toHaveLength(3);
    for (const reading of report.value.readings) expect(reading.status).toBe("absent");
    const signals = harnessLivenessToWatchdogSignals(report.value);
    expect(signals).toEqual({});
    expect(classifyWatchdogLiveness(signals).outcome).toBe("absent");
  });

  test("the watchdog and harness tiers do not import each other", () => {
    const list = (relative: string): string[] =>
      readdirSync(join(ROOT, relative))
        .filter((entry) => entry.endsWith(".ts"))
        .map((entry) => `${relative}/${entry}`);
    const harnessFiles = [
      ...list("packages/core/src/contracts").filter((file) => file.includes("harness")),
      ...list("packages/core/src/domain").filter((file) => file.includes("harness")),
      ...list("packages/adapters/src/harness"),
    ];
    const watchdogFiles = [
      ...list("packages/core/src/contracts").filter((file) => file.includes("watchdog")),
      ...list("packages/core/src/domain").filter((file) => file.includes("watchdog")),
      ...list("packages/adapters/src/git").filter((file) => file.includes("watchdog")),
    ];
    expect(harnessFiles.length).toBeGreaterThan(0);
    expect(watchdogFiles.length).toBeGreaterThan(0);
    const importsOf = (file: string): string[] => {
      const source = ts.createSourceFile(
        file,
        readFileSync(join(ROOT, file), "utf8"),
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
    for (const file of harnessFiles) {
      for (const specifier of importsOf(file)) {
        expect(specifier, file).not.toContain("watchdog");
      }
    }
    for (const file of watchdogFiles) {
      for (const specifier of importsOf(file)) {
        expect(specifier, file).not.toContain("harness");
      }
    }
  });
});
