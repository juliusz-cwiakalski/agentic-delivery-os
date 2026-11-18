/**
 * TC-E2E-003 (phase 10) — the controlled fixture exposes no ledger writer, every
 * counted record carries command-produced provenance and the declared
 * controlled-proof class, and a cross-scope record (controlled-proof under a
 * production identity, or smoke/fixture) is surfaced but never counted.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createControlledRepo } from "./controlled-repo";
import { summarizeDispatchEvidence } from "../../../packages/core/src/app/dispatch-gate";
import { appendDispatchAttempt } from "../../../packages/core/src/app/dispatch-ledger";
import { makeAttemptFor, REPOSITORY, REPOSITORY_BETA } from "../../fixtures/dispatch/ledger";

const ALL = [
  "pr-open",
  "pr-open-unverified",
  "merged",
  "blocked",
  "finished",
  "failed",
  "partial",
  "max-restarts",
  "state-unverified",
  "noop-lane-permission",
  "noop-lane-nothing-to-do",
] as const;

describe("TC-E2E-003 fixture evidence is command-produced and never counted cross-scope", () => {
  test("the fixture API surface has no ledger writer", () => {
    const repo = createControlledRepo();
    try {
      const keys = Object.keys(repo);
      for (const forbidden of ["append", "write", "record", "seed", "insert"]) {
        expect(
          keys.some((key) => key.toLowerCase().includes(forbidden)),
          forbidden,
        ).toBe(false);
      }
      const source = readFileSync(
        join(process.cwd(), "tests/conformance/dispatch/controlled-repo.ts"),
        "utf8",
      );
      expect(/export const (append|writeRecord|recordAttempt)/u.test(source)).toBe(false);
    } finally {
      repo.dispose();
    }
  });

  test("every counted record is command-produced and controlled-proof", async () => {
    const repo = createControlledRepo();
    try {
      for (const _token of ALL) await repo.run();
      const provenance = repo.provenance();
      expect(provenance.attempts).toBe(provenance.dispatches);
      expect(provenance.classes).toEqual(["controlled-proof"]);
      const production = summarizeDispatchEvidence({
        store: repo.state.store,
        repository: REPOSITORY,
        scope: "production",
        nowIso: new Date(Date.parse("2026-12-01T10:00:00.000Z")).toISOString(),
      });
      expect(production.ok).toBe(true);
      if (!production.ok) return;
      // No controlled-proof attempt is counted toward the production scope.
      expect(production.data.countedDeliveries).toBe(0);
      expect(production.data.excludedEvidenceClasses).toEqual([
        { evidenceClass: "controlled-proof", count: provenance.attempts },
      ]);
    } finally {
      repo.dispose();
    }
  });

  test("a test-local pilot record under the controlled identity is excluded and not counted", async () => {
    const repo = createControlledRepo();
    try {
      await repo.run();
      const before = repo.provenance();
      // A direct ledger append bypasses the command provenance and must not count.
      appendDispatchAttempt(
        repo.state.store,
        repo.state.fenceToken,
        makeAttemptFor("merged", {
          attemptId: "hand-inserted",
          repository: REPOSITORY,
          evidenceClass: "pilot",
        }),
      );
      const after = repo.provenance();
      expect(after.attempts).toBe(before.attempts + 1);
      expect(after.classes.sort()).toEqual(["controlled-proof", "pilot"]);

      const controlled = summarizeDispatchEvidence({
        store: repo.state.store,
        repository: REPOSITORY,
        scope: "controlled",
        nowIso: new Date(Date.parse("2026-12-01T10:00:00.000Z")).toISOString(),
      });
      expect(controlled.ok).toBe(true);
      if (!controlled.ok) return;
      expect(controlled.data.countedDeliveries).toBe(1);
      expect(controlled.data.excludedEvidenceClasses).toEqual([
        { evidenceClass: "pilot", count: 1 },
      ]);
    } finally {
      repo.dispose();
    }
  });

  test("smoke and fixture attempts count toward no handover in either scope", async () => {
    const repo = createControlledRepo();
    try {
      appendDispatchAttempt(
        repo.state.store,
        repo.state.fenceToken,
        makeAttemptFor("merged", {
          attemptId: "smoke-1",
          repository: REPOSITORY_BETA,
          evidenceClass: "smoke",
        }),
      );
      appendDispatchAttempt(
        repo.state.store,
        repo.state.fenceToken,
        makeAttemptFor("merged", {
          attemptId: "fixture-1",
          repository: REPOSITORY_BETA,
          evidenceClass: "fixture",
        }),
      );
      for (const scope of ["production", "controlled"] as const) {
        const summary = summarizeDispatchEvidence({
          store: repo.state.store,
          repository: REPOSITORY_BETA,
          scope,
          nowIso: new Date(Date.parse("2026-12-01T10:00:00.000Z")).toISOString(),
        });
        expect(summary.ok, scope).toBe(true);
        if (!summary.ok) continue;
        expect(summary.data.countedDeliveries, scope).toBe(0);
        expect(summary.data.eligibility, scope).toBe(false);
      }
    } finally {
      repo.dispose();
    }
  });
});
