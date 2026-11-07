/**
 * TC-HARN-022 — drift discipline over both stores: optional fields warn,
 * missing cost is null, capture never hard-fails on optional drift.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { rmSync } from "node:fs";
import {
  createBunSqliteStoreOpener,
  createClaudeTelemetryExtractor,
  createOpencodeTelemetryExtractor,
} from "../../packages/adapters/src/harness/index";
import {
  HARNESS_WARNING_REASONS,
  type HarnessTelemetryCapture,
  type HarnessWarningReason,
} from "../../packages/core/src/contracts/index";
import { createFakeFileReader } from "../fixtures/harness/claude-code/reader";
import {
  buildOpencodeStore,
  PRIVACY_CANARY,
  type StoreVariant,
  WORK_ITEM_REF,
} from "../fixtures/harness/opencode-store/build";

const NOW = "2026-11-06T00:00:00Z";
const RUN_ID = "run-022";
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const opencode = (
  variant: StoreVariant,
  options: { readonly pinnedVersion?: string } = {},
): HarnessTelemetryCapture => {
  const store = buildOpencodeStore({ variant });
  roots.push(store.directory);
  const result = createOpencodeTelemetryExtractor({
    opener: (path) => createBunSqliteStoreOpener()(path),
    storePath: store.path,
    now: () => NOW,
    ...(options.pinnedVersion === undefined ? {} : { pinnedVersion: options.pinnedVersion }),
  }).extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
  if (!result.ok) throw new Error(result.error.summary ?? "extraction failed");
  return result.value;
};

const claude = (text: string, pinnedVersion?: string): HarnessTelemetryCapture => {
  const result = createClaudeTelemetryExtractor({
    directory: "fixtures/claude-code",
    reader: createFakeFileReader({ "fixtures/claude-code/drift.jsonl": text }).reader,
    now: () => NOW,
    ...(pinnedVersion === undefined ? {} : { pinnedVersion }),
  }).extract({ workItemRef: WORK_ITEM_REF, runId: RUN_ID });
  if (!result.ok) throw new Error(result.error.summary ?? "extraction failed");
  return result.value;
};

const warnings = (capture: HarnessTelemetryCapture, reason: HarnessWarningReason, record = 0) =>
  (capture.records[record]?.warnings ?? capture.warnings).filter(
    (warning) => warning.reason === reason,
  );

const claudeSession = (overrides: {
  readonly cost?: number | string | null;
  readonly input?: number | string;
  readonly version?: string;
  readonly agent?: string | null;
  readonly model?: string | null;
}) => {
  const cost = overrides.cost === undefined ? 0.5 : overrides.cost;
  const input = overrides.input === undefined ? 10 : overrides.input;
  const agent = overrides.agent === undefined ? "agent-a" : overrides.agent;
  const model = overrides.model === undefined ? "model-a" : overrides.model;
  return [
    JSON.stringify({
      type: "session",
      sessionId: "cc_root",
      parentId: null,
      workItemRef: WORK_ITEM_REF,
      harnessVersion: overrides.version ?? "1.0.0",
      agent,
      model,
    }),
    JSON.stringify({
      type: "usage",
      sessionId: "cc_root",
      agent,
      model,
      tool: "edit",
      cost,
      input_tokens: input,
      output_tokens: 2,
      reasoning_tokens: 1,
      cache_read_input_tokens: 1,
      cache_creation_input_tokens: 1,
      content: PRIVACY_CANARY,
    }),
  ].join("\n");
};

describe("TC-HARN-022 drift discipline", () => {
  test("the pinned fixture is the positive control: no warnings, all token classes numeric", () => {
    const capture = opencode("full");
    expect(capture.records.every((record) => record.warnings.length === 0)).toBe(true);
    for (const record of capture.records) {
      for (const token of Object.values(record.tokens)) expect(typeof token).toBe("number");
      expect(typeof record.cost).toBe("number");
    }
  });

  test("an absent optional column degrades with exactly one naming warning", () => {
    const capture = opencode("no-optional-column");
    for (const record of capture.records) {
      expect(record.tokens.reasoning).toBeNull();
      const named = record.warnings.filter(
        (warning) => warning.reason === "optional-field-absent" && warning.field === "reasoning",
      );
      expect(named).toHaveLength(1);
    }
  });

  test("an absent input token column yields exactly one naming warning", () => {
    const capture = opencode("no-input-column");
    for (const record of capture.records) {
      expect(record.tokens.input).toBeNull();
      const named = record.warnings.filter(
        (warning) => warning.reason === "optional-field-absent" && warning.field === "input",
      );
      expect(named).toHaveLength(1);
    }
  });

  test("the two-group fixture keeps the drift matrix green", () => {
    const capture = opencode("multi-group");
    const root = capture.records.filter((record) => record.sessionId === "ses_root");
    expect(root).toHaveLength(2);
    expect(root.every((record) => record.warnings.length === 0)).toBe(true);
  });

  test("missing cost is null with a warning, never zero and never an estimate", () => {
    for (const capture of [opencode("missing-cost"), claude(claudeSession({ cost: null }))]) {
      for (const record of capture.records) {
        expect(record.cost).toBeNull();
        expect(record.cost).not.toBe(0);
        expect(record.warnings.some((warning) => warning.reason === "cost-missing")).toBe(true);
      }
    }
  });

  test("a non-numeric optional value warns and degrades, never coerces", () => {
    const capture = opencode("non-numeric-cost");
    for (const record of capture.records) {
      expect(record.cost).toBeNull();
      expect(record.warnings.some((warning) => warning.reason === "non-numeric-value")).toBe(true);
    }
    const text = claudeSession({ input: "ten" });
    const claudeCapture = claude(text);
    expect(claudeCapture.records[0]?.tokens.input).toBeNull();
    expect(
      claudeCapture.records[0]?.warnings.some((warning) => warning.reason === "non-numeric-value"),
    ).toBe(true);
  });

  test("a drifted observed version warns naming expected and observed and completes", () => {
    const capture = opencode("full", { pinnedVersion: "0.9.0" });
    const drift = warnings(capture, "version-drift");
    expect(drift.length).toBeGreaterThan(0);
    expect(drift[0]?.field).toContain("expected=0.9.0");
    expect(drift[0]?.field).toContain("observed=1.0.0");
    const claudeCapture = claude(claudeSession({ version: "2.0.0" }), "1.0.0");
    expect(
      claudeCapture.records[0]?.warnings.some(
        (warning) => warning.reason === "version-drift" && warning.field.includes("observed=2.0.0"),
      ),
    ).toBe(true);
  });

  test("an orphan root is a store-scoped warning with no fabricated work-item ref", () => {
    const capture = opencode("orphan");
    expect(capture.records.some((record) => record.sessionId === "ses_orphan")).toBe(false);
    expect(
      capture.failedSessions.some((session) => session.reason === "unattributable-session"),
    ).toBe(false);
    expect(
      capture.warnings.some(
        (warning) =>
          warning.reason === "unattributable-session" &&
          warning.field === "store:out-of-port-orphans=1",
      ),
    ).toBe(true);
    expect(JSON.stringify(capture)).not.toContain("fabricated");
  });

  test("a malformed required identity is a bounded store warning with no placeholder id", () => {
    const capture = opencode("broken-identity");
    expect(capture.records.every((record) => record.sessionId.length > 0)).toBe(true);
    expect(
      capture.failedSessions.some((session) => session.reason === "invalid-session-identity"),
    ).toBe(false);
    expect(
      capture.warnings.some(
        (warning) =>
          warning.reason === "invalid-session-identity" &&
          warning.field === "store:invalid-identity=1",
      ),
    ).toBe(true);
    const claudeCapture = claude(
      [
        JSON.stringify({
          type: "session",
          sessionId: "cc_ghost",
          parentId: null,
          workItemRef: WORK_ITEM_REF,
          harnessVersion: "1.0.0",
        }),
        JSON.stringify({
          type: "usage",
          sessionId: "cc_ghost",
          tool: "edit",
          cost: 0.1,
          input_tokens: 1,
          output_tokens: 1,
          reasoning_tokens: 0,
          cache_read_input_tokens: 0,
          cache_creation_input_tokens: 0,
        }),
      ].join("\n"),
    );
    expect(
      claudeCapture.failedSessions.some((session) => session.reason === "invalid-session-identity"),
    ).toBe(true);
  });

  test("the warning vocabulary is closed and no figure is fabricated across cases", () => {
    const captures = [
      opencode("full"),
      opencode("multi-group"),
      opencode("no-optional-column"),
      opencode("no-input-column"),
      opencode("non-numeric-cost"),
      opencode("missing-cost"),
      opencode("orphan"),
      opencode("broken-identity"),
      claude(claudeSession({ cost: null })),
      claude(claudeSession({ input: "ten" })),
    ];
    for (const capture of captures) {
      for (const warning of [
        ...capture.warnings,
        ...capture.records.flatMap((record) => record.warnings),
      ]) {
        expect(HARNESS_WARNING_REASONS).toContain(warning.reason);
      }
      for (const record of capture.records) {
        expect(record.cost === null || typeof record.cost === "number").toBe(true);
        for (const token of Object.values(record.tokens)) {
          expect(token === null || typeof token === "number").toBe(true);
        }
      }
    }
  });
});
