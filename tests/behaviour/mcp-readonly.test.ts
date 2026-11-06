/**
 * TC-MCP-017 — the read-only guarantee.
 *
 * Every state store is wrapped in `guardStore` with `throwOnMutation: true`; the
 * full three-tool sequence runs over success and failure fixtures, the temp tree
 * is snapshotted before and after (paths, hashes, mtimes), no audit record
 * exists, and the AST scans prove the surface cannot spawn or use the git seam.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  nodePmNotesFileSystemFacts,
  readPmNotesText,
} from "../../packages/adapters/src/file/index";
import { readChangeTransitionsTolerant } from "../../packages/core/src/state/index";
import { createToolset } from "../../packages/mcp/src/index";
import {
  createVerifyRecorder,
  createVerifyState,
  guardStore,
  readFixture,
  VERIFY_REF,
  type VerifyState,
} from "../behaviour/verify-support";
import { gitSeamViolations, handlerWriteViolations } from "../fixtures/mcp/mutants/scan";
import { baseFacts, statusRuntime } from "../fixtures/status/harness";
import {
  clone,
  EXPECTED_JOBS,
  baseFacts as gatesBaseFacts,
  run,
} from "../fixtures/verify-gates/cases/facts";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const tempRoots: string[] = [];

type TreeEntry = { readonly hash: string; readonly mtimeMs: number };

const snapshotTree = (root: string): Record<string, TreeEntry> => {
  const entries: Record<string, TreeEntry> = {};
  const walk = (relative: string): void => {
    for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
      const next = relative.length === 0 ? entry.name : `${relative}/${entry.name}`;
      const path = join(root, next);
      if (entry.isDirectory()) {
        entries[`${next}/`] = { hash: "dir", mtimeMs: statSync(path).mtimeMs };
        walk(next);
      } else {
        entries[next] = {
          hash: createHash("sha256").update(readFileSync(path)).digest("hex"),
          mtimeMs: statSync(path).mtimeMs,
        };
      }
    }
  };
  walk("");
  return entries;
};

const workspaceWithTarget = (): { root: string; changesDirectory: string } => {
  const root = mkdtempSync(join(tmpdir(), "mcp-readonly-"));
  tempRoots.push(root);
  const changesDirectory = join(root, "doc/changes");
  const directory = join(changesDirectory, "2026-10", `2026-10-31--${VERIFY_REF}--fixture`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, `chg-${VERIFY_REF}-pm-notes.yaml`),
    readFixture("full/base-complete.yaml"),
  );
  writeFileSync(join(root, "config.yaml"), "{}\n");
  return { root, changesDirectory };
};

const registryRead = (store: Parameters<typeof readChangeTransitionsTolerant>[0], ref: string) => {
  const read = readChangeTransitionsTolerant(store, ref);
  return read.ok
    ? {
        ok: true as const,
        present: read.value.present,
        verifiedEmpty: read.value.verifiedEmpty,
        transitions: read.value.transitions,
        recordCount: read.value.evidence.recordCount,
      }
    : { ok: false as const, error: read.error };
};

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

afterAll(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("TC-MCP-017 the full sequence performs zero writes or mutations", () => {
  test("guarded stores record no mutation and the tree is byte-identical", async () => {
    const workspace = workspaceWithTarget();
    const state: VerifyState = createVerifyState();
    try {
      const recorder = createVerifyRecorder();
      const guarded = guardStore(state.store, recorder, { throwOnMutation: true });
      const before = snapshotTree(workspace.root);
      const gitBefore = gitStatus();

      const verifyRuntime = {
        readPmNotes: (ref: string) =>
          readPmNotesText({
            changeRef: ref,
            changesDirectory: workspace.changesDirectory,
            fs: nodePmNotesFileSystemFacts(),
          }),
        readRegistry: (ref: string) => registryRead(guarded.store, ref),
      };
      const gateFacts = gatesBaseFacts();
      const gateRuntime = {
        readLifecycle: (ref: string) => ({
          document: readPmNotesText({
            changeRef: ref,
            changesDirectory: workspace.changesDirectory,
            fs: nodePmNotesFileSystemFacts(),
          }),
          registry: registryRead(guarded.store, ref),
        }),
        readRepository: () => gateFacts.repository,
        readWorkflow: () => gateFacts.workflow,
        readOpenPullRequests: async () => gateFacts.openPullRequests,
        readDeliveryRequestDetail: async () => gateFacts.deliveryRequestDetail,
        readCheckRuns: async () => gateFacts.checkRuns,
        readWorkItem: async () => gateFacts.workItem,
      };

      const toolset = createToolset({
        brand: SYNTHETIC_BRAND,
        status: statusRuntime(baseFacts()),
        verify: verifyRuntime,
        gates: gateRuntime,
      });

      expect((await toolset.callTool("status")).ok).toBe(true);
      expect((await toolset.callTool("verify-artifact", { ref: VERIFY_REF })).ok).toBe(true);
      expect((await toolset.callTool("gate-report", { ref: VERIFY_REF })).ok).toBe(true);

      const redFacts = clone(gateFacts);
      redFacts.checkRuns = {
        ok: true,
        value: {
          items: EXPECTED_JOBS.map((name) =>
            run(name, name === EXPECTED_JOBS[0] ? "failed" : "succeeded"),
          ),
          pageItemCount: EXPECTED_JOBS.length,
        },
      };
      const redToolset = createToolset({
        brand: SYNTHETIC_BRAND,
        gates: { ...gateRuntime, readCheckRuns: async () => redFacts.checkRuns },
      });
      expect((await redToolset.callTool("gate-report", { ref: VERIFY_REF })).ok).toBe(false);
      expect((await toolset.callTool("verify-artifact", { ref: "GH-9999" })).ok).toBe(false);

      const mutations = recorder.calls.filter((call) =>
        [
          "append",
          "replaceDocument",
          "acquireFence",
          "releaseFence",
          "recoverFence",
          "repairTornTail",
          "salvage",
        ].includes(call),
      );
      expect(mutations).toEqual([]);
      expect(snapshotTree(workspace.root)).toEqual(before);
      expect(gitStatus()).toBe(gitBefore);

      const auditFiles = readdirSync(state.identity.stateDirectory).filter((name) =>
        name.toLowerCase().includes("audit"),
      );
      expect(auditFiles).toEqual([]);
    } finally {
      state.cleanup();
    }
  });

  test("the surface imports no spawn-capable seam and calls none of its constructors", () => {
    const report = gitSeamViolations(ROOT);
    expect(report.files.length).toBeGreaterThan(0);
    expect(report.violations).toEqual([]);
  });

  test("no mcp module contains a state-mutation call", () => {
    const report = handlerWriteViolations(ROOT);
    expect(report.files.length).toBeGreaterThan(0);
    expect(report.violations).toEqual([]);
  });

  test("a seeded git seam import and call fail by name", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-readonly-mutant-"));
    try {
      mkdirSync(join(root, "packages/mcp/src"), { recursive: true });
      writeFileSync(
        join(root, "packages/mcp/src/serve.ts"),
        'import { createGitBranchSeam } from "@delivery-os/adapters/git";\n' +
          "export const seam = createGitBranchSeam();\n",
      );
      const report = gitSeamViolations(root);
      expect(report.violations.some((entry) => entry.includes("git seam"))).toBe(true);
      expect(report.violations.some((entry) => entry.includes("createGitBranchSeam"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a seeded store mutation fails by name", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-readonly-write-"));
    try {
      mkdirSync(join(root, "packages/mcp/src/commands"), { recursive: true });
      writeFileSync(
        join(root, "packages/mcp/src/commands/status.ts"),
        "export const write = (store: { append: (x: unknown) => void }): void => store.append(1);\n",
      );
      const report = handlerWriteViolations(root);
      expect(report.violations.some((entry) => entry.includes("state mutation append"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
