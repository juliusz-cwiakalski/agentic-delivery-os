/**
 * GH-289 TC-ATTEMPT-011, 012, 013, 014 — repository-scoped read isolation at the
 * real production composition, the non-checkout refusal, and the read-only
 * posture with respect to delivery evidence.
 *
 * Two real checkouts share one host root; the migrated-root cell places another
 * repository's records inside one project state root; the non-checkout cell uses
 * the delivered `nonCheckoutDirectory()` guard.
 */
import { describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
  readDispatchAttempts,
  readDispatchDivergences,
  readDispatchHandover,
} from "../../packages/core/src/app/dispatch-ledger";
import type { DispatchAttemptsData } from "../../packages/core/src/contracts/index";
import { ATTEMPTS_REF, ledgerOf } from "../fixtures/dispatch/attempt-records";
import {
  createAttemptsProductionFixture,
  evidenceFiles,
  snapshotStore,
} from "../fixtures/dispatch/attempts-production";
import { makeDivergence } from "../fixtures/dispatch/ledger";
import { createHostFixture, nonCheckoutDirectory } from "../fixtures/projects/state-scope";
import { createProductionProjectsHarness } from "../fixtures/projects/production";

const REPO_A = "github.com/owner/repo-a";
const REPO_B = "github.com/owner/repo-b";
const ORIGIN_A = `https://${REPO_A}.git`;
const ORIGIN_B = `https://${REPO_B}.git`;

const dataOf = (value: unknown): DispatchAttemptsData => value as DispatchAttemptsData;

/** Give one seeded group distinct attempt identifiers (immutable record keys). */
const withIds = <T extends { readonly attemptId: string }>(
  records: readonly T[],
  prefix: string,
): readonly T[] =>
  records.map((record, index) => ({ ...record, attemptId: `${prefix}-${String(index + 1)}` }));

const countOf = (
  read:
    | { readonly ok: true; readonly records: readonly unknown[] }
    | { readonly ok: false; readonly code: string },
): number => (read.ok ? read.records.length : -1);

describe("TC-ATTEMPT-011 two projects on one host root", () => {
  test("each checkout reports only its own repository's attempts", async () => {
    const host = createHostFixture("gh289-scope-two");
    const fixture = createAttemptsProductionFixture({
      host,
      origins: { a: ORIGIN_A, b: ORIGIN_B },
    });
    try {
      fixture.a.seedAttempts(ledgerOf(2, { repository: REPO_A }));
      fixture.b.seedAttempts(ledgerOf(3, { repository: REPO_B }));

      const a = await fixture.a.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      expect(a.exitCode).toBe(0);
      const dataA = dataOf(a.envelope?.data);
      expect(dataA.repository).toBe(REPO_A);
      expect(dataA.excluded.foreignRepository).toBe(0);
      expect(dataA.attempts).toHaveLength(2);
      expect(dataA.attempts.every((row) => row.repository === REPO_A)).toBe(true);

      const b = await fixture.b.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      expect(b.exitCode).toBe(0);
      const dataB = dataOf(b.envelope?.data);
      expect(dataB.repository).toBe(REPO_B);
      expect(dataB.excluded.foreignRepository).toBe(0);
      expect(dataB.attempts).toHaveLength(3);
      expect(dataB.attempts.every((row) => row.repository === REPO_B)).toBe(true);
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-ATTEMPT-012 a migrated project root holding two repositories", () => {
  test("foreign records are counted, never named, and independent of --ref", async () => {
    const host = createHostFixture("gh289-scope-migrated");
    const fixture = createAttemptsProductionFixture({
      host,
      origins: { a: ORIGIN_A, b: ORIGIN_B },
    });
    try {
      fixture.a.seedAttempts([
        ...withIds(ledgerOf(3, { repository: REPO_A }), "A-OWN"),
        ...withIds(ledgerOf(2, { repository: REPO_B }), "A-FOR"),
        ...withIds(ledgerOf(1, { repository: REPO_B, ref: "GH-000" }), "A-REF"),
      ]);

      const scoped = await fixture.a.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      expect(scoped.exitCode).toBe(0);
      const data = dataOf(scoped.envelope?.data);
      expect(data.attempts).toHaveLength(3);
      expect(data.attempts.every((row) => row.repository === REPO_A)).toBe(true);
      expect(data.excluded.foreignRepository).toBe(3);

      // Independent of --ref: the count describes the root, not the query.
      const otherRef = await fixture.a.run(["dispatch", "attempts", "--ref", "GH-000", "--json"]);
      expect(dataOf(otherRef.envelope?.data).excluded.foreignRepository).toBe(3);

      // No foreign identifier or reference appears anywhere in the output.
      const text = await fixture.a.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      for (const marker of ["A-FOR", "A-REF", "GH-000"]) {
        expect(text.stdout).not.toContain(marker);
      }
      expect(scoped.stdout + scoped.stderr).not.toContain("repo-b");
    } finally {
      fixture.dispose();
    }
  });
});

describe("TC-ATTEMPT-013 outside any checkout", () => {
  test("refuses instead of presenting the unbound store as a repository's history", async () => {
    const host = createHostFixture("gh289-scope-noncheckout");
    const directory = nonCheckoutDirectory("gh289-attempts");
    try {
      const harness = createProductionProjectsHarness({
        label: "gh289-noncheckout",
        workingDirectory: directory,
        host,
      });
      const result = await harness.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      expect(result.exitCode).toBe(1);
      const error = (result.envelope?.error ?? {}) as {
        readonly code?: string;
        readonly summary?: string;
      };
      expect(error.code).toBe("input.value.rejected");
      expect(error.summary).toContain("checkout");
      expect(result.envelope?.data).toBeUndefined();
      // The dispatch repository binding marker is neither created nor repaired.
      const files = Object.keys(harness.snapshot(host.hostRoot));
      expect(files.some((name) => name.endsWith("dispatch-identity.json"))).toBe(false);
    } finally {
      host.dispose();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe("TC-ATTEMPT-014 read-only with respect to evidence", () => {
  test("zero appends, unchanged evidence bytes, and no binding marker", async () => {
    const host = createHostFixture("gh289-scope-readonly");
    const fixture = createAttemptsProductionFixture({
      host,
      origins: { a: ORIGIN_A, b: ORIGIN_B },
    });
    try {
      fixture.a.seedAttempts(ledgerOf(2, { repository: REPO_A }));
      fixture.a.seedDivergences([makeDivergence({ repository: REPO_A })]);
      const before = evidenceFiles(snapshotStore(fixture.a.harness.stateLocation));
      const attemptsBefore = readDispatchAttempts(fixture.a.harness.store);
      const divergencesBefore = readDispatchDivergences(fixture.a.harness.store);
      const handoversBefore = readDispatchHandover(fixture.a.harness.store);
      expect(fixture.a.dispatchIdentityMarker()).toBeUndefined();

      const result = await fixture.a.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      expect(result.exitCode).toBe(0);

      const after = evidenceFiles(snapshotStore(fixture.a.harness.stateLocation));
      expect(after).toEqual(before);
      expect(countOf(readDispatchAttempts(fixture.a.harness.store))).toBe(countOf(attemptsBefore));
      expect(countOf(readDispatchDivergences(fixture.a.harness.store))).toBe(
        countOf(divergencesBefore),
      );
      expect(countOf(readDispatchHandover(fixture.a.harness.store))).toBe(countOf(handoversBefore));
      // A read never creates, repairs, or re-persists the binding marker.
      expect(fixture.a.dispatchIdentityMarker()).toBeUndefined();
    } finally {
      fixture.dispose();
    }
  });
});
