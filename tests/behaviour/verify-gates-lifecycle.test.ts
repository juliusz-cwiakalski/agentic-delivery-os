/** TC-VGATES-013..017, 062 — lifecycle finalization from structured evidence. */
import { describe, expect, test } from "bun:test";
import type {
  VerifyGatesPmNotesRead,
  VerifyGatesRegistryRead,
} from "../../packages/cli/src/commands/verify-gates";
import {
  evaluateVerifyGates,
  verifyGatesUnknownIdentity,
} from "../../packages/core/src/domain/index";
import { baseFacts, CHANGE_REF, clone, lifecycle } from "../fixtures/verify-gates/cases/facts";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import { fullBase } from "./verify-support";

const lifecycleRecord = (facts: ReturnType<typeof baseFacts>) =>
  evaluateVerifyGates(facts).gates[0];

const countOf = (record: ReturnType<typeof lifecycleRecord>, name: string): number | undefined =>
  record.citation.counts.find((entry) => entry.name === name)?.value;

describe("TC-VGATES-013/014 complete full and LITE ledgers pass", () => {
  test("full finished passes with counts and registry evidence", () => {
    const record = lifecycleRecord(baseFacts());
    expect(record.id).toBe("lifecycle-finalization");
    expect(record.verdict).toBe("pass");
    expect(record.reason).toBe("lifecycle-complete");
    expect(record.citation.sources.map((source) => `${source.name}:${source.outcome}`)).toEqual([
      "pm-notes:read",
      "delivery-registry:read",
    ]);
    expect(countOf(record, "required")).toBe(11);
    expect(countOf(record, "completed")).toBe(11);
    expect(countOf(record, "missing")).toBe(0);
    expect(countOf(record, "registryRecords")).toBe(12);
    expect(countOf(record, "registryTransitions")).toBe(3);
    expect(countOf(record, "overlaid")).toBe(2);
    expect(record.citation.identity.changeRef).toBe(CHANGE_REF);
  });

  test("LITE finished passes with only the LITE set", () => {
    const facts = clone(baseFacts());
    const required = [
      "inception",
      "discovery",
      "specification",
      "test_planning",
      "delivery",
      "closeout",
    ];
    facts.lifecycle.evaluation = lifecycle({
      variant: "lite",
      requiredPhases: required,
      completedPhases: required,
      declaration: { requiredCount: 6, completedCount: 6 },
      registry: {
        present: true,
        verifiedEmpty: false,
        recordCount: 2,
        transitionCount: 1,
        overlaidPhases: [required[0] as string],
      },
    });
    const record = lifecycleRecord(facts);
    expect(record.verdict).toBe("pass");
    expect(countOf(record, "required")).toBe(6);
    expect(countOf(record, "completed")).toBe(6);
  });
});

describe("TC-VGATES-015 incomplete and terminal failures reuse identities", () => {
  test("partial carries ordered missing phases and the reused code", () => {
    const facts = clone(baseFacts());
    facts.lifecycle.evaluation = lifecycle({
      outcome: "partial",
      completedPhases: ["phase-1", "phase-2"],
      missingPhases: ["phase-3", "phase-4"],
      declaration: { requiredCount: 11, completedCount: 2 },
      code: "verify.ledger.incomplete",
    });
    const record = lifecycleRecord(facts);
    expect(record.verdict).toBe("fail");
    expect(record.reason).toBe("lifecycle-incomplete");
    expect(record.citation.names[0]?.values).toEqual(["phase-3", "phase-4"]);
    expect(countOf(record, "missing")).toBe(2);
    expect(record.citation.sources[0]?.failureCode).toBe("verify.ledger.incomplete");
  });

  test("malformed notes yields empty arrays, zero counts, and a failed source", () => {
    const facts = clone(baseFacts());
    facts.lifecycle.evaluation = {
      variant: "unknown",
      outcome: "failed",
      requiredPhases: [],
      completedPhases: [],
      missingPhases: [],
      declaration: { requiredCount: 0, completedCount: 0 },
      registry: {
        present: false,
        verifiedEmpty: false,
        recordCount: 0,
        transitionCount: 0,
        overlaidPhases: [],
      },
      kind: "lint",
      code: "lint.notes.malformed",
    };
    const record = lifecycleRecord(facts);
    expect(record.verdict).toBe("fail");
    expect(countOf(record, "required")).toBe(0);
    expect(countOf(record, "completed")).toBe(0);
    expect(record.citation.sources[0]).toMatchObject({
      name: "pm-notes",
      outcome: "failed",
      failureCode: "lint.notes.malformed",
    });
    expect(record.citation.sources[1]?.outcome).toBe("not-attempted");
  });

  test("missing target is absent, not failed", () => {
    const facts = clone(baseFacts());
    facts.lifecycle.evaluation = {
      variant: "unknown",
      outcome: "failed",
      requiredPhases: [],
      completedPhases: [],
      missingPhases: [],
      declaration: { requiredCount: 0, completedCount: 0 },
      registry: {
        present: false,
        verifiedEmpty: false,
        recordCount: 0,
        transitionCount: 0,
        overlaidPhases: [],
      },
      kind: "lint",
      code: "lint.target.missing",
    };
    const record = lifecycleRecord(facts);
    expect(record.verdict).toBe("fail");
    expect(record.citation.sources[0]?.outcome).toBe("absent");
  });
});

describe("TC-VGATES-016/017 registry failures are unknown with their identity", () => {
  test("platform state failure is unknown and reuses state.store.torn", () => {
    const facts = clone(baseFacts());
    facts.lifecycle.evaluation = lifecycle({
      outcome: "state-unverified",
      kind: "state",
      code: "state.store.torn",
      registry: {
        present: false,
        verifiedEmpty: false,
        recordCount: 0,
        transitionCount: 0,
        overlaidPhases: [],
      },
    });
    const evaluated = evaluateVerifyGates(facts);
    const record = evaluated.gates[0];
    expect(record?.verdict).toBe("unknown");
    expect(record?.reason).toBe("lifecycle-unverifiable");
    expect(record?.citation.sources[1]).toMatchObject({
      name: "delivery-registry",
      outcome: "failed",
      failureCode: "state.store.torn",
    });
    expect(verifyGatesUnknownIdentity(evaluated)?.code).toBe("state.store.torn");
  });

  test("user state failure keeps the user identity for the overall unknown", () => {
    const facts = clone(baseFacts());
    facts.lifecycle.evaluation = lifecycle({
      outcome: "state-unverified",
      kind: "state",
      code: "state.permission.denied",
    });
    const evaluated = evaluateVerifyGates(facts);
    expect(evaluated.overall).toBe("unknown");
    expect(verifyGatesUnknownIdentity(evaluated)?.code).toBe("state.permission.denied");
    expect(verifyGatesUnknownIdentity(evaluated)?.projectionClass).toBe("user-validation");
  });
});

describe("TC-VGATES-062 structured evidence is the only source", () => {
  test("mutating an evaluation field moves the citation and no summary is parsed", () => {
    const baseline = lifecycleRecord(baseFacts());
    const facts = clone(baseFacts());
    facts.lifecycle.evaluation = lifecycle({
      registry: {
        present: true,
        verifiedEmpty: false,
        recordCount: 99,
        transitionCount: 4,
        overlaidPhases: ["phase-1"],
      },
    });
    const mutated = lifecycleRecord(facts);
    expect(countOf(mutated, "registryRecords")).toBe(99);
    expect(countOf(mutated, "overlaid")).toBe(1);
    expect(countOf(mutated, "registryRecords")).not.toBe(countOf(baseline, "registryRecords"));
  });
});

describe("TC-VGATES-013/015/062 the handler drives the real EvaluateVerifyChange", () => {
  const lifecycleLine = (result: Awaited<ReturnType<typeof runVerify>>): string => {
    const summary = (result.envelope?.error as { summary?: string } | undefined)?.summary ?? "";
    return summary.split("\n").find((line) => line.startsWith("lifecycle-finalization ")) ?? "";
  };

  const runtimeWith = (document: VerifyGatesPmNotesRead, registry: VerifyGatesRegistryRead) => {
    const base = combinedRuntime();
    const gates = base.gates;
    if (gates === undefined) throw new Error("combined runtime is missing the gates member");
    return {
      ...base,
      gates: { ...gates, readLifecycle: () => ({ document, registry }) },
    };
  };

  const emptyRegistry: VerifyGatesRegistryRead = {
    ok: true,
    present: false,
    verifiedEmpty: false,
    transitions: [],
    recordCount: 0,
  };

  test("a missing target evaluates to a failed ledger with empty counts and an absent source", async () => {
    const result = await runVerify(runtimeWith({ ok: false, reason: "missing" }, emptyRegistry), [
      "gates",
      "GH-178",
    ]);
    expect(result.exitCode).toBe(1);
    const line = lifecycleLine(result);
    expect(line).toContain("reason=lifecycle-incomplete");
    expect(line).toContain("source=pm-notes:absent+delivery-registry:not-attempted");
    expect(line).toContain("counts=required=0,completed=0,missing=0");
    expect(line).toContain("names=-");
  });

  test("a malformed document evaluates to a failed ledger with a failed source", async () => {
    const result = await runVerify(
      runtimeWith(
        {
          ok: false,
          reason: "malformed",
          file: "chg-GH-178-pm-notes.yaml",
          parseFailure: { class: "syntax", location: "line 1" },
        },
        emptyRegistry,
      ),
      ["gates", "GH-178"],
    );
    expect(result.exitCode).toBe(1);
    const line = lifecycleLine(result);
    expect(line).toContain("reason=lifecycle-incomplete");
    expect(line).toContain("source=pm-notes:failed+delivery-registry:not-attempted");
    expect(line).toContain("counts=required=0,completed=0,missing=0");
  });

  test("a user state failure evaluates to an unknown lifecycle with failed registry evidence", async () => {
    const result = await runVerify(
      runtimeWith(
        { ok: true, file: "fixture.yaml", text: "", value: fullBase() },
        {
          ok: false,
          error: { kind: "state", code: "state.permission.denied", summary: "denied" },
        },
      ),
      ["gates", "GH-178"],
    );
    expect(result.exitCode).toBe(1);
    const line = lifecycleLine(result);
    expect(line).toContain("unknown reason=lifecycle-unverifiable");
    expect(line).toContain("source=pm-notes:read+delivery-registry:failed");
  });
});
