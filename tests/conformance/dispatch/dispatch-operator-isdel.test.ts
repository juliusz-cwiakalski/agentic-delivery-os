/**
 * GH-354 F-3 — `is-delivering`, both admissible forms (TC-ISDEL-001..007).
 *
 * Driver D1: the real repository-scoped fold over the real lane read, the real
 * projection, and the real command definition. The probe verdict is injected.
 */
import { describe, expect, test } from "bun:test";
import { storeWithReadFailure } from "../../fixtures/dispatch/attempts-harness";
import {
  createOperatorHarness,
  OPERATOR_REF,
  OPERATOR_REPOSITORY,
} from "../../fixtures/dispatch/operator/harness";
import { createFixedProbe } from "../../fixtures/dispatch/operator/probe";

const dataOf = (data: unknown) => data as Record<string, unknown>;

describe("TC-ISDEL the delivering fold", () => {
  test("TC-ISDEL-001 a live lane answers exit 0 with delivering=true and the ref, and no refs list", async () => {
    const probe = createFixedProbe("live");
    const h = createOperatorHarness({ label: "isdel-live", probe: probe.probe });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "active", sessionId: "ses-live" });
      // Unrelated refs whose owners are gone must not affect the per-ref answer.
      h.seedLane({ ref: "GH-355", state: "active", sessionId: "ses-355" });
      for (const argv of [
        ["dispatch", "is-delivering", OPERATOR_REF],
        ["dispatch", "is-delivering", OPERATOR_REF, "--json"],
      ]) {
        const before = h.counters.readRecords;
        const result = await h.run(argv);
        expect(result.exit).toBe(0);
        expect(h.counters.readRecords - before).toBe(1);
        if (argv.includes("--json")) {
          const data = dataOf(result.data);
          expect(data.query).toBe("is-delivering");
          expect(data.delivering).toBe(true);
          expect(data.ref).toBe(OPERATOR_REF);
          expect(data.repository).toBe(OPERATOR_REPOSITORY);
          expect(data.refs).toBeUndefined();
          expect(result.envelope?.error).toBeUndefined();
          expect(data.truncation).toBeUndefined();
        } else {
          expect(result.stdout).toContain("delivering=true");
        }
      }
      expect(h.counters.append).toBe(0);
      expect(h.counters.acquireFence).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("TC-ISDEL-002 a terminal or absent lane answers exit 1 with the boolean in data and no error object", async () => {
    const rows = [
      { label: "terminal", seed: { state: "terminal" as const, sessionId: "ses-t" } },
      { label: "absent", seed: undefined },
    ];
    for (const row of rows) {
      const h = createOperatorHarness({ label: `isdel-${row.label}` });
      try {
        if (row.seed !== undefined) h.seedLane({ ref: OPERATOR_REF, ...row.seed });
        for (const argv of [
          ["dispatch", "is-delivering", OPERATOR_REF],
          ["dispatch", "is-delivering", OPERATOR_REF, "--json"],
        ]) {
          const result = await h.run(argv);
          expect(result.exit, row.label).toBe(1);
          if (argv.includes("--json")) {
            const data = dataOf(result.data);
            expect(data.delivering, row.label).toBe(false);
            expect(result.envelope?.error, row.label).toBeUndefined();
            expect(data.error, row.label).toBeUndefined();
          } else {
            expect(result.stdout, row.label).toContain("delivering=false");
          }
        }
        expect(h.counters.append).toBe(0);
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-ISDEL-003 the ref-less form answers over the repository, and an empty repository is exit 1", async () => {
    const live = createFixedProbe("live");
    const h = createOperatorHarness({ label: "isdel-repo", probe: live.probe });
    try {
      h.seedLane({ ref: "GH-354", state: "active", sessionId: "ses-354" });
      h.seedLane({ ref: "GH-355", state: "active", sessionId: "ses-355" });
      h.seedLane({ ref: "GH-356", state: "terminal", sessionId: "ses-356" });
      const first = await h.run(["dispatch", "is-delivering", "--json"]);
      const second = await h.run(["dispatch", "is-delivering", "--json"]);
      expect(first.exit).toBe(0);
      const data = dataOf(first.data);
      expect(data.ref).toBeNull();
      expect(data.delivering).toBe(true);
      expect(data.refs).toEqual(["GH-354", "GH-355"]);
      expect(data.truncation).toBeUndefined();
      // Deterministic order across a second run.
      expect(dataOf(second.data).refs).toEqual(["GH-354", "GH-355"]);
      expect(second.exit).toBe(0);
    } finally {
      h.dispose();
    }

    // Store B: only terminal records — not in progress at exit 1.
    const terminal = createOperatorHarness({ label: "isdel-repo-terminal" });
    try {
      terminal.seedLane({ ref: "GH-354", state: "terminal", sessionId: "ses-t" });
      const result = await terminal.run(["dispatch", "is-delivering", "--json"]);
      expect(result.exit).toBe(1);
      const data = dataOf(result.data);
      expect(data.delivering).toBe(false);
      expect(data.refs).toEqual([]);
      expect(result.envelope?.error).toBeUndefined();
    } finally {
      terminal.dispose();
    }
  });

  test("TC-ISDEL-004 twenty-five delivering refs list twenty with one truncation fact", async () => {
    const h = createOperatorHarness({ label: "isdel-bound" });
    try {
      for (let index = 1; index <= 25; index += 1) {
        h.seedLane({ ref: `GH-${400 + index}`, state: "active", sessionId: `ses-${index}` });
      }
      const first = await h.run(["dispatch", "is-delivering", "--json"]);
      const second = await h.run(["dispatch", "is-delivering", "--json"]);
      expect(first.exit).toBe(0);
      const data = dataOf(first.data);
      expect((data.refs as readonly string[]).length).toBe(20);
      expect(data.truncation).toEqual({ bound: 20, omitted: 5 });
      expect(dataOf(second.data).refs).toEqual(data.refs);
      expect(h.counters.append).toBe(0);
    } finally {
      h.dispose();
    }
  });

  test("TC-ISDEL-005 a stale lane never makes the ref or the repository look busy", async () => {
    // dead variant: both forms answer not in progress.
    {
      const h = createOperatorHarness({
        label: "isdel-stale-dead",
        probe: createFixedProbe("dead").probe,
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "active", sessionId: "ses-stale" });
        const perRef = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
        const whole = await h.run(["dispatch", "is-delivering", "--json"]);
        expect(perRef.exit).toBe(1);
        expect(dataOf(perRef.data).delivering).toBe(false);
        expect(dataOf(perRef.data).ref).toBe(OPERATOR_REF);
        expect(whole.exit).toBe(1);
        expect(dataOf(whole.data).refs).toEqual([]);
        expect(h.counters.append).toBe(0);
      } finally {
        h.dispose();
      }
    }

    // unknown variant: the durable active state stands.
    {
      const h = createOperatorHarness({
        label: "isdel-stale-unknown",
        probe: createFixedProbe("unknown").probe,
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "active", sessionId: "ses-unknown" });
        const perRef = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
        const whole = await h.run(["dispatch", "is-delivering", "--json"]);
        expect(perRef.exit).toBe(0);
        expect(dataOf(perRef.data).delivering).toBe(true);
        expect(whole.exit).toBe(0);
        expect(dataOf(whole.data).refs).toEqual([OPERATOR_REF]);
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-ISDEL-006 an unreadable lane store keeps its typed state.* identity, never a fabricated false", async () => {
    for (const row of [
      { code: "state.store.torn", expectedExit: 2 },
      { code: "state.permission.denied", expectedExit: 1 },
    ] as const) {
      const h = createOperatorHarness({
        label: `isdel-${row.code.replaceAll(".", "-")}`,
        wrap: (store) => storeWithReadFailure(store, "dispatch.lane", row.code),
      });
      try {
        h.seedLane({ ref: OPERATOR_REF, state: "active", sessionId: "ses-unreadable" });
        for (const argv of [
          ["dispatch", "is-delivering", OPERATOR_REF, "--json"],
          ["dispatch", "is-delivering", "--json"],
        ]) {
          const result = await h.run(argv);
          expect(result.exit, row.code).toBe(row.expectedExit);
          expect(result.errorCode, row.code).toBe(row.code);
          expect(result.data, row.code).toBeUndefined();
        }
      } finally {
        h.dispose();
      }
    }
  });

  test("TC-ISDEL-007 only the current repository's lanes are counted, and a newer foreign record never decides", async () => {
    const h = createOperatorHarness({ label: "isdel-scope" });
    try {
      for (const ref of ["GH-354", "GH-355", "GH-356"]) {
        h.seedLane({ ref, state: "active", sessionId: `ses-${ref}` });
      }
      for (const ref of ["GH-701", "GH-702", "GH-703", "GH-704"]) {
        h.seedForeignLane(
          { ref, state: "active", sessionId: `ses-${ref}` },
          "github.com/other/repo",
        );
      }
      h.seedDaemon({ ref: "GH-900", state: "delivering", sessionId: "ses-daemon" });
      const whole = await h.run(["dispatch", "is-delivering", "--json"]);
      const data = dataOf(whole.data);
      expect(data.refs).toEqual(["GH-354", "GH-355", "GH-356"]);
      // A ref that exists only under the foreign repository is not in progress.
      const foreignOnly = await h.run(["dispatch", "is-delivering", "GH-701", "--json"]);
      expect(foreignOnly.exit).toBe(1);
      expect(dataOf(foreignOnly.data).delivering).toBe(false);
    } finally {
      h.dispose();
    }

    // Fold order: local terminal first, then a NEWER foreign active record.
    {
      const h = createOperatorHarness({ label: "isdel-fold-order" });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "terminal",
          sessionId: "ses-local-final",
          lastToken: "pr-open",
          lastOutcome: "completed",
          recordedAt: "2026-11-19T00:00:00.000Z",
        });
        h.seedForeignLane(
          {
            ref: OPERATOR_REF,
            state: "active",
            sessionId: "ses-foreign-active",
            recordedAt: "2026-11-19T01:00:00.000Z",
          },
          "github.com/other/repo",
        );
        const perRef = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
        const whole = await h.run(["dispatch", "is-delivering", "--json"]);
        expect(perRef.exit).toBe(1);
        expect(dataOf(perRef.data).delivering).toBe(false);
        expect(dataOf(perRef.data).ref).toBe(OPERATOR_REF);
        expect(dataOf(whole.data).refs).not.toContain(OPERATOR_REF);
      } finally {
        h.dispose();
      }
    }

    // Mirrored: local active first, then a NEWER foreign terminal record.
    {
      const h = createOperatorHarness({ label: "isdel-fold-order-mirror" });
      try {
        h.seedLane({
          ref: OPERATOR_REF,
          state: "active",
          sessionId: "ses-local-active",
          recordedAt: "2026-11-19T00:00:00.000Z",
        });
        h.seedForeignLane(
          {
            ref: OPERATOR_REF,
            state: "terminal",
            sessionId: "ses-foreign-terminal",
            recordedAt: "2026-11-19T01:00:00.000Z",
          },
          "github.com/other/repo",
        );
        const perRef = await h.run(["dispatch", "is-delivering", OPERATOR_REF, "--json"]);
        const whole = await h.run(["dispatch", "is-delivering", "--json"]);
        expect(perRef.exit).toBe(0);
        expect(dataOf(perRef.data).delivering).toBe(true);
        expect(dataOf(whole.data).refs).toContain(OPERATOR_REF);
      } finally {
        h.dispose();
      }
    }
  });
});
