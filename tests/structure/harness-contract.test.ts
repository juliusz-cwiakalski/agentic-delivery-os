/**
 * TC-HARN-001 / TC-HARN-003 (phase-1 half) — the closed harness vocabulary,
 * declaration invariants, instance shape, and the data-only contract tier.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { CLAUDE_CAPABILITIES } from "../../packages/adapters/src/harness/claude";
import {
  DEFAULT_HARNESS_MODE,
  HARNESS_ABSENCE_REASONS,
  HARNESS_BINDING_RESOLUTION_OUTCOMES,
  HARNESS_CLASSIFICATION_TOKENS,
  HARNESS_FAILURE_CODES,
  HARNESS_GAP_REASONS,
  HARNESS_KINDS,
  HARNESS_LIFECYCLE_CAPABILITIES,
  HARNESS_LIVENESS_KINDS,
  HARNESS_MANDATORY_USAGE_FACTS,
  HARNESS_MODE_ORIGINS,
  HARNESS_MODE_SURFACES,
  HARNESS_MODEL_EXPRESSION_MAX_CHARS,
  HARNESS_MODES,
  HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
  HARNESS_OBSERVED_AXES,
  HARNESS_OPERATIONS,
  HARNESS_OUTCOMES,
  HARNESS_SUPPORTED_VERSION_WINDOW,
  HARNESS_UNRESOLVED_SEAT_REASON,
  HARNESS_VERSION_MAX_CHARS,
  HARNESS_VERSION_PROBE_PATTERN,
  HARNESS_VERSION_PROBE_TIMEOUT_MS,
  HARNESS_VERSION_VERDICTS,
  HARNESS_VERSION_WINDOW_RULE,
  HARNESS_WARNING_REASONS,
  type HarnessCapabilityDeclaration,
  type HarnessInstance,
} from "../../packages/core/src/contracts/index";
import {
  classifyHarnessEvidence,
  harnessCapabilityViolations,
} from "../../packages/core/src/domain/index";

const ROOT = process.cwd();
const harnessFiles = (): string[] => [
  "packages/core/src/contracts/harness.ts",
  "packages/core/src/contracts/harness-telemetry.ts",
];

const fullDeclaration = (): HarnessCapabilityDeclaration => ({
  supportedOperations: [...HARNESS_OPERATIONS],
  lifecycleCapabilities: [...HARNESS_LIFECYCLE_CAPABILITIES],
  livenessSources: [...HARNESS_LIVENESS_KINDS],
  declaredGaps: [],
});

/**
 * A derived copy of the shipped declaration (F-10): drift-rejection demos
 * mutate one field, so the fixture can never silently diverge from production.
 */
const claudeDeclaration = (): HarnessCapabilityDeclaration => ({
  supportedOperations: [...CLAUDE_CAPABILITIES.supportedOperations],
  lifecycleCapabilities: [...CLAUDE_CAPABILITIES.lifecycleCapabilities],
  livenessSources: [...CLAUDE_CAPABILITIES.livenessSources],
  declaredGaps: CLAUDE_CAPABILITIES.declaredGaps.map((gap) => ({ ...gap })),
});

describe("TC-HARN-001 closed harness vocabularies", () => {
  test("harness kinds are a closed, duplicate-free set with no wildcard", () => {
    expect([...HARNESS_KINDS]).toEqual(["opencode", "claude-code"]);
    expect(new Set(HARNESS_KINDS).size).toBe(HARNESS_KINDS.length);
    for (const value of HARNESS_KINDS) {
      expect(["any", "unknown", "*"]).not.toContain(value);
    }
  });

  test("operations, lifecycle capabilities, and liveness kinds are closed and clean", () => {
    for (const vocabulary of [
      HARNESS_OPERATIONS,
      HARNESS_LIFECYCLE_CAPABILITIES,
      HARNESS_LIVENESS_KINDS,
      HARNESS_GAP_REASONS,
      HARNESS_OUTCOMES,
    ]) {
      expect(new Set(vocabulary).size).toBe(vocabulary.length);
      for (const value of vocabulary) {
        expect(["any", "unknown", "*"]).not.toContain(value);
      }
    }
    expect([...HARNESS_LIVENESS_KINDS]).toEqual([
      "session-traffic",
      "worktree-activity",
      "process",
    ]);
  });

  test("the outcome-to-token projection only names taxonomy tokens", () => {
    const tokens = Object.values(HARNESS_CLASSIFICATION_TOKENS);
    expect(new Set(tokens).size).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(typeof token).toBe("string");
    }
  });

  test("declaration validation accepts exhaustive declarations and rejects drift", () => {
    expect(harnessCapabilityViolations("opencode", fullDeclaration())).toEqual([]);
    expect(harnessCapabilityViolations("claude-code", claudeDeclaration())).toEqual([]);

    const missing: HarnessCapabilityDeclaration = {
      ...fullDeclaration(),
      supportedOperations: ["spawn"],
      declaredGaps: [],
    };
    const violations = harnessCapabilityViolations("broken", missing);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.join("\n")).toContain("deliver");

    const contradictory: HarnessCapabilityDeclaration = {
      ...claudeDeclaration(),
      supportedOperations: ["spawn", "deliver", "collect", "resume"],
    };
    expect(harnessCapabilityViolations("contradictory", contradictory).join("\n")).toContain(
      "both supported and a gap",
    );
  });

  test("the instance carries exactly kind, observed version, warning, and declaration", () => {
    const instance: HarnessInstance = {
      kind: "opencode",
      observedVersion: "synthetic-1.2.3",
      capabilities: fullDeclaration(),
    };
    expect(Object.keys(instance).sort()).toEqual(["capabilities", "kind", "observedVersion"]);
    expect(instance.observedVersion).toBe("synthetic-1.2.3");
    const unknown: HarnessInstance = {
      kind: "opencode",
      observedVersion: null,
      versionWarning: "version-probe-failed",
      capabilities: fullDeclaration(),
    };
    expect(unknown.observedVersion).toBeNull();
  });

  test("the classifier keeps completed, premature end, and failed distinct", () => {
    const base = {
      exitStatus: 0,
      timedOut: false,
      spawnRefused: false,
      failureReported: false,
      toolFailure: false,
    };
    const completed = classifyHarnessEvidence({ ...base, completionMarker: true });
    const premature = classifyHarnessEvidence({ ...base, completionMarker: false });
    const failed = classifyHarnessEvidence({ ...base, completionMarker: false, exitStatus: 3 });
    expect(completed.outcome).toBe("completed");
    expect(premature.outcome).toBe("premature-end");
    expect(failed.outcome).toBe("failed");
    expect(new Set([completed.token, premature.token, failed.token]).size).toBe(3);
  });

  test("contract modules are data-only and import only sibling contract modules", () => {
    for (const file of harnessFiles()) {
      const source = ts.createSourceFile(
        file,
        readFileSync(join(ROOT, file), "utf8"),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      const allowed = new Set<ts.SyntaxKind>([
        ts.SyntaxKind.TypeAliasDeclaration,
        ts.SyntaxKind.InterfaceDeclaration,
        ts.SyntaxKind.ImportDeclaration,
        ts.SyntaxKind.ExportDeclaration,
        ts.SyntaxKind.VariableStatement,
        ts.SyntaxKind.EndOfFileToken,
      ]);
      for (const statement of source.statements) {
        expect(allowed.has(statement.kind), `${file}: ${ts.SyntaxKind[statement.kind]}`).toBe(true);
        if (ts.isImportDeclaration(statement)) {
          const specifier = (statement.moduleSpecifier as ts.StringLiteral).text;
          expect(specifier.startsWith("."), `${file}: ${specifier}`).toBe(true);
        }
      }
      for (const statement of source.statements) {
        if (!ts.isVariableStatement(statement)) continue;
        for (const declaration of statement.declarationList.declarations) {
          expect(ts.isIdentifier(declaration.name)).toBe(true);
        }
      }
    }
  });

  test("the contract tier contains no runtime API imports", () => {
    const directory = join(ROOT, "packages/core/src/contracts");
    for (const entry of readdirSync(directory).filter((name) => name.endsWith(".ts"))) {
      const text = readFileSync(join(directory, entry), "utf8");
      expect(text).not.toContain('from "node:');
      expect(text).not.toContain('from "bun:');
    }
  });
});

describe("TC-HARN-002 / TC-HARN-003 adapter declarations (Phase 3)", () => {
  test("the opencode declaration is exhaustive, disjoint, and gap-bearing only where declared", async () => {
    const { OPENCODE_CAPABILITIES } = await import("../../packages/adapters/src/harness/index");
    expect(harnessCapabilityViolations("opencode", OPENCODE_CAPABILITIES)).toEqual([]);
    expect(OPENCODE_CAPABILITIES.livenessSources).toContain("session-traffic");
    expect(OPENCODE_CAPABILITIES.livenessSources).toContain("process");
    expect(OPENCODE_CAPABILITIES.declaredGaps).toEqual([
      { capability: "worktree-activity", reason: "provider-unsupported" },
    ]);
  });
});

describe("TC-HARN-002 Claude gaps visible before spawn", () => {
  test("the Claude declaration is exhaustive and surfaces resume as a gap", async () => {
    const { createClaudeInstance, createOpencodeInstance } = await import(
      "../../packages/adapters/src/harness/index"
    );
    const { inspectHarnessCapability } = await import("../../packages/core/src/domain/index");
    expect(harnessCapabilityViolations("claude-code", CLAUDE_CAPABILITIES)).toEqual([]);
    expect(CLAUDE_CAPABILITIES.supportedOperations).not.toContain("resume");
    expect(CLAUDE_CAPABILITIES.declaredGaps).toContainEqual({
      capability: "resume",
      reason: "headless-mode-limitation",
    });
    // F-1: the declaration is truthful about deliver, mirroring resume.
    expect(CLAUDE_CAPABILITIES.supportedOperations).not.toContain("deliver");
    expect(CLAUDE_CAPABILITIES.declaredGaps).toContainEqual({
      capability: "deliver",
      reason: "headless-mode-limitation",
    });
    for (const kind of ["session-traffic", "worktree-activity", "process"] as const) {
      expect(CLAUDE_CAPABILITIES.livenessSources).not.toContain(kind);
      expect(
        CLAUDE_CAPABILITIES.declaredGaps.some((gap) => gap.capability === kind),
        kind,
      ).toBe(true);
    }

    const claude = createClaudeInstance({ kind: "claude-code", observedVersion: "1.0.0" });
    const gap = inspectHarnessCapability(claude, "resume");
    expect(gap.supported).toBe(false);
    if (!gap.supported) {
      expect(gap.gap).toEqual({
        harnessKind: "claude-code",
        capability: "resume",
        reason: "headless-mode-limitation",
      });
    }
    const deliverGap = inspectHarnessCapability(claude, "deliver");
    expect(deliverGap.supported).toBe(false);
    if (!deliverGap.supported) {
      expect(deliverGap.gap).toEqual({
        harnessKind: "claude-code",
        capability: "deliver",
        reason: "headless-mode-limitation",
      });
    }
    const opencode = createOpencodeInstance({ kind: "opencode", observedVersion: "2.0.0" });
    expect(inspectHarnessCapability(opencode, "resume").supported).toBe(true);
    expect(inspectHarnessCapability(opencode, "deliver").supported).toBe(true);
  });
});

describe("TC-HARN-027 state additivity", () => {
  test("the schema version is unchanged and the telemetry kind is additive", async () => {
    const contracts = await import("../../packages/core/src/contracts/index");
    expect(contracts.STATE_SCHEMA_VERSION).toBe("delivery.state.v1");
    expect(contracts.HARNESS_TELEMETRY_RECORD_KIND).toBe("harness.telemetry");
    expect(contracts.HARNESS_TELEMETRY_SCHEMA_ID).not.toBe(contracts.STATE_SCHEMA_VERSION);
    expect(contracts.HARNESS_TELEMETRY_SCHEMA_ID).not.toBe(contracts.CLOSEOUT_SCHEMA_ID);
    expect(contracts.CLOSEOUT_OPERATION_RECORD_KIND).toBe("closeout.operation");
    expect(contracts.COMMIT_TELEMETRY_RECORD_KIND).toBe("commit.telemetry");
    expect(contracts.STATE_SALVAGE_RECORD_KIND).toBe("state.salvage");
  });
});

/**
 * TC-HARNESS-010 (record-content constant half) / TC-HARNESS-035 (identity half)
 * / AC-F5-7 (no-widening half) — the GH-335 contract additions: the pinned
 * window, the probe grammar, the closed mode and verdict vocabularies, the
 * single-seat binding, both additive optional input members, the four new
 * refusal identities, and the observed-axis absence vocabulary.
 */
const typeAliasSource = (file: string, name: string): string => {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  for (const statement of source.statements) {
    if (ts.isTypeAliasDeclaration(statement) && statement.name.text === name) {
      return statement.getText(source);
    }
  }
  return "";
};

describe("TC-HARNESS-010/035 GH-335 contract surface", () => {
  test("the window is pinned data with the rule beside its delivery value", () => {
    expect([...HARNESS_SUPPORTED_VERSION_WINDOW.minors]).toEqual(["2.3", "2.2"]);
    expect(HARNESS_SUPPORTED_VERSION_WINDOW.rule).toBe(
      "current-minor-at-delivery-plus-one-previous-minor",
    );
    expect(HARNESS_VERSION_WINDOW_RULE).toContain(
      "current minor line at delivery time plus one previous minor",
    );
    expect(HARNESS_VERSION_MAX_CHARS).toBe(32);
  });

  test("the probe grammar accepts the observed forms and rejects every off-grammar shape", () => {
    for (const accepted of ["opencode v2.3.2", "opencode 2.3.2", "opencode v2.2.5"]) {
      expect(HARNESS_VERSION_PROBE_PATTERN.test(accepted), accepted).toBe(true);
    }
    for (const rejected of [
      "2.3.2",
      "v2.3.2",
      "latest",
      "2.three.2",
      "2.3.x",
      "opencode v2.3",
      "opencode v2.3.2.1",
      "opencode v2.3.2 extra",
      "opencode v2.3.2\nopencode v2.1.7",
      "",
    ]) {
      expect(HARNESS_VERSION_PROBE_PATTERN.test(rejected), JSON.stringify(rejected)).toBe(false);
    }
    expect([...HARNESS_VERSION_VERDICTS]).toEqual(["inside", "outside", "indeterminate"]);
    expect(HARNESS_VERSION_PROBE_TIMEOUT_MS).toBe(5000);
  });

  test("the mode vocabulary is closed, surface-mapped, and has exactly one default", () => {
    expect([...HARNESS_MODES]).toEqual([
      "per-invocation-private-server",
      "managed-background-service",
      "running-server-client",
    ]);
    for (const mode of HARNESS_MODES) {
      expect(Object.hasOwn(HARNESS_MODE_SURFACES, mode), mode).toBe(true);
      expect(HARNESS_MODE_SURFACES[mode].length).toBeGreaterThan(0);
    }
    expect(Object.keys(HARNESS_MODE_SURFACES).sort()).toEqual([...HARNESS_MODES].sort());
    expect((HARNESS_MODES as readonly string[]).includes(DEFAULT_HARNESS_MODE)).toBe(true);
    expect([...HARNESS_MODE_ORIGINS]).toEqual(["defaults", "configured"]);
  });

  test("the failure vocabulary grows by exactly four and adds no absence or unassigned code", () => {
    expect(HARNESS_FAILURE_CODES).toHaveLength(13);
    for (const delivered of [
      "harness.spawn.invalid-output",
      "harness.spawn.refused",
      "harness.spawn.variable-missing",
      "harness.session.unknown",
      "harness.capability.gap",
      "harness.listing.invalid-output",
      "harness.telemetry.unattributable",
      "harness.telemetry.invalid-identity",
      "harness.telemetry.extraction-failed",
    ]) {
      expect(HARNESS_FAILURE_CODES as readonly string[]).toContain(delivered);
    }
    for (const added of [
      "harness.version.unsupported",
      "harness.version.unknown",
      "harness.mode.unavailable",
      "harness.profile.model-unrepresentable",
    ]) {
      expect(HARNESS_FAILURE_CODES as readonly string[]).toContain(added);
    }
    expect(
      (HARNESS_FAILURE_CODES as readonly string[]).some((code) => code.includes("absent")),
    ).toBe(false);
    expect(
      (HARNESS_FAILURE_CODES as readonly string[]).filter((code) =>
        code.startsWith("harness.profile."),
      ),
    ).toEqual(["harness.profile.model-unrepresentable"]);
  });

  test("both additive optional input members are declared, one seat per binding", () => {
    const spawn = typeAliasSource("packages/core/src/contracts/harness.ts", "HarnessSpawnInput");
    const resume = typeAliasSource("packages/core/src/contracts/harness.ts", "HarnessResumeInput");
    const binding = typeAliasSource("packages/core/src/contracts/harness.ts", "HarnessSeatBinding");
    for (const source of [spawn, resume]) {
      expect(source).toContain("readonly agent?: string;");
      expect(source).toContain("readonly binding?: HarnessSeatBinding;");
    }
    expect(binding).toContain("readonly agent: string;");
    expect(binding).toContain("readonly seat: string;");
    expect(binding).toContain("readonly resolvedModel: string;");
    expect(binding).toContain("readonly envName?: string;");
    // A binding carries no seat map and no repeated seat member.
    expect(binding).not.toContain("seats");
    expect([...HARNESS_BINDING_RESOLUTION_OUTCOMES]).toEqual(["binding", "no-agent", "unassigned"]);
    expect(HARNESS_MODEL_EXPRESSION_MAX_CHARS).toBe(200);
  });

  test("the instance carries the additive verdict, mode, and origin optionally", () => {
    const instance = typeAliasSource("packages/core/src/contracts/harness.ts", "HarnessInstance");
    expect(instance).toContain("readonly versionVerdict?: HarnessVersionVerdict;");
    expect(instance).toContain("readonly mode?: HarnessMode;");
    expect(instance).toContain("readonly modeOrigin?: HarnessModeOrigin;");
    expect(instance).toContain("readonly observedVersion: string | null;");
  });

  test("the observed-axis absence vocabulary and placeholder live in the telemetry contract", () => {
    expect([...HARNESS_OBSERVED_AXES]).toEqual(["agent", "model"]);
    expect(HARNESS_OBSERVED_ABSENCE_PLACEHOLDER).toBe("");
    expect(HARNESS_UNRESOLVED_SEAT_REASON).toBe("unresolved-seat");
    for (const reason of [
      "model-divergence",
      "agent-divergence",
      "duration-absent",
      "unresolved-seat",
      "no-tool-source",
      "no-usage-fact",
    ]) {
      expect(HARNESS_WARNING_REASONS as readonly string[]).toContain(reason);
    }
    expect([...HARNESS_ABSENCE_REASONS]).toEqual(["session-not-in-store"]);
    expect([...HARNESS_MANDATORY_USAGE_FACTS]).toEqual(["token", "cost"]);
    const record = typeAliasSource(
      "packages/core/src/contracts/harness-telemetry.ts",
      "HarnessTelemetryRecord",
    );
    expect(record).toContain("readonly seat?: string | null;");
    expect(record).toContain("readonly resolvedModel?: string | null;");
    expect(record).toContain("readonly durations?: HarnessTelemetryDurations;");
    expect(record).toContain("readonly absentObservedAxes?: readonly HarnessObservedAxis[];");
    // No duplicate observed-identity member and no widening of the delivered fields.
    expect(record).not.toContain("readonly observedModel");
    expect(record).not.toContain("readonly agentRole");
    expect(record).toContain("readonly agent: string;");
    expect(record).toContain("readonly model: string;");
    expect(record).not.toContain("readonly agent: string | null;");
  });
});
