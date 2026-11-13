/**
 * TC-TELEMETRY-035 — records and reports carry aggregate counts, identity
 * references, and time windows only. Prompt-like content in a frame never lands
 * in a stored record or a rendered report, and the delivered redaction
 * chokepoint composes unchanged (NFR-7, §20).
 */
import { afterEach, describe, expect, test } from "bun:test";
import { projectBrief, renderBriefHuman } from "../../packages/core/src/domain/brief";
import { computeSpendReport } from "../../packages/core/src/domain/spend";
import { decodeTelemetryStepFrame } from "../../packages/core/src/domain/telemetry-ingest";
import { readSpendLedger, readTelemetrySteps } from "../../packages/core/src/state/index";
import { baseFacts } from "../fixtures/brief/harness";
import { runSpendCli, spendRuntimeOver } from "../fixtures/spend/harness";
import {
  foldTelemetryStore,
  frameContext,
  makeStepRecord,
  removeRoot,
  SESSION_A,
  tokens,
} from "../fixtures/telemetry";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const CANARY = "CANARY-prompt-transcript-diff-7b21";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeRoot(root);
});

const frameWithPrompt = (): string =>
  JSON.stringify({
    type: "step_finish",
    timestamp: 3,
    sessionID: SESSION_A,
    prompt: CANARY,
    part: {
      type: "step-finish",
      reason: "stop",
      text: CANARY,
      tokens: { input: 10, output: 5, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      cost: 0.01,
      calls: 1,
    },
  });

describe("TC-TELEMETRY-035 telemetry privacy", () => {
  test("a frame's prompt-like content never lands in the stored record", () => {
    const decoded = decodeTelemetryStepFrame(JSON.parse(frameWithPrompt()), frameContext());
    expect(decoded.kind).toBe("captured");
    if (decoded.kind !== "captured") return;
    const rendered = JSON.stringify(decoded.record);
    expect(rendered).not.toContain(CANARY);
    expect(rendered).not.toContain("prompt");
    // The only "text" is the drifted-field name in a warning, never a value.
    expect(decoded.record.warnings).toEqual([{ reason: "version-drift", field: "part.text" }]);
    // Aggregate counts and identity references only.
    expect(decoded.record.tokens.input).toBe(10);
    expect(decoded.record.ticket).toBe("GH-291");
  });

  test("stored records and rendered reports carry no canary", async () => {
    const fixture = foldTelemetryStore(
      { steps: [makeStepRecord({ sessionId: SESSION_A, tokens: tokens({ input: 10 }) })] },
      "privacy",
    );
    roots.push(fixture.root);
    const steps = readTelemetrySteps(fixture.store, "GH-291");
    expect(steps.ok).toBe(true);
    if (steps.ok) expect(JSON.stringify(steps.value.records)).not.toContain(CANARY);
    const read = readSpendLedger(fixture.store, "GH-291");
    if (!read.ok) throw new Error("read failed");
    const folded = computeSpendReport(read.value, { workItemRef: "GH-291" });
    if (!folded.ok) throw new Error("fold failed");
    expect(JSON.stringify(folded.data)).not.toContain(CANARY);
    const run = await runSpendCli(["spend", "--ref", "GH-291"], spendRuntimeOver(fixture.store));
    expect(run.stdout).not.toContain(CANARY);
    expect(run.stderr).not.toContain(CANARY);
    const brief = renderBriefHuman(
      projectBrief({
        ...baseFacts(),
        spend: {
          state: "observed",
          captured: true,
          tokensByClass: folded.data.tokensByClass,
          restarts: folded.data.restarts,
          ratio: folded.data.amplification.ratio,
          telemetryState: folded.data.telemetryState,
          reconciliation: folded.data.reconciliation,
          byRole: folded.data.breakdowns.role,
          byModel: folded.data.breakdowns.model,
        },
      }),
      SYNTHETIC_BRAND,
    );
    expect(brief).not.toContain(CANARY);
  });

  test("records declare no free-form message, transcript, or tool-output fields", () => {
    const decoded = decodeTelemetryStepFrame(JSON.parse(frameWithPrompt()), frameContext());
    if (decoded.kind !== "captured") return;
    const keys = Object.keys(decoded.record).sort();
    expect(keys).toEqual([
      "agentRole",
      "calls",
      "capturedAt",
      "cost",
      "finishedAt",
      "harnessKind",
      "harnessVersion",
      "lane",
      "model",
      "repository",
      "runId",
      "schemaId",
      "sessionId",
      "startedAt",
      "storageVersion",
      "ticket",
      "tokens",
      "treeRoot",
      "warnings",
      "workItemRef",
    ]);
  });
});
