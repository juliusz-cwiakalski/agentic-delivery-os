/**
 * TC-BRANDING-008/009/010/011/027 — scan delivered state, per-class failing
 * mutations, matching corpora, allowlist exactness, and docs-scope lifetime.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  matchSeedLiteral,
  scan,
  validateRegistryShape,
} from "../../scripts/checks/forbidden-literals";
import {
  createTempRepo,
  git,
  liveRegistry,
  REGISTRY_PATH,
  ROOT,
  writeFiles,
  writeRegistry,
} from "./fixture-repo";

const DRILL = "doc/guides/rename-drill.md";

const corpus = (name: string): string[] =>
  JSON.parse(
    readFileSync(join(ROOT, `tests/fixtures/forbidden-literals/${name}.json`), "utf8"),
  ) as string[];

const seededRegistry = (baseline: string, registered: string[] = []) => ({
  ...liveRegistry(),
  corpusBaseline: baseline,
  registered,
});

const violationsFor = (outcome: ReturnType<typeof scan>, file: string): string[] =>
  outcome.violations.filter((violation) => violation.file === file).map((entry) => entry.token);

describe("delivered state", () => {
  test("5/5 scope classes are scanned with 0 violations", () => {
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
    expect(outcome.classes.map((entry) => entry.id)).toEqual([
      "packageTree",
      "rootManifests",
      "rootWorkspaceFiles",
      "ignoreRules",
      "userFacingDocs",
    ]);
  });

  test("the registry is baseline-anchored and exactly shaped", () => {
    const registry = liveRegistry();
    expect(validateRegistryShape(registry)).toEqual([]);
    expect(registry.seedLiterals).toEqual(["ados", "ADOS_", "~/.ados"]);
    expect(registry.corpusBaseline).toBe("32784affbb8a1b82a57b6c4578a331b8bd99b4c4");
    expect(registry.scopeClasses).toHaveLength(5);
    expect(registry.allowlist).toHaveLength(5);
    if (existsSync(join(ROOT, DRILL))) {
      expect(registry.registered).toContain(DRILL);
    }
  });

  test("the scan is read-only over the live tree", () => {
    const before = git(ROOT, ["status", "--porcelain"]);
    scan(ROOT);
    expect(git(ROOT, ["status", "--porcelain"])).toBe(before);
  });
});

describe("per-class failing mutations", () => {
  test("package tree", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, { "packages/core/src/domain/bad.ts": "// ados\n" });
    const outcome = scan(repo.root);
    expect(violationsFor(outcome, "packages/core/src/domain/bad.ts")).toContain("ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("root manifest", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, {
      "package.json": '{\n  "name": "fixture",\n  "description": "ados"\n}\n',
    });
    const outcome = scan(repo.root);
    expect(violationsFor(outcome, "package.json")).toContain("ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("root workspace file", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, { "tsconfig.base.json": '{\n  "types": ["ADOS_"]\n}\n' });
    const outcome = scan(repo.root);
    expect(violationsFor(outcome, "tsconfig.base.json")).toContain("ADOS_");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("ignore rules", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, {
      ".gitignore": "node_modules/\ndist/\n.ai/local/\n.*/config.local.yaml\n~/.ados\n",
    });
    const outcome = scan(repo.root);
    expect(violationsFor(outcome, ".gitignore")).toContain("~/.ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("registered user-facing doc added after the baseline", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline, [DRILL]));
    writeFiles(repo.root, { [DRILL]: "# Drill\n\nados\n" });
    const outcome = scan(repo.root);
    expect(violationsFor(outcome, DRILL)).toContain("ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("an unregistered doc absent at the baseline fails the meta-check", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, { [DRILL]: "# Drill\n\nName-free.\n" });
    const outcome = scan(repo.root);
    expect(
      outcome.failures.some((message) =>
        message.includes(`unregistered user-facing doc absent at corpusBaseline: ${DRILL}`),
      ),
    ).toBe(true);
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("all violations are reported in one run", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, {
      "packages/core/src/domain/bad.ts": "// ados\n",
      "package.json": '{\n  "name": "fixture",\n  "description": "ados"\n}\n',
      ".gitignore": "node_modules/\ndist/\n.ai/local/\n.*/config.local.yaml\nados\n",
    });
    const outcome = scan(repo.root);
    const files = outcome.violations.map((violation) => violation.file);
    expect(files).toContain("packages/core/src/domain/bad.ts");
    expect(files).toContain("package.json");
    expect(files).toContain(".gitignore");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("a shallow clone fails closed on an unreachable baseline", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    repo.commit("successor");
    const parent = mkdtempSync(join(tmpdir(), "forbidden-shallow-"));
    const clone = join(parent, "clone");
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${repo.root}`, clone], {
      encoding: "utf8",
    });
    const outcome = scan(clone);
    expect(outcome.failures.some((message) => message.includes("corpusBaseline"))).toBe(true);
    rmSync(parent, { recursive: true, force: true });
    rmSync(repo.root, { recursive: true, force: true });
  });
});

describe("matching semantics", () => {
  const seeds = liveRegistry().seedLiterals;

  test("true-positive corpus all match", () => {
    for (const entry of corpus("true-positives")) {
      expect(matchSeedLiteral(entry, seeds)).toBeDefined();
    }
  });

  test("false-positive corpus all miss", () => {
    for (const entry of corpus("false-positives")) {
      expect(matchSeedLiteral(entry, seeds)).toBeUndefined();
    }
  });

  test("case-insensitive forms report a seed literal", () => {
    expect(matchSeedLiteral("ADOS_HOME", seeds)).toBe("ADOS_");
    expect(matchSeedLiteral("ados_home", seeds)).toBeDefined();
    expect(seeds).toContain(matchSeedLiteral("ADOS_HOME", seeds) as string);
    expect(seeds).toContain(matchSeedLiteral("ados_home", seeds) as string);
  });

  test("the corpus is not vacuous", () => {
    const directory = mkdtempSync(join(tmpdir(), "forbidden-corpus-"));
    const path = join(directory, "true.json");
    writeFileSync(path, JSON.stringify([...corpus("true-positives"), "shadow"]));
    const mutated = JSON.parse(readFileSync(path, "utf8")) as string[];
    const failures = mutated.filter((entry) => matchSeedLiteral(entry, seeds) === undefined);
    expect(failures).toEqual(["shadow"]);
    rmSync(directory, { recursive: true, force: true });
  });

  test("a lowercase embedded identifier is the reserved non-match (RSK-2)", () => {
    expect(matchSeedLiteral("myados", seeds)).toBeUndefined();
  });
});

describe("allowlist exactness", () => {
  test("five allowlisted locations are clean and do not mask a violation", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, {
      "packages/core/src/branding/probe.ts": "// ados\n",
      "packages/adapters/src/legacy/probe.ts": "// ADOS_\n",
      "doc/decisions/adr-synthetic.md": "ados\n",
      "doc/changes/synthetic/chg.md": "~/.ados\n",
      "packages/core/src/domain/index.ts": "// Copyright 2026 ados\n",
    });
    const clean = scan(repo.root);
    expect(clean.violations).toEqual([]);
    expect(clean.failures).toEqual([]);
    writeFiles(repo.root, { "packages/core/src/domain/bad.ts": "// ados\n" });
    const masked = scan(repo.root);
    expect(violationsFor(masked, "packages/core/src/domain/bad.ts")).toContain("ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("a header line is exempt but a body line still fails", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, {
      "packages/core/src/domain/index.ts": "// Copyright 2026 ados\n",
    });
    expect(scan(repo.root).violations).toEqual([]);
    writeFiles(repo.root, {
      "packages/core/src/domain/index.ts": "// Copyright 2026 ados\n// ados\n",
    });
    expect(violationsFor(scan(repo.root), "packages/core/src/domain/index.ts")).toContain("ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("registry-shape mutations fail closed", () => {
    const sixthAllowlist = liveRegistry();
    sixthAllowlist.allowlist.push({ id: "extra", kind: "path", path: "packages/cli/" });
    expect(
      validateRegistryShape(sixthAllowlist).some((message) => message.includes("DEC-8 set")),
    ).toBe(true);

    const removedAllowlist = liveRegistry();
    removedAllowlist.allowlist = removedAllowlist.allowlist.filter(
      (entry) => entry.id !== "branding-subpath",
    );
    expect(
      validateRegistryShape(removedAllowlist).some((message) => message.includes("DEC-8 set")),
    ).toBe(true);

    const orphanSeed = liveRegistry();
    orphanSeed.seedLiterals.push("extra-token");
    expect(
      validateRegistryShape(orphanSeed).some((message) => message.includes("seedLiterals")),
    ).toBe(true);

    const sixthClass = liveRegistry();
    sixthClass.scopeClasses.push({ id: "extra", root: "extra" });
    expect(
      validateRegistryShape(sixthClass).some((message) => message.includes("scope classes")),
    ).toBe(true);
  });
});

describe("docs-scope lifetime", () => {
  test("registered membership survives merge and successor commits", () => {
    const liveStatusBefore = git(ROOT, ["status", "--porcelain"]);
    const repo = createTempRepo();
    const d = (() => {
      writeFiles(repo.root, { [DRILL]: "# Drill\n\nName-free.\n" });
      writeRegistry(repo.root, seededRegistry(repo.baseline, [DRILL]));
      return repo.commit("add drill");
    })();
    repo.run(["commit", "--allow-empty", "-qm", "merge"]);
    const m = repo.run(["rev-parse", "HEAD"]);
    writeFiles(repo.root, {
      "packages/core/src/domain/index.ts":
        'export type Placeholder = { readonly module: "domain"; readonly note: "successor" };\n',
    });
    const s = repo.commit("successor");

    for (const commit of [m, s]) {
      repo.run(["checkout", "-q", commit]);
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
      expect(outcome.registeredDocs).toContain(DRILL);
      expect(outcome.classes.find((entry) => entry.id === "userFacingDocs")?.files).toBe(1);
    }
    repo.run(["checkout", "-q", s]);

    writeFiles(repo.root, { [DRILL]: "# Drill\n\nados\n" });
    const injected = scan(repo.root);
    expect(violationsFor(injected, DRILL)).toContain("ados");
    repo.run(["checkout", "--", DRILL]);

    // A7: deleting a registered doc leaves an orphaned entry, named by the scan.
    unlinkSync(join(repo.root, DRILL));
    const orphaned = scan(repo.root);
    expect(
      orphaned.failures.some(
        (message) =>
          message.includes("registered doc is missing from the tree") && message.includes(DRILL),
      ),
    ).toBe(true);
    repo.run(["checkout", "--", DRILL]);

    writeRegistry(repo.root, seededRegistry(repo.baseline, []));
    const removed = scan(repo.root);
    expect(
      removed.failures.some(
        (message) => message.includes(`unregistered user-facing doc`) && message.includes(DRILL),
      ),
    ).toBe(true);
    repo.run(["checkout", "--", REGISTRY_PATH]);

    const noBaseline = seededRegistry(repo.baseline, [DRILL]) as Record<string, unknown>;
    delete noBaseline.corpusBaseline;
    writeFiles(repo.root, { [REGISTRY_PATH]: `${JSON.stringify(noBaseline, null, 2)}\n` });
    expect(scan(repo.root).failures.some((message) => message.includes("corpusBaseline"))).toBe(
      true,
    );

    for (const movingRef of ["main", "HEAD"]) {
      writeRegistry(repo.root, {
        ...seededRegistry(repo.baseline, [DRILL]),
        corpusBaseline: movingRef,
      });
      expect(scan(repo.root).failures.some((message) => message.includes("corpusBaseline"))).toBe(
        true,
      );
    }
    repo.run(["checkout", "--", REGISTRY_PATH]);

    writeRegistry(repo.root, seededRegistry(d, [DRILL]));
    expect(
      scan(repo.root).failures.some(
        (message) => message.includes("present at corpusBaseline") && message.includes(DRILL),
      ),
    ).toBe(true);
    repo.run(["checkout", "--", REGISTRY_PATH]);

    const parent = mkdtempSync(join(tmpdir(), "forbidden-lifecycle-clone-"));
    const clone = join(parent, "clone");
    execFileSync("git", ["clone", "-q", "--depth", "1", `file://${repo.root}`, clone], {
      encoding: "utf8",
    });
    const shallow = scan(clone);
    expect(shallow.failures.some((message) => message.includes("corpusBaseline"))).toBe(true);
    rmSync(parent, { recursive: true, force: true });

    expect(git(ROOT, ["status", "--porcelain"])).toBe(liveStatusBefore);
    rmSync(repo.root, { recursive: true, force: true });
  });
});

describe("TC-GH223-013 audit identity seam carries no product token", () => {
  test("the declared suffix and the new audit sources are token-free", async () => {
    const { AUDIT_IDENTITY_VARIABLE_SUFFIX } = await import(
      "../../packages/core/src/contracts/index"
    );
    expect(AUDIT_IDENTITY_VARIABLE_SUFFIX.toLowerCase()).not.toContain("ados");
    const files = [
      "packages/core/src/contracts/audit.ts",
      "packages/core/src/state/audit.ts",
      "packages/cli/src/index.ts",
      "packages/cli/src/edge.ts",
      "packages/cli/src/output/serialize.ts",
      "packages/testkit/src/result-conformance.ts",
    ];
    for (const file of files) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const seed of liveRegistry().seedLiterals) {
        expect(text.includes(seed), `${file}: ${seed}`).toBe(false);
      }
    }
  });

  test("the live scan includes the new audit files with zero violations", () => {
    const outcome = scan(ROOT);
    const auditViolations = outcome.violations.filter((violation) =>
      violation.file.includes("audit"),
    );
    expect(auditViolations).toEqual([]);
  });
});

describe("TC-DOCTOR-023 doctor source carries no product literal", () => {
  test("the doctor modules carry no seed literal", () => {
    for (const source of [
      "packages/core/src/contracts/doctor.ts",
      "packages/core/src/domain/doctor.ts",
      "packages/cli/src/commands/doctor.ts",
    ]) {
      expect(matchSeedLiteral(readFileSync(join(ROOT, source), "utf8"), ["ados"])).toBeFalsy();
      expect(matchSeedLiteral(readFileSync(join(ROOT, source), "utf8"), ["ADOS_"])).toBeFalsy();
    }
  });
});

describe("TC-ECON-084 the economics surface is brand- and privacy-conformant", () => {
  const ECONOMICS_MODULES = [
    "packages/core/src/contracts/economics.ts",
    "packages/core/src/domain/economics-budget.ts",
    "packages/core/src/domain/economics-resume.ts",
    "packages/core/src/domain/economics-view.ts",
    "packages/core/src/domain/economics-evidence.ts",
    "packages/core/src/state/economics.ts",
    "packages/core/src/config/catalog.ts",
  ];

  test("the seed-literal matcher finds no product literal in any new module", () => {
    for (const file of ECONOMICS_MODULES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(matchSeedLiteral(text, liveRegistry().seedLiterals), file).toBeUndefined();
    }
  });

  test("a seeded product literal in a new module fails naming file and token", () => {
    const repo = createTempRepo();
    writeRegistry(repo.root, seededRegistry(repo.baseline));
    writeFiles(repo.root, {
      "packages/core/src/domain/economics-probe.ts": "// ados\n",
    });
    const outcome = scan(repo.root);
    expect(violationsFor(outcome, "packages/core/src/domain/economics-probe.ts")).toContain("ados");
    rmSync(repo.root, { recursive: true, force: true });
  });

  test("the live scan includes the economics modules with zero violations", () => {
    const outcome = scan(ROOT);
    expect(outcome.violations).toEqual([]);
    for (const file of ECONOMICS_MODULES) {
      expect(outcome.violations.filter((violation) => violation.file === file)).toEqual([]);
    }
  });

  test("refusal and record payloads carry counts and refs only, never a content canary", async () => {
    const { formatStallEvidence, formatBudgetEvidence, formatUneconomicalEvidence } = await import(
      "../../packages/core/src/domain/index"
    );
    const corpus = [
      formatStallEvidence({
        reason: "watchdog.liveness-stalled",
        heartbeatAgeMs: 400_000,
        tokenDelta: 0,
        traffic: 0,
        stallBoundMs: 300_000,
      }),
      formatBudgetEvidence({
        reason: "dispatch.restart-budget-exceeded",
        restarts: 3,
        workItemRef: "GH-235",
      }),
      formatUneconomicalEvidence({
        reason: "dispatch.resume-uneconomical",
        repayTokens: 900,
        workItemRef: "GH-235",
      }),
    ].join("\n");
    for (const canary of ["PROMPT-CANARY", "transcript", "sk-live-", "ghp_"]) {
      expect(corpus).not.toContain(canary);
    }
    expect(corpus).toContain("economics/GH-235");
  });
});
