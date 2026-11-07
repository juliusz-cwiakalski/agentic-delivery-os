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

  test("the allowlist is exactly five entries with one credential-material entry", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(5);
    expect(
      SECRET_READ_ALLOWLIST.filter((entry) => entry.class === "credential-material"),
    ).toHaveLength(1);
    expect(scopedFiles(ROOT).length).toBeGreaterThan(0);
  });

  test("the testkit conformance source is not allowlisted", () => {
    expect(SECRET_READ_ALLOWLIST.some((entry) => entry.path.includes("testkit"))).toBe(false);
    expect(SECRET_READ_ALLOWLIST).toHaveLength(5);
    expect(
      SECRET_READ_ALLOWLIST.filter((entry) => entry.class === "credential-material"),
    ).toHaveLength(1);
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

describe("TC-MCP-018 mcp serve allowlist scope", () => {
  test("the mcp serve entry is the only allowlisted mcp path", () => {
    const mcp = SECRET_READ_ALLOWLIST.filter((entry) => entry.path.startsWith("packages/mcp/"));
    expect(mcp).toHaveLength(1);
    expect(mcp[0]?.path).toBe("packages/mcp/src/serve.ts");
    expect(mcp[0]?.kind).toBe("file");
    expect(mcp[0]?.class).toBe("configuration-environment-source");
  });

  test("an ambient env read in a non-serve mcp file fails by name (control)", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-secret-"));
    try {
      mkdirSync(join(root, "packages/mcp/src/commands"), { recursive: true });
      writeFileSync(
        join(root, "packages/mcp/src/commands/status.ts"),
        "export const leak = (): string | undefined => process.env.FIXTURE_SECRET;\n",
      );
      const violations = scan(root);
      expect(
        violations.some((violation) => violation.file === "packages/mcp/src/commands/status.ts"),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the allowlisted serve startup read stays clean", () => {
    const root = mkdtempSync(join(tmpdir(), "mcp-serve-secret-"));
    try {
      mkdirSync(join(root, "packages/mcp/src"), { recursive: true });
      writeFileSync(
        join(root, "packages/mcp/src/serve.ts"),
        "export const environment = { ...process.env };\n",
      );
      expect(scan(root)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-DOCTOR-023 doctor adds no secret-read surface", () => {
  test("the allowlist stays exactly five entries with one credential-material entry", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(5);
    expect(
      SECRET_READ_ALLOWLIST.filter((entry) => entry.class === "credential-material"),
    ).toHaveLength(1);
    for (const entry of SECRET_READ_ALLOWLIST) {
      expect(entry.path).not.toContain("doctor");
    }
  });

  test("the doctor modules are clean under the live scanner", () => {
    const violations = scan(ROOT).filter((violation) => violation.file.includes("doctor"));
    expect(violations).toEqual([]);
  });

  test("a planted ambient read in a doctor file fails by name (control)", () => {
    const root = mkdtempSync(join(tmpdir(), "doctor-secret-"));
    try {
      mkdirSync(join(root, "packages/core/src/contracts"), { recursive: true });
      writeFileSync(
        join(root, "packages/core/src/contracts/doctor.ts"),
        "export const leak = (): string | undefined => process.env.FIXTURE_SECRET;\n",
      );
      expect(scan(root).some((violation) => violation.file.includes("doctor.ts"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-PROFILE-021 provider-profile work adds zero secret-read allowlist entries", () => {
  test("the allowlist stays exactly five entries and names no profile/watch path", () => {
    expect(SECRET_READ_ALLOWLIST).toHaveLength(5);
    for (const entry of SECRET_READ_ALLOWLIST) {
      expect(entry.path).not.toContain("provider-profile");
      expect(entry.path).not.toContain("profile-env-record");
      expect(entry.path).not.toContain("provider-quota");
    }
  });

  test("the live tree remains clean over the profile/watch modules", () => {
    expect(scan(ROOT)).toEqual([]);
    expect(validate(ROOT)).toEqual([]);
  });
});

describe("TC-VOCAB-006 (GH-237) the queue engine adds no secret-read allowlist entry", () => {
  test("no scheduling module is allowlisted and the live scan remains clean", () => {
    expect(SECRET_READ_ALLOWLIST.some((entry) => entry.path.includes("queue"))).toBe(false);
    expect(SECRET_READ_ALLOWLIST.some((entry) => entry.path.includes("lanes"))).toBe(false);
    expect(scan(ROOT)).toEqual([]);
    expect(validate(ROOT)).toEqual([]);
  });
});
