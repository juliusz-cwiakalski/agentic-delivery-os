/**
 * TC-BRIEF-018 — read-only execution, zero spawn, credential-reference guard,
 * and the redaction chokepoint over the brief's machine and human output.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import type { RepositoryIo } from "../../packages/adapters/src/repo/index";
import { createBriefCommandDefinition } from "../../packages/cli/src/commands/brief";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { writeOutput } from "../../packages/cli/src/output/serialize";
import { anonymousInstance, NOW_ISO, NOW_MS, statusInstance } from "../fixtures/brief/harness";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";
import { createFixtureTransport } from "./providers/support";
import { guardStore } from "./verify-support";

const PM_TEXT =
  "active_change:\n  workItemRef: GH-228\n  branch: feat/GH-228/brief-render-only\n  change_folder: doc/changes/x\nparked_changes: []\n";

const issueUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/issues?state=open&per_page=100&sort=updated&direction=desc";
const pullUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/pulls?state=open&per_page=100&sort=updated&direction=desc";
const checksUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/commits/1111111111111111111111111111111111111111/check-runs?per_page=20";

const routes = [
  { url: issueUrl, body: [] },
  { url: pullUrl, body: [] },
  { url: checksUrl, body: { check_runs: [] } },
] as const;

const repoIo = (): RepositoryIo => {
  const files = new Map<string, string>([
    [
      "/repo/.git/config",
      '[remote "origin"]\n\turl = git@github.com:owner-placeholder/project-placeholder.git\n',
    ],
    ["/repo/.git/HEAD", "ref: refs/heads/feat/GH-228/brief-render-only\n"],
    [
      "/repo/.git/refs/heads/feat/GH-228/brief-render-only",
      "1111111111111111111111111111111111111111\n",
    ],
  ]);
  return {
    exists: (path) => path === "/repo/.git" || files.has(path),
    isFile: (path) => files.has(path),
    readText: (path) => files.get(path) ?? "",
  };
};

const runtimeFor = (
  store: StatusComposition["store"],
  pmPath: string,
  transport = createFixtureTransport(routes),
) => {
  const composition: StatusComposition = {
    store,
    credentials: createEnvironmentCredentialPort({
      environment: { GITHUB_TOKEN: "canary-token" },
      brand: fixtureBrand,
    }),
    transport,
    repository: { cwd: "/repo", io: repoIo() },
    localContext: {
      path: pmPath,
      fs: {
        exists: (path) => path === pmPath,
        readText: (path) => {
          if (path !== pmPath) throw new Error("missing");
          return readFileSync(pmPath, "utf8");
        },
      },
    },
    clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
    github: { instance: statusInstance() },
  };
  return createStatusCommandRuntime(composition, () => ({
    ok: true,
    config: { defaultChain: undefined, credentials: {}, entries: {}, chains: {} },
  }));
};

const runBrief = async (
  argv: readonly string[],
  runtime: ReturnType<typeof runtimeFor>,
  secrets: readonly string[] = [],
) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = [100, 110] as const;
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => "run-brief-readonly",
    secrets,
    program: { commands: { brief: createBriefCommandDefinition(runtime) } },
  };
  const exitCode = await runCli(argv, { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

describe("TC-BRIEF-018 read-only execution and guard", () => {
  test("the guarded store observes reads and no mutation or fence call", async () => {
    const root = makeTempRoot("gh228-brief-readonly");
    const pmDir = mkdtempSync(join(tmpdir(), "gh228-pm-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const recorder = { calls: [] as string[] };
      const guarded = guardStore(store, recorder);
      const run = await runBrief(["--json", "brief"], runtimeFor(guarded.store, pmPath));
      expect(run.exitCode).toBe(0);
      expect(recorder.calls).toContain("read");
      for (const forbidden of ["append", "replaceDocument", "acquireFence", "releaseFence"]) {
        expect(recorder.calls).not.toContain(forbidden);
      }
      expect(() => guarded.store.acquireFence("deliberate-control")).toThrow(
        /forbidden acquireFence/,
      );
    } finally {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    }
  });

  test("the transport sees only GETs to the three declared endpoints", async () => {
    const root = makeTempRoot("gh228-brief-transport");
    const pmDir = mkdtempSync(join(tmpdir(), "gh228-pm-transport-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const transport = createFixtureTransport(routes);
      const run = await runBrief(["--json", "brief"], runtimeFor(store, pmPath, transport));
      expect(run.exitCode).toBe(0);
      expect(transport.requests).toHaveLength(3);
      expect(transport.requests.every((request) => request.method === "GET")).toBe(true);
      expect(transport.requests.some((request) => request.url.includes("quota"))).toBe(false);
      expect(transport.requests.some((request) => request.url.includes("announcement"))).toBe(
        false,
      );
    } finally {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    }
  });

  test("the PM-context bytes and mtime are unchanged", async () => {
    const root = makeTempRoot("gh228-brief-pm");
    const pmDir = mkdtempSync(join(tmpdir(), "gh228-pm-bytes-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const beforeBytes = readFileSync(pmPath, "utf8");
      const beforeMtime = statSync(pmPath).mtimeMs;
      const run = await runBrief(["--json", "brief"], runtimeFor(store, pmPath));
      expect(run.exitCode).toBe(0);
      expect(readFileSync(pmPath, "utf8")).toBe(beforeBytes);
      expect(statSync(pmPath).mtimeMs).toBe(beforeMtime);
    } finally {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    }
  });

  test("no brief module contains a child-process capability", () => {
    let scanned = 0;
    for (const file of [
      "packages/core/src/contracts/brief.ts",
      "packages/core/src/domain/brief.ts",
      "packages/cli/src/commands/brief.ts",
      "packages/cli/src/edge.ts",
    ]) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text).not.toContain("node:child_process");
      expect(text).not.toContain("spawnSync");
      expect(text).not.toContain("execFile");
      expect(text).not.toContain("Bun.spawn");
      scanned += 1;
    }
    expect(scanned).toBeGreaterThan(0);
  });

  test("an anonymous instance is refused before any GitHub read and the local context is read", async () => {
    const root = makeTempRoot("gh228-brief-anon");
    const pmDir = mkdtempSync(join(tmpdir(), "gh228-pm-anon-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const transport = createFixtureTransport(routes);
      const composition: StatusComposition = {
        store,
        credentials: createEnvironmentCredentialPort({
          environment: { GITHUB_TOKEN: "canary-token" },
          brand: fixtureBrand,
        }),
        transport,
        repository: { cwd: "/repo", io: repoIo() },
        localContext: {
          path: pmPath,
          fs: {
            exists: (path) => path === pmPath,
            readText: (path) => {
              if (path !== pmPath) throw new Error("missing");
              return readFileSync(pmPath, "utf8");
            },
          },
        },
        clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
        github: { instance: anonymousInstance() },
      };
      const runtime = createStatusCommandRuntime(composition, () => ({
        ok: true,
        config: { defaultChain: undefined, credentials: {}, entries: {}, chains: {} },
      }));
      const run = await runBrief(["--json", "brief"], runtime);
      expect(run.exitCode).toBe(0);
      expect(transport.requests).toHaveLength(0);
      const envelope = JSON.parse(run.stdout) as {
        data: { surfaces: { id: string; state: string }[] };
      };
      const state = (id: string) =>
        envelope.data.surfaces.find((surface) => surface.id === id)?.state;
      expect(state("tracker")).toBe("unknown");
      expect(state("ci")).toBe("unknown");
      expect(state("changes-and-prs")).toBe("degraded");
      expect(state("parked-work")).toBe("observed");
    } finally {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    }
  });

  test("the write chokepoint redacts a planted canary in human text", () => {
    const canary = "planted-fake-brief-canary";
    const stdout = bufferSink();
    const stderr = bufferSink();
    writeOutput(
      { stdout, stderr },
      {
        schemaVersion: "delivery.result.v1",
        runId: "run-redaction-control",
        exitCode: 0,
        timing: { totalMs: 1 },
        data: { value: canary },
      },
      undefined,
      [canary],
      false,
      { humanText: `prefix ${canary} suffix\n` },
    );
    expect(stdout.value).not.toContain(canary);
    expect(stdout.value).toContain("[redacted]");
  });
});
