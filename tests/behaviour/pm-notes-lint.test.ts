/**
 * TC-LINT-005 / TC-LINT-006 — variant semantics, pinned LITE omissions, and
 * opaque-key acceptance at rule level.
 *
 * LITE omission fixtures are derived from the committed lite-six control so each
 * case omits exactly one pinned phase; the same test restores it. Opaque extras
 * are proven never inspected while the same shapes on applicable entries fail.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRegistryLintReader } from "../../packages/cli/src/edge";
import { LITE_REQUIRED_PHASES } from "../../packages/core/src/contracts/index";
import { lintPmNotes } from "../../packages/core/src/domain/pm-notes-lint";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";
import {
  emptyRegistry,
  runLint,
  runtimeForFixture,
  runtimeWithoutTarget,
} from "./pm-notes-lint-command-support";
import { documentOf, entryOf, loadPmNotes, mutated, parsePmNotes } from "./pm-notes-lint-support";

const CANARY = "planted-payload-variant-0002";
const LITE = loadPmNotes("valid/lite-six.yaml");
const FULL = loadPmNotes("valid/full-complete.yaml");

const failureOf = (value: Parameters<typeof lintPmNotes>[0]) => {
  const verdict = lintPmNotes(value);
  if (verdict.ok) throw new Error("expected a finding");
  return verdict.finding;
};

describe("TC-LINT-005 LITE required-phase omissions", () => {
  for (const phase of LITE_REQUIRED_PHASES) {
    test(`omitting ${phase} fails lint.phases.incomplete naming exactly it`, () => {
      const finding = failureOf(
        mutated(LITE, CANARY, (document) => {
          const phases = document.phases as Record<string, unknown>;
          delete phases[phase];
        }),
      );
      expect(finding.code).toBe("lint.phases.incomplete");
      expect(finding.offenders).toEqual([phase]);
      expect(JSON.stringify(finding)).not.toContain(CANARY);
    });
  }

  test("restoring each omitted phase passes (restored control)", () => {
    for (const phase of LITE_REQUIRED_PHASES) {
      const document = documentOf(LITE);
      const phases = { ...(document.phases as Record<string, unknown>) };
      phases[phase] = { started: null, completed: null };
      expect(lintPmNotes({ ok: true, value: { ...document, phases } })).toEqual({
        ok: true,
        variant: "lite",
      });
    }
  });

  test("the all-six control passes and non-required phases are not required", () => {
    expect(lintPmNotes(LITE)).toEqual({ ok: true, variant: "lite" });
    const withOpaque = mutated(LITE, CANARY, (document) => {
      (document.phases as Record<string, unknown>).test_planning = "plain string";
    });
    expect(lintPmNotes(withOpaque)).toEqual({ ok: true, variant: "lite" });
  });

  test("a two-phase omission names both missing phases", () => {
    const finding = failureOf(
      mutated(LITE, CANARY, (document) => {
        const phases = document.phases as Record<string, unknown>;
        delete phases.dod_check;
        delete phases.pr_creation;
      }),
    );
    expect(finding.code).toBe("lint.phases.incomplete");
    expect(finding.offenders.sort()).toEqual(["dod_check", "pr_creation"]);
  });
});

describe("TC-LINT-006 variant semantics and opaque keys", () => {
  test("absent variant means full: omitting a canonical phase fails", () => {
    const finding = failureOf(
      mutated(FULL, CANARY, (document) => {
        delete (document.phases as Record<string, unknown>).test_planning;
      }),
    );
    expect(finding.code).toBe("lint.phases.incomplete");
    expect(finding.offenders).toEqual(["test_planning"]);
  });

  test("explicit full requires the canonical eleven", () => {
    const finding = failureOf(
      mutated(FULL, CANARY, (document) => {
        document.variant = "full";
        delete (document.phases as Record<string, unknown>).review_fix;
      }),
    );
    expect(finding.code).toBe("lint.phases.incomplete");
    expect(finding.offenders).toEqual(["review_fix"]);
  });

  test("declaring lite while keeping only the six control passes", () => {
    expect(lintPmNotes(LITE)).toEqual({ ok: true, variant: "lite" });
  });

  test("opaque extra entries, extra top-level keys, and non-canonical phases pass", () => {
    expect(lintPmNotes(loadPmNotes("valid/full-with-opaque-extras.yaml"))).toEqual({
      ok: true,
      variant: "full",
    });
    expect(lintPmNotes(loadPmNotes("opaque/non-canonical-phase.yaml"))).toEqual({
      ok: true,
      variant: "full",
    });
  });

  test("opaque phase keys are never inspected, even with entry-like shapes", () => {
    const opaque = mutated(FULL, CANARY, (document) => {
      (document.phases as Record<string, unknown>).ci_remediation = {
        started: 42,
        completed: {},
        reason: ["not", "inspected"],
      };
    });
    expect(lintPmNotes(opaque)).toEqual({ ok: true, variant: "full" });
  });

  test("the same missing/typed defects on an applicable entry still fail", () => {
    const missing = failureOf(
      mutated(FULL, CANARY, (document) => {
        delete entryOf(document, "review_fix").started;
      }),
    );
    expect(missing.code).toBe("lint.keys.missing");
    expect(missing.offenders).toEqual(["review_fix.started"]);

    const wrongType = failureOf(
      mutated(FULL, CANARY, (document) => {
        entryOf(document, "review_fix").completed = 42;
      }),
    );
    expect(wrongType.code).toBe("lint.notes.malformed");
    expect(wrongType.offenders).toEqual(["review_fix.completed"]);
  });

  test("the committed GH-170 pm-notes passes as the real opaque-extra control", () => {
    const path = join(
      process.cwd(),
      "doc/changes/2026-10/2026-10-29--GH-170--monorepo-scaffold-toolchain/chg-GH-170-pm-notes.yaml",
    );
    expect(lintPmNotes(parsePmNotes(readFileSync(path, "utf8"), path))).toEqual({
      ok: true,
      variant: "full",
    });
  });

  test("GH-179's own pm-notes conforms (A-T8 corpus membership)", () => {
    const path = join(
      process.cwd(),
      "doc/changes/2026-10/2026-10-31--GH-179--pm-notes-registry-lint-phase-transitions/chg-GH-179-pm-notes.yaml",
    );
    expect(lintPmNotes(parsePmNotes(readFileSync(path, "utf8"), path))).toEqual({
      ok: true,
      variant: "full",
    });
  });
});

const withStore = (
  label: string,
  body: (context: {
    readonly root: string;
    readonly reader: ReturnType<typeof createRegistryLintReader>;
    readonly ledger: string;
    readonly torn: () => void;
  }) => Promise<void>,
): Promise<void> => {
  const root = makeTempRoot(label);
  const identity = makeIdentity(root);
  const { store } = openStore(identity);
  const acquired = store.acquireFence("lint-fixture");
  if (!acquired.ok) throw new Error("fence acquisition failed");
  const appended = store.append(acquired.value.handle, {
    kind: "phase.transition",
    recordKey: "GH-179:clarify_scope",
    payload: {
      changeRef: "GH-179",
      phaseId: "clarify_scope",
      operation: "complete",
      timestamp: "2026-10-31T00:00:00Z",
      outcome: "landed",
    },
  });
  if (!appended.ok) throw new Error("append failed");
  store.releaseFence(acquired.value.handle);
  const path = ledgerPath(identity);
  return body({
    root,
    reader: createRegistryLintReader(store),
    ledger: path,
    torn: () => {
      const text = readFileSync(path, "utf8");
      writeFileSync(path, text.replace('"sequence":1', '"sequence":9'));
    },
  }).finally(() => removeRoot(root));
};

describe("TC-LINT-004 target resolution", () => {
  test("missing pm-notes is the only target-resolution failure", async () => {
    const fixture = runtimeWithoutTarget();
    try {
      const run = await runLint(fixture.runtime, ["GH-179"]);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "lint.target.missing" });
    } finally {
      fixture.cleanup();
    }
  });

  test("an absent registry is an explicit verified-empty pass, distinct from target.missing", async () => {
    const root = makeTempRoot("gh179-lint-absent");
    try {
      const identity = makeIdentity(`${root}/absent`);
      const { store } = openStore(identity);
      const fixture = runtimeForFixture(
        "valid/full-complete.yaml",
        createRegistryLintReader(store),
      );
      try {
        const run = await runLint(fixture.runtime, ["GH-179", "--registry"]);
        expect(run.exitCode).toBe(0);
        expect(run.envelope?.error).toBeUndefined();
        expect(run.envelope?.data).toMatchObject({
          target: "registry",
          evidence: { class: "verified-empty", target: "registry" },
        });
      } finally {
        fixture.cleanup();
      }
    } finally {
      removeRoot(root);
    }
  });

  test("a present-but-torn registry is a classified storage failure, never empty", async () => {
    await withStore("gh179-lint-torn", async ({ reader, torn }) => {
      torn();
      const fixture = runtimeForFixture("valid/full-complete.yaml", reader);
      try {
        const run = await runLint(fixture.runtime, ["GH-179", "--registry"]);
        expect(run.exitCode).toBe(2);
        expect(run.envelope?.error).toMatchObject({ code: "state.store.torn" });
        expect(run.envelope?.error).not.toMatchObject({ code: "lint.target.missing" });
        expect(run.envelope?.data).toBeUndefined();
      } finally {
        fixture.cleanup();
      }
    });
  });

  test("valid pm-notes plus a valid registry passes in both mode", async () => {
    await withStore("gh179-lint-valid", async ({ reader, ledger }) => {
      const before = readFileSync(ledger, "utf8");
      const fixture = runtimeForFixture("valid/full-complete.yaml", reader);
      try {
        const run = await runLint(fixture.runtime, ["GH-179", "--pm-notes", "--registry"]);
        expect(run.exitCode).toBe(0);
        const data = run.envelope?.data as { targets?: unknown[] } | undefined;
        expect(data?.targets).toHaveLength(2);
      } finally {
        fixture.cleanup();
      }
      expect(readFileSync(ledger, "utf8")).toBe(before);
    });
  });

  test("both-mode failures report pm-notes first (PIN-1 order)", async () => {
    await withStore("gh179-lint-order", async ({ reader, torn }) => {
      torn();
      const fixture = runtimeForFixture(
        "malformed/unparseable-orphaned-indentation.yaml.txt",
        reader,
      );
      try {
        const run = await runLint(fixture.runtime, ["GH-179", "--pm-notes", "--registry"]);
        expect(run.exitCode).toBe(1);
        expect(run.envelope?.error).toMatchObject({ code: "lint.notes.malformed" });
      } finally {
        fixture.cleanup();
      }
    });
  });
});

describe("TC-LINT-010 lint envelope and exit projection", () => {
  test("success is one valid envelope with exit 0 in json mode", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    try {
      const run = await runLint(fixture.runtime, ["GH-179"]);
      expect(run.exitCode).toBe(0);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      expect(run.envelope?.data).toMatchObject({
        target: "pm-notes",
        variant: "full",
        evidence: { class: "conforms" },
      });
    } finally {
      fixture.cleanup();
    }
  });

  test("an unknown flag stays on fallback.invocation with exit 1", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    try {
      const run = await runLint(fixture.runtime, ["GH-179", "--unknown"]);
      expect(run.exitCode).toBe(1);
      expect(assertEnvelopeContract(run.envelope)).toEqual([]);
      expect(run.envelope?.error).toMatchObject({ code: "fallback.invocation" });
    } finally {
      fixture.cleanup();
    }
  });

  test("human success writes output and no diagnostic; failure writes only the error stream", async () => {
    const success = runtimeForFixture("valid/full-complete.yaml");
    try {
      const run = await runLint(success.runtime, ["GH-179"], { json: false });
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toContain("pm-notes");
      expect(run.stderr).toBe("");
    } finally {
      success.cleanup();
    }
    const failure = runtimeForFixture("malformed/unparseable-orphaned-indentation.yaml.txt");
    try {
      const run = await runLint(failure.runtime, ["GH-179"], { json: false });
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toBe("");
      expect(run.stderr).toContain("lint.notes.malformed");
    } finally {
      failure.cleanup();
    }
  });

  test("a missing positional ref is a user validation failure, not a crash", async () => {
    const fixture = runtimeForFixture("valid/full-complete.yaml");
    try {
      const run = await runLint(fixture.runtime, []);
      expect(run.exitCode).toBe(1);
      expect(run.envelope?.error).toMatchObject({ code: "input.value.rejected" });
    } finally {
      fixture.cleanup();
    }
  });

  test("the registry verified evidence includes count and no projection", async () => {
    await withStore("gh179-lint-evidence", async ({ reader }) => {
      const fixture = runtimeForFixture("valid/full-complete.yaml", reader);
      try {
        const run = await runLint(fixture.runtime, ["GH-179", "--registry"]);
        expect(run.exitCode).toBe(0);
        expect(run.envelope?.data).toMatchObject({
          evidence: {
            class: "verified",
            recordCount: 1,
            projection: { present: false },
          },
        });
      } finally {
        fixture.cleanup();
      }
    });
  });

  test("unused empty registry helper remains the default control", () => {
    expect(emptyRegistry()).toMatchObject({ ok: true, verifiedEmpty: true, recordCount: 0 });
  });
});
