/**
 * TC-VERIFY-007..009 and TC-VERIFY-011 — malformed pm-notes classes, unknown
 * variants, missing targets, and grammar failures each resolve to exactly one
 * pinned identity before any registry read, with no crash and no canary leak.
 */
import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { stringify } from "yaml";
import { ERROR_TABLE, type ErrorTableEntry } from "../../packages/core/src/contracts/index";
import { classifyVerifyDocument } from "../../packages/core/src/domain/index";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  createVerifyHarness,
  createVerifyState,
  fullBase,
  liteCompleteAbsent,
  ROOT,
  VERIFY_REF,
  type VerifyRun,
} from "./verify-support";

const CANARY = "planted-payload-verify-";
const MALFORMED_ROOT = join(ROOT, "tests/fixtures/verify/malformed");
const FAILED_PREFIX = "result=failed; variant=unknown; missing=-";

const entryFor = (code: string): ErrorTableEntry =>
  (ERROR_TABLE as readonly ErrorTableEntry[]).find(
    (entry) => entry.code === code,
  ) as ErrorTableEntry;

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

const expectPinnedFailure = (
  run: VerifyRun,
  code: string,
  options: { readonly detail: "optional" | "absent" } = { detail: "optional" },
): void => {
  expect(run.exitCode).toBe(1);
  expect(assertEnvelopeContract(run.envelope)).toEqual([]);
  const envelope = envelopeOf(run);
  expect(Object.hasOwn(envelope, "data")).toBe(false);
  const error = errorOf(run);
  expect(error.code).toBe(code);
  const row = entryFor(code);
  expect(error.category).toBe(row.category);
  expect(error.retryable).toBe(row.retryable);
  expect(error.consequence).toBe(row.consequence);
  const summary = String(error.summary);
  expect(summary.startsWith(FAILED_PREFIX), summary).toBe(true);
  const detail = summary.slice(FAILED_PREFIX.length);
  if (options.detail === "absent") {
    expect(detail).toBe("");
  } else if (detail.length > 0) {
    expect(detail.startsWith("; detail=")).toBe(true);
    expect(detail).toContain("(at ");
    expect(detail).not.toContain(CANARY);
    expect(detail).not.toContain("\n");
  }
  expect(run.stdout).not.toContain(CANARY);
  expect(run.stderr).not.toContain(CANARY);
};

type MalformedRun = { readonly run: VerifyRun; readonly calls: readonly string[] };

const runMalformedCase = async (caseName: string): Promise<MalformedRun> => {
  const state = createVerifyState();
  const harness = createVerifyHarness({
    changesDirectory: join(MALFORMED_ROOT, caseName),
    state,
  });
  try {
    const run = await harness.run(["change", VERIFY_REF]);
    return { run, calls: [...harness.recorder.calls] };
  } finally {
    harness.cleanup();
    state.cleanup();
  }
};

const runText = async (
  text: string,
  args: readonly string[] = ["change", VERIFY_REF],
): Promise<MalformedRun> => {
  const state = createVerifyState();
  const harness = createVerifyHarness({ targetText: text, state });
  try {
    const run = await harness.run(args);
    return { run, calls: [...harness.recorder.calls] };
  } finally {
    harness.cleanup();
    state.cleanup();
  }
};

const derived = (
  base: Record<string, unknown>,
  mutate: (document: Record<string, unknown>) => void,
): string => {
  const document = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  mutate(document);
  return stringify(document);
};

describe("TC-VERIFY-007 malformed pm-notes classes", () => {
  const cases: Array<[string, string]> = [
    ["unparseable", "lint.notes.malformed"],
    ["missing-change-id", "lint.keys.missing"],
    ["missing-title", "lint.keys.missing"],
    ["missing-delivery-mode", "lint.keys.missing"],
    ["missing-phases", "lint.keys.missing"],
    ["missing-entry-started", "lint.keys.missing"],
    ["missing-entry-completed", "lint.keys.missing"],
    ["missing-collection-text", "lint.keys.missing"],
    ["wrong-typed-change-id", "lint.notes.malformed"],
    ["wrong-typed-title", "lint.notes.malformed"],
    ["wrong-typed-phases", "lint.notes.malformed"],
    ["wrong-typed-variant", "lint.notes.malformed"],
    ["wrong-typed-notes", "lint.notes.malformed"],
    ["non-timestamp-started", "lint.notes.malformed"],
    ["non-timestamp-completed", "lint.notes.malformed"],
  ];

  test("each committed malformed class resolves to exactly one pinned identity", async () => {
    for (const [caseName, code] of cases) {
      const { run, calls } = await runMalformedCase(caseName);
      expectPinnedFailure(run, code);
      expect(calls).not.toContain("readRegistry");
      expect(calls.filter((call) => call === "readPmNotes")).toHaveLength(1);
    }
  });

  test("co-occurrence fixtures follow keys -> value types -> variant -> phases", async () => {
    const keysFirst = derived(fullBase(), (document) => {
      delete document.title;
      document.change_id = 42;
    });
    const keys = await runText(keysFirst);
    expectPinnedFailure(keys.run, "lint.keys.missing");

    const entryKeyFirst = derived(fullBase(), (document) => {
      const phases = document.phases as Record<string, Record<string, unknown>>;
      delete phases.dor_check?.completed;
      document.title = [1, 2, 3];
    });
    const entryKey = await runText(entryKeyFirst);
    expectPinnedFailure(entryKey.run, "lint.keys.missing");

    const valueTypeFirst = derived(fullBase(), (document) => {
      document.change_id = 42;
      document.variant = "compressed";
    });
    const valueType = await runText(valueTypeFirst);
    expectPinnedFailure(valueType.run, "lint.notes.malformed");

    const variantFirst = derived(fullBase(), (document) => {
      document.variant = "compressed";
      const phases = document.phases as Record<string, unknown>;
      delete phases.dor_check;
    });
    const variant = await runText(variantFirst);
    expectPinnedFailure(variant.run, "lint.variant.unknown", { detail: "absent" });
  });

  test("a valid full document is the control and no class is fallback.internal", async () => {
    const control = await runText(stringify(fullBase()));
    expect(control.run.exitCode).toBe(0);
    for (const [caseName] of cases) {
      const { run } = await runMalformedCase(caseName);
      expect(errorOf(run).code).not.toBe("fallback.internal");
    }
  });
});

describe("TC-VERIFY-008 unknown variant before any registry read", () => {
  const unknownCases = [
    "unknown-variant-compressed",
    "unknown-variant-upper",
    "unknown-variant-spaced",
    "unknown-variant-fullish",
    "unknown-variant-empty",
  ];

  test("every unknown string is lint.variant.unknown with the exact summary", async () => {
    for (const caseName of unknownCases) {
      const { run, calls } = await runMalformedCase(caseName);
      expectPinnedFailure(run, "lint.variant.unknown", { detail: "absent" });
      expect(errorOf(run).summary).toBe(FAILED_PREFIX);
      expect(calls).not.toContain("readRegistry");
    }
  });

  test("wrong-typed variants stay in the value-type class", async () => {
    for (const caseName of ["wrong-typed-variant", "wrong-variant-array", "wrong-variant-map"]) {
      const { run } = await runMalformedCase(caseName);
      expectPinnedFailure(run, "lint.notes.malformed");
      expect(errorOf(run).code).not.toBe("lint.variant.unknown");
    }
  });

  test("lite, full, and absent-variant controls never produce the unknown code", async () => {
    for (const document of [fullBase(), liteCompleteAbsent()]) {
      const { run } = await runText(stringify(document));
      expect(run.exitCode).toBe(0);
      expect(run.stdout).not.toContain("lint.variant.unknown");
    }
    const absentVariant = fullBase();
    delete absentVariant.variant;
    const { run } = await runText(stringify(absentVariant));
    expect(run.exitCode).toBe(0);
  });
});

describe("TC-VERIFY-009 missing target before any registry read", () => {
  test("an absent target is lint.target.missing with the pinned summary", async () => {
    const state = createVerifyState();
    const harness = createVerifyHarness({ omitTarget: true, state });
    try {
      const run = await harness.run(["change", VERIFY_REF]);
      expectPinnedFailure(run, "lint.target.missing", { detail: "absent" });
      expect(errorOf(run).summary).toBe(FAILED_PREFIX);
      expect(harness.recorder.calls).toEqual(["readPmNotes"]);
    } finally {
      harness.cleanup();
      state.cleanup();
    }
  });

  test("refs outside the prefix shape are target missing, not a new identity", async () => {
    for (const ref of ["not-a-ref", "gh-177", "GH177"]) {
      const { run } = await runText(stringify(fullBase()), ["change", ref]);
      expectPinnedFailure(run, "lint.target.missing", { detail: "absent" });
      expect(errorOf(run).summary).toBe(FAILED_PREFIX);
    }
  });

  test("present and malformed present targets are unaffected", async () => {
    const present = await runText(stringify(fullBase()));
    expect(present.run.exitCode).toBe(0);
    expect(present.calls).toContain("readRegistry");
    const malformed = await runMalformedCase("unparseable");
    expectPinnedFailure(malformed.run, "lint.notes.malformed");
    expect(errorOf(malformed.run).code).not.toBe("lint.target.missing");
  });
});

describe("TC-VERIFY-011 grammar fails before any read", () => {
  test("handler grammar rejects with input.value.rejected and zero reads", async () => {
    const cases: string[][] = [[], ["change"], ["other", VERIFY_REF], ["unknown", VERIFY_REF]];
    for (const args of cases) {
      const { run, calls } = await runText(stringify(fullBase()), args);
      expect(run.exitCode).toBe(1);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      const error = errorOf(run);
      expect(error.code).toBe("input.value.rejected");
      expect(error.summary).toBe(FAILED_PREFIX);
      expect(calls).toEqual([]);
      expect(run.exitCode).not.toBe(0);
      expect(error.code).not.toBe("fallback.internal");
    }
  });

  test("parser-level cases reject with fallback.invocation and zero reads", async () => {
    const cases: string[][] = [
      ["change", VERIFY_REF, "extra"],
      ["change", VERIFY_REF, "--verify-gates"],
      ["--verify-gates", "change", VERIFY_REF],
    ];
    for (const args of cases) {
      const { run, calls } = await runText(stringify(fullBase()), args);
      expect(run.exitCode).toBe(1);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      const error = errorOf(run);
      expect(error.code).toBe("fallback.invocation");
      expect(Object.hasOwn(envelopeOf(run), "data")).toBe(false);
      expect(calls).toEqual([]);
      expect(run.exitCode).not.toBe(0);
    }
  });

  test("valid invocations are unaffected and the recorder is live", async () => {
    const { run, calls } = await runText(stringify(fullBase()));
    expect(run.exitCode).toBe(0);
    expect(calls).toContain("readPmNotes");
    expect(calls).toContain("readRegistry");
    const jsonBefore = await runText(stringify(fullBase()), ["change", VERIFY_REF]);
    expect(jsonBefore.run.exitCode).toBe(0);
  });
});

describe("TC-VERIFY-007 ordering oracle at the pure seam", () => {
  test("the document classifier returns the same first-family identity", () => {
    const document = JSON.parse(JSON.stringify(fullBase())) as Record<string, unknown>;
    delete document.title;
    document.change_id = 42;
    const verdict = classifyVerifyDocument({ ok: true, value: document });
    expect(verdict.ok).toBe(false);
    if (!verdict.ok) expect(verdict.code).toBe("lint.keys.missing");
  });
});
