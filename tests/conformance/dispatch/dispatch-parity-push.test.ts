/**
 * GH-386 — the push-parity group's owning suite (TC-BAT-001's per-row proof,
 * TC-PUSH-013's conformance totality, TC-FAIL-001's registry row semantics).
 *
 * Every registry row yields its declared token and delivered exit exactly once
 * through the real command path; the defect-pin matrix is total over the
 * closed injected fact space and no cell resolves a divergent `pr-open`.
 */
import { describe, expect, test } from "bun:test";
import {
  PARITY_CASES,
  parityCasesOf,
  runDefectPinMatrix,
} from "../../fixtures/dispatch/parity/cases";

const row = (id: string) => {
  const entry = parityCasesOf("push-parity").find((candidate) => candidate.id === id);
  if (entry === undefined) throw new Error(`registry row ${id} is missing`);
  return entry;
};

describe("TC-BAT-001 every push-parity row yields its declared token and exit once", () => {
  test("the registry declares the push-parity group with its fourteen rows", () => {
    expect(parityCasesOf("push-parity").map((entry) => entry.id)).toEqual([
      "push-parity-clean",
      "push-parity-pushed",
      "push-parity-non-fast-forward",
      "push-parity-protected-branch",
      "push-parity-credential",
      "push-parity-timeout",
      "push-parity-spawn-failed",
      "push-parity-stale-reread",
      "push-parity-remote-ahead",
      "push-parity-unreadable",
      "push-parity-url-unverified",
      "push-parity-defect-pin",
      "resume-pr-open-equal-heads",
      "resume-pr-open-local-ahead",
    ]);
  });

  for (const entry of PARITY_CASES.filter((candidate) => candidate.group === "push-parity")) {
    if (entry.id === "push-parity-defect-pin") continue;
    test(`${entry.id} resolves ${entry.expected.token ?? "its token"} at exit ${entry.expected.exit ?? 0}`, {
      timeout: 30_000,
    }, async () => {
      const observation = await entry.scenario();
      if (entry.expected.token !== undefined) {
        expect(observation.token, entry.id).toBe(entry.expected.token);
      }
      if (entry.expected.exit !== undefined) {
        expect(observation.exit, entry.id).toBe(entry.expected.exit);
      }
      // Every row stays inside the delivered bounds: one attempt, no
      // violations, no divergence on success, references within the budget.
      expect(observation.attempts.length, entry.id).toBe(1);
      expect(observation.violations, entry.id).toEqual([]);
      for (const attempt of observation.attempts) {
        expect(attempt.evidenceRefs.length, entry.id).toBeLessThanOrEqual(16);
      }
    });
  }
});

describe("TC-PUSH-013 the defect pin: the matrix is total and pr-open is never divergent", () => {
  test("every declared cell yields exactly one of the four outcomes", {
    timeout: 60_000,
  }, async () => {
    const observations = await runDefectPinMatrix();
    const expectedTokens = [
      "pr-open",
      "pr-open",
      "failed",
      "failed",
      "failed",
      "failed",
      "state-unverified",
      "pr-open-unverified",
    ];
    expect(observations.map((observation) => observation.token)).toEqual(expectedTokens);
    for (const [index, observation] of observations.entries()) {
      // Totality: exactly one attempt per cell, no unclassified outcome.
      expect(observation.attempts.length, `cell ${index}`).toBe(1);
      // The defining property (AC-F1-2): a pr-open classification always
      // carries a parity-true disclosure; the failure always parity-false.
      if (observation.token === "pr-open") {
        expect(observation.envelopes[0]?.data?.push?.parity, `cell ${index}`).toBe(true);
      }
      if (observation.token === "failed") {
        expect(observation.envelopes[0]?.data?.push?.parity, `cell ${index}`).toBe(false);
        expect(observation.attempts[0]?.comparison, `cell ${index}`).toMatchObject({
          class: "not-applicable",
          token: null,
          outcome: "not-applicable",
          reason: "push-parity-unmet",
        });
      }
      // The unreadable boundary never lands in the push-failure row.
      if (observation.token === "state-unverified") {
        expect(observation.attempts[0]?.comparison, `cell ${index}`).not.toMatchObject({
          reason: "push-parity-unmet",
        });
      }
    }
  });

  test("the registry row answers from the same builder as the matrix", () => {
    const pin = row("push-parity-defect-pin");
    expect(pin.declaredSeam).toBe("push");
    expect(pin.group).toBe("push-parity");
  });
});

describe("TC-FAIL-001 the typed failure row's registry semantics", () => {
  test("the rejected-push row keeps the PR URL and appends no divergence", async () => {
    const observation = await row("push-parity-non-fast-forward").scenario();
    expect(observation.token).toBe("failed");
    expect(observation.exit).toBe(1);
    expect(observation.divergences).toBe(0);
    const attempt = observation.attempts[0];
    expect(attempt?.falseSuccess).toBe(false);
    expect(attempt?.comparison).toEqual({
      class: "not-applicable",
      token: null,
      outcome: "not-applicable",
      reason: "push-parity-unmet",
    });
    expect(observation.envelopes[0]?.data?.prUrl).toContain("pull/501");
    expect(observation.envelopes[0]?.data?.error).toBeUndefined();
  });
});

describe("TC-PUSH-011 the resume variants keep the delivered resume economics", () => {
  test("the equal-heads resume charges zero spawns and zero pushes", async () => {
    const observation = await row("resume-pr-open-equal-heads").scenario();
    expect(observation.token).toBe("pr-open");
    expect(observation.spawns).toBe(0);
    expect(observation.resumes).toBe(1);
    expect(observation.invocations.filter((invocation) => invocation.seam === "push")).toHaveLength(
      0,
    );
    expect(observation.attempts[0]?.evidenceRefs).toContain("push:clean");
  });

  test("the local-ahead resume reconciles by exactly one push", async () => {
    const observation = await row("resume-pr-open-local-ahead").scenario();
    expect(observation.token).toBe("pr-open");
    expect(observation.resumes).toBe(1);
    const pushes = observation.invocations.filter((invocation) => invocation.seam === "push");
    expect(pushes).toHaveLength(1);
    expect(observation.attempts[0]?.evidenceRefs).toContain("push:pushed");
  });
});
