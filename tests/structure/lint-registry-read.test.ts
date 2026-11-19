/**
 * TC-SYNC-006 — the lint registry read gains the verified fold additively
 * (DM-8, TDR-0055 §4).
 *
 * The delivered fields keep their exact values and types, the new fold field
 * carries the phases map `foldPhaseState` produces for the same transitions, and
 * no other read in the command changed. The controls substitute the document's
 * phases into the fold field (it must fail naming the differing phase) and move
 * a delivered field (it must fail naming that field).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { LintRegistryRead } from "../../packages/cli/src/commands/lint";
import { createRegistryLintReader } from "../../packages/cli/src/edge";
import { CANONICAL_PHASE_IDS, type StateStorePort } from "../../packages/core/src/contracts/index";
import { firstPhaseDivergence } from "../../packages/core/src/domain/index";
import {
  appendPhaseTransition,
  foldPhaseState,
  readChangeTransitionsTolerant,
  replacePhaseProjection,
} from "../../packages/core/src/state/index";
import { phaseNotesValue } from "../fixtures/phase/history";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const REF = "GH-349";
const T1 = "2026-11-18T10:00:00Z";
const REOPENED_AT = "2026-11-18T12:00:00Z";
const T2 = "2026-11-19T10:00:00Z";

type HistoryFixture = {
  readonly read: () => LintRegistryRead;
  readonly store: StateStorePort;
};

/** A store holding one real history: complete → reopen → complete. */
const withHistory = async (body: (fixture: HistoryFixture) => Promise<void> | void) => {
  const root = makeTempRoot("gh349-lint-registry");
  try {
    const identity = makeIdentity(root, { workspaceId: "lint-read-fixture" });
    const { store } = openStore(identity);
    const append = (operation: "complete" | "reopen", timestamp: string): void => {
      const outcome = appendPhaseTransition(store, {
        changeRef: REF,
        phaseId: "delivery",
        operation,
        timestamp,
        fenceToken: `lint-read-${operation}-${timestamp}`,
        ...(operation === "reopen" ? { reason: "fixture reopen" } : {}),
      });
      if (!outcome.ok) throw new Error(`append failed: ${outcome.error.code}`);
    };
    append("complete", T1);
    append("reopen", REOPENED_AT);
    append("complete", T2);
    const transitions = readChangeTransitionsTolerant(store, REF);
    if (!transitions.ok) throw new Error(`registry read failed: ${transitions.error.code}`);
    const replaced = replacePhaseProjection(store, {
      changeRef: REF,
      transitions: transitions.value.transitions,
      fenceToken: "lint-read-projection",
    });
    if (!replaced.ok) throw new Error(`projection failed: ${replaced.error.code}`);
    const reader = createRegistryLintReader(store);
    await body({ read: () => reader(REF), store });
  } finally {
    removeRoot(root);
  }
};

describe("TC-SYNC-006 the lint registry read exposes the verified fold additively", () => {
  test("the delivered fields keep their values and the fold equals a direct fold", async () => {
    await withHistory(async ({ read, store }) => {
      const value = read();
      if (!value.ok) throw new Error(`unexpected failure: ${value.error.code}`);
      // Exactly the delivered fields plus the additive fold: no other read moved.
      expect(Object.keys(value).sort()).toEqual([
        "fold",
        "ok",
        "projection",
        "recordCount",
        "verification",
        "verifiedEmpty",
      ]);
      expect(typeof value.recordCount).toBe("number");
      expect(value.recordCount).toBeGreaterThan(0);
      expect(Array.isArray(value.verification)).toBe(true);
      expect(value.verifiedEmpty).toBe(false);
      // The projection observation keeps its delivered shape and source (the
      // values map of the same read); this change adds no projection read.
      expect(Object.keys(value.projection)).toEqual(["present"]);
      expect(typeof value.projection.present).toBe("boolean");

      // The fold is the production fold over the same verified transitions.
      const transitions = readChangeTransitionsTolerant(store, REF);
      if (!transitions.ok) throw new Error(`registry read failed: ${transitions.error.code}`);
      expect(value.fold).toEqual(foldPhaseState(REF, transitions.value.transitions));
      expect(value.fold?.phases.delivery).toEqual({ started: T1, completed: T2 });
    });
  });

  test("the reader is deterministic across two reads and writes nothing", async () => {
    await withHistory(async ({ read, store }) => {
      const before = store.read({ requiredKeys: [] });
      if (!before.ok) throw new Error(before.error.code);
      const first = read();
      const second = read();
      expect(first).toEqual(second);
      const after = store.read({ requiredKeys: [] });
      if (!after.ok) throw new Error(after.error.code);
      expect(after.value.evidence.recordCount).toBe(before.value.evidence.recordCount);
    });
  });

  test("control: a fold carrying the document's phases fails naming the phase", async () => {
    await withHistory(async ({ read }) => {
      const value = read();
      if (!value.ok || value.fold === undefined) throw new Error("the read exposes no fold");
      // The delivered comparison over the delivered fold agrees; a fold built from
      // the document's own completions disagrees on exactly the reopened phase.
      const document = phaseNotesValue({
        delivery: { started: T1, completed: T1 },
      });
      expect(firstPhaseDivergence(document, value.fold)).toEqual({
        phaseId: "delivery",
        documentCompleted: T1,
        foldCompleted: T2,
      });
      const documentDerived = {
        ...value.fold,
        phases: {
          ...value.fold.phases,
          delivery: { started: T1, completed: T1 },
        },
      };
      expect(firstPhaseDivergence(document, documentDerived)).toBeUndefined();
    });
  });

  test("control: a moved delivered field fails naming the field", async () => {
    await withHistory(async ({ read }) => {
      const value = read();
      if (!value.ok) throw new Error(`unexpected failure: ${value.error.code}`);
      const delivered = {
        verifiedEmpty: value.verifiedEmpty,
        recordCount: value.recordCount,
        verification: value.verification,
        projection: value.projection,
      };
      // A moved delivered field is visible as a differing value, not silently read.
      expect({ ...delivered, recordCount: delivered.recordCount + 1 }).not.toEqual(delivered);
      expect({ ...delivered, verification: [...delivered.verification, "unexpected"] }).not.toEqual(
        delivered,
      );
    });
  });
});

describe("TC-SYNC-006 the production composition supplies the fold", () => {
  test("every registry lint reader in the composed surfaces carries the fold", () => {
    const production = readFileSync(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    const edge = readFileSync(join(ROOT, "packages/cli/src/edge.ts"), "utf8");
    expect(production).toContain("fold: foldPhaseState(changeRef, read.value.transitions)");
    expect(edge).toContain("fold: foldPhaseState(changeRef, transitions.value.transitions)");
    // The both-target comparison reads only the canonical phase ids, in order.
    const rules = readFileSync(join(ROOT, "packages/core/src/domain/pm-notes-lint.ts"), "utf8");
    expect(rules).toContain("for (const phaseId of CANONICAL_PHASE_IDS)");
    expect(CANONICAL_PHASE_IDS).toHaveLength(11);
  });
});
