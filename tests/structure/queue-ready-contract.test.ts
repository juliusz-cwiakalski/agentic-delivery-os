/**
 * TC-QREADY-024 — declared constants and closed vocabularies.
 *
 * Every constant is bound to Appendix C, the 41-reason set to DM-10, the six
 * reason groups to DM-1, and the tests-only live literal to RES-3. The live
 * change spec is read read-only (token presence + unchanged mtime, no digest).
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  QUEUE_READY_ASSOCIATED_COUNT_RANGE,
  QUEUE_READY_BRANCH_SEGMENT_MIN,
  QUEUE_READY_CLOSE_CLASSES,
  QUEUE_READY_CONDITION_ORDER,
  QUEUE_READY_CONDITION_STATES,
  QUEUE_READY_EVIDENCE_REASONS,
  QUEUE_READY_EVIDENCE_SOURCES,
  QUEUE_READY_MAX_BRANCH_CHARS,
  QUEUE_READY_MAX_CANDIDATES,
  QUEUE_READY_MAX_DETAIL_CHARS,
  QUEUE_READY_MAX_EVIDENCE_PER_CONDITION,
  QUEUE_READY_MAX_HUMAN_BYTES,
  QUEUE_READY_MAX_HUMAN_LINES,
  QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES,
  QUEUE_READY_MAX_IDENTITY_CHARS,
  QUEUE_READY_MAX_LABEL_CHARS,
  QUEUE_READY_MAX_LABELS,
  QUEUE_READY_MAX_MACHINE_BYTES,
  QUEUE_READY_MAX_OWNER_CHARS,
  QUEUE_READY_MAX_POSITIONALS,
  QUEUE_READY_MAX_REASONS,
  QUEUE_READY_MAX_REF_CHARS,
  QUEUE_READY_MAX_RELATIONS,
  QUEUE_READY_MAX_REPO_NAME_CHARS,
  QUEUE_READY_MAX_TIMESTAMP_CHARS,
  QUEUE_READY_MAX_WORK_ITEM_REF_CHARS,
  QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN,
  QUEUE_READY_OWNER_ATTENTION_LABELS,
  QUEUE_READY_PAYLOAD_MARKER_REASONS,
  QUEUE_READY_RANK_CLASS_ORDER,
  QUEUE_READY_REASON_ORDER,
  QUEUE_READY_SCHEMA_VERSION,
  QUEUE_READY_SOURCE_FAILURE_REASONS,
  QUEUE_READY_SOURCE_ITEM_LIMIT,
  QUEUE_READY_SOURCE_PIPELINE_LIMIT,
  QUEUE_READY_TIER_LABELS,
  QUEUE_READY_WORK_ITEM_REF_PATTERN,
  STATUS_SOURCE_ITEM_LIMIT,
  STATUS_SOURCE_PIPELINE_LIMIT,
} from "../../packages/core/src/contracts/index";
import * as contracts from "../../packages/core/src/contracts/index";
import * as domain from "../../packages/core/src/domain/index";
import * as ciResult from "../../packages/core/src/domain/ci-result";
import * as core from "../../packages/core/src/index";

const ROOT = process.cwd();
const SPEC = "doc/changes/2026-10/2026-10-31--GH-176--queue-ready/chg-GH-176-spec.md";
const HARNESS = "tests/fixtures/queue-ready/harness.ts";

const listPackagesTypeScript = (): string[] => {
  const results: string[] = [];
  const walk = (path: string): void => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name === "dist" || entry.name === "node_modules") continue;
        walk(join(path, entry.name));
      } else if (entry.name.endsWith(".ts")) {
        results.push(join(path, entry.name));
      }
    }
  };
  walk(join(ROOT, "packages"));
  return results;
};

type ConstantInput = {
  readonly schemaVersion: string;
  readonly conditionOrder: readonly string[];
  readonly states: readonly string[];
  readonly closeClasses: readonly string[];
  readonly rankOrder: readonly string[];
  readonly maxCandidates: number;
  readonly maxPositionals: number;
  readonly maxEvidence: number;
  readonly maxReasons: number;
  readonly maxDetail: number;
  readonly maxRefLength: number;
  readonly maxMachineBytes: number;
  readonly maxHumanLines: number;
  readonly maxHumanBytes: number;
  readonly sourceItemLimit: number;
  readonly sourcePipelineLimit: number;
  readonly identity: number;
  readonly ref: number;
  readonly labelChars: number;
  readonly labels: number;
  readonly relations: number;
  readonly owner: number;
  readonly repoName: number;
  readonly branch: number;
  readonly timestamp: number;
  readonly humanSegment: number;
  readonly numericPattern: string;
  readonly branchSegmentMin: number;
  readonly tierLabels: readonly string[];
  readonly ownerLabels: readonly string[];
  readonly refPattern: string;
  readonly reasons: readonly string[];
  readonly sources: readonly string[];
  readonly payloadMarkers: readonly string[];
  readonly sourceFailures: readonly string[];
  readonly reasonGroups: readonly { readonly group: string; readonly reasons: readonly string[] }[];
};

const validate = (value: ConstantInput): string[] => {
  const failures: string[] = [];
  const eq = (name: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      failures.push(`${name}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`);
    }
  };
  eq("QUEUE_READY_SCHEMA_VERSION", value.schemaVersion, "delivery.queue-ready.v1");
  eq("QUEUE_READY_CONDITION_ORDER", value.conditionOrder, [
    "deps-satisfied",
    "repo-free",
    "tier-known",
    "no-owner-gate",
    "ci-healthy",
    "provider-available",
  ]);
  eq("QUEUE_READY_CONDITION_STATES", value.states, ["satisfied", "unsatisfied", "unknown"]);
  eq("QUEUE_READY_CLOSE_CLASSES", value.closeClasses, [
    "merge-ready",
    "review-pending",
    "new-start",
    "unknown",
    "not-ready",
  ]);
  eq("QUEUE_READY_RANK_CLASS_ORDER", value.rankOrder, [
    "merge-ready",
    "review-pending",
    "new-start",
    "unknown",
    "not-ready",
  ]);
  eq("QUEUE_READY_MAX_CANDIDATES", value.maxCandidates, 8);
  eq("QUEUE_READY_MAX_POSITIONALS", value.maxPositionals, 33);
  eq("QUEUE_READY_MAX_EVIDENCE_PER_CONDITION", value.maxEvidence, 2);
  eq("QUEUE_READY_MAX_REASONS", value.maxReasons, 6);
  eq("QUEUE_READY_MAX_DETAIL_CHARS", value.maxDetail, 160);
  eq("QUEUE_READY_MAX_WORK_ITEM_REF_CHARS", value.maxRefLength, 64);
  eq("QUEUE_READY_MAX_MACHINE_BYTES", value.maxMachineBytes, 65536);
  eq("QUEUE_READY_MAX_HUMAN_LINES", value.maxHumanLines, 16);
  eq("QUEUE_READY_MAX_HUMAN_BYTES", value.maxHumanBytes, 4096);
  eq("QUEUE_READY_SOURCE_ITEM_LIMIT", value.sourceItemLimit, 100);
  eq("QUEUE_READY_SOURCE_PIPELINE_LIMIT", value.sourcePipelineLimit, 20);
  eq("QUEUE_READY_MAX_IDENTITY_CHARS", value.identity, 128);
  eq("QUEUE_READY_MAX_REF_CHARS", value.ref, 128);
  eq("QUEUE_READY_MAX_LABEL_CHARS", value.labelChars, 128);
  eq("QUEUE_READY_MAX_LABELS", value.labels, 16);
  eq("QUEUE_READY_MAX_RELATIONS", value.relations, 16);
  eq("QUEUE_READY_MAX_OWNER_CHARS", value.owner, 128);
  eq("QUEUE_READY_MAX_REPO_NAME_CHARS", value.repoName, 128);
  eq("QUEUE_READY_MAX_BRANCH_CHARS", value.branch, 256);
  eq("QUEUE_READY_MAX_TIMESTAMP_CHARS", value.timestamp, 40);
  eq("QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES", value.humanSegment, 32);
  eq("QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN", value.numericPattern, "^[0-9]+$");
  eq("QUEUE_READY_BRANCH_SEGMENT_MIN", value.branchSegmentMin, 3);
  eq("QUEUE_READY_TIER_LABELS", value.tierLabels, [
    "priority:high",
    "priority:medium",
    "priority:low",
  ]);
  eq("QUEUE_READY_OWNER_ATTENTION_LABELS", value.ownerLabels, ["hand-back", "human-input-needed"]);
  eq("QUEUE_READY_WORK_ITEM_REF_PATTERN", value.refPattern, "^[A-Za-z][A-Za-z0-9]*-[0-9]+$");
  if (value.reasons.length !== 41) failures.push(`reason count ${value.reasons.length} != 41`);
  if (!value.reasons.includes("value-clamped")) failures.push("reason set lacks value-clamped");
  eq("QUEUE_READY_EVIDENCE_SOURCES", value.sources, [
    "tracker",
    "changes",
    "ci",
    "provider-config",
    "provider-parks",
    "local-context",
    "repository-binding",
  ]);
  eq("QUEUE_READY_PAYLOAD_MARKER_REASONS", value.payloadMarkers, [
    "source-truncated",
    "value-clamped",
  ]);
  eq("QUEUE_READY_SOURCE_FAILURE_REASONS", value.sourceFailures, [
    "read-failed",
    "credential-unavailable",
    "signal-unavailable",
    "work-item-unobserved",
    "commit-unresolved",
    "local-context-missing",
    "local-context-malformed",
  ]);
  eq(
    "QUEUE_READY_REASON_ORDER",
    value.reasonGroups.map((group) => [group.group, group.reasons]),
    [
      ["binding", ["addressing-unresolved", "remote-unsupported"]],
      ["payload-markers", ["source-truncated", "value-clamped"]],
      [
        "provider-config",
        ["config-invalid", "provider-chain-not-declared", "provider-chain-unresolved"],
      ],
      ["park-fold", ["state-unreadable"]],
      [
        "condition-source-failure",
        [
          "read-failed",
          "credential-unavailable",
          "signal-unavailable",
          "work-item-unobserved",
          "commit-unresolved",
          "local-context-missing",
          "local-context-malformed",
        ],
      ],
      ["close-association", ["pr-association-unknown"]],
    ],
  );
  return failures;
};

const live = (): ConstantInput => ({
  schemaVersion: QUEUE_READY_SCHEMA_VERSION,
  conditionOrder: QUEUE_READY_CONDITION_ORDER,
  states: QUEUE_READY_CONDITION_STATES,
  closeClasses: QUEUE_READY_CLOSE_CLASSES,
  rankOrder: QUEUE_READY_RANK_CLASS_ORDER,
  maxCandidates: QUEUE_READY_MAX_CANDIDATES,
  maxPositionals: QUEUE_READY_MAX_POSITIONALS,
  maxEvidence: QUEUE_READY_MAX_EVIDENCE_PER_CONDITION,
  maxReasons: QUEUE_READY_MAX_REASONS,
  maxDetail: QUEUE_READY_MAX_DETAIL_CHARS,
  maxRefLength: QUEUE_READY_MAX_WORK_ITEM_REF_CHARS,
  maxMachineBytes: QUEUE_READY_MAX_MACHINE_BYTES,
  maxHumanLines: QUEUE_READY_MAX_HUMAN_LINES,
  maxHumanBytes: QUEUE_READY_MAX_HUMAN_BYTES,
  sourceItemLimit: QUEUE_READY_SOURCE_ITEM_LIMIT,
  sourcePipelineLimit: QUEUE_READY_SOURCE_PIPELINE_LIMIT,
  identity: QUEUE_READY_MAX_IDENTITY_CHARS,
  ref: QUEUE_READY_MAX_REF_CHARS,
  labelChars: QUEUE_READY_MAX_LABEL_CHARS,
  labels: QUEUE_READY_MAX_LABELS,
  relations: QUEUE_READY_MAX_RELATIONS,
  owner: QUEUE_READY_MAX_OWNER_CHARS,
  repoName: QUEUE_READY_MAX_REPO_NAME_CHARS,
  branch: QUEUE_READY_MAX_BRANCH_CHARS,
  timestamp: QUEUE_READY_MAX_TIMESTAMP_CHARS,
  humanSegment: QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES,
  numericPattern: QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN,
  branchSegmentMin: QUEUE_READY_BRANCH_SEGMENT_MIN,
  tierLabels: QUEUE_READY_TIER_LABELS,
  ownerLabels: QUEUE_READY_OWNER_ATTENTION_LABELS,
  refPattern: QUEUE_READY_WORK_ITEM_REF_PATTERN,
  reasons: QUEUE_READY_EVIDENCE_REASONS,
  sources: QUEUE_READY_EVIDENCE_SOURCES,
  payloadMarkers: QUEUE_READY_PAYLOAD_MARKER_REASONS,
  sourceFailures: QUEUE_READY_SOURCE_FAILURE_REASONS,
  reasonGroups: QUEUE_READY_REASON_ORDER,
});

describe("TC-QREADY-024 declared constants and closed vocabularies", () => {
  test("every constant equals Appendix C", () => {
    expect(validate(live())).toEqual([]);
  });

  test("the source limits equal the delivered status constants", () => {
    expect(QUEUE_READY_SOURCE_ITEM_LIMIT).toBe(STATUS_SOURCE_ITEM_LIMIT);
    expect(QUEUE_READY_SOURCE_PIPELINE_LIMIT).toBe(STATUS_SOURCE_PIPELINE_LIMIT);
  });

  test("the associatedCount range is 0..100", () => {
    expect(QUEUE_READY_ASSOCIATED_COUNT_RANGE).toEqual({ min: 0, max: 100 });
  });

  test("the human segment cap is byte-named and the old character name is gone", () => {
    expect(QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES).toBe(32);
    const oldName = ["QUEUE_READY_MAX_HUMAN_SEGMENT", "CHARS"].join("_");
    expect(Object.prototype.hasOwnProperty.call(contracts, oldName)).toBe(false);
  });

  test("the queue-ready public additions are exactly evaluateQueueReady and renderQueueReadyHuman", () => {
    for (const surface of [core, domain]) {
      expect(typeof surface.evaluateQueueReady).toBe("function");
      expect(typeof surface.renderQueueReadyHuman).toBe("function");
    }
    const classifierName = ["classify", "PipelineRuns"].join("");
    expect(classifierName in core).toBe(false);
    expect(classifierName in domain).toBe(false);
    expect(typeof ciResult.classifyPipelineRuns).toBe("function");
    for (const modulePath of [
      "packages/core/src/domain/status.ts",
      "packages/core/src/domain/queue-ready.ts",
    ]) {
      const text = readFileSync(join(ROOT, modulePath), "utf8");
      expect(text.includes('from "./ci-result.js"'), modulePath).toBe(true);
    }
  });

  test("mutation controls fail by name", () => {
    const mutations: readonly [string, (value: ConstantInput) => ConstantInput][] = [
      ["cap", (v) => ({ ...v, identity: 127 })],
      ["human segment byte cap", (v) => ({ ...v, humanSegment: 31 })],
      ["numeric pattern", (v) => ({ ...v, numericPattern: "^[0-9]*$" })],
      ["condition", (v) => ({ ...v, conditionOrder: [...v.conditionOrder].reverse() })],
      ["state", (v) => ({ ...v, states: ["satisfied", "unsatisfied", "clear"] })],
      [
        "marker",
        (v) => ({
          ...v,
          reasonGroups: v.reasonGroups.map((g) =>
            g.group === "payload-markers"
              ? { ...g, reasons: ["value-clamped", "source-truncated"] }
              : g,
          ),
        }),
      ],
      ["schema", (v) => ({ ...v, schemaVersion: "delivery.queue-ready.v2" })],
      ["reason", (v) => ({ ...v, reasons: v.reasons.filter((r) => r !== "value-clamped") })],
    ];
    for (const [label, mutate] of mutations) {
      const failures = validate(mutate(live()));
      expect(failures.length, label).toBeGreaterThan(0);
    }
  });

  test("no live-switch constant is declared anywhere under packages/**", () => {
    for (const file of listPackagesTypeScript()) {
      const text = readFileSync(file, "utf8");
      expect(text.includes("QUEUE_READY_LIVE"), file).toBe(false);
      expect(text.includes("ADOS_QUEUE_READY_LIVE"), file).toBe(false);
    }
  });

  test("the harness binds the tests-only live literal and gates on exactly 1", () => {
    const text = readFileSync(join(ROOT, HARNESS), "utf8");
    expect(text.includes("ADOS_QUEUE_READY_LIVE")).toBe(true);
    expect(text.includes('=== "1"')).toBe(true);
  });

  test("the spec pins the projection caps, human segment cap, numeric pattern, and value-clamped", () => {
    const path = join(ROOT, SPEC);
    const before = statSync(path).mtimeMs;
    const text = readFileSync(path, "utf8");
    for (const token of [
      "QUEUE_READY_MAX_IDENTITY_CHARS",
      "QUEUE_READY_MAX_REF_CHARS",
      "QUEUE_READY_MAX_LABEL_CHARS",
      "QUEUE_READY_MAX_LABELS",
      "QUEUE_READY_MAX_RELATIONS",
      "QUEUE_READY_MAX_OWNER_CHARS",
      "QUEUE_READY_MAX_REPO_NAME_CHARS",
      "QUEUE_READY_MAX_BRANCH_CHARS",
      "QUEUE_READY_MAX_TIMESTAMP_CHARS",
      "QUEUE_READY_MAX_HUMAN_SEGMENT_BYTES",
      "QUEUE_READY_NUMERIC_ENTITY_ID_PATTERN",
      "value-clamped",
    ]) {
      expect(text.includes(token), token).toBe(true);
    }
    expect(statSync(path).mtimeMs).toBe(before);
  });
});
