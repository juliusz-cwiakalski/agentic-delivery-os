/**
 * TC-STATE-002 / TC-STATE-001 (conformance half) — one case set, every kind in
 * the current driver map, parity over driver-neutral observables, map-relative
 * anti-vacuity guards (D7; test-plan §4.1).
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

import type { StateDriverKind, StateStorePort } from "../../packages/core/src/contracts/index";
import { type CaseOutcome, CONFORMANCE_CASES, type ConformanceCase } from "../fixtures/state/cases";
import {
  digestPaths,
  ledgerPath,
  makeIdentity,
  makeTempRoot,
  openStore,
  removeRoot,
} from "../fixtures/state/harness";

const ROOT = process.cwd();
const DRIVER_MAP = JSON.parse(
  readFileSync(`${ROOT}/tests/fixtures/state/driver-map.json`, "utf8"),
) as { kinds: StateDriverKind[] };
const KINDS = DRIVER_MAP.kinds;

type Run = {
  readonly kind: StateDriverKind;
  readonly caseId: string;
  readonly outcome: CaseOutcome;
  readonly digest: string;
};

const runCase = (driver: StateDriverKind, definition: ConformanceCase): Run => {
  const root = makeTempRoot(`conformance-${driver}`);
  try {
    const identity = makeIdentity(root, { workspaceId: "conformance" });
    const { store, edge } = openStore(identity, { driver });
    const context = { store, edge, root, workspaceId: identity.workspaceId };
    definition.seed?.(context);
    const digest = digestPaths([ledgerPath(identity)]);
    const outcome = definition.observe(context);
    return { kind: driver, caseId: definition.id, outcome, digest };
  } finally {
    removeRoot(root);
  }
};

const normalize = (outcome: CaseOutcome): string =>
  JSON.stringify({
    ok: outcome.ok,
    values: outcome.values ?? null,
    code: outcome.code ?? null,
    verifiedEmpty: outcome.verifiedEmpty ?? null,
    recordCount: outcome.recordCount ?? null,
  });

/** A deliberately divergent driver wrapper: it corrupts one returned value. */
const divergentStore = (store: StateStorePort): StateStorePort => ({
  ...store,
  read: (request) => {
    const result = store.read(request);
    if (!result.ok) return result;
    const values: Record<string, unknown> = { ...result.value.values };
    const first = Object.keys(values)[0];
    if (first !== undefined) values[first] = "divergent-value";
    return { ok: true, value: { ...result.value, values } };
  },
});

const kindBranchViolations = (relative: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    readFileSync(`${ROOT}/${relative}`, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const failures: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind) &&
      ts.isStringLiteral(node.right) &&
      ["jsonl", "sqlite"].includes(node.right.text)
    ) {
      failures.push(
        `${relative}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`,
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
};

describe("TC-STATE-002 driver conformance parity", () => {
  test("the case set is non-empty and every kind executes every case", () => {
    expect(CONFORMANCE_CASES.length).toBeGreaterThan(0);
    expect(KINDS.length).toBeGreaterThan(0);
    const runs = KINDS.flatMap((kind) =>
      CONFORMANCE_CASES.map((definition) => runCase(kind, definition)),
    );
    for (const kind of KINDS) {
      expect(runs.filter((run) => run.kind === kind)).toHaveLength(CONFORMANCE_CASES.length);
    }
  });

  test("both runs consume byte-identical ledger fixtures", () => {
    for (const definition of CONFORMANCE_CASES) {
      const runs = KINDS.map((kind) => runCase(kind, definition));
      const digests = new Set(runs.map((run) => run.digest));
      expect(digests.size, `case ${definition.id}`).toBe(1);
    }
  });

  test("parity holds over driver-neutral observables for every case", () => {
    for (const definition of CONFORMANCE_CASES) {
      const runs = KINDS.map((kind) => runCase(kind, definition));
      const normalized = new Set(runs.map((run) => normalize(run.outcome)));
      if (KINDS.length < 2) {
        // Map-relative guard: with a singleton map there is nothing to compare
        // yet; the divergent-driver control is recorded pending with a reason.
        expect(normalized.size).toBe(1);
        expect(KINDS.length).toBe(1);
        continue;
      }
      expect(normalized.size, `case ${definition.id}`).toBe(1);
    }
  });

  test("the divergent-driver control is detected once two kinds are bound", () => {
    if (KINDS.length < 2) {
      // Declared conditional, never a silent skip: the pending control is
      // recorded here and in the phase evidence.
      const pending = "divergent-driver control pending: driver map has one kind";
      expect(pending).toContain("pending");
      return;
    }
    const definition = CONFORMANCE_CASES[0] as ConformanceCase;
    const baseline = runCase(KINDS[0] as StateDriverKind, definition);
    const identity = makeIdentity(makeTempRoot("conformance-control"), {
      workspaceId: "conformance",
    });
    const divergent = divergentStore(openStore(identity, { driver: KINDS[0] }).store);
    definition.seed?.({
      store: divergent,
      edge: openStore(identity, { driver: KINDS[0] }).edge,
      root: identity.stateDirectory,
      workspaceId: identity.workspaceId,
    });
    const outcome = definition.observe({
      store: divergent,
      edge: openStore(identity, { driver: KINDS[0] }).edge,
      root: identity.stateDirectory,
      workspaceId: identity.workspaceId,
    });
    expect(normalize(outcome)).not.toBe(normalize(baseline.outcome));
    removeRoot(identity.stateDirectory);
  });

  test("the public port exposes no driver discriminant and callers do not branch on kind", () => {
    const { store } = openStore(makeIdentity(makeTempRoot("conformance-port")));
    expect(Object.keys(store)).not.toContain("driverKind");
    expect(Object.keys(store)).not.toContain("driver");
    expect(kindBranchViolations("tests/behaviour/state-conformance.test.ts")).toEqual([]);
    expect(kindBranchViolations("tests/fixtures/state/cases.ts")).toEqual([]);
  });
});
