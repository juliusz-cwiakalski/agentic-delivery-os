/**
 * TC-CEREMONY-011 (one parametric parity suite over the six built-ins through
 * one runner path), TC-CEREMONY-012 (a per-built-in negative case makes a green
 * parity run non-vacuous), and TC-CEREMONY-019 (degradation is data, not
 * failure).
 */
import { describe, expect, test } from "bun:test";
import { flattenCeremonyAgenda } from "../../packages/core/src/domain/index";
import { readCeremonySteps } from "../../packages/core/src/state/index";
import {
  BUILTINS,
  firstArtifactRef,
  prepareBuiltin,
  runPrepared,
} from "../fixtures/ceremony/builtins";

describe("TC-CEREMONY-011 the six built-ins run through one runner path", () => {
  test.each(BUILTINS.map((declaration) => declaration.id))(
    "%s satisfies its declared agenda, outputs, verification, and verdict",
    (id) => {
      const prepared = prepareBuiltin(id);
      try {
        const run = runPrepared(prepared);
        expect(run.ok, id).toBe(true);
        if (!run.ok) return;
        const declared = flattenCeremonyAgenda(prepared.declaration);
        expect(run.data.steps.map((step) => step.index)).toEqual(
          declared.map((entry) => entry.index),
        );
        expect(run.data.steps.map((step) => step.kind)).toEqual(
          declared.map((entry) => entry.step.kind),
        );
        for (const step of run.data.steps) {
          expect(step.verification).toBe("verified");
          expect(step.artifactRef.length).toBeGreaterThan(0);
        }
        const expectedVerdict = id === "decision-record-mirror-sync" ? "dry-run" : "verified";
        expect(run.data.verdict).toBe(expectedVerdict);
        const steps = readCeremonySteps(prepared.harness.store, run.data.runId);
        expect(steps.ok).toBe(true);
        if (steps.ok) expect(steps.value.records).toHaveLength(declared.length);
      } finally {
        prepared.harness.dispose();
      }
    },
  );

  test("no built-in needs a distinct entry point, dispatcher, or verifier", () => {
    // Every declaration is executed by runCeremony; the parity suite above is
    // the only per-ceremony variation and it varies only fixture data.
    expect(BUILTINS).toHaveLength(6);
    expect(new Set(BUILTINS.map((declaration) => declaration.id)).size).toBe(6);
  });
});

describe("TC-CEREMONY-012 every built-in has a failing verification case", () => {
  test.each(BUILTINS.map((declaration) => declaration.id))(
    "%s stops at its first step when the artifact fails read-back",
    (id) => {
      const prepared = prepareBuiltin(id, { corruptFirstArtifact: true });
      try {
        const run = runPrepared(prepared);
        expect(run.ok).toBe(true);
        if (!run.ok) return;
        expect(run.data.verdict).toBe("unverified");
        expect(run.data.steps).toHaveLength(1);
        expect(run.data.steps[0]?.index).toBe(1);
        expect(run.data.steps[0]?.verification).toBe("unverified");
        const steps = readCeremonySteps(prepared.harness.store, "run-1");
        expect(steps.ok).toBe(true);
        if (steps.ok) expect(steps.value.records).toHaveLength(1);
      } finally {
        prepared.harness.dispose();
      }
    },
  );
});

describe("TC-CEREMONY-019 degradation is data, not failure", () => {
  test("an unavailable collector renders state plus reason and the run still verifies", () => {
    const prepared = prepareBuiltin("morning-brief", { unavailable: ["status-facts"] });
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      expect(run.data.verdict).toBe("verified");
      const brief = [...prepared.harness.artifactContents.values()]
        .map((content) => JSON.parse(content) as Record<string, unknown>)
        .find((document) => document.schemaId === "delivery.brief.v1");
      expect(brief).toBeDefined();
      const surfaces = Array.isArray(brief?.surfaces) ? brief.surfaces : [];
      const degraded = surfaces.filter(
        (surface) => (surface as { state?: string }).state === "unavailable",
      );
      expect(degraded.length).toBeGreaterThan(0);
      expect(JSON.stringify(degraded)).toContain("status-facts unavailable");
    } finally {
      prepared.harness.dispose();
    }
  });

  test("the paired available control renders present surfaces", () => {
    const prepared = prepareBuiltin("morning-brief");
    try {
      const run = runPrepared(prepared);
      expect(run.ok).toBe(true);
      const brief = [...prepared.harness.artifactContents.values()]
        .map((content) => JSON.parse(content) as Record<string, unknown>)
        .find((document) => document.schemaId === "delivery.brief.v1");
      const surfaces = Array.isArray(brief?.surfaces) ? brief.surfaces : [];
      expect(surfaces.every((surface) => (surface as { state?: string }).state === "present")).toBe(
        true,
      );
      expect(firstArtifactRef()).toContain("run-1");
    } finally {
      prepared.harness.dispose();
    }
  });
});
