/**
 * GH-289 TC-ATTEMPT-017 — taxonomy closure: the registry stays at 124 identities
 * with exactly four `dispatch` rows, and no `attempts.*` identity exists in the
 * code, the help surface, the result-contract page, or the rendered output.
 *
 * The string scan looks for a quoted attempts-code literal and for the three
 * proposed identities by name; a member access such as `data.attempts.length`
 * is a declared field reference, not an error identity.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";

const ROOT = process.cwd();

/** The proposed identities the spec retired; none may exist anywhere. */
const PROPOSED_IDENTITIES = [
  "attempts.ref-unknown",
  "attempts.limit-invalid",
  "attempts.ledger-unavailable",
] as const;

/** The quoted-literal shape of an `attempts.*` error code. */
const QUOTED_CODE = /["'`]attempts\.[a-z][a-z-]*["'`]/u;

/**
 * The scan targets: the code and help surfaces plus the two reconciled spec
 * pages, added here once they state the delivered behaviour.
 */
const SCAN_TARGETS = [
  "packages/core/src/contracts/dispatch.ts",
  "packages/core/src/domain/dispatch-attempts.ts",
  "packages/core/src/app/dispatch-attempts.ts",
  "packages/cli/src/commands/dispatch.ts",
  "packages/cli/src/output/dispatch-text.ts",
  "packages/cli/src/help.ts",
  "doc/spec/features/feature-result-contract.md",
  "doc/spec/features/feature-dispatch-engine.md",
] as const;

describe("TC-ATTEMPT-017 taxonomy closure", () => {
  test("the registry holds exactly 124 identities and four dispatch rows", () => {
    const entries = ERROR_TABLE as readonly ErrorTableEntry[];
    expect(entries).toHaveLength(124);
    expect(entries.filter((entry) => entry.domainKind === "dispatch")).toHaveLength(4);
    expect(entries.some((entry) => entry.code.startsWith("attempts."))).toBe(false);
  });

  test("no attempts identity string exists in the code, help or contract page", () => {
    const failures: string[] = [];
    for (const target of SCAN_TARGETS) {
      const text = readFileSync(join(ROOT, target), "utf8");
      for (const identity of PROPOSED_IDENTITIES) {
        if (text.includes(identity)) failures.push(`${target}: ${identity}`);
      }
      if (QUOTED_CODE.test(text)) failures.push(`${target}: quoted attempts.* code`);
    }
    expect(failures).toEqual([]);
  });

  test("the rendered output carries no attempts identity", async () => {
    const harness = createAttemptsHarness({ label: "taxonomy", records: ledgerOf(2) });
    try {
      const text = await harness.invoke(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      const machine = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      for (const output of [text.stdout + text.stderr, machine.stdout + machine.stderr]) {
        expect(output).not.toMatch(/attempts\.[a-z]/u);
      }
    } finally {
      harness.dispose();
    }
  });
});
