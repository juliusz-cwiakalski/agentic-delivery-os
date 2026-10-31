/**
 * TC-PRIVACY-014 — the working-tree boundary: history, untracked, ignored,
 * binary, tracked, and enumerated exclusions, with a stable file list.
 */
import { describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { listScanFiles } from "../../scripts/checks/privacy-literals";
import type { RegistryLike } from "../fixtures/privacy-literals/registry";
import { RULE_POSITIVES } from "../fixtures/privacy-literals/rules";
import { createPrivacyRepo, readLiveRegistry, scan } from "./privacy-support";

const value = RULE_POSITIVES[4]?.value as string;

describe("TC-PRIVACY-014 working-tree scan boundary", () => {
  test("history-only values pass while the commit proves the fixture is live", () => {
    const repo = createPrivacyRepo({ "history.txt": `${value}\n` });
    try {
      repo.git(["add", "-A"]);
      repo.git(["commit", "-qm", "history-only"]);
      repo.write("history.txt", "clean content\n");
      repo.git(["add", "-A"]);
      repo.git(["commit", "-qm", "clean-tree"]);
      expect(repo.git(["show", "HEAD~1:history.txt"])).toContain(value);
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("an untracked-but-not-ignored value is scanned", () => {
    const repo = createPrivacyRepo({ "scanned/untracked.txt": `${value}\n` });
    try {
      const outcome = scan(repo.root);
      expect(outcome.violations.map((violation) => violation.file)).toContain(
        "scanned/untracked.txt",
      );
    } finally {
      repo.cleanup();
    }
  });

  test("an ignored value is neither scanned nor counted as scanned", () => {
    const repo = createPrivacyRepo({ "ignored/secret.txt": `${value}\n` });
    try {
      const files = listScanFiles(repo.root);
      expect(files).not.toContain("ignored/secret.txt");
      const outcome = scan(repo.root);
      expect(outcome.violations).toEqual([]);
    } finally {
      repo.cleanup();
    }
  });

  test("a tracked value is scanned", () => {
    const repo = createPrivacyRepo({});
    try {
      repo.write("tracked.txt", `${value}\n`);
      repo.git(["add", "-A"]);
      repo.git(["commit", "-qm", "tracked"]);
      const outcome = scan(repo.root);
      expect(outcome.violations.map((violation) => violation.file)).toContain("tracked.txt");
    } finally {
      repo.cleanup();
    }
  });

  test("a binary value is skipped with a counted report", () => {
    const repo = createPrivacyRepo({});
    try {
      writeFileSync(
        join(repo.root, "binary.bin"),
        Buffer.concat([Buffer.from([0, 1, 2, 3]), Buffer.from(value, "utf8")]),
      );
      const outcome = scan(repo.root);
      expect(outcome.violations).toEqual([]);
      expect(outcome.summary?.binarySkipped).toBeGreaterThan(0);
    } finally {
      repo.cleanup();
    }
  });

  test("an enumerated exclusion is honored and a reasonless exclusion is rejected", () => {
    const live = readLiveRegistry();
    const excluded = structuredClone(live);
    excluded.exclusions.push({
      id: "excluded-fixture",
      kind: "file",
      path: "excluded/secret.txt",
      rules: ["*"],
      reason: "Synthetic exclusion fixture.",
    });
    const repo = createPrivacyRepo({ "excluded/secret.txt": `${value}\n` }, { registry: excluded });
    try {
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
      expect(outcome.summary?.excludedFiles).toBeGreaterThanOrEqual(2);
    } finally {
      repo.cleanup();
    }

    const reasonless: RegistryLike = structuredClone(live);
    reasonless.exclusions.push({
      id: "reasonless-exclusion",
      kind: "file",
      path: "pnpm-lock.yaml",
      rules: ["*"],
      reason: "",
    });
    const failing = createPrivacyRepo({}, { registry: reasonless });
    try {
      const outcome = scan(failing.root);
      expect(outcome.failures).toHaveLength(1);
      expect(outcome.failures[0]).toContain("reason");
    } finally {
      failing.cleanup();
    }
  });

  test("violation ordering is deterministic code-unit order for mixed-case and non-ASCII paths", () => {
    const repo = createPrivacyRepo({
      "scanned/zeta.txt": `${value}\n`,
      "scanned/Alpha.txt": `${value}\n`,
      "scanned/Ärger.txt": `${value}\n`,
      "scanned/beta.txt": `${value}\n`,
    });
    try {
      const first = scan(repo.root);
      const second = scan(repo.root);
      expect(JSON.stringify(first)).toBe(JSON.stringify(second));
      const files = first.violations.map((violation) => violation.file);
      expect(files).toEqual([...files].sort());
    } finally {
      repo.cleanup();
    }
  });

  test("the file list is independent of materialization order", () => {
    const first = createPrivacyRepo({
      "a/first.txt": "one\n",
      "b/second.txt": "two\n",
      "c/third.txt": "three\n",
    });
    const second = createPrivacyRepo({
      "c/third.txt": "three\n",
      "b/second.txt": "two\n",
      "a/first.txt": "one\n",
    });
    try {
      expect(listScanFiles(first.root)).toEqual(listScanFiles(second.root));
    } finally {
      first.cleanup();
      second.cleanup();
    }
  });
});
