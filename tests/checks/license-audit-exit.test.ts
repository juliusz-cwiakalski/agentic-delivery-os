/**
 * TC-LICREG-022, 025, 026, 027 — the license audit at the process boundary:
 * exit codes, stream separation, deterministic behaviour, diagnosability, and
 * the performance bound. Exactly ten spawn cases are registered (one live green
 * plus nine failure classes); the four remaining failure classes are proven
 * in process by the audit suite.
 */
import { beforeAll, describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringify as stringifyYaml } from "yaml";
import {
  auditRegistry,
  type Dependency,
  directExternalDependencies,
  loadRegistry,
  lockedUses,
  type Registry,
  type RegistryEntry,
  validate,
} from "../../scripts/checks/license-audit";
import { createLicenseTree, removeLicenseTree, spawnLicenseAudit } from "./license-fixture";

const ROOT = process.cwd();

const clone = (): Registry => JSON.parse(JSON.stringify(loadRegistry(ROOT))) as Registry;
let cachedDependencies: Dependency[] | null = null;
const dependencies = (): Dependency[] => {
  if (cachedDependencies === null) {
    cachedDependencies = lockedUses(ROOT, directExternalDependencies(ROOT));
  }
  return cachedDependencies;
};

const probe = (registry: Registry): RegistryEntry => {
  const entry = registry.entries.find((candidate) => candidate.package === "typescript");
  if (!entry) throw new Error("typescript entry missing from the live registry");
  return entry;
};

const setProbeLicense = (registry: Registry, license: string): void => {
  probe(registry).license = license;
};

const failuresFor = (registry: Registry, license: string): string[] => {
  setProbeLicense(registry, license);
  return auditRegistry(registry, dependencies());
};

const removeDenyIdentifier = (registry: Registry, identifier: string): void => {
  Reflect.set(
    registry,
    "deny_list",
    (registry.deny_list ?? []).filter((entry) => entry !== identifier),
  );
};

const appendAllowIdentifier = (registry: Registry, identifier: string): void => {
  Reflect.set(registry, "allow_list", [...(registry.allow_list ?? []), identifier]);
};

const removeEntry = (registry: Registry, packageName: string): void => {
  registry.entries = registry.entries.filter((entry) => entry.package !== packageName);
};

type SpawnCase = {
  id: string;
  success: boolean;
  mutate: (registry: Registry) => void;
  tokens: string[];
};

const CASES: SpawnCase[] = [
  { id: "live-green", success: true, mutate: () => undefined, tokens: [] },
  {
    id: "denied-single",
    success: false,
    mutate: (registry) => setProbeLicense(registry, "SSPL-1.0"),
    tokens: ["typescript", "SSPL-1.0", "denied"],
  },
  {
    id: "denied-branch",
    success: false,
    mutate: (registry) => setProbeLicense(registry, "MIT OR BUSL-1.1"),
    tokens: ["BUSL-1.1", "denied"],
  },
  {
    id: "denied-nested",
    success: false,
    mutate: (registry) => setProbeLicense(registry, "(MIT OR Apache-2.0) AND (ISC OR Elastic-2.0)"),
    tokens: ["Elastic-2.0", "denied"],
  },
  {
    id: "deny-list-absent",
    success: false,
    mutate: (registry) => Reflect.deleteProperty(registry, "deny_list"),
    tokens: ["deny_list", "absent"],
  },
  {
    id: "old-schema",
    success: false,
    mutate: (registry) => {
      Reflect.set(registry, "schema_version", 2);
      Reflect.deleteProperty(registry, "deny_list");
    },
    tokens: ["schema", "2"],
  },
  {
    id: "floor-removal",
    success: false,
    mutate: (registry) => removeDenyIdentifier(registry, "SSPL-1.0"),
    tokens: ["deny_list", "SSPL-1.0", "mandatory"],
  },
  {
    id: "allow-deny-overlap",
    success: false,
    mutate: (registry) => appendAllowIdentifier(registry, "SSPL-1.0"),
    tokens: ["deny_list", "allow_list", "SSPL-1.0"],
  },
  {
    id: "non-asserted",
    success: false,
    mutate: (registry) => setProbeLicense(registry, "NOASSERTION"),
    tokens: ["NOASSERTION", "non-asserted"],
  },
  {
    id: "unregistered-dependency",
    success: false,
    mutate: (registry) => removeEntry(registry, "fast-uri"),
    tokens: ["missing registry entry", "fast-uri"],
  },
];

type SpawnRun = {
  id: string;
  status: number | null;
  stdout: string;
  stderr: string;
  elapsedMs: number;
};

const registryTextFor = (testCase: SpawnCase): string => {
  const registry = clone();
  testCase.mutate(registry);
  return stringifyYaml(registry);
};

const worktreeStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

const runs: SpawnRun[] = [];
let statusBefore = "";
let statusAfter = "";

beforeAll(() => {
  statusBefore = worktreeStatus();
  for (const testCase of CASES) {
    const tree = createLicenseTree(registryTextFor(testCase));
    const startedAt = performance.now();
    try {
      const result = spawnLicenseAudit(tree);
      runs.push({
        id: testCase.id,
        status: result.status,
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        elapsedMs: performance.now() - startedAt,
      });
    } finally {
      removeLicenseTree(tree);
    }
  }
  statusAfter = worktreeStatus();
});

describe("license audit process contract", () => {
  test("TC-LICREG-022 spawned audit exits non-zero with clean diagnostics per class", () => {
    expect(CASES.length).toBe(10);
    expect(runs.length).toBe(CASES.length);

    CASES.forEach((testCase, index) => {
      const run = runs[index];
      if (!run) throw new Error(`missing spawn result for ${testCase.id}`);
      if (testCase.success) {
        expect(run.status, testCase.id).toBe(0);
        expect(run.stdout.startsWith("OK license-audit:"), testCase.id).toBe(true);
        expect(run.stderr, testCase.id).toBe("");
        return;
      }
      expect(run.status, testCase.id).toBe(1);
      expect(run.stderr, testCase.id).toContain("FAIL license-audit: ");
      for (const token of testCase.tokens) {
        expect(run.stderr, `${testCase.id}: ${token}`).toContain(token);
      }
      expect(run.stdout, testCase.id).not.toContain("OK");
      expect(run.stderr, testCase.id).not.toMatch(/^\s+at /m);
      expect(run.stderr, testCase.id).not.toMatch(/\bError:\s/);
      const lines = run.stderr.split("\n").filter((line) => line.length > 0);
      for (const line of lines) {
        expect(line.startsWith("FAIL license-audit: "), `${testCase.id}: ${line}`).toBe(true);
      }
    });

    expect(statusAfter).toBe(statusBefore);
  });

  test("TC-LICREG-025 audit behaviour is deterministic, order-independent, offline", () => {
    expect(validate(ROOT)).toEqual(validate(ROOT));

    const mutated = clone();
    setProbeLicense(mutated, "MIT OR BUSL-1.0");
    const first = auditRegistry(mutated, dependencies());
    const second = auditRegistry(mutated, dependencies());
    expect(second).toEqual(first);

    const reversed = clone();
    setProbeLicense(reversed, "MIT OR BUSL-1.0");
    reversed.entries = [...reversed.entries].reverse();
    expect([...auditRegistry(reversed, dependencies())].sort()).toEqual([...first].sort());

    const reorderedDeny = clone();
    reorderedDeny.deny_list = [...(reorderedDeny.deny_list ?? [])].reverse();
    expect(validate(ROOT, reorderedDeny)).toEqual([]);

    const source = readFileSync(join(ROOT, "scripts/checks/license-audit.ts"), "utf8");
    for (const token of [
      "Math.random",
      "Date.now",
      "new Date",
      "performance.now",
      "fetch(",
      "node:http",
      "node:https",
      "node:net",
      "node:dns",
      "child_process",
      "process.env",
    ]) {
      expect(source, token).not.toContain(token);
    }
  });

  test("TC-LICREG-026 every failure is diagnosable and classes stay distinguishable", () => {
    type Representative = {
      id: string;
      subject: string;
      offending: string;
      token: string;
      forbidden?: string;
      compute: () => string[];
    };

    const representatives: Representative[] = [
      {
        id: "denied-single",
        subject: "typescript",
        offending: "SSPL-1.0",
        token: "is denied by deny_list",
        forbidden: "not allow-listed",
        compute: () => failuresFor(clone(), "SSPL-1.0"),
      },
      {
        id: "denied-branch",
        subject: "typescript",
        offending: "BUSL-1.1",
        token: "is denied by deny_list",
        forbidden: "not allow-listed",
        compute: () => failuresFor(clone(), "MIT OR BUSL-1.1"),
      },
      {
        id: "unknown-reference",
        subject: "typescript",
        offending: "LicenseRef-Proprietary",
        token: "unknown license reference",
        forbidden: "not allow-listed",
        compute: () => failuresFor(clone(), "LicenseRef-Proprietary"),
      },
      {
        id: "non-asserted",
        subject: "typescript",
        offending: "NOASSERTION",
        token: "non-asserted",
        forbidden: "not allow-listed",
        compute: () => failuresFor(clone(), "NOASSERTION"),
      },
      {
        id: "empty",
        subject: "typescript",
        offending: "empty license field",
        token: "empty license",
        compute: () => failuresFor(clone(), ""),
      },
      {
        id: "unparseable",
        subject: "typescript",
        offending: "MIT OR",
        token: "not a valid SPDX expression",
        compute: () => failuresFor(clone(), "MIT OR"),
      },
      {
        id: "non-allow-listed",
        subject: "typescript",
        offending: "GPL-3.0-only",
        token: "not allow-listed",
        forbidden: "is denied by deny_list",
        compute: () => failuresFor(clone(), "GPL-3.0-only"),
      },
      {
        id: "unregistered-use",
        subject: "yaml",
        offending: "@changesets/parse@1.0.0",
        token: "missing registered use",
        compute: () => {
          const registry = clone();
          const entry = registry.entries.find((candidate) => candidate.package === "yaml");
          if (!entry) throw new Error("yaml entry missing");
          entry.uses = entry.uses.filter((use) => use.owner !== "@changesets/parse@1.0.0");
          return auditRegistry(registry, dependencies());
        },
      },
      {
        id: "malformed-policy",
        subject: "deny_list",
        offending: "absent",
        token: "absent",
        compute: () => {
          const registry = clone();
          Reflect.deleteProperty(registry, "deny_list");
          return validate(ROOT, registry);
        },
      },
      {
        id: "overlap",
        subject: "deny_list",
        offending: "MIT",
        token: "both contain",
        compute: () => {
          const registry = clone();
          Reflect.set(registry, "deny_list", [...(registry.deny_list ?? []), "MIT"]);
          return validate(ROOT, registry);
        },
      },
      {
        id: "schema",
        subject: "schema",
        offending: "2",
        token: "unsupported",
        compute: () => {
          const registry = clone();
          Reflect.set(registry, "schema_version", 2);
          return validate(ROOT, registry);
        },
      },
      {
        id: "floor",
        subject: "deny_list",
        offending: "SSPL-1.0",
        token: "missing mandatory",
        compute: () => {
          const registry = clone();
          removeDenyIdentifier(registry, "SSPL-1.0");
          return validate(ROOT, registry);
        },
      },
      {
        id: "drift",
        subject: "allow_list",
        offending: "GPL-3.0-only",
        token: "not backed by an approved verdict",
        compute: () => {
          const registry = clone();
          appendAllowIdentifier(registry, "GPL-3.0-only");
          return validate(ROOT, registry);
        },
      },
    ];

    expect(representatives.length).toBe(13);
    for (const representative of representatives) {
      let failures: string[] = [];
      try {
        failures = representative.compute();
      } catch (error) {
        throw new Error(`${representative.id} threw instead of returning: ${String(error)}`);
      }
      expect(failures.length, representative.id).toBeGreaterThan(0);
      expect(
        failures.some(
          (message) =>
            message.includes(representative.subject) &&
            message.includes(representative.offending) &&
            message.includes(representative.token),
        ),
        representative.id,
      ).toBe(true);
      if (representative.forbidden) {
        expect(
          failures.some((message) => message.includes(representative.forbidden ?? "")),
          representative.id,
        ).toBe(false);
      }
      for (const message of failures) {
        expect(message.length, representative.id).toBeGreaterThan(0);
        expect(message, representative.id).not.toContain("process.env");
        expect(message, representative.id).not.toContain("token");
        expect(message, representative.id).not.toContain("secret");
        expect(message, representative.id).not.toMatch(/\/home\/|\/Users\//);
      }
    }

    const failureRun = runs.find((run) => run.id === "denied-single");
    if (!failureRun) throw new Error("denied-single spawn result is missing");
    for (const line of failureRun.stderr.split("\n").filter((entry) => entry.length > 0)) {
      expect(line.startsWith("FAIL license-audit: ")).toBe(true);
    }
    expect(failureRun.stdout).not.toContain("OK");
  });

  test("TC-LICREG-027 live audit completes within the 30-second bound", () => {
    const green = runs.find((run) => run.id === "live-green");
    if (!green) throw new Error("live-green spawn result is missing");
    expect(green.status).toBe(0);
    expect(green.elapsedMs).toBeLessThan(30_000);
    console.log(`license-audit live spawn: ${green.elapsedMs.toFixed(0)} ms`);
  });
});
