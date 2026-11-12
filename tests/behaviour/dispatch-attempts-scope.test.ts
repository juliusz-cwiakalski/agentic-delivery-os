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
import { createAttemptsHarness } from "../fixtures/dispatch/attempts-harness";
import {
  createAttemptsProductionFixture,
  evidenceFiles,
  readStoreFile,
  snapshotStore,
} from "../fixtures/dispatch/attempts-production";
import { makeDivergence } from "../fixtures/dispatch/ledger";
import { createProductionProjectsHarness } from "../fixtures/projects/production";
import { createHostFixture, nonCheckoutDirectory } from "../fixtures/projects/state-scope";

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
  /**
   * The production composer exposes no store seam by design, so the store-port
   * counters (append / fence acquire / fence release) run over the in-process
   * composition of the same command definition, gate runtime, and app read. The
   * production-composition cells below prove the same property by hashing every
   * store byte, by both markers, and by the host-index write counters.
   */
  test("a successful read performs zero appends, zero fence acquisitions, zero releases", async () => {
    const harness = createAttemptsHarness({ label: "scope-read-counters", records: ledgerOf(2) });
    try {
      const readsBefore = harness.counters.readRecords;
      const appendsBefore = harness.counters.append;
      const acquiresBefore = harness.counters.acquireFence;
      const releasesBefore = harness.counters.releaseFence;
      const result = await harness.invoke([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(result.exit).toBe(0);
      // A successful read, not a refusal: the seeded page is returned.
      expect(dataOf(result.data).attempts).toHaveLength(2);
      expect(harness.counters.readRecords - readsBefore).toBe(1);
      expect(harness.counters.append).toBe(appendsBefore);
      expect(harness.counters.acquireFence).toBe(acquiresBefore);
      expect(harness.counters.releaseFence).toBe(releasesBefore);
    } finally {
      harness.dispose();
    }
  });

  test("sha256-stable evidence, unchanged counts, and permitted effects only", async () => {
    const host = createHostFixture("gh289-scope-readonly");
    const fixture = createAttemptsProductionFixture({
      host,
      origins: { a: ORIGIN_A, b: ORIGIN_B },
    });
    try {
      fixture.a.seedAttempts(ledgerOf(2, { repository: REPO_A }));
      fixture.a.seedDivergences([makeDivergence({ repository: REPO_A })]);
      const stateDirectory = fixture.a.harness.stateLocation;
      // sha256 is the primary "bytes unchanged" evidence (TR-2); mode and mtime
      // are the corroborating fingerprint.
      const hashesBefore = fixture.a.harness.snapshot(stateDirectory);
      const looseBefore = snapshotStore(stateDirectory);
      const evidenceBefore = evidenceFiles(hashesBefore);
      const ledgerNames = Object.keys(evidenceBefore);
      expect(ledgerNames.length).toBeGreaterThan(0);
      const ledgerBytes = ledgerNames.map((name) => readStoreFile(stateDirectory, name));
      const attemptsBefore = readDispatchAttempts(fixture.a.harness.store);
      const divergencesBefore = readDispatchDivergences(fixture.a.harness.store);
      const handoversBefore = readDispatchHandover(fixture.a.harness.store);
      const projectMarkerBefore = fixture.a.projectIdentityMarker();
      expect(fixture.a.dispatchIdentityMarker()).toBeUndefined();
      const writesBefore = fixture.a.harness.hostIndexAccess.writes;

      const machine = await fixture.a.run([
        "dispatch",
        "attempts",
        "--ref",
        ATTEMPTS_REF,
        "--json",
      ]);
      expect(machine.exitCode).toBe(0);
      expect(dataOf(machine.envelope?.data).attempts).toHaveLength(2);
      // A first invocation may register the project: at most one index write.
      const firstWrites = fixture.a.harness.hostIndexAccess.writes - writesBefore;
      expect(firstWrites).toBeLessThanOrEqual(1);
      const projectMarkerAfterFirst = fixture.a.projectIdentityMarker();
      expect(projectMarkerAfterFirst.state).toBe("present");

      // The second (text) invocation runs over unchanged index content.
      const secondWritesBefore = fixture.a.harness.hostIndexAccess.writes;
      const text = await fixture.a.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF]);
      expect(text.exitCode).toBe(0);
      expect(text.stdout).toContain(REPO_A);
      expect(fixture.a.harness.hostIndexAccess.writes - secondWritesBefore).toBe(0);
      // No absolute path is disclosed by the digest (NFR-6).
      for (const absolute of [host.hostRoot, fixture.a.checkout, host.home]) {
        expect(text.stdout).not.toContain(absolute);
      }

      // Every store artifact is byte-, mode-, and mtime-identical.
      const hashesAfter = fixture.a.harness.snapshot(stateDirectory);
      expect(hashesAfter).toEqual(hashesBefore);
      expect(evidenceFiles(hashesAfter)).toEqual(evidenceBefore);
      expect(snapshotStore(stateDirectory)).toEqual(looseBefore);
      expect(ledgerNames.map((name) => readStoreFile(stateDirectory, name))).toEqual(ledgerBytes);
      expect(countOf(readDispatchAttempts(fixture.a.harness.store))).toBe(countOf(attemptsBefore));
      expect(countOf(readDispatchDivergences(fixture.a.harness.store))).toBe(
        countOf(divergencesBefore),
      );
      expect(countOf(readDispatchHandover(fixture.a.harness.store))).toBe(countOf(handoversBefore));

      // The dispatch repository binding marker is neither created nor repaired.
      expect(fixture.a.dispatchIdentityMarker()).toBeUndefined();
      // The project checkout identity marker is create-once and never rewritten:
      // a run that finds it present leaves it byte-identical.
      expect(fixture.a.projectIdentityMarker()).toEqual(projectMarkerAfterFirst);
      if (projectMarkerBefore.state === "present") {
        expect(projectMarkerAfterFirst).toEqual(projectMarkerBefore);
      }
    } finally {
      fixture.dispose();
    }
  });

  test("a torn dispatch binding marker is not repaired by a read", async () => {
    const host = createHostFixture("gh289-scope-torn-binding");
    const fixture = createAttemptsProductionFixture({
      host,
      origins: { a: ORIGIN_A, b: ORIGIN_B },
    });
    try {
      fixture.a.seedAttempts(ledgerOf(1, { repository: REPO_A }));
      const torn = '{"repository":"github.com/owner/repo","schema":"dispatch.iden';
      fixture.a.writeDispatchIdentityMarker(torn);
      expect(fixture.a.dispatchIdentityMarker()).toBe(torn);

      const result = await fixture.a.run(["dispatch", "attempts", "--ref", ATTEMPTS_REF, "--json"]);
      expect(result.exitCode).toBe(0);
      expect(dataOf(result.envelope?.data).attempts).toHaveLength(1);
      expect(fixture.a.dispatchIdentityMarker()).toBe(torn);
    } finally {
      fixture.dispose();
    }
  });
});
