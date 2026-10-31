/**
 * TC-VERIFY-006 — the committed GH-179/GH-170/GH-171 pm-notes classify exactly
 * as AC-V11 pins. The corpus is read in place, read-only; mutations run only on
 * temp copies.
 */
import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { parsePmNotesText } from "../../packages/adapters/src/file/pm-notes-parser";
import { CANONICAL_PHASE_IDS } from "../../packages/core/src/contracts/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { createVerifyHarness, createVerifyState, type VerifyRun } from "./verify-support";

const ROOT = process.cwd();
const CHANGES = join(ROOT, "doc/changes");
const GH179 =
  "doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-pm-notes.yaml";
const GH170 =
  "doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-pm-notes.yaml";
const GH171 =
  "doc/changes/2026-10/2026-10-29--GH-171--branding-seam-working-name/chg-GH-171-pm-notes.yaml";

const digest = (relative: string): string =>
  createHash("sha256")
    .update(readFileSync(join(ROOT, relative)))
    .digest("hex");

const envelopeOf = (run: VerifyRun): Record<string, unknown> => {
  if (run.envelope === undefined) throw new Error("expected one envelope");
  return run.envelope;
};

const errorOf = (run: VerifyRun): Record<string, unknown> => {
  const error = envelopeOf(run).error;
  if (typeof error !== "object" || error === null || Array.isArray(error)) {
    throw new Error("expected an error envelope");
  }
  return error as Record<string, unknown>;
};

const dataOf = (run: VerifyRun): Record<string, unknown> => {
  const data = envelopeOf(run).data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new Error("expected success data");
  }
  return data as Record<string, unknown>;
};

const runCorpus = async (ref: string, changesDirectory = CHANGES): Promise<VerifyRun> => {
  const state = createVerifyState();
  try {
    const harness = createVerifyHarness({ changesDirectory, state });
    try {
      return await harness.run(["change", ref]);
    } finally {
      harness.cleanup();
    }
  } finally {
    state.cleanup();
  }
};

const materializeForRef = (
  ref: string,
  text: string,
): { root: string; changesDirectory: string } => {
  const root = mkdtempSync(join(tmpdir(), `gh177-corpus-${ref}-`));
  const directory = join(root, "doc/changes/2026-10", `2026-10-31--${ref}--fixture`);
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `chg-${ref}-pm-notes.yaml`), text);
  return { root, changesDirectory: join(root, "doc/changes") };
};

const gitStatus = (): string =>
  execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });

describe("TC-VERIFY-006 real committed corpus", () => {
  test("preconditions hold and the GH-179 corpus finishes", async () => {
    const before = gitStatus();
    const digests = new Map([
      [GH179, digest(GH179)],
      [GH170, digest(GH170)],
      [GH171, digest(GH171)],
    ]);

    const gh179 = parse(readFileSync(join(ROOT, GH179), "utf8")) as Record<string, unknown>;
    expect(Object.hasOwn(gh179, "variant")).toBe(false);
    const gh179Phases = gh179.phases as Record<string, Record<string, unknown>>;
    for (const phaseId of CANONICAL_PHASE_IDS) {
      expect(typeof gh179Phases[phaseId]?.completed, phaseId).toBe("string");
    }

    const run = await runCorpus("GH-179");
    expect(run.exitCode).toBe(0);
    expect(assertEnvelopeContract(run.envelope)).toEqual([]);
    const data = dataOf(run);
    expect(data.result).toBe("finished");
    expect(data.variant).toBe("full");
    expect(data.requiredPhases).toEqual([...CANONICAL_PHASE_IDS]);
    expect(data.completedPhases).toEqual([...CANONICAL_PHASE_IDS]);
    expect(data.missingPhases).toEqual([]);
    expect(run.stdout).not.toContain("state.keys.missing");

    for (const [file, expected] of digests) expect(digest(file), file).toBe(expected);
    expect(gitStatus()).toBe(before);
  });

  test("GH-170 is partial naming test_planning and delivery_planning", async () => {
    const document = parse(readFileSync(join(ROOT, GH170), "utf8")) as Record<string, unknown>;
    const phases = document.phases as Record<string, Record<string, unknown>>;
    const nulls = Object.entries(phases)
      .filter(([, entry]) => entry.completed === null)
      .map(([phaseId]) => phaseId)
      .sort();
    expect(nulls).toEqual(["delivery_planning", "test_planning"]);
    for (const opaque of [
      "dor_iterations",
      "review_iterations",
      "quality_gate_iterations",
      "dod_findings",
    ]) {
      expect(Object.hasOwn(phases, opaque), opaque).toBe(true);
    }

    const run = await runCorpus("GH-170");
    expect(run.exitCode).toBe(1);
    expect(assertEnvelopeContract(run.envelope)).toEqual([]);
    const error = errorOf(run);
    expect(error.code).toBe("verify.ledger.incomplete");
    expect(error.summary).toBe(
      "result=partial; variant=full; missing=test_planning,delivery_planning",
    );
    for (const opaque of [
      "dor_iterations",
      "review_iterations",
      "quality_gate_iterations",
      "dod_findings",
    ]) {
      expect(String(error.summary)).not.toContain(opaque);
    }
    expect(Object.hasOwn(envelopeOf(run), "data")).toBe(false);
  });

  test("GH-171 is lint.notes.malformed with no crash or raw parser bytes", async () => {
    const text = readFileSync(join(ROOT, GH171), "utf8");
    const parsed = parsePmNotesText(text, GH171);
    expect(parsed.ok).toBe(false);

    const run = await runCorpus("GH-171");
    expect(run.exitCode).toBe(1);
    expect(assertEnvelopeContract(run.envelope)).toEqual([]);
    const error = errorOf(run);
    expect(error.code).toBe("lint.notes.malformed");
    expect(error.code).not.toBe("fallback.internal");
    expect(run.stdout).not.toContain("docs-scope");
    expect(run.stderr).not.toContain("docs-scope");
    expect(run.stderr).not.toContain("    at ");
  });

  test("all three envelopes are valid and none is fallback.internal", async () => {
    for (const ref of ["GH-179", "GH-170", "GH-171"]) {
      const run = await runCorpus(ref);
      expect(assertEnvelopeContract(run.envelope), ref).toEqual([]);
      if (run.envelope !== undefined && Object.hasOwn(run.envelope, "error")) {
        expect(errorOf(run).code).not.toBe("fallback.internal");
      }
    }
  });

  test("temp-copy mutation controls prove the corpus assertions are live", async () => {
    const gh179Text = readFileSync(join(ROOT, GH179), "utf8");
    const openDelivery = gh179Text.replace(
      /(\n {2}delivery: \{[^\n]*?completed: )"[^"]+"/,
      "$1null",
    );
    expect(openDelivery).not.toBe(gh179Text);
    const gh179Copy = materializeForRef("GH-179", openDelivery);
    try {
      const run = await runCorpus("GH-179", gh179Copy.changesDirectory);
      expect(run.exitCode).toBe(1);
      expect(errorOf(run).code).toBe("verify.ledger.incomplete");
      expect(errorOf(run).summary).toBe("result=partial; variant=full; missing=delivery");
    } finally {
      rmSync(gh179Copy.root, { recursive: true, force: true });
    }

    const gh171Text = readFileSync(join(ROOT, GH171), "utf8");
    const repaired = gh171Text.replace(
      /\n {2}(delivery|system_spec_update|review_fix|quality_gates|dod_check|pr_creation):/g,
      "\n$1:",
    );
    expect(repaired).not.toBe(gh171Text);
    expect(parsePmNotesText(repaired, GH171).ok).toBe(true);
    const gh171Copy = materializeForRef("GH-171", repaired);
    try {
      const run = await runCorpus("GH-171", gh171Copy.changesDirectory);
      expect(errorOf(run).code).not.toBe("lint.notes.malformed");
    } finally {
      rmSync(gh171Copy.root, { recursive: true, force: true });
    }
  });
});
