/**
 * TC-F5-007 — no repair surface exists and the lint rows keep their codes, order
 * and remediation (F-5, DM-8, AC-F5-6).
 *
 * Detection never repairs: the `phase` grammar has no `repair` (or any other)
 * verb, the `lint` command has no `--fix` flag or write mode, the phase state
 * surface declares no new kind, the five delivered identities keep their codes
 * and remediation strings, and the sixth row is appended last with its documented
 * and machine-declared entries moving together.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createLintCommandDefinition,
  type LintCommandRuntime,
} from "../../packages/cli/src/commands/lint";
import { createPhaseCommandDefinition } from "../../packages/cli/src/commands/phase";
import { runCli } from "../../packages/cli/src/index";
import {
  CANONICAL_PHASE_IDS,
  ERROR_TABLE,
  PHASE_STATE_DOCUMENT_PREFIX,
  PHASE_STATE_DOCUMENT_SUFFIX,
  PHASE_TRANSITION_KIND,
  PM_NOTES_LINT_CODES,
} from "../../packages/core/src/contracts/index";
import { PHASE_TRANSITION_BOUNDARY } from "../../packages/core/src/state/registry";
import { bufferSink, SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const DOC_PATH = "doc/spec/features/feature-result-contract.md";

/** The six documented pm-notes lint rows, in the declared rule order. */
const DECLARED_ROWS = [...PM_NOTES_LINT_CODES, "lint.phases.divergent"] as const;

/** The five delivered identities with their delivered remediation strings. */
const DELIVERED_REMEDIATION: Readonly<Record<string, string>> = {
  "lint.notes.malformed":
    "Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry.",
  "lint.keys.missing": "Add the named required key(s) with a conforming value and retry.",
  "lint.variant.unknown": "Set `variant` to `full` or `lite` and retry.",
  "lint.phases.incomplete":
    "Add the named missing required phase(s) of the declared variant or correct the declared variant.",
  "lint.target.missing":
    "pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3).",
};

const lintRows = (): readonly { readonly code: string; readonly remediationHint: string }[] =>
  (
    ERROR_TABLE as readonly {
      readonly code: string;
      readonly domainKind: string;
      readonly remediationHint: string;
    }[]
  )
    .filter((entry) => entry.domainKind === "lint")
    .map((entry) => ({ code: entry.code, remediationHint: entry.remediationHint }));

const documentedOrder = (): readonly string[] => {
  const text = readFileSync(join(ROOT, DOC_PATH), "utf8");
  return DECLARED_ROWS.map((code) => ({ code, at: text.indexOf(`| ${code} |`) }))
    .filter((entry) => entry.at >= 0)
    .sort((left, right) => left.at - right.at)
    .map((entry) => entry.code);
};

/** The first row that moved between two ordered lists, or undefined. */
const firstMoved = (
  documented: readonly string[],
  machine: readonly string[],
): string | undefined => {
  const length = Math.max(documented.length, machine.length);
  for (let index = 0; index < length; index += 1) {
    const left = documented[index];
    const right = machine[index];
    if (left !== right) return right ?? left;
  }
  return undefined;
};

const runLintArgs = async (runtime: LintCommandRuntime, args: readonly string[]) => {
  const stdout = bufferSink();
  const stderr = bufferSink();
  const definition = createLintCommandDefinition(runtime);
  const exitCode = await runCli(
    ["--json", "lint", ...args],
    { stdout, stderr },
    {
      brand: SYNTHETIC_BRAND,
      clock: { now: () => 1 },
      newRunId: () => "run-lint-surface",
      secrets: [],
      program: { commands: { lint: definition } },
    },
  );
  const text = stdout.value.trim();
  return {
    exitCode,
    envelope: text.length === 0 ? undefined : (JSON.parse(text) as Record<string, unknown>),
  };
};

describe("TC-F5-007 no repair surface exists", () => {
  test("the phase grammar has no repair verb (or any other unknown verb)", async () => {
    const definition = createPhaseCommandDefinition(
      new Proxy({} as never, {
        get: () => () => {
          throw new Error("grammar reached the runtime");
        },
      }),
    );
    expect(definition.flags).toEqual(["--no-commit"]);
    expect(definition.positionals).toEqual({ max: 4 });
    for (const verb of ["repair", "fix", "sync", "reconcile"]) {
      const result = (await definition.handler({
        positionals: [verb, "GH-349", "delivery"],
        flags: {},
      })) as unknown as {
        readonly error?: { readonly code?: unknown; readonly summary?: unknown };
      };
      expect(result.error?.code).toBe("input.value.rejected");
      expect(String(result.error?.summary)).toContain(`unknown phase subcommand "${verb}"`);
    }
  });

  test("the lint command has no --fix flag or write mode", async () => {
    const runtime: LintCommandRuntime = {
      readPmNotes: () => ({ ok: false, reason: "missing" }),
      readRegistry: () => ({
        ok: true,
        verifiedEmpty: true,
        recordCount: 0,
        verification: [],
        projection: { present: false },
      }),
    };
    const definition = createLintCommandDefinition(runtime);
    expect(definition.flags).toEqual(["--pm-notes", "--registry"]);
    const run = await runLintArgs(runtime, ["GH-349", "--fix"]);
    expect(run.exitCode).toBe(1);
    expect((run.envelope?.error as { readonly code?: unknown } | undefined)?.code).toBe(
      "fallback.invocation",
    );
  });

  test("the phase state surface declares no new record kind or document", () => {
    expect(PHASE_TRANSITION_BOUNDARY.kinds).toHaveLength(1);
    expect(PHASE_TRANSITION_BOUNDARY.kinds[0]?.kind).toBe("phase.transition");
    expect(PHASE_TRANSITION_KIND).toBe("phase.transition");
    expect(PHASE_STATE_DOCUMENT_PREFIX).toBe("phase-state.");
    expect(PHASE_STATE_DOCUMENT_SUFFIX).toBe(".json");
    expect([...CANONICAL_PHASE_IDS]).toEqual([
      "clarify_scope",
      "specification",
      "test_planning",
      "delivery_planning",
      "dor_check",
      "delivery",
      "system_spec_update",
      "review_fix",
      "quality_gates",
      "dod_check",
      "pr_creation",
    ]);
  });
});

describe("TC-F5-007 the lint rows keep their codes, order and remediation", () => {
  test("the five delivered identities keep their codes and remediation strings", () => {
    expect([...PM_NOTES_LINT_CODES]).toEqual(Object.keys(DELIVERED_REMEDIATION));
    const rows = lintRows();
    for (const [code, remediation] of Object.entries(DELIVERED_REMEDIATION)) {
      const row = rows.find((entry) => entry.code === code);
      expect(row?.remediationHint, code).toBe(remediation);
    }
  });

  test("the sixth row is appended last with both tables in the declared order", () => {
    expect(PM_NOTES_LINT_CODES).toHaveLength(5);
    expect([...PM_NOTES_LINT_CODES]).not.toContain("lint.phases.divergent");
    const machine = lintRows().map((entry) => entry.code);
    expect(machine).toHaveLength(7);
    expect(machine.slice(-2)).toEqual(["lint.document.unreadable", "lint.phases.divergent"]);
    const documented = documentedOrder();
    expect(documented).toEqual([...DECLARED_ROWS]);
    // The documented and machine orders agree over the six pm-notes identities.
    expect(
      firstMoved(
        [...DECLARED_ROWS],
        machine.filter((code) => DECLARED_ROWS.includes(code as never)),
      ),
    ).toBe(undefined);
    expect(documented.at(-1)).toBe("lint.phases.divergent");
  });

  test("control: a reordered row fails naming the first moved code", () => {
    const reordered = ["lint.keys.missing", "lint.notes.malformed", ...DECLARED_ROWS.slice(2)];
    expect(firstMoved([...DECLARED_ROWS], reordered)).toBe("lint.keys.missing");
    expect(firstMoved([...DECLARED_ROWS], [...DECLARED_ROWS])).toBeUndefined();
  });
});
