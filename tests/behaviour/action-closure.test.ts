/**
 * TC-ACTION-009..013, 038, 039 — explicit closure on two planes: the refusal
 * matrix, the pinned SC-M2-S10-02 artifact/outcome split, the explicit-only
 * outcome rule, the both-plane routes, and the state-conflict refusal
 * (AC-F4-1..AC-F4-5; DEC-4, DEC-5, DEC-11).
 */
import { describe, expect, test } from "bun:test";
import { conformingDraft } from "../fixtures/action/builders";
import { NOW_MS } from "../fixtures/action/clock";
import { actionSnapshot, closeAction, fileAction, listActions } from "../fixtures/action/seed";
import { makeActionStore } from "../fixtures/action/store";

const seedOne = (
  store: ReturnType<typeof makeActionStore>["store"],
  options: { readonly actionId?: string; readonly window?: string } = {},
) => {
  const outcome = fileAction(store, conformingDraft({ window: options.window ?? "window-a" }), {
    actionId: options.actionId ?? "action-1",
  });
  expect(outcome.ok).toBe(true);
};

describe("TC-ACTION-009 closure refusals transition nothing", () => {
  const cases: ReadonlyArray<readonly [string, Parameters<typeof closeAction>[1], string]> = [
    ["no decision", { actionId: "action-1", route: "done", artifact: "artifact:x" }, "decision"],
    ["done without artifact", { actionId: "action-1", route: "done", decision: "d" }, "artifact"],
    [
      "deprioritized without reason",
      { actionId: "action-1", route: "deprioritized", decision: "d" },
      "reason",
    ],
    [
      "superseded without successor",
      { actionId: "action-1", route: "superseded", decision: "d" },
      "successor",
    ],
  ];

  test("each missing member is refused naming it and leaves the planes open", () => {
    for (const [label, request, field] of cases) {
      const fixture = makeActionStore(`closure-refuse-${field}`);
      try {
        seedOne(fixture.store);
        const outcome = closeAction(fixture.store, request, { nowMs: NOW_MS });
        expect(outcome.ok, label).toBe(false);
        if (!outcome.ok) {
          expect(outcome.error.code).toBe("retro.closure-incomplete");
          expect(outcome.error.location?.field, label).toBe(field);
        }
        const snapshot = actionSnapshot(fixture.store);
        expect(snapshot.closures, label).toHaveLength(0);
      } finally {
        fixture.cleanup();
      }
    }
  });

  test("outcome closure without in-window evidence is refused (C-05, C-06)", () => {
    const fixture = makeActionStore("closure-outcome-refusals");
    try {
      seedOne(fixture.store);
      expect(
        closeAction(
          fixture.store,
          { actionId: "action-1", route: "done", decision: "d", artifact: "artifact:x" },
          { nowMs: NOW_MS },
        ).ok,
      ).toBe(true);
      const noEvidence = closeAction(
        fixture.store,
        { actionId: "action-1", plane: "outcome", decision: "d2" },
        { nowMs: NOW_MS },
      );
      expect(noEvidence.ok).toBe(false);
      if (!noEvidence.ok) expect(noEvidence.error.location?.field).toBe("evidence");

      const outOfWindow = closeAction(
        fixture.store,
        { actionId: "action-1", plane: "outcome", decision: "d2", evidence: "metric:x" },
        { nowMs: NOW_MS },
      );
      expect(outOfWindow.ok).toBe(false);
      if (!outOfWindow.ok) expect(outOfWindow.error.summary).toContain("verification window");
      const entries = listActions(fixture.store, NOW_MS);
      expect(entries.ok && entries.data.actions[0]?.outcomeClosure).toBe("open");
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-010 SC-M2-S10-02 artifact closed, outcome open", () => {
  test("a done closure records the artifact plane only and keeps the filed window", () => {
    const fixture = makeActionStore("closure-done");
    try {
      seedOne(fixture.store);
      const outcome = closeAction(
        fixture.store,
        { actionId: "action-1", route: "done", decision: "decision-1", artifact: "artifact:x" },
        { nowMs: NOW_MS },
      );
      expect(outcome.ok).toBe(true);
      if (outcome.ok && "artifactClosure" in outcome.data) {
        expect(outcome.data.artifactClosure).toBe("closed");
        expect(outcome.data.outcomeClosure).toBe("open");
        expect(outcome.data.verificationWindow).toEqual({
          evidence: "metric:guard-rejection-rate",
          windowStart: "2026-10-15T00:00:00Z",
          windowEnd: "2026-11-15T00:00:00Z",
        });
      }
      const snapshot = actionSnapshot(fixture.store);
      expect(snapshot.closures).toHaveLength(1);
      expect(snapshot.closures[0]).toMatchObject({
        route: "done",
        decision: "decision-1",
        artifactClosure: "closed",
        outcomeClosure: "open",
      });
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-011 outcome closure never follows elapsed time", () => {
  test("an elapsed window keeps the outcome plane open and discloses the window state", () => {
    const fixture = makeActionStore("closure-elapsed");
    try {
      seedOne(fixture.store);
      expect(
        closeAction(
          fixture.store,
          { actionId: "action-1", route: "done", decision: "d", artifact: "artifact:x" },
          { nowMs: NOW_MS },
        ).ok,
      ).toBe(true);
      const later = NOW_MS + 400 * 86_400_000;
      const listed = listActions(fixture.store, later);
      expect(listed.ok).toBe(true);
      if (listed.ok && "actions" in listed.data) {
        expect(listed.data.actions[0]?.outcomeClosure).toBe("open");
        expect(listed.data.actions[0]?.verificationWindowState).toBe("elapsed");
      }
      expect(actionSnapshot(fixture.store).closures).toHaveLength(1);

      const paired = makeActionStore("closure-elapsed-control");
      try {
        seedOne(paired.store);
        const open = listActions(paired.store, later);
        expect(open.ok && open.data.actions[0]?.verificationWindowState).toBe("elapsed");
        expect(open.ok && open.data.actions[0]?.outcomeClosure).toBe("open");
      } finally {
        paired.cleanup();
      }
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-012 three explicit routes carry provenance and their plane effects", () => {
  test("done, deprioritized, and superseded record route, decision, and justification", () => {
    const fixture = makeActionStore("closure-routes");
    try {
      seedOne(fixture.store, { actionId: "action-done", window: "window-done" });
      seedOne(fixture.store, { actionId: "action-dep", window: "window-dep" });
      seedOne(fixture.store, { actionId: "action-super", window: "window-super" });
      seedOne(fixture.store, { actionId: "action-successor", window: "window-successor" });

      const done = closeAction(
        fixture.store,
        {
          actionId: "action-done",
          route: "done",
          decision: "dec-done",
          artifact: "artifact:done",
        },
        { nowMs: NOW_MS },
      );
      expect(done.ok && "outcomeClosure" in done.data && done.data.outcomeClosure).toBe("open");

      const dep = closeAction(
        fixture.store,
        {
          actionId: "action-dep",
          route: "deprioritized",
          decision: "dec-dep",
          reason: "not worth the churn",
        },
        { nowMs: NOW_MS },
      );
      expect(dep.ok).toBe(true);
      if (dep.ok && "outcomeClosure" in dep.data) {
        expect(dep.data.artifactClosure).toBe("closed");
        expect(dep.data.outcomeClosure).toBe("closed");
        expect(dep.data.windowState).toBe("mooted");
      }

      const sup = closeAction(
        fixture.store,
        {
          actionId: "action-super",
          route: "superseded",
          decision: "dec-super",
          successor: "action-successor",
        },
        { nowMs: NOW_MS },
      );
      expect(sup.ok).toBe(true);
      const records = actionSnapshot(fixture.store).closures;
      const depRecord = records.find((record) => record.actionId === "action-dep");
      expect(depRecord?.justification).toEqual({ reason: "not worth the churn" });
      const supRecord = records.find((record) => record.actionId === "action-super");
      expect(supRecord?.justification).toEqual({ successor: "action-successor" });
      expect(
        actionSnapshot(fixture.store).actions.some(
          (action) => action.actionId === "action-successor",
        ),
      ).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });

  test("a supersede naming an unrecorded successor is refused", () => {
    const fixture = makeActionStore("closure-supersede-unknown");
    try {
      seedOne(fixture.store, { actionId: "action-super" });
      const outcome = closeAction(
        fixture.store,
        {
          actionId: "action-super",
          route: "superseded",
          decision: "dec",
          successor: "action-absent",
        },
        { nowMs: NOW_MS },
      );
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) expect(outcome.error.location?.field).toBe("successor");
      expect(actionSnapshot(fixture.store).closures).toHaveLength(0);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-013 explicit outcome closure cites in-window evidence", () => {
  test("an in-window evidence decision closes the outcome plane and records the reference", () => {
    const inWindow = Date.parse("2026-11-01T00:00:00Z");
    const fixture = makeActionStore("closure-outcome");
    try {
      seedOne(fixture.store);
      expect(
        closeAction(
          fixture.store,
          { actionId: "action-1", route: "done", decision: "d1", artifact: "artifact:x" },
          { nowMs: inWindow },
        ).ok,
      ).toBe(true);
      const outcome = closeAction(
        fixture.store,
        { actionId: "action-1", plane: "outcome", decision: "d2", evidence: "metric:x" },
        { nowMs: inWindow },
      );
      expect(outcome.ok).toBe(true);
      if (outcome.ok && "outcomeClosure" in outcome.data) {
        expect(outcome.data.outcomeClosure).toBe("closed");
        expect(outcome.data.decision).toBe("d2");
      }
      const records = actionSnapshot(fixture.store).closures;
      expect(records.find((record) => record.plane === "outcome")?.justification).toEqual({
        artifact: "metric:x",
      });
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-038 the both-plane routes close in the one decision", () => {
  test("deprioritized and superseded close both planes; time never changes them", () => {
    const fixture = makeActionStore("closure-both-planes");
    try {
      seedOne(fixture.store, { actionId: "action-dep", window: "window-dep" });
      seedOne(fixture.store, { actionId: "action-super", window: "window-super" });
      seedOne(fixture.store, { actionId: "action-successor", window: "window-successor" });
      seedOne(fixture.store, { actionId: "action-done", window: "window-done" });

      expect(
        closeAction(
          fixture.store,
          { actionId: "action-dep", route: "deprioritized", decision: "d", reason: "later" },
          { nowMs: NOW_MS },
        ).ok,
      ).toBe(true);
      expect(
        closeAction(
          fixture.store,
          {
            actionId: "action-super",
            route: "superseded",
            decision: "d",
            successor: "action-successor",
          },
          { nowMs: NOW_MS },
        ).ok,
      ).toBe(true);
      expect(
        closeAction(
          fixture.store,
          { actionId: "action-done", route: "done", decision: "d", artifact: "artifact:x" },
          { nowMs: NOW_MS },
        ).ok,
      ).toBe(true);

      const farFuture = NOW_MS + 5_000 * 86_400_000;
      const listed = listActions(fixture.store, farFuture);
      expect(listed.ok).toBe(true);
      if (listed.ok && "actions" in listed.data) {
        const byId = new Map(listed.data.actions.map((row) => [row.actionId, row]));
        for (const actionId of ["action-dep", "action-super"]) {
          expect(byId.get(actionId)?.artifactClosure, actionId).toBe("closed");
          expect(byId.get(actionId)?.outcomeClosure, actionId).toBe("closed");
          expect(byId.get(actionId)?.verificationWindowState, actionId).toBe("mooted");
        }
        expect(byId.get("action-done")?.artifactClosure).toBe("closed");
        expect(byId.get("action-done")?.outcomeClosure).toBe("open");
      }
      expect(actionSnapshot(fixture.store).closures).toHaveLength(3);

      // The refusal controls still hold before any plane closes.
      seedOne(fixture.store, { actionId: "action-refuse", window: "window-refuse" });
      const noReason = closeAction(
        fixture.store,
        { actionId: "action-refuse", route: "deprioritized", decision: "d" },
        { nowMs: NOW_MS },
      );
      expect(noReason.ok).toBe(false);
      const noSuccessor = closeAction(
        fixture.store,
        { actionId: "action-refuse", route: "superseded", decision: "d" },
        { nowMs: NOW_MS },
      );
      expect(noSuccessor.ok).toBe(false);
    } finally {
      fixture.cleanup();
    }
  });
});

describe("TC-ACTION-039 repeat closure is a state conflict", () => {
  test("a second artifact-plane decision and a repeat outcome decision are refused", () => {
    const inWindow = Date.parse("2026-11-01T00:00:00Z");
    const fixture = makeActionStore("closure-conflict");
    try {
      seedOne(fixture.store, { actionId: "action-done" });
      seedOne(fixture.store, { actionId: "action-dep" });
      seedOne(fixture.store, { actionId: "action-open" });

      expect(
        closeAction(
          fixture.store,
          { actionId: "action-done", route: "done", decision: "d1", artifact: "artifact:x" },
          { nowMs: inWindow, closureId: "closure-done" },
        ).ok,
      ).toBe(true);
      expect(
        closeAction(
          fixture.store,
          { actionId: "action-dep", route: "deprioritized", decision: "d", reason: "later" },
          { nowMs: inWindow, closureId: "closure-dep" },
        ).ok,
      ).toBe(true);

      const before = actionSnapshot(fixture.store).closures;
      const repeatArtifact = closeAction(
        fixture.store,
        { actionId: "action-done", route: "done", decision: "d2", artifact: "artifact:y" },
        { nowMs: inWindow },
      );
      expect(repeatArtifact.ok).toBe(false);
      if (!repeatArtifact.ok) {
        expect(repeatArtifact.error.code).toBe("retro.closure-incomplete");
        expect(repeatArtifact.error.location?.field).toBe("artifactClosure");
        expect(repeatArtifact.error.location?.plane).toBe("artifactClosure");
        expect(repeatArtifact.error.location?.existingClosure).toBe("closure-done");
        expect(repeatArtifact.error.summary).toContain("closure-done");
      }

      const repeatOutcome = closeAction(
        fixture.store,
        { actionId: "action-dep", plane: "outcome", decision: "d3", evidence: "metric:x" },
        { nowMs: inWindow },
      );
      expect(repeatOutcome.ok).toBe(false);
      if (!repeatOutcome.ok) {
        expect(repeatOutcome.error.location?.field).toBe("outcomeClosure");
        expect(repeatOutcome.error.location?.existingClosure).toBe("closure-dep");
      }
      expect(actionSnapshot(fixture.store).closures).toEqual(before);

      // The paired control: the still-open action closes normally.
      const control = closeAction(
        fixture.store,
        { actionId: "action-open", route: "done", decision: "d4", artifact: "artifact:z" },
        { nowMs: inWindow },
      );
      expect(control.ok).toBe(true);
    } finally {
      fixture.cleanup();
    }
  });
});
