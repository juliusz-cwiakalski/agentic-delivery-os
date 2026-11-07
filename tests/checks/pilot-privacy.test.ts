/**
 * TC-PSCAN-010 — pilot fixtures, seeded artifacts, and pilot suite files carry
 * no secret-shaped material, and the commit safety scan is unchanged.
 */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSecretScanner } from "../../packages/adapters/src/file/index";
import { createPilot, type Pilot } from "../fixtures/pilot/harness";

const ROOT = process.cwd();
const PILOT_ROOTS = ["tests/fixtures/pilot", "tests/conformance/pilot"] as const;

const PATTERNS: readonly { readonly id: string; readonly pattern: RegExp }[] = [
  { id: "github-token", pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { id: "openai-key", pattern: /sk-[A-Za-z0-9]{20,}/ },
  { id: "aws-key", pattern: /AKIA[0-9A-Z]{16}/ },
  { id: "slack-token", pattern: /xox[bap]-[A-Za-z0-9-]{10,}/ },
  { id: "private-key", pattern: /-----BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/ },
  { id: "bearer-token", pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/ },
];

/** Build canaries at runtime so this suite itself never contains one. */
const canary = (kind: "github" | "openai" | "aws" | "slack" | "private" | "bearer"): string => {
  const body = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6".slice(0, 36);
  switch (kind) {
    case "github":
      return ["ghp", "_", body].join("");
    case "openai":
      return ["sk", "-", body].join("");
    case "aws":
      return ["AK", "IA", "ABCDEFGHIJKLMNOP"].join("");
    case "slack":
      return ["xox", "b-", "1234567890abcdef"].join("");
    case "private":
      return ["-----BEGIN ", "RSA", " PRIVATE KEY-----"].join("");
    case "bearer":
      return ["Bearer ", body].join("");
  }
};

const scan = (text: string): readonly string[] =>
  PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.id);

const walk = (relative: string): readonly string[] => {
  const found: string[] = [];
  const visit = (current: string): void => {
    const entries = (() => {
      try {
        return readdirSync(join(ROOT, current), { withFileTypes: true });
      } catch {
        return [];
      }
    })();
    for (const entry of entries) {
      const next = `${current}/${entry.name}`;
      if (entry.isDirectory()) visit(next);
      else if (entry.name.endsWith(".ts")) found.push(next);
    }
  };
  visit(relative);
  return found.sort();
};

const pilotFiles = (): readonly string[] => PILOT_ROOTS.flatMap((root) => walk(root));

const tempDirectory = (label: string): string => {
  const base = join(ROOT, "tmp", "tmpdir");
  mkdirSync(base, { recursive: true });
  return mkdtempSync(join(base, `pilot-privacy-${label}-`));
};

let pilot: Pilot | undefined;

beforeAll(async () => {
  pilot = await createPilot();
  await pilot.runSequence();
});

afterAll(() => {
  pilot?.cleanup();
});

describe("TC-PSCAN-010 pilot privacy", () => {
  test("zero secret-shaped findings across the pilot fixtures and suite", () => {
    const failures: string[] = [];
    for (const file of pilotFiles()) {
      for (const id of scan(readFileSync(join(ROOT, file), "utf8"))) {
        failures.push(`${file}: ${id}`);
      }
    }
    expect(failures).toEqual([]);
  });

  test("seeded change-folder files and the real ledger carry no secret-shaped value", () => {
    const current = pilot;
    if (current === undefined) throw new Error("pilot fixture was not created");
    const failures: string[] = [];
    for (const path of current.repo.changeFolderFiles()) {
      for (const id of scan(current.repo.read(path))) failures.push(`${path}: ${id}`);
    }
    for (const id of scan(current.snapshot().ledger)) failures.push(`ledger: ${id}`);
    expect(failures).toEqual([]);
  });

  test("every pilot fixture class is inside the scan scope and a canary is detected", () => {
    const classes = [
      { label: "harness", path: "tests/fixtures/pilot/harness.ts", canary: "github" },
      { label: "repo", path: "tests/fixtures/pilot/repo.ts", canary: "openai" },
      { label: "stubs", path: "tests/fixtures/pilot/stubs.ts", canary: "aws" },
      { label: "matrix", path: "tests/fixtures/pilot/matrix.ts", canary: "slack" },
      {
        label: "suite",
        path: "tests/conformance/pilot/pilot-fixture.test.ts",
        canary: "bearer",
      },
      {
        label: "private-key class",
        path: "tests/fixtures/pilot/matrix.ts",
        canary: "private",
      },
    ] as const;
    const expected: Record<string, string> = {
      github: "github-token",
      openai: "openai-key",
      aws: "aws-key",
      slack: "slack-token",
      bearer: "bearer-token",
      private: "private-key",
    };
    const scanned = new Set(pilotFiles());
    for (const entry of classes) {
      expect(scanned.has(entry.path), `${entry.label} is outside the scan scope`).toBe(true);
      const directory = tempDirectory(entry.label.replaceAll(" ", "-"));
      try {
        const copy = join(directory, "copy.ts");
        writeFileSync(
          copy,
          `${readFileSync(join(ROOT, entry.path), "utf8")}\n// ${canary(entry.canary)}\n`,
        );
        expect(scan(readFileSync(copy, "utf8"))).toContain(expected[entry.canary]);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });

  test("the commit safety scan allows pilot files and still STOPs on a canary", async () => {
    const scanner = createSecretScanner({ cwd: ROOT });
    const allowed = await scanner(pilotFiles().map((path) => ({ path })));
    expect(allowed.ok).toBe(true);
    if (allowed.ok) expect(allowed.findings).toEqual([]);

    const directory = tempDirectory("safety");
    try {
      writeFileSync(join(directory, "canary.txt"), `token: ${canary("github")}\n`);
      const stopping = await createSecretScanner({ cwd: directory })([{ path: "canary.txt" }]);
      expect(stopping.ok).toBe(true);
      if (stopping.ok) {
        expect(stopping.findings).toContainEqual({ class: "secret-content", path: "canary.txt" });
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
