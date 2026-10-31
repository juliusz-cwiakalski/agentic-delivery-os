/**
 * TC-LINT-007 / TC-LINT-008 — the variant-era corpus boundary fixture.
 *
 * The member set derives from change-folder dates plus the committed exclusion
 * manifest (PIN-2). Committed files are linted read-only through the real
 * command path; drift, manifest and schema-mutation controls run on temp copies.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CANONICAL_PHASE_IDS,
  LITE_REQUIRED_PHASES,
  type PmNotesParseOutcome,
} from "../../packages/core/src/contracts/index";
import {
  CORPUS_MANIFEST_PATH,
  type CorpusEntry,
  type CorpusManifest,
  copyChangesTree,
  corpusRuntime,
  enumerateCorpus,
  enumerateCorpusRaw,
  manifestViolations,
  mutateLitePhaseSet,
  readCorpusManifest,
  writeCorpusFile,
} from "./pm-notes-corpus-support";
import { runLint } from "./pm-notes-lint-command-support";
import { documentOf, loadPmNotes, phasesOf } from "./pm-notes-lint-support";

const ROOT = process.cwd();
const MANIFEST = readCorpusManifest(ROOT);
const TEMP_PREFIX = "gh179-corpus-";

const tempRoot = (label: string): string => mkdtempSync(join(tmpdir(), `${TEMP_PREFIX}${label}-`));

const withTemp = async (label: string, body: (root: string) => Promise<void> | void) => {
  const root = tempRoot(label);
  try {
    await body(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

const lintEntry = (root: string, entry: CorpusEntry) =>
  runLint(corpusRuntime(root), [entry.changeRef], { ticks: [10, 10] });

const errorCode = (envelope: Record<string, unknown> | undefined): unknown => {
  const error = envelope?.error;
  return typeof error === "object" && error !== null
    ? (error as { readonly code?: unknown }).code
    : undefined;
};

const validCorpusText = readFileSync(
  join(ROOT, "tests/fixtures/pm-notes/valid/full-complete.yaml"),
  "utf8",
);

const unparseableText = readFileSync(
  join(ROOT, "tests/fixtures/pm-notes/malformed/unparseable-orphaned-indentation.yaml.txt"),
  "utf8",
);

const phaseMissingText = readFileSync(
  join(ROOT, "tests/fixtures/pm-notes/valid/optional-omissions.yaml"),
  "utf8",
).replace("  test_planning: { started: null, completed: null }\n", "");

const missingRequired = (
  outcome: PmNotesParseOutcome,
  required: readonly string[],
): readonly string[] => {
  if (!outcome.ok) throw new Error("expected a parsed document");
  const phases = phasesOf(documentOf(outcome));
  return required.filter((phase) => !Object.hasOwn(phases, phase));
};

describe("TC-LINT-007 variant-era corpus membership", () => {
  test("the derived set is non-empty and includes every measured variant-era change", () => {
    const entries = enumerateCorpus(ROOT, MANIFEST);
    expect(entries.length).toBeGreaterThan(0);
    const refs = new Set(entries.map((entry) => entry.changeRef));
    for (const ref of ["GH-170", "GH-172", "GH-173", "GH-174", "GH-181", "GH-179"]) {
      expect(refs.has(ref)).toBe(true);
    }
    for (const entry of entries) {
      expect(entry.month >= "2026-10").toBe(true);
    }
  });

  test("GH-171 is excluded only by the manifest", () => {
    const raw = enumerateCorpusRaw(ROOT);
    const rawRefs = new Set(raw.map((entry) => entry.changeRef));
    expect(rawRefs.has("GH-171")).toBe(true);
    const excludedPath = MANIFEST.exclude[0] as string;
    expect(raw.some((entry) => entry.path === excludedPath)).toBe(true);
    const entries = enumerateCorpus(ROOT, MANIFEST);
    expect(entries.some((entry) => entry.changeRef === "GH-171")).toBe(false);
  });

  test("legacy-era folders are outside the derived set", () => {
    expect(CORPUS_MANIFEST_PATH).toBe("tests/fixtures/pm-notes/corpus-exclusions.json");
    for (const entry of enumerateCorpus(ROOT, MANIFEST)) {
      expect(entry.path.startsWith("doc/changes/2026-10/")).toBe(true);
      expect(entry.path).not.toContain("2026-03/");
      expect(entry.path).not.toContain("2026-07/");
    }
  });
});

describe("TC-LINT-007 corpus acceptance through the lint command", () => {
  test("every boundary file lints clean with the effective-variant default", async () => {
    const entries = enumerateCorpus(ROOT, MANIFEST);
    const members = entries.map((entry) => entry.changeRef).join(",");
    const failures: string[] = [];
    for (const entry of entries) {
      const run = await lintEntry(ROOT, entry);
      if (run.exitCode !== 0) {
        failures.push(
          `${entry.path}: exit ${run.exitCode} ${String(errorCode(run.envelope) ?? "")} (members: ${members})`,
        );
      }
    }
    expect(failures).toEqual([]);
  });

  test("the GH-170 real document is the opaque-extra positive control and passes", async () => {
    const entries = enumerateCorpus(ROOT, MANIFEST);
    const gh170 = entries.find((entry) => entry.changeRef === "GH-170");
    expect(gh170).toBeDefined();
    if (gh170 === undefined) return;
    const text = readFileSync(join(ROOT, gh170.path), "utf8");
    expect(text).toContain("dor_iterations");
    const run = await lintEntry(ROOT, gh170);
    expect(run.exitCode).toBe(0);
    expect(run.envelope).toMatchObject({ data: { target: "pm-notes", variant: "full" } });
  });

  test("the corpus is read strictly read-only", async () => {
    const entries = enumerateCorpus(ROOT, MANIFEST);
    const before = entries.map((entry) => readFileSync(join(ROOT, entry.path), "utf8"));
    for (const entry of entries) await lintEntry(ROOT, entry);
    const after = entries.map((entry) => readFileSync(join(ROOT, entry.path), "utf8"));
    expect(after).toEqual(before);
  });
});

describe("TC-LINT-008 boundary guard is live", () => {
  test("a newly added variant-era file is picked up and a file moved to 2026-09 leaves", async () => {
    await withTemp("boundary", (root) => {
      copyChangesTree(root);
      writeCorpusFile(
        root,
        "doc/changes/2026-10/2026-10-31--GH-900--injected/chg-GH-900-pm-notes.yaml",
        validCorpusText,
      );
      expect(enumerateCorpus(root, MANIFEST).some((entry) => entry.changeRef === "GH-900")).toBe(
        true,
      );

      mkdirSync(join(root, "doc/changes/2026-09"), { recursive: true });
      renameSync(
        join(root, "doc/changes/2026-10/2026-10-30--GH-174--state-layer"),
        join(root, "doc/changes/2026-09/2026-09-30--GH-174--state-layer"),
      );
      expect(enumerateCorpus(root, MANIFEST).some((entry) => entry.changeRef === "GH-174")).toBe(
        false,
      );
    });
  });

  test("a malformed injection fails the scan with the pinned code", async () => {
    await withTemp("malformed", async (root) => {
      copyChangesTree(root);
      writeCorpusFile(
        root,
        "doc/changes/2026-10/2026-10-31--GH-901--malformed/chg-GH-901-pm-notes.yaml",
        unparseableText,
      );
      const entry = enumerateCorpus(root, MANIFEST).find(
        (candidate) => candidate.changeRef === "GH-901",
      );
      expect(entry).toBeDefined();
      if (entry === undefined) return;
      const run = await lintEntry(root, entry);
      expect(run.exitCode).toBe(1);
      expect(errorCode(run.envelope)).toBe("lint.notes.malformed");
    });
  });

  test("a missing-required-phase injection fails the scan", async () => {
    await withTemp("phases", async (root) => {
      copyChangesTree(root);
      writeCorpusFile(
        root,
        "doc/changes/2026-10/2026-10-31--GH-902--incomplete/chg-GH-902-pm-notes.yaml",
        phaseMissingText,
      );
      const entry = enumerateCorpus(root, MANIFEST).find(
        (candidate) => candidate.changeRef === "GH-902",
      );
      expect(entry).toBeDefined();
      if (entry === undefined) return;
      const run = await lintEntry(root, entry);
      expect(run.exitCode).toBe(1);
      expect(errorCode(run.envelope)).toBe("lint.phases.incomplete");
    });
  });
});

describe("TC-LINT-008 exclusion manifest guard", () => {
  test("the committed manifest is justified: one existing, genuinely unparseable path", () => {
    expect(manifestViolations(ROOT, MANIFEST)).toEqual([]);
    expect(MANIFEST.exclude).toHaveLength(1);
    expect(MANIFEST.exclude[0]).toContain("GH-171");
  });

  test("a second entry fails the guard, even when it names an unparseable file", () => {
    const grown: CorpusManifest = {
      exclude: [
        MANIFEST.exclude[0] as string,
        "doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml",
      ],
    };
    expect(manifestViolations(ROOT, grown)).toEqual([
      "manifest must name exactly one path, found 2",
    ]);
  });

  test("an entry naming a parseable file fails the guard", () => {
    const widened: CorpusManifest = {
      exclude: ["doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-pm-notes.yaml"],
    };
    expect(manifestViolations(ROOT, widened)).toEqual([
      "manifest entry names a parseable file: doc/changes/2026-10/2026-10-30--GH-174--state-layer/chg-GH-174-pm-notes.yaml",
    ]);
  });

  test("a missing manifest path fails the guard", () => {
    const dangling: CorpusManifest = { exclude: ["doc/changes/2026-10/absent-pm-notes.yaml"] };
    expect(manifestViolations(ROOT, dangling)).toContain(
      "manifest entry does not exist: doc/changes/2026-10/absent-pm-notes.yaml",
    );
  });
});

describe("TC-LINT-008 schema-mutation re-assertion (corpus half)", () => {
  type SchemaModule = { readonly LITE_REQUIRED_PHASES: readonly string[] };

  const schemaModuleOf = (value: unknown): SchemaModule => {
    if (typeof value !== "object" || value === null)
      throw new Error("schema module is not a module");
    const phases = (value as { readonly LITE_REQUIRED_PHASES?: unknown }).LITE_REQUIRED_PHASES;
    if (!Array.isArray(phases) || !phases.every((phase) => typeof phase === "string")) {
      throw new Error("schema module has no LITE_REQUIRED_PHASES");
    }
    return { LITE_REQUIRED_PHASES: phases };
  };

  test("a temp-copy LITE-set change makes a previously passing lite document fail", async () => {
    await withTemp("schema", async (root) => {
      const source = readFileSync(join(ROOT, "packages/core/src/contracts/pm-notes.ts"), "utf8");
      const target = join(root, "packages/core/src/contracts/pm-notes.ts");
      mkdirSync(join(target, ".."), { recursive: true });
      writeFileSync(target, mutateLitePhaseSet(source, "test_planning"));
      const mutated = schemaModuleOf(await import(pathToFileURL(target).href));

      const lite = loadPmNotes("valid/lite-six.yaml");
      expect(missingRequired(lite, [...LITE_REQUIRED_PHASES])).toEqual([]);
      expect(missingRequired(lite, [...mutated.LITE_REQUIRED_PHASES])).toEqual(["test_planning"]);
    });
  });

  test("the corpus suite reads the schema constant; no hardcoded LITE duplicate exists", () => {
    const text = readFileSync(join(ROOT, "tests/behaviour/pm-notes-corpus.test.ts"), "utf8");
    expect(text).toContain("LITE_REQUIRED_PHASES");
    expect(/\[\s*"clarify_scope"[\s\S]{0,240}"dod_check"\s*\]/.test(text)).toBe(false);
    expect([...CANONICAL_PHASE_IDS]).toHaveLength(11);
  });
});
