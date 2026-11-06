/**
 * TC-SAFETY-001..010 — staging precision, fail-closed safety, forbidden-path
 * and binary exclusions, and the ordering proof that nothing is staged before
 * the scan.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSecretScanner } from "../../packages/adapters/src/file/secret-scan";
import {
  COMMIT_REF,
  commitPaths,
  commitDataOf,
  errorCodeOf,
  excludedOf,
  head,
  ledgerLineCount,
  seedDirtyTree,
  status,
  telemetryPayloads,
  validMessage,
} from "./commit-support";
import { withCommitHarness } from "../fixtures/commit/harness";

const SEED = { "README.md": "# fixture\n", "src/existing.ts": "export const v = 1;\n" } as const;

describe("TC-SAFETY-001 untracked stray outside declared scope never stages", () => {
  test("the stray is disclosed and remains untracked", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: {
            "src/new-file.ts": "export const n = 1;\n",
            "stray.txt": "stray\n",
          },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitPaths(harness)).not.toContain("stray.txt");
        expect(excludedOf(run).untrackedNotStaged).toEqual(["stray.txt"]);
        expect(status(harness)).toContain("?? stray.txt");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-002 untracked file inside declared scope is staged", () => {
  test("the declared new file lands; an undeclared sibling stays out", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness, {
          tracked: { "src/existing.ts": "export const v = 2;\n" },
          untracked: {
            "src/new-file.ts": "export const n = 1;\n",
            "src/other-file.ts": "export const o = 1;\n",
          },
        });
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitPaths(harness)).toContain("src/new-file.ts");
        expect(commitPaths(harness)).not.toContain("src/other-file.ts");
        expect(excludedOf(run).untrackedNotStaged).toEqual(["src/other-file.ts"]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-003 tracked work outside declared scope is staged with drift", () => {
  test("both tracked modifications land and the drift is disclosed", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("docs/guide.md", "changed\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitDataOf(run).stagedFiles).toEqual(["docs/guide.md", "src/existing.ts"]);
        expect(excludedOf(run).scopeDrift).toEqual(["docs/guide.md"]);
        expect(commitPaths(harness)).toEqual(["docs/guide.md", "src/existing.ts"]);
      },
      {
        seedFiles: {
          "README.md": "# fixture\n",
          "src/existing.ts": "export const v = 1;\n",
          "docs/guide.md": "original\n",
        },
      },
    );
  });
});

describe("TC-SAFETY-004/005 secret suspicion STOPs without material", () => {
  test("a content finding refuses the operation and commits nothing", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const beforeHead = head(harness);
        const beforeLedger = ledgerLineCount(harness);
        harness.safety.setFindings([{ class: "secret-content", path: "src/existing.ts" }]);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("commit.safety.secret-suspected");
        expect(head(harness)).toBe(beforeHead);
        expect(ledgerLineCount(harness)).toBe(beforeLedger);
        expect(telemetryPayloads(harness)).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });

  test("a filename finding uses the same STOP identity", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("src/id_rsa", "not actually a key\n");
        harness.safety.setFindings([{ class: "secret-filename", path: "src/id_rsa" }]);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("commit.safety.secret-suspected");
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-006 forbidden paths are excluded and disclosed", () => {
  test("tmp/ and .ai/local/ never stage while the valid change lands", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("tmp/secret.txt", "local\n");
        harness.repo.write(".ai/local/state.json", "{}\n");
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitPaths(harness)).toEqual(["src/existing.ts"]);
        expect(excludedOf(run).forbiddenPaths).toEqual([".ai/local/state.json", "tmp/secret.txt"]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-007 oversized binary is excluded and disclosed", () => {
  test("a binary over the cap is never staged and the text change lands", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("src/existing.ts", "export const v = 2;\n");
        harness.repo.write("assets/blob.bin", `\0${"a".repeat(1_048_600)}`);
        harness.coreTransport.push({ kind: "success", message: validMessage() });
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(0);
        expect(commitPaths(harness)).toEqual(["src/existing.ts"]);
        expect(excludedOf(run).oversizedBinaries).toEqual(["assets/blob.bin"]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-008 exclusion emptying the set is staging-blocked", () => {
  test("only forbidden material refuses with the user identity", async () => {
    await withCommitHarness(
      async (harness) => {
        harness.repo.write("tmp/secret.txt", "local\n");
        const beforeHead = head(harness);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(errorCodeOf(run)).toBe("commit.staging-blocked-untracked");
        expect(head(harness)).toBe(beforeHead);
        expect(harness.repo.stagedPaths()).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-009 scan unavailable fails closed", () => {
  test("exit 2, nothing staged, no transport", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        harness.safety.setUnavailable();
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(2);
        expect(errorCodeOf(run)).toBe("commit.safety.scan-unavailable");
        expect(harness.repo.stagedPaths()).toEqual([]);
        expect(harness.coreTransport.calls).toEqual([]);
      },
      { seedFiles: SEED },
    );
  });
});

describe("TC-SAFETY-010 safety runs before anything is staged", () => {
  test("the index is empty at scan time and remains empty after a STOP", async () => {
    await withCommitHarness(
      async (harness) => {
        seedDirtyTree(harness);
        const indexSnapshots: string[][] = [];
        harness.safety.onScan = () => {
          indexSnapshots.push([...harness.repo.stagedPaths()]);
        };
        harness.safety.setFindings([{ class: "secret-content", path: "src/existing.ts" }]);
        const run = await harness.runCommit([COMMIT_REF]);
        expect(run.exitCode).toBe(1);
        expect(indexSnapshots).toEqual([[]]);
        expect(harness.repo.stagedPaths()).toEqual([]);
        expect(harness.safety.calls).toHaveLength(1);
      },
      { seedFiles: SEED },
    );
  });
});

describe("the real deterministic scanner names classes and never material", () => {
  test("content and filename findings carry no secret bytes", async () => {
    const root = mkdtempSync(join(process.cwd(), "tmp", "tmpdir", "scanner-"));
    try {
      mkdirSync(join(root, "src"), { recursive: true });
      writeFileSync(join(root, "src/config.ts"), 'const token = "ghp_abcdefghijklmnopqrstuvwxyz";\n');
      writeFileSync(join(root, "src/server.pem"), "not a key\n");
      const scanner = createSecretScanner({ cwd: root });
      const outcome = await scanner([{ path: "src/config.ts" }, { path: "src/server.pem" }]);
      expect(outcome.ok).toBe(true);
      if (outcome.ok) {
        const serialized = JSON.stringify(outcome.findings);
        expect(serialized).toContain("secret-content");
        expect(serialized).toContain("secret-filename");
        expect(serialized).not.toContain("ghp_abcdefghijklmnopqrstuvwxyz");
        expect(serialized).not.toContain("not a key");
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
