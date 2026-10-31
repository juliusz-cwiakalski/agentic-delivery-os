/**
 * TC-STATUS-024 / TC-STATUS-025 — read-only execution and byte-identical
 * determinism over identical injected inputs, with live seeded controls.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import type { RepositoryIo } from "../../packages/adapters/src/repo/index";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  baseFacts,
  NOW_ISO,
  NOW_MS,
  runStatusCli,
  statusInstance,
  statusRuntime,
} from "../fixtures/status/harness";
import { createFixtureTransport } from "./providers/support";
import { guardStore } from "./verify-support";

const ROOT = process.cwd();
const PM_TEXT = `active_change:\n  workItemRef: GH-175\n  branch: feat/GH-175/status-v1\n  change_folder: doc/changes/x\nparked_changes: []\n`;

const repoIo = (): RepositoryIo => {
  const files = new Map<string, string>([
    [
      "/repo/.git/config",
      '[remote "origin"]\n\turl = git@github.com:owner-placeholder/project-placeholder.git\n',
    ],
    ["/repo/.git/HEAD", "ref: refs/heads/feat/GH-175/status-v1\n"],
    ["/repo/.git/refs/heads/feat/GH-175/status-v1", "1111111111111111111111111111111111111111\n"],
  ]);
  return {
    exists: (path) => path === "/repo/.git" || files.has(path),
    isFile: (path) => files.has(path),
    readText: (path) => files.get(path) ?? "",
  };
};

const routes = [
  {
    url: "https://api.github.com/repos/owner-placeholder/project-placeholder/issues?state=open&per_page=100&sort=updated&direction=desc",
    body: [],
  },
  {
    url: "https://api.github.com/repos/owner-placeholder/project-placeholder/pulls?state=open&per_page=100&sort=updated&direction=desc",
    body: [],
  },
  {
    url: "https://api.github.com/repos/owner-placeholder/project-placeholder/commits/1111111111111111111111111111111111111111/check-runs?per_page=20",
    body: { check_runs: [] },
  },
] as const;

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

describe("TC-STATUS-024 read-only execution", () => {
  test("the guarded store observes reads and no mutation/fence call", async () => {
    const root = makeTempRoot("gh175-readonly");
    const pmDir = mkdtempSync(join(tmpdir(), "gh175-pm-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const recorder = { calls: [] as string[] };
      const guarded = guardStore(store, recorder);
      const run = await runStatusCli(["--json", "status"], runtimeFor(guarded.store, pmPath));
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
    const root = makeTempRoot("gh175-readonly-transport");
    const pmDir = mkdtempSync(join(tmpdir(), "gh175-pm-transport-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const transport = createFixtureTransport(routes);
      const runtime = runtimeFor(store, pmPath, transport);
      const run = await runStatusCli(["--json", "status"], runtime);
      expect(run.exitCode).toBe(0);
      expect(transport.requests).toHaveLength(3);
      expect(transport.requests.every((request) => request.method === "GET")).toBe(true);
      expect(transport.requests.some((request) => request.url.includes("quota"))).toBe(false);
      expect(transport.requests.some((request) => request.url.includes("announcement"))).toBe(
        false,
      );
      const strict = {
        send: async (request: { readonly method: string }) => {
          if (request.method !== "GET") throw new Error("non-GET rejected");
          return { status: 200, body: [] };
        },
      };
      await expect(
        strict.send({ method: "POST" } as unknown as Parameters<typeof strict.send>[0]),
      ).rejects.toThrow(/non-GET/);
    } finally {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    }
  });

  test("the PM-context bytes and mtime are unchanged", async () => {
    const root = makeTempRoot("gh175-readonly-pm");
    const pmDir = mkdtempSync(join(tmpdir(), "gh175-pm-bytes-"));
    const pmPath = join(pmDir, "pm-context.yaml");
    writeFileSync(pmPath, PM_TEXT);
    try {
      const { store } = openStore(makeIdentity(root));
      const beforeBytes = readFileSync(pmPath, "utf8");
      const beforeMtime = statSync(pmPath).mtimeMs;
      const run = await runStatusCli(["--json", "status"], runtimeFor(store, pmPath));
      expect(run.exitCode).toBe(0);
      expect(readFileSync(pmPath, "utf8")).toBe(beforeBytes);
      expect(statSync(pmPath).mtimeMs).toBe(beforeMtime);
    } finally {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    }
  });

  test("no status module imports node:child_process", () => {
    for (const file of [
      "packages/core/src/domain/status.ts",
      "packages/cli/src/commands/status.ts",
      "packages/cli/src/edge.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).not.toContain("node:child_process");
      expect(text).not.toContain("spawnSync");
    }
  });
});

describe("TC-STATUS-025 determinism and byte-identical replay", () => {
  test("--json and human replays are byte-identical", async () => {
    const jsonRuntime = statusRuntime(baseFacts());
    const humanRuntime = statusRuntime(baseFacts());
    const first = await runStatusCli(["--json", "status"], jsonRuntime);
    const second = await runStatusCli(["--json", "status"], jsonRuntime);
    expect(first.stdout).toBe(second.stdout);
    const humanFirst = await runStatusCli(["status"], humanRuntime);
    const humanSecond = await runStatusCli(["status"], humanRuntime);
    expect(humanFirst.stdout).toBe(humanSecond.stdout);
  });

  test("a changed fact changes the bounded digest", async () => {
    const base = await runStatusCli(["--json", "status"], statusRuntime(baseFacts()));
    const changed = await runStatusCli(
      ["--json", "status"],
      statusRuntime(
        baseFacts({
          tracker: {
            ok: true,
            items: [
              {
                identity: { systemName: "github", entityId: "1" },
                title: "New work",
                status: { nativeStatus: "open", deliveryState: "ready" },
                labels: ["hand-back"],
                relations: [],
              },
            ],
            pageItemCount: 1,
            availability: {
              ownerHandBacks: "available",
              blockedDependencies: "unavailable",
              stalls: "available",
              hygiene: "available",
            },
          },
        }),
      ),
    );
    expect(changed.stdout).not.toBe(base.stdout);
  });

  test("the pure domain and command contain no ambient clock/randomness/env reads", () => {
    for (const file of [
      "packages/core/src/domain/status.ts",
      "packages/cli/src/commands/status.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const banned of [
        "Date.now",
        "Math.random",
        "process.env",
        "Bun.env",
        "performance.now",
      ]) {
        expect(text).not.toContain(banned);
      }
    }
  });
});
