/**
 * TC-F3-006 (scan half) — the check and refusal path carries exactly one
 * required-check evaluator entry point and no prose classification.
 *
 * The scan reads product sources (file and line, so a planted construct is
 * found and named) and asserts two absences:
 *
 *  1. `evaluateRequiredJobGate` is the only exported required-check evaluator
 *     in `packages/*\/src` — a second entry point would be a second authority
 *     over the same page.
 *  2. The refusal composition (`merge-transaction` and the `merge` command)
 *     never reads a job state itself, and no file on the check path case-folds
 *     or substring-matches a message-like value to classify it.
 *
 * Each absence carries a planted control that the same matcher must find, so
 * the scan cannot pass vacuously. There is no network, no child process, and
 * no fixture: the population is the committed tree.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PACKAGES = join(ROOT, "packages");

type Unit = { readonly file: string; readonly text: string };

const walk = (directory: string, relative: string): Unit[] => {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(join(directory, relative), { withFileTypes: true });
  } catch {
    return [];
  }
  const units: Unit[] = [];
  for (const entry of entries) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (["dist", "node_modules", "tmp"].includes(entry.name)) continue;
      units.push(...walk(directory, next));
    } else if (entry.name.endsWith(".ts")) {
      units.push({ file: next, text: readFileSync(join(directory, next), "utf8") });
    }
  }
  return units;
};

const productSources = (): readonly Unit[] =>
  readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => walk(ROOT, `packages/${entry.name}/src`))
    .sort((left, right) => left.file.localeCompare(right.file));

/** The check/refusal path: the probe, the composition, the gate battery, the command. */
const checkPath = (): readonly Unit[] => {
  const files = [
    "packages/core/src/domain/merge-probe.ts",
    "packages/core/src/domain/merge-transaction.ts",
    "packages/core/src/domain/verify-gates.ts",
    "packages/cli/src/commands/merge.ts",
  ];
  return files.map((file) => ({ file, text: readFileSync(join(ROOT, file), "utf8") }));
};

/** An exported required-check evaluator declaration. */
const EVALUATOR = /export (?:const|function) ([A-Za-z_$][\w$]*)/gu;
const REQUIRED_CHECK_NAME =
  /(?:evaluate|classify)\w*(?:RequiredJob|RequiredCheck|CheckRun|JobState)/u;

/** A direct job-state read in the refusal composition. */
const JOB_STATE = /\bjobState\b/u;

/** Case-folding or matching a message-like value to classify it. */
const PROSE_CLASSIFIER =
  /(?:detail|message|summary|body|title|prose|text|output|stderr|stdout)\s*\.\s*(?:toLowerCase|toUpperCase|includes|match|test)\s*\(/u;

const lineFindings = (units: readonly Unit[], pattern: RegExp): string[] => {
  const findings: string[] = [];
  for (const unit of units) {
    unit.text.split("\n").forEach((line, index) => {
      // A fresh non-global test per line keeps `lastIndex` from leaking.
      const local = new RegExp(pattern.source, pattern.flags.replace("g", ""));
      if (local.test(line)) findings.push(`${unit.file}:${index + 1}:${line.trim()}`);
    });
  }
  return findings;
};

const evaluatorEntryPoints = (units: readonly Unit[]): string[] => {
  const found: string[] = [];
  for (const unit of units) {
    for (const match of unit.text.matchAll(new RegExp(EVALUATOR.source, "gu"))) {
      const name = match[1];
      if (name !== undefined && REQUIRED_CHECK_NAME.test(name)) found.push(`${unit.file}:${name}`);
    }
  }
  return found;
};

describe("TC-F3-006 the check path has one evaluator and no prose classification", () => {
  test("exactly one exported required-check evaluator exists in product source", () => {
    expect(evaluatorEntryPoints(productSources())).toEqual([
      "packages/core/src/domain/merge-probe.ts:evaluateRequiredJobGate",
    ]);
  });

  test("control M39: a planted second evaluator entry point is found and named", () => {
    const planted: Unit = {
      file: "packages/core/src/domain/planted-second-evaluator.ts",
      text: "export const evaluateRequiredCheck = (): boolean => true;\n",
    };
    const found = evaluatorEntryPoints([...productSources(), planted]);
    expect(found).toContain(
      "packages/core/src/domain/planted-second-evaluator.ts:evaluateRequiredCheck",
    );
    expect(found).toHaveLength(2);
  });

  test("the refusal composition never reads a job state itself", () => {
    const path = checkPath().filter(
      (unit) => unit.file.endsWith("merge-transaction.ts") || unit.file.endsWith("merge.ts"),
    );
    expect(path).toHaveLength(2);
    expect(lineFindings(path, JOB_STATE)).toEqual([]);
  });

  test("control: a planted direct state read in the composition is found and named", () => {
    const planted: Unit = {
      file: "packages/core/src/domain/merge-transaction.ts",
      text: "const red = run.jobs.some((job) => job.jobState === 'failed');\n",
    };
    const found = lineFindings([planted], JOB_STATE);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("merge-transaction.ts:1");
    expect(found[0]).toContain("jobState");
  });

  test("no check-path file classifies through prose", () => {
    expect(lineFindings(checkPath(), PROSE_CLASSIFIER)).toEqual([]);
  });

  test("control M27: a planted prose classifier is found and named", () => {
    const planted: Unit = {
      file: "packages/core/src/domain/planted-prose-classifier.ts",
      text: [
        "const a = detail.toLowerCase().includes('check');",
        "const b = payload.message.match(/check/i);",
        "const c = summary.toUpperCase().includes('REQUIRED');",
      ].join("\n"),
    };
    const found = lineFindings([planted], PROSE_CLASSIFIER);
    expect(found).toHaveLength(3);
    expect(found[0]).toContain("planted-prose-classifier.ts:1");
    expect(found[2]).toContain("planted-prose-classifier.ts:3");
  });
});
