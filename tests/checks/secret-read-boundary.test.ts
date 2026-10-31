/**
 * TC-SECRET-001 / TC-SECRET-003 / TC-SECRET-004 — the secret-read boundary
 * invariant fires on planted reads, fails closed on allowlist mutations, and is
 * non-vacuous over the live tree.
 */
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  SECRET_READ_ALLOWLIST,
  SECRET_READ_RULE,
  scan,
  scopedFiles,
  validate,
  validateAllowlist,
  validateFixtureCoverage,
} from "../../scripts/checks/secret-read-boundary";
import {
  withoutCredentialEntry,
  withPrefixEntry,
  withReasonlessEntry,
  withSecondCredentialEntry,
  withWildcardEntry,
} from "../fixtures/secret-boundary/allowlist";
import { SECRET_READ_CASES, type SecretReadCase } from "../fixtures/secret-boundary/cases";

const ROOT = process.cwd();

const materialize = (testCase: SecretReadCase): string => {
  const root = mkdtempSync(join(tmpdir(), "secret-read-"));
  for (const [relative, source] of Object.entries(testCase.files)) {
    const path = join(root, relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source);
  }
  return root;
};

const gitStatus = (): string =>
  spawnSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).stdout ?? "";

describe("TC-SECRET-001 planted violations fire", () => {
  test("the live tree is clean and the scope is non-vacuous", () => {
    expect(scopedFiles(ROOT).length).toBeGreaterThan(0);
    expect(scan(ROOT)).toEqual([]);
    expect(validate(ROOT)).toEqual([]);
  });

  test("the allowlist is exactly four entries with one credential-material entry", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(4);
    expect(
      SECRET_READ_ALLOWLIST.filter((entry) => entry.class === "credential-material"),
    ).toHaveLength(1);
    expect(scopedFiles(ROOT).length).toBeGreaterThan(0);
  });

  test("planted reads fire in every provider subpath", () => {
    for (const subpath of ["github", "gitlab", "jira"]) {
      const testCase = SECRET_READ_CASES.find(
        (entry) =>
          entry.expect === "violation" &&
          entry.assertFile.startsWith(`packages/adapters/src/${subpath}/`),
      );
      if (testCase === undefined) throw new Error(`no planted case for ${subpath}`);
      const root = materialize(testCase);
      try {
        const violations = scan(root);
        expect(violations.length, subpath).toBeGreaterThan(0);
        expect(
          violations.some((violation) => violation.file === testCase.assertFile),
          subpath,
        ).toBe(true);
        expect(
          violations.some((violation) => violation.line === 1),
          subpath,
        ).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("every environment-read form is reported by the rule, naming file and line", () => {
    for (const testCase of SECRET_READ_CASES.filter((entry) => entry.expect === "violation")) {
      const root = materialize(testCase);
      try {
        const violations = scan(root);
        expect(violations.length, testCase.id).toBeGreaterThan(0);
        expect(violations.every((violation) => violation.rule === testCase.rule)).toBe(true);
        expect(
          violations.some((violation) => violation.file === testCase.assertFile),
          testCase.id,
        ).toBe(true);
        expect(
          violations.some((violation) => violation.line === 1),
          testCase.id,
        ).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("computed and template keys over ambient globals fail closed by name", () => {
    const ids = ["computed-key-env", "template-literal-key-env", "computed-global-name"];
    for (const id of ids) {
      const testCase = SECRET_READ_CASES.find((entry) => entry.id === id);
      if (testCase === undefined) throw new Error(`fixture ${id} is missing`);
      const root = materialize(testCase);
      try {
        const violations = scan(root);
        expect(
          violations.some((violation) =>
            violation.detail.includes("ambient element access with non-literal key"),
          ),
          id,
        ).toBe(true);
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  });

  test("the clean control of sanctioned readers passes", () => {
    const testCase = SECRET_READ_CASES.find((entry) => entry.expect === "clean");
    if (testCase === undefined) throw new Error("clean control fixture is missing");
    const root = materialize(testCase);
    try {
      expect(scan(root)).toEqual([]);
      expect(validateAllowlist(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the live-tree scan is read-only", () => {
    const before = gitStatus();
    scan(ROOT);
    expect(gitStatus()).toBe(before);
  });
});

describe("TC-SECRET-003 allowlist mutations fail closed", () => {
  test("the live registry is reason-bearing, class-tagged, and has one credential entry", () => {
    expect(validateAllowlist(ROOT)).toEqual([]);
    expect(
      SECRET_READ_ALLOWLIST.filter((entry) => entry.class === "credential-material"),
    ).toHaveLength(1);
    for (const entry of SECRET_READ_ALLOWLIST) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
      expect(["file", "directory"]).toContain(entry.kind);
    }
  });

  test("mutation A: removing the credential entry makes its sanctioned read fail", () => {
    const violations = scan(ROOT, withoutCredentialEntry());
    expect(
      violations.some((violation) =>
        violation.file.startsWith("packages/adapters/src/credentials/"),
      ),
    ).toBe(true);
  });

  test("mutation B: an undeclared provider credential read fails naming the path", () => {
    const testCase = SECRET_READ_CASES[0];
    if (testCase === undefined) throw new Error("planted fixture is missing");
    const root = materialize({
      ...testCase,
      files: {
        "packages/adapters/src/github/provider.ts": "export const secret = process.env.SECRET;\n",
      },
    });
    try {
      const violations = scan(root);
      expect(
        violations.some(
          (violation) => violation.file === "packages/adapters/src/github/provider.ts",
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("mutation C: a reasonless entry fails the registry check", () => {
    expect(
      validateAllowlist(ROOT, withReasonlessEntry()).some((message) => message.includes("reason")),
    ).toBe(true);
  });

  test("mutation D: a second credential-material entry fails the sole-entry check", () => {
    expect(
      validateAllowlist(ROOT, withSecondCredentialEntry()).some((message) =>
        message.includes("exactly one credential-material"),
      ),
    ).toBe(true);
  });

  test("mutation E: wildcard and prefix entries fail exact-path validation", () => {
    expect(
      validateAllowlist(ROOT, withWildcardEntry()).some((message) => message.includes("wildcard")),
    ).toBe(true);
    expect(
      validateAllowlist(ROOT, withPrefixEntry()).some((message) =>
        message.includes("does not exist"),
      ),
    ).toBe(true);
  });
});

describe("TC-SECRET-004 non-vacuity and fixture coverage", () => {
  test("the clean control is a real sanctioned read, not an empty tree", () => {
    const testCase = SECRET_READ_CASES.find((entry) => entry.id === "clean-sanctioned-readers");
    if (testCase === undefined) throw new Error("clean fixture is missing");
    const root = materialize(testCase);
    try {
      expect(scan(root, withoutCredentialEntry()).length).toBeGreaterThan(0);
      expect(scan(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("emptying the allowlist fails the sanctioned reads", () => {
    expect(scan(ROOT, []).length).toBeGreaterThan(0);
  });

  test("the fixture-coverage meta-check requires a firing fixture and a clean control", () => {
    expect(validateFixtureCoverage(SECRET_READ_CASES)).toEqual([]);
    expect(
      validateFixtureCoverage(SECRET_READ_CASES.filter((entry) => entry.expect === "clean")).some(
        (message) => message.includes("negative fixture"),
      ),
    ).toBe(true);
    expect(validateFixtureCoverage([]).length).toBeGreaterThan(0);
  });

  test("the rule is referenced by the fixture-coverage registry", () => {
    expect(SECRET_READ_RULE).toBe("secret-read-boundary");
    const registry = readFileSync(join(ROOT, "tests/boundaries/fixture-coverage.test.ts"), "utf8");
    expect(registry).toContain("validateFixtureCoverage");
  });
});
