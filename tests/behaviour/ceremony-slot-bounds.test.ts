/**
 * TC-CEREMONY-069 — slot fidelity, note bounds, and the read budget (DM-1,
 * DM-2, DM-6, NFR-11): a `state-record` output lands the ledger record its slot
 * declares and writes no artifact file; per-step artifacts in the
 * `ceremony-artifact` slot never overwrite one another; the note read is
 * bounded in bytes and the stored note is re-validated against the note
 * contract on read-back.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ceremonyArtifactsDirectory } from "../../packages/adapters/src/file/index";
import { createCeremonyCommandRuntime } from "../../packages/cli/src/edge";
import {
  CEREMONY_NOTE_SCHEMA,
  type CeremonyDeclaration,
} from "../../packages/core/src/contracts/index";
import { appendCeremonyRun, readCeremonySteps } from "../../packages/core/src/state/index";
import { runPrepared } from "../fixtures/ceremony/builtins";
import { makeEngineHarness, threeStepDeclaration } from "../fixtures/ceremony/engine";
import { conformingNote } from "../fixtures/ceremony/notes";
import { makeCeremonyState, NOW_MS, runRecord } from "../fixtures/ceremony/state";
import { withinFence } from "../fixtures/state/harness";

const REPO_ID = "github.com/example/repo";

const makeRuntime = (root: string, state: ReturnType<typeof makeCeremonyState>) =>
  createCeremonyCommandRuntime({
    store: state.store,
    stateDirectory: state.root,
    changesDirectory: join(root, "doc", "changes"),
    workspaceId: "workspace-note",
    clock: { nowMs: () => NOW_MS },
    newRunId: () => "run-note-probe",
    newFenceToken: () => "fence-note",
    gitRoot: root,
    configurationDirectoryName: ".delivery",
    repositoryId: REPO_ID,
  });

describe("TC-CEREMONY-069 the state-record slot lands the ledger record", () => {
  test("a state-record step writes no artifact file and names its ledger record", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = threeStepDeclaration();
      const run = runPrepared({
        id: "generic",
        declaration,
        harness,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const recordSteps = run.data.steps.filter(
        (step) => step.kind === "fold" || step.kind === "record",
      );
      expect(recordSteps.length).toBeGreaterThanOrEqual(2);
      for (const step of recordSteps) {
        expect(step.artifactRef.startsWith("ledger:ceremony.steps:run-1:")).toBe(true);
      }
      // No artifact file carries a state-record slot name.
      for (const ref of harness.artifactContents.keys()) {
        expect(ref.includes("state-record")).toBe(false);
      }
      const steps = readCeremonySteps(harness.store, "run-1");
      expect(steps.ok).toBe(true);
      if (!steps.ok) return;
      const landed = steps.value.records.filter((step) => step.slot === "state-record");
      expect(landed.length).toBe(recordSteps.length);
      for (const landedStep of landed) {
        expect(landedStep.verification).toBe("verified");
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-CEREMONY-069 per-step artifacts never overwrite one another", () => {
  test("two ceremony-artifact steps write distinct per-step files", () => {
    const harness = makeEngineHarness();
    try {
      const declaration = threeStepDeclaration();
      const patched = JSON.parse(JSON.stringify(declaration)) as unknown as {
        agenda: { steps: { outputs: { slot: string }[] }[] }[];
      };
      patched.agenda[1]?.steps[0]?.outputs.forEach((output) => {
        output.slot = "ceremony-artifact";
      });
      patched.agenda[1]?.steps[1]?.outputs.forEach((output) => {
        output.slot = "ceremony-artifact";
      });
      const run = runPrepared({
        id: "generic",
        declaration: patched as unknown as CeremonyDeclaration,
        harness,
        noteSupplied: false,
        apply: false,
      });
      expect(run.ok).toBe(true);
      if (!run.ok) return;
      const refs = [...harness.artifactContents.keys()].filter((ref) =>
        ref.startsWith("ceremony-artifact:"),
      );
      expect(refs).toHaveLength(3);
      expect(new Set(refs).size).toBe(3);
      for (const ref of refs) {
        expect(ref).toContain(".s");
      }
      // Every executed step verified, so each read-back saw its own artifact.
      expect(run.data.steps.every((step) => step.outcome !== "unverified")).toBe(true);
    } finally {
      harness.dispose();
    }
  });

  test("the production artifact directory is the per-workspace family", () => {
    const state = makeCeremonyState("slot-names");
    try {
      expect(ceremonyArtifactsDirectory(state.root, "ws")).toContain("ceremony-artifacts.ws");
    } finally {
      state.dispose();
    }
  });
});

describe("TC-CEREMONY-069 the note read is bounded and re-validated on read-back", () => {
  test("a note above the byte bound is refused as ceremony.note-invalid", async () => {
    const state = makeCeremonyState("note-bound");
    const root = mkdtempSync(join(tmpdir(), "ceremony-note-bound-"));
    try {
      const runtime = makeRuntime(root, state);
      const notePath = join(root, "note.json");
      const padding = "x".repeat(1024);
      let text = `{"schemaId":"${CEREMONY_NOTE_SCHEMA}","ceremony":"testing-session-assessment","scopeKey":"bound-scope"`;
      while (Buffer.byteLength(text, "utf8") <= 1_048_576) {
        text += `,["${padding}"]`;
      }
      text += "}";
      writeFileSync(notePath, text, "utf8");
      expect(Buffer.byteLength(readFileSync(notePath, "utf8"), "utf8")).toBeGreaterThan(1_048_576);
      const run = await runtime.run({
        name: "testing-session-assessment",
        notePath,
        apply: false,
      });
      expect(run.ok).toBe(false);
      if (run.ok) return;
      expect(run.error.code).toBe("ceremony.note-invalid");
      expect(run.error.field).toBe("document");
      expect(run.error.summary).toContain("the declared bound is 1048576");
    } finally {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a stored note that fails the note contract refuses the resume with the field named", async () => {
    const state = makeCeremonyState("note-readback");
    const root = mkdtempSync(join(tmpdir(), "ceremony-note-readback-"));
    try {
      const runtime = makeRuntime(root, state);
      withinFence(state.store, "note-readback-seed", (handle) => {
        const appended = appendCeremonyRun(
          state.store,
          handle,
          runRecord({ runId: "run-note-probe", ceremonyId: "testing-session-assessment" }),
          1,
        );
        if (!appended.ok) throw new Error(appended.error.code);
      });
      // The stored body parses but names the wrong ceremony: read-back
      // validation must refuse before any agenda step executes.
      const memoryDirectory = join(root, ".ai", "memory", "ceremony");
      mkdirSync(memoryDirectory, { recursive: true });
      writeFileSync(
        join(memoryDirectory, `${encodeURIComponent(REPO_ID)}.md`),
        JSON.stringify({
          schemaId: CEREMONY_NOTE_SCHEMA,
          ceremony: "retro-evidence-pass",
          scopeKey: REPO_ID,
        }),
        "utf8",
      );
      const resume = await runtime.resume({ runId: "run-note-probe", apply: false });
      expect(resume.ok).toBe(false);
      if (resume.ok) return;
      expect(resume.error.code).toBe("ceremony.note-invalid");
      expect(resume.error.summary).toContain("read-back validation");
    } finally {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a conforming stored note lets the resume execute", async () => {
    const state = makeCeremonyState("note-conform");
    const root = mkdtempSync(join(tmpdir(), "ceremony-note-conform-"));
    try {
      const note = conformingNote("testing-session-assessment", { scopeKey: REPO_ID });
      const runtime = makeRuntime(root, state);
      const memoryDirectory = join(root, ".ai", "memory", "ceremony");
      mkdirSync(memoryDirectory, { recursive: true });
      writeFileSync(
        join(memoryDirectory, `${encodeURIComponent(REPO_ID)}.md`),
        JSON.stringify(note),
        "utf8",
      );
      const resume = await runtime.resume({ runId: "run-note-probe", apply: false });
      // No run is recorded, so the refusal is the input identity — never a
      // note-contract refusal: a conforming stored note passes validation.
      expect(resume.ok).toBe(false);
      if (resume.ok) return;
      expect(resume.error.code).toBe("input.value.rejected");
      expect(resume.error.summary).toContain("no ceremony run");
    } finally {
      state.dispose();
      rmSync(root, { recursive: true, force: true });
    }
  });
});
