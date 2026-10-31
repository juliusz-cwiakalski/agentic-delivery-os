/**
 * TC-STATUS-033 — performance and read-cost bounds: three bounded network reads,
 * one logical park-fold read, one config resolve, and ≤50 ms pure aggregation.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import type { RepositoryIo } from "../../packages/adapters/src/repo/index";
import { createStatusCommandRuntime, type StatusComposition } from "../../packages/cli/src/edge";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  capSizedFacts,
  NOW_ISO,
  NOW_MS,
  runStatusCli,
  statusInstance,
} from "../fixtures/status/harness";
import { createFixtureTransport } from "./providers/support";
import { guardStore } from "./verify-support";

const SHA = "1111111111111111111111111111111111111111";
const PM = `active_change:\n  workItemRef: GH-175\n  branch: feat/GH-175/status-v1\n  change_folder: doc/changes/x\nparked_changes: []\n`;

const repoIo = (withOrigin: boolean): RepositoryIo => {
  const files = new Map<string, string>([
    [
      "/repo/.git/config",
      withOrigin
        ? '[remote "origin"]\n\turl = git@github.com:owner-placeholder/project-placeholder.git\n'
        : "[core]\n\tbare = false\n",
    ],
    ["/repo/.git/HEAD", "ref: refs/heads/feat/GH-175/status-v1\n"],
    ["/repo/.git/refs/heads/feat/GH-175/status-v1", `${SHA}\n`],
  ]);
  return {
    exists: (path) => path === "/repo/.git" || files.has(path),
    isFile: (path) => files.has(path),
    readText: (path) => files.get(path) ?? "",
  };
};

const checkRuns = (count: number) => ({
  check_runs: Array.from({ length: count }, (_, index) => ({
    id: 9000 + index,
    name: `ci-${index}`,
    status: "completed",
    conclusion: "success",
  })),
});

const issuesUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/issues?state=open&per_page=100&sort=updated&direction=desc";
const pullsUrl =
  "https://api.github.com/repos/owner-placeholder/project-placeholder/pulls?state=open&per_page=100&sort=updated&direction=desc";
const checksUrl = `https://api.github.com/repos/owner-placeholder/project-placeholder/commits/${SHA}/check-runs?per_page=20`;

const setup = (options: { readonly withOrigin: boolean }) => {
  const root = makeTempRoot("gh175-perf");
  const pmDir = mkdtempSync(join(tmpdir(), "gh175-perf-pm-"));
  const pmPath = join(pmDir, "pm-context.yaml");
  writeFileSync(pmPath, PM);
  const { store } = openStore(makeIdentity(root));
  const recorder = { calls: [] as string[] };
  const guarded = guardStore(store, recorder);
  const transport = createFixtureTransport([
    { url: issuesUrl, body: [] },
    { url: pullsUrl, body: [] },
    { url: checksUrl, body: checkRuns(20) },
  ]);
  let resolves = 0;
  const composition: StatusComposition = {
    store: guarded.store,
    credentials: createEnvironmentCredentialPort({
      environment: { GITHUB_TOKEN: "canary-token" },
      brand: fixtureBrand,
    }),
    transport,
    repository: { cwd: "/repo", io: repoIo(options.withOrigin) },
    localContext: {
      path: pmPath,
      fs: {
        exists: (path) => path === pmPath,
        readText: () => PM,
      },
    },
    clock: { nowMs: () => NOW_MS, nowIso: () => NOW_ISO },
    github: { instance: statusInstance() },
  };
  const runtime = createStatusCommandRuntime(composition, () => {
    resolves += 1;
    return {
      ok: true,
      config: { defaultChain: undefined, credentials: {}, entries: {}, chains: {} },
    };
  });
  return {
    runtime,
    transport,
    recorder,
    resolves: () => resolves,
    cleanup: () => {
      removeRoot(root);
      rmSync(pmDir, { recursive: true, force: true });
    },
  };
};

describe("TC-STATUS-033 performance and read-cost bounds", () => {
  test("exactly three network reads, one logical park fold, one config resolve", async () => {
    const harness = setup({ withOrigin: true });
    try {
      const run = await runStatusCli(["--json", "status"], harness.runtime);
      expect(run.exitCode).toBe(0);
      expect(harness.transport.requests).toHaveLength(3);
      expect(new Set(harness.transport.requests.map((request) => request.url))).toEqual(
        new Set([issuesUrl, pullsUrl, checksUrl]),
      );
      expect(harness.transport.requests.every((request) => request.method === "GET")).toBe(true);
      expect(harness.transport.requests.some((request) => request.url.includes("&page=2"))).toBe(
        false,
      );
      expect(harness.recorder.calls.filter((call) => call === "read")).toHaveLength(1);
      expect(harness.resolves()).toBe(1);
    } finally {
      harness.cleanup();
    }
  });

  test("the check-runs raw page of 20 drives source-truncated and renders eight runs", async () => {
    const harness = setup({ withOrigin: true });
    try {
      const run = await runStatusCli(["--json", "status"], harness.runtime);
      const envelope = JSON.parse(run.stdout) as {
        data: {
          sections: {
            id: string;
            truncated: boolean;
            runs: unknown[];
            evidence: { reasons: string[] };
          }[];
        };
      };
      const ci = envelope.data.sections.find((entry) => entry.id === "ci");
      expect(ci?.truncated).toBe(true);
      expect(ci?.runs).toHaveLength(8);
      expect(ci?.evidence.reasons).toContain("source-truncated");
    } finally {
      harness.cleanup();
    }
  });

  test("an unavailable binding short-circuits to zero network reads with six sections", async () => {
    const harness = setup({ withOrigin: false });
    try {
      const run = await runStatusCli(["--json", "status"], harness.runtime);
      expect(run.exitCode).toBe(0);
      expect(harness.transport.requests).toHaveLength(0);
      const envelope = JSON.parse(run.stdout) as { data: { sections: unknown[] } };
      expect(envelope.data.sections).toHaveLength(6);
    } finally {
      harness.cleanup();
    }
  });

  test("pure aggregation over cap-sized facts stays within 50 ms (median of five)", () => {
    const facts = capSizedFacts();
    aggregateStatus(facts);
    const timings: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const started = performance.now();
      aggregateStatus(facts);
      timings.push(performance.now() - started);
    }
    timings.sort((left, right) => left - right);
    const median = timings[2] ?? Number.POSITIVE_INFINITY;
    console.log(
      `status aggregation median ${median.toFixed(3)} ms; runtime ${Bun.version}; platform ${process.platform}/${process.arch}`,
    );
    expect(median).toBeLessThanOrEqual(50);
    // The measurement is live: a deliberately slow loop is observable.
    const slowStart = performance.now();
    while (performance.now() - slowStart < 10) {
      // intentional delay
    }
    expect(performance.now() - slowStart).toBeGreaterThanOrEqual(10);
  });
});
