/**
 * GH-365 P3 — the prior-namespace content arm.
 *
 * TC-SCAN-001: seven classes, six carrying the prior seed class, one planted
 * occurrence per carrying class failing by name, the non-carrying class green
 * for the prior seed and red for its delivered seed, the `SCOPE_ORG` neutral
 * site, and the ADR-0003 DEC-8 allowlist independence.
 * TC-SCAN-002: the structural neutral exclusions, a product-identifier use, the
 * longest-literal precedence, and the matching corpora.
 * TC-SHIM-002: both-directions reconciliation — presence for every site,
 * match/budget only for in-corpus sites, and declaration-only sites never
 * matched.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, rmSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import {
  EXPECTED_SCOPE_IDS,
  matchPriorNamespaceLine,
  matchPriorNamespaceLiteral,
  readRegistry,
  resolvePriorShim,
  scan,
  validateRegistryShape,
} from "../../scripts/checks/forbidden-literals";
import {
  CLASS_TARGETS,
  type LiveShim,
  liveShims,
  prepareRepo,
  type SownClass,
  sow,
  sowDoc,
  writeAt,
} from "../fixtures/namespace/seeds";
import { ROOT } from "./fixture-repo";

type Block = NonNullable<ReturnType<typeof readRegistry>["priorNamespace"]>;

const liveBlock = (): Block => {
  const block = readRegistry(ROOT).priorNamespace;
  if (block === undefined) throw new Error("the live registry has no priorNamespace block");
  return block;
};

const hasViolation = (outcome: ReturnType<typeof scan>, file: string, token: string): boolean =>
  outcome.violations.some((entry) => entry.file === file && entry.token === token);

const scanTemp = (root: string, presence = false): ReturnType<typeof scan> =>
  scan(root, { checkSitePresence: presence });

const withRepo = (body: (repo: ReturnType<typeof prepareRepo>) => void): void => {
  const repo = prepareRepo();
  try {
    body(repo);
  } finally {
    rmSync(repo.root, { recursive: true, force: true });
  }
};

// ---------------------------------------------------------------------------
// TC-SCAN-001
// ---------------------------------------------------------------------------

describe("TC-SCAN-001 the prior-namespace content arm", () => {
  test("the real tree is green with seven classes and six prior carriers", () => {
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
    expect(outcome.classes.map((entry) => entry.id)).toEqual([...EXPECTED_SCOPE_IDS]);

    const block = liveBlock();
    const carriers = EXPECTED_SCOPE_IDS.filter((id) =>
      (block.scopeSelection[id] ?? []).includes("priorNamespace"),
    );
    expect(carriers).toEqual([
      "packageTree",
      "rootManifests",
      "ignoreRules",
      "promptSurface",
      "scriptSurface",
      "userFacingDocs",
    ]);
    expect((block.scopeSelection.rootWorkspaceFiles ?? []).includes("priorNamespace")).toBe(false);
    expect(block.scopeSelection.promptSurface).toEqual(["priorNamespace"]);
    expect(block.scopeSelection.scriptSurface).toEqual(["priorNamespace"]);
  });

  test("one planted occurrence per carrying class fails by name", () => {
    const rows: ReadonlyArray<readonly [SownClass, string, string]> = [
      ["packageTree", ".delivery-os/x", ".delivery-os"],
      ["rootManifests", "DELIVERY_OS_FOO", "DELIVERY_OS_"],
      ["ignoreRules", ".delivery-os/", ".delivery-os"],
      ["promptSurface", ".delivery-os/config.yaml", ".delivery-os"],
      ["scriptSurface", "~/.delivery-os/config.yaml", "~/.delivery-os"],
    ];
    for (const [classId, line, token] of rows) {
      withRepo((repo) => {
        const file = sow(repo, classId, line);
        const outcome = scanTemp(repo.root);
        expect(hasViolation(outcome, file, token), `${classId}: ${line}`).toBe(true);
      });
    }

    const repo = prepareRepo({ registered: [CLASS_TARGETS.userFacingDocs] });
    try {
      const file = sowDoc(repo, ".delivery-os/config.yaml");
      const outcome = scanTemp(repo.root);
      expect(hasViolation(outcome, file, ".delivery-os")).toBe(true);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  test("the non-carrying class stays green for the prior seed and red for its delivered seed", () => {
    withRepo((repo) => {
      const file = sow(repo, "rootWorkspaceFiles", ".delivery-os/x");
      const first = scanTemp(repo.root);
      expect(first.violations.filter((entry) => entry.file === file)).toEqual([]);
      sow(repo, "rootWorkspaceFiles", "ADOS_");
      const second = scanTemp(repo.root);
      expect(hasViolation(second, file, "ADOS_")).toBe(true);
    });
  });

  test("a prior executable token in a registered doc stays green (RSK-11 residual)", () => {
    const target = CLASS_TARGETS.userFacingDocs;
    const repo = prepareRepo({ registered: [target] });
    try {
      sowDoc(repo, "the prior delivery-os executable is a declared shim");
      const outcome = scanTemp(repo.root);
      expect(outcome.violations.filter((entry) => entry.file === target)).toEqual([]);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  test("prompt and script scopes carry the prior class only", () => {
    withRepo((repo) => {
      const script = sow(repo, "scriptSurface", "ADOS_FOO=bar");
      const prompt = sow(repo, "promptSurface", "ADOS_FOO=bar");
      const outcome = scanTemp(repo.root);
      expect(outcome.violations.filter((entry) => entry.file === script)).toEqual([]);
      expect(outcome.violations.filter((entry) => entry.file === prompt)).toEqual([]);
    });
  });

  test("the widened shape rejects the old five-class registry by name", () => {
    const live = readRegistry(ROOT);
    expect(validateRegistryShape(live)).toEqual([]);

    const oldFive = { ...live, scopeClasses: live.scopeClasses.slice(0, 5) };
    const failures = validateRegistryShape(oldFive).join("\n");
    expect(failures).toContain("promptSurface");
    expect(failures).toContain("scriptSurface");

    const deliveredShape = live;
    const seedMutation = { ...deliveredShape, seedLiterals: [...deliveredShape.seedLiterals, "x"] };
    expect(validateRegistryShape(seedMutation).some((m) => m.includes("seedLiterals"))).toBe(true);
    const allowlistMutation = {
      ...deliveredShape,
      allowlist: deliveredShape.allowlist.filter((entry) => entry.id !== "branding-subpath"),
    };
    expect(validateRegistryShape(allowlistMutation).some((m) => m.includes("DEC-8 set"))).toBe(
      true,
    );
  });

  test("the SCOPE_ORG neutral site is bounded at one occurrence", () => {
    const file = "packages/core/src/branding/index.ts";
    withRepo((repo) => {
      writeAt(repo, file, 'export const SCOPE_ORG = "delivery-os";\n');
      expect(scanTemp(repo.root).violations.filter((entry) => entry.file === file)).toEqual([]);
      writeAt(
        repo,
        file,
        'export const SCOPE_ORG = "delivery-os";\nexport const EXTRA = "delivery-os";\n',
      );
      const over = scanTemp(repo.root);
      expect(
        over.violations.some((entry) => entry.file === file && entry.token === "delivery-os"),
      ).toBe(true);
    });
  });

  test("the ADR-0003 DEC-8 path allowlist does not filter the prior class", () => {
    const file = "packages/adapters/src/legacy/index.ts";
    withRepo((repo) => {
      writeAt(repo, file, "// .delivery-os\n");
      const outcome = scanTemp(repo.root);
      expect(hasViolation(outcome, file, ".delivery-os")).toBe(true);
    });
  });

  test("the two reworded pages present the current path and are not declared sites", () => {
    const live = readRegistry(ROOT);
    for (const file of ["doc/guides/opencode-model-configuration.md", "doc/overview/glossary.md"]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text).toContain(".jaiship/config.yaml");
      expect(/\.delivery-os|DELIVERY_OS_|~\/\.delivery-os/.test(text)).toBe(false);
      expect(live.registered.includes(file)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// TC-SCAN-002
// ---------------------------------------------------------------------------

describe("TC-SCAN-002 neutral-scope and longest-literal semantics", () => {
  const block = liveBlock();

  test("the structural exclusions admit the scope sigil and the repository name only", () => {
    expect(
      matchPriorNamespaceLiteral('import { x } from "@delivery-os/core";', block),
    ).toBeUndefined();
    expect(
      matchPriorNamespaceLiteral("see the agentic-delivery-os repository", block),
    ).toBeUndefined();
    expect(matchPriorNamespaceLiteral("run delivery-os migrate", block)).toBe("delivery-os");
    expect(matchPriorNamespaceLiteral("@delivery-os", block)).toBeUndefined();
    expect(matchPriorNamespaceLiteral("delivery-osx", block)).toBeUndefined();
  });

  test("a root-manifest prior name is a declared neutral site; an unscoped package name fails", () => {
    withRepo((repo) => {
      writeAt(repo, "package.json", '{\n  "name": "delivery-os"\n}\n');
      expect(scanTemp(repo.root).violations.filter((e) => e.file === "package.json")).toEqual([]);

      writeAt(repo, "packages/x/package.json", '{\n  "name": "delivery-os"\n}\n');
      expect(hasViolation(scanTemp(repo.root), "packages/x/package.json", "delivery-os")).toBe(
        true,
      );
    });
  });

  test("DELIVERY_OS_WORKING_NAME resolves to the longest literal (the override shim)", () => {
    const shims: readonly LiveShim[] = liveShims(ROOT);
    const line = "const name = DELIVERY_OS_WORKING_NAME;";
    expect(matchPriorNamespaceLiteral(line, block)).toBe("DELIVERY_OS_");
    const [match] = matchPriorNamespaceLine(line, block);
    if (match === undefined) throw new Error("no prior match on the probe line");
    expect(resolvePriorShim(line, match, shims)?.id).toBe("prior-working-name-override");
    const ownerHold = "DELIVERY_OS_OWNER_HOLD=1";
    const [ownerMatch] = matchPriorNamespaceLine(ownerHold, block);
    if (ownerMatch === undefined) throw new Error("no prior match on the owner-hold probe");
    expect(resolvePriorShim(ownerHold, ownerMatch, shims)?.id).toBe("prior-environment-prefix");
  });

  test("the SCOPE_ORG occurrence is admitted by the neutral site, not by an exclusion", () => {
    const line = 'const SCOPE_ORG = "delivery-os";';
    expect(matchPriorNamespaceLiteral(line, block)).toBe("delivery-os");
    const branding = block.neutralSites.find(
      (site) => site.file === "packages/core/src/branding/index.ts",
    );
    expect(branding?.seed).toBe("prior-executable");
    expect(branding?.maxOccurrences).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// TC-SHIM-002
// ---------------------------------------------------------------------------

describe("TC-SHIM-002 both-directions reconciliation", () => {
  test("every declared site is present; match/budget applies only in-corpus", () => {
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.violations).toEqual([]);
    expect(outcome.sites.length).toBeGreaterThan(0);
    for (const site of outcome.sites) {
      expect(site.present, site.file).toBe(true);
      if (site.inCorpus) {
        expect(site.matched, site.file).toBe(true);
        expect(site.occurrences, site.file).toBeLessThanOrEqual(site.budget);
      } else {
        expect(site.matched, site.file).toBe(false);
      }
    }

    const declarationOnly = [
      "doc/spec/features/feature-autonomous-delivery.md",
      "doc/guides/delivery-modes.md",
      "doc/quality/test-specs/test-spec-autonomous-delivery.md",
      "tests/fixtures/entrypoint/prior-identity/harness.ts",
      "tests/fixtures/namespace/pre-freeze-env.ts",
    ];
    for (const file of declarationOnly) {
      const reports = outcome.sites.filter((site) => site.file === file);
      expect(reports.length, file).toBeGreaterThan(0);
      for (const report of reports) {
        expect(report.inCorpus, file).toBe(false);
        expect(report.matched, file).toBe(false);
      }
    }
  });

  test("row A: an undeclared occurrence fails by file, line and token", () => {
    withRepo((repo) => {
      const file = sow(repo, "scriptSurface", "DELIVERY_OS_CUSTOM=1");
      const outcome = scanTemp(repo.root);
      const violation = outcome.violations.find((entry) => entry.file === file);
      expect(violation?.token).toBe("DELIVERY_OS_");
      expect(violation?.line).toBeGreaterThan(0);
    });
  });

  test("row B: a vanished declared site fails by name, in-corpus and declaration-only", () => {
    const repo = prepareRepo({
      sites: {
        "prior-config-directory": [
          { file: "scripts/install.sh", maxOccurrences: 2 },
          { file: "tests/fixtures/namespace/probe.ts", maxOccurrences: 2 },
        ],
      },
    });
    try {
      writeAt(repo, "scripts/install.sh", "root=.delivery-os\n");
      writeAt(repo, "tests/fixtures/namespace/probe.ts", "probe\n");
      const clean = scan(repo.root);
      expect(clean.failures).toEqual([]);

      unlinkSync(join(repo.root, "scripts/install.sh"));
      const missingCorpus = scan(repo.root);
      expect(
        missingCorpus.failures.some(
          (message) =>
            message.includes("declared site absent") && message.includes("scripts/install.sh"),
        ),
      ).toBe(true);

      writeAt(repo, "scripts/install.sh", "root=.delivery-os\n");
      unlinkSync(join(repo.root, "tests/fixtures/namespace/probe.ts"));
      const missingOnly = scan(repo.root);
      expect(
        missingOnly.failures.some(
          (message) =>
            message.includes("declared site absent") &&
            message.includes("tests/fixtures/namespace/probe.ts"),
        ),
      ).toBe(true);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  test("row C: an over-budget in-corpus site fails; a declaration-only zero match does not", () => {
    const repo = prepareRepo({
      sites: {
        "prior-config-directory": [
          { file: "scripts/install.sh", maxOccurrences: 1 },
          { file: "tests/fixtures/namespace/probe.ts", maxOccurrences: 1 },
        ],
      },
    });
    try {
      writeAt(repo, "scripts/install.sh", "root=.delivery-os\n");
      writeAt(repo, "tests/fixtures/namespace/probe.ts", "nothing here\n");
      const within = scan(repo.root);
      expect(within.failures).toEqual([]);
      expect(within.violations).toEqual([]);

      writeAt(repo, "scripts/install.sh", "one=.delivery-os\ntwo=.delivery-os\n");
      const over = scan(repo.root);
      expect(over.violations.some((entry) => entry.file === "scripts/install.sh")).toBe(true);
      expect(over.failures).toEqual([]);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  test("row D: longest-literal precedence keeps owner-hold and override occurrences green", () => {
    const repo = prepareRepo({
      sites: {
        "prior-environment-prefix": [{ file: "scripts/install.sh", maxOccurrences: 5 }],
        "prior-working-name-override": [{ file: "scripts/install.sh", maxOccurrences: 1 }],
      },
    });
    try {
      writeAt(
        repo,
        "scripts/install.sh",
        "owner=DELIVERY_OS_OWNER_HOLD\nname=DELIVERY_OS_WORKING_NAME\n",
      );
      const outcome = scan(repo.root);
      expect(outcome.failures).toEqual([]);
      expect(outcome.violations).toEqual([]);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  test("row E: a declared corpus is exempt until its prefix is removed", () => {
    const m1 = "doc/planning/oss-tooling/milestones/m1/commands/entrypoint.md";
    const inception = "doc/inception/analysis/phase-4-quality-baseline.md";
    const repo = prepareRepo({ registered: [m1, inception] });
    try {
      writeAt(repo, m1, "current path .delivery-os/config.yaml\n");
      writeAt(repo, inception, "observed DELIVERY_OS_WORKING_NAME\n");
      expect(scanTemp(repo.root).violations).toEqual([]);

      const registry = JSON.parse(
        readFileSync(join(repo.root, "scripts/checks/forbidden-literals.registry.json"), "utf8"),
      ) as { priorNamespace: { declaredCorpora: { prefix: string; reason: string }[] } };
      registry.priorNamespace.declaredCorpora = registry.priorNamespace.declaredCorpora.filter(
        (corpus) => corpus.prefix !== "doc/planning/oss-tooling/milestones/m1/commands/",
      );
      writeAt(
        repo,
        "scripts/checks/forbidden-literals.registry.json",
        `${JSON.stringify(registry, null, 2)}\n`,
      );
      const exposed = scanTemp(repo.root);
      expect(hasViolation(exposed, m1, ".delivery-os")).toBe(true);
      expect(exposed.violations.filter((entry) => entry.file === inception)).toEqual([]);
    } finally {
      rmSync(repo.root, { recursive: true, force: true });
    }
  });

  test("row F: the pre-freeze fixture is never a DELIVERY_OS_ site", () => {
    const shims = liveShims(ROOT);
    const byId = new Map(shims.map((shim) => [shim.id, shim]));
    const prefix = byId.get("prior-environment-prefix");
    const preFreeze = byId.get("pre-freeze-environment-prefix");
    expect(prefix).toBeDefined();
    expect(preFreeze).toBeDefined();
    const prefixFiles = new Set((prefix?.sites ?? []).map((site) => site.file));
    for (const file of [
      "scripts/hooks/pre-opencode-iteration-owner-hold.sh",
      "scripts/.tests/test-hook-owner-hold-example.sh",
      "doc/spec/features/feature-autonomous-delivery.md",
      "doc/guides/delivery-modes.md",
      "doc/quality/test-specs/test-spec-autonomous-delivery.md",
      "tests/fixtures/entrypoint/prior-identity/harness.ts",
    ]) {
      expect(prefixFiles.has(file), file).toBe(true);
    }
    expect(prefixFiles.has("tests/fixtures/namespace/pre-freeze-env.ts")).toBe(false);
    const preFreezeFiles = new Set((preFreeze?.sites ?? []).map((site) => site.file));
    expect(preFreezeFiles.has("tests/fixtures/namespace/pre-freeze-env.ts")).toBe(true);
    expect(preFreezeFiles.has("packages/adapters/src/legacy/index.ts")).toBe(true);
  });
});
