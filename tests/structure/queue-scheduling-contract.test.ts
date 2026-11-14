/**
 * TC-VOCAB-001 / TC-VOCAB-002 / TC-VOCAB-003 / TC-VOCAB-004 / TC-VOCAB-005
 * (GH-237) — the scheduling vocabulary, record kinds, error identities, and
 * typed configuration branch are closed data, declared once, and synchronized.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import {
  claimQueueLease,
  declareQueueEntry,
  readQueueIncidents,
  readQueueLeases,
  readQueueParks,
  recoverQueueParks,
  releaseQueueLease,
} from "../../packages/core/src/app/index";
import { PRODUCTION_CATALOG, resolveQueueSettings } from "../../packages/core/src/config/index";
import {
  BOARD_COLLECTOR_IDS,
  DOMAIN_KINDS,
  ERROR_TABLE,
  QUEUE_BLOCKING_REASONS,
  QUEUE_CLAIM_RESULTS,
  QUEUE_CONFIG_KEY_LEASE_TTL,
  QUEUE_CONFIG_KEY_PARK_RECHECK,
  QUEUE_DEFAULT_LEASE_TTL_MS,
  QUEUE_DEFAULT_NEXT_ACTIONS,
  QUEUE_DEFAULT_PRIORITY,
  QUEUE_DEGRADATION_REASONS,
  QUEUE_DEPENDENCY_KEY_PREFIX,
  QUEUE_DEPENDENCY_MUTATION_RESULTS,
  QUEUE_DEPENDENCY_RECORD_KIND,
  QUEUE_DEPENDENCY_SCHEMA,
  QUEUE_ENTRY_KEY_PREFIX,
  QUEUE_ENTRY_RECORD_KIND,
  QUEUE_ENTRY_SCHEMA,
  QUEUE_ERROR_CODES,
  QUEUE_GRAPH_DOCUMENT_NAME,
  QUEUE_GRAPH_SCHEMA,
  QUEUE_IMPLEMENTED_LEASE_SCOPES,
  QUEUE_INCIDENT_KEY_PREFIX,
  QUEUE_INCIDENT_RECORD_KIND,
  QUEUE_INCIDENT_SCHEMA,
  QUEUE_INCIDENT_TYPES,
  QUEUE_LANE_IDLE_REASONS,
  QUEUE_LANE_STATES,
  QUEUE_LANES_SCHEMA_VERSION,
  QUEUE_LEASE_KEY_PREFIX,
  QUEUE_LEASE_OPERATIONS,
  QUEUE_LEASE_RECORD_KIND,
  QUEUE_LEASE_SCHEMA,
  QUEUE_LEASE_SCOPES,
  QUEUE_MAX_DEPLOY_READS,
  QUEUE_MAX_EDGES_PER_ENTRY,
  QUEUE_MAX_ENTRIES,
  QUEUE_MAX_EVALUATED_CANDIDATES,
  QUEUE_MAX_FINDINGS,
  QUEUE_MAX_HUMAN_BYTES,
  QUEUE_MAX_HUMAN_LINES,
  QUEUE_MAX_LANES,
  QUEUE_MAX_MACHINE_BYTES,
  QUEUE_MAX_NEXT_ACTIONS,
  QUEUE_MAX_REASONS,
  QUEUE_MIN_RENEWAL_MS,
  QUEUE_MUTATION_RESULTS,
  QUEUE_PARK_CAUSE_CONDITION_PAIRS,
  QUEUE_PARK_CAUSES,
  QUEUE_PARK_CONDITION_TYPES,
  QUEUE_PARK_KEY_PREFIX,
  QUEUE_PARK_RECHECK_DEFAULTS,
  QUEUE_PARK_RECORD_KIND,
  QUEUE_PARK_RECOVERY_STATES,
  QUEUE_PARK_SCHEMA,
  QUEUE_PRECEDENCE_STEP_IDS,
  QUEUE_RANK_CLASSES,
  QUEUE_RECONCILE_RESULTS,
  QUEUE_RECORD_DECLARATIONS,
  QUEUE_RELEASE_RESULTS,
  QUEUE_REMOVAL_KEY_PREFIX,
  QUEUE_REMOVAL_REASONS,
  QUEUE_REMOVAL_RECORD_KIND,
  QUEUE_REMOVAL_RESULTS,
  QUEUE_REMOVAL_SCHEMA,
  QUEUE_SCHEMA_VERSION,
  QUEUE_STUCK_PARK_FINDING_CODE,
  QUEUE_WEIGHT_CLASS_SOURCES,
  QUEUE_WEIGHT_CLASSES,
  STATE_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import { resolveConfig } from "../../packages/core/src/index";
import { makeAuditStore } from "../fixtures/state/harness";

const ROOT = process.cwd();
const CONTRACT = "packages/core/src/contracts/queue.ts";

type ClosedSets = {
  leaseScopes: string[];
  implementedLeaseScopes: string[];
  leaseOperations: string[];
  weightClasses: string[];
  weightClassSources: string[];
  rankClasses: string[];
  parkConditionTypes: string[];
  parkCauses: string[];
  parkPairing: Array<{ cause: string; conditionType: string }>;
  removalReasons: string[];
  removalResults: string[];
  mutationResults: string[];
  dependencyMutationResults: string[];
  reconcileResults: string[];
  recoveryStates: string[];
  incidentTypes: string[];
  laneStates: string[];
  laneIdleReasons: string[];
  blockingReasons: string[];
  precedenceStepIds: number[];
  bounds: Record<string, number>;
};

type RecordKinds = {
  records: Array<{
    kind: string;
    payloadSchema: string;
    keyPrefix: string;
    identityField: string;
  }>;
  derivedDocument: { schema: string; name: string };
  stateSchemaVersion: string;
};

type ConfigCases = {
  defaults: { leaseTtlMs: number; parkRecheckMs: Record<string, number> };
  valid: { leaseTtlMs: number; parkRecheckMs: Record<string, number> };
  invalidValues: Array<{ key: string; value: number; code: string }>;
  unknownKeys: Array<{ key: string; code: string }>;
};

const readJson = <T>(relative: string): T =>
  JSON.parse(readFileSync(join(ROOT, relative), "utf8")) as T;

const closedSets = readJson<ClosedSets>("tests/fixtures/queue/vocabulary/closed-sets.json");
const recordKinds = readJson<RecordKinds>("tests/fixtures/queue/state/kinds/record-kinds.json");
const errorsFixture = readJson<{
  queueRows: string[];
  collectorIds: string[];
  collectorFamily: { prefix: string; suffix: string };
}>("tests/fixtures/queue/errors/references.json");
const configCases = readJson<ConfigCases>("tests/fixtures/queue/config/branch/cases.json");

const DATA_ONLY_STATEMENTS = new Set<number>([
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.ImportDeclaration,
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.VariableStatement,
  ts.SyntaxKind.EndOfFileToken,
]);

const dataOnlyViolations = (text: string, label = CONTRACT): string[] => {
  const source = ts.createSourceFile(label, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const violations: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) ||
      ts.isNewExpression(node) ||
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isClassDeclaration(node)
    ) {
      violations.push(`${label}: executable construct ${ts.SyntaxKind[node.kind]}`);
    }
    ts.forEachChild(node, visit);
  };
  for (const statement of source.statements) {
    if (!DATA_ONLY_STATEMENTS.has(statement.kind)) {
      violations.push(`${label}: executable statement ${ts.SyntaxKind[statement.kind]}`);
    }
    visit(statement);
  }
  return violations;
};

describe("TC-VOCAB-005 / TC-HOLDQUEUE-011 / TC-HOLDNEG-002 closed sets are exact and distinct", () => {
  test("lease, weight, and rank vocabularies are the declared closed sets", () => {
    expect([...QUEUE_LEASE_SCOPES]).toEqual(closedSets.leaseScopes);
    expect([...QUEUE_IMPLEMENTED_LEASE_SCOPES]).toEqual(closedSets.implementedLeaseScopes);
    expect([...QUEUE_LEASE_OPERATIONS]).toEqual(closedSets.leaseOperations);
    expect([...QUEUE_WEIGHT_CLASSES]).toEqual(closedSets.weightClasses);
    expect([...QUEUE_WEIGHT_CLASS_SOURCES]).toEqual(closedSets.weightClassSources);
    expect([...QUEUE_RANK_CLASSES]).toEqual(closedSets.rankClasses);
    expect(new Set(QUEUE_LEASE_SCOPES).size).toBe(2);
    expect(QUEUE_IMPLEMENTED_LEASE_SCOPES).toEqual(["repo-exclusive"]);
  });

  test("park causes and condition types are distinct closed sets with a one-to-one pairing", () => {
    expect([...QUEUE_PARK_CONDITION_TYPES]).toEqual(closedSets.parkConditionTypes);
    expect([...QUEUE_PARK_CAUSES]).toEqual(closedSets.parkCauses);
    expect(QUEUE_PARK_CAUSE_CONDITION_PAIRS.map((pair) => ({ ...pair }))).toEqual(
      closedSets.parkPairing,
    );
    // The two sets are distinct vocabularies: the cause set contains
    // preempted-for-close-item while the condition-type set contains preemption.
    expect([...QUEUE_PARK_CAUSES]).not.toEqual([...QUEUE_PARK_CONDITION_TYPES]);
    expect(QUEUE_PARK_CONDITION_TYPES as readonly string[]).toContain("preemption");
    expect(QUEUE_PARK_CAUSES as readonly string[]).not.toContain("preemption");
    expect(QUEUE_PARK_CAUSES as readonly string[]).toContain("preempted-for-close-item");
    // Every cause and every condition type participates in exactly one pairing.
    for (const cause of QUEUE_PARK_CAUSES) {
      expect(QUEUE_PARK_CAUSE_CONDITION_PAIRS.filter((pair) => pair.cause === cause)).toHaveLength(
        1,
      );
    }
    for (const conditionType of QUEUE_PARK_CONDITION_TYPES) {
      const causes = QUEUE_PARK_CAUSE_CONDITION_PAIRS.filter(
        (pair) => pair.conditionType === conditionType,
      ).length;
      // GH-294 DEC-2 supersedes the delivered injective pairing: `peak-window`
      // rides the existing `provider-window` condition type and `owner-hold`
      // joins on the read-time `preemption` type (no duplicate cause, no
      // silent rename), so those two condition types now carry two causes
      // each while `provider-quota` keeps exactly one.
      if (conditionType === "provider-quota") expect(causes).toBe(1);
      else expect(causes).toBe(2);
    }
    expect([...QUEUE_PARK_RECOVERY_STATES]).toEqual(closedSets.recoveryStates);
    expect([...QUEUE_INCIDENT_TYPES]).toEqual(closedSets.incidentTypes);
  });

  test("lane states and blocking reasons come only from the declared sets", () => {
    expect([...QUEUE_LANE_STATES]).toEqual(closedSets.laneStates);
    expect(QUEUE_LANE_STATES).toHaveLength(6);
    // D16/DoR-2: exact two-way ordered equality against the named fixture
    // arrays. A single token added, removed, reordered, or renamed fails here.
    expect([...QUEUE_LANE_IDLE_REASONS]).toEqual(closedSets.laneIdleReasons);
    expect([...QUEUE_BLOCKING_REASONS]).toEqual(closedSets.blockingReasons);
    expect(
      (QUEUE_LANE_IDLE_REASONS as readonly string[]).filter((reason) => reason === "owner-hold"),
    ).toHaveLength(1);
    expect(
      (QUEUE_BLOCKING_REASONS as readonly string[]).filter((reason) => reason === "owner-hold"),
    ).toHaveLength(1);
    for (const reason of QUEUE_LANE_IDLE_REASONS) {
      expect(QUEUE_BLOCKING_REASONS as readonly string[]).toContain(reason);
    }
    for (const condition of [
      "deps-satisfied",
      "repo-free",
      "tier-known",
      "no-owner-gate",
      "ci-healthy",
      "provider-available",
    ]) {
      expect(QUEUE_BLOCKING_REASONS as readonly string[]).toContain(condition);
    }
    expect([...QUEUE_PRECEDENCE_STEP_IDS]).toEqual(closedSets.precedenceStepIds);
  });

  test("the declared defaults, bounds, and caps are exact", () => {
    expect(QUEUE_DEFAULT_LEASE_TTL_MS).toBe(90_000);
    expect(QUEUE_MIN_RENEWAL_MS).toBe(1_000);
    expect(QUEUE_DEFAULT_PRIORITY).toBe(100);
    expect({ ...QUEUE_PARK_RECHECK_DEFAULTS }).toEqual(configCases.defaults.parkRecheckMs);
    const bounds = {
      entries: QUEUE_MAX_ENTRIES,
      edgesPerEntry: QUEUE_MAX_EDGES_PER_ENTRY,
      nextActions: QUEUE_MAX_NEXT_ACTIONS,
      defaultNextActions: QUEUE_DEFAULT_NEXT_ACTIONS,
      lanes: QUEUE_MAX_LANES,
      findings: QUEUE_MAX_FINDINGS,
      reasons: QUEUE_MAX_REASONS,
      machineBytes: QUEUE_MAX_MACHINE_BYTES,
      humanLines: QUEUE_MAX_HUMAN_LINES,
      humanBytes: QUEUE_MAX_HUMAN_BYTES,
      evaluatedCandidates: QUEUE_MAX_EVALUATED_CANDIDATES,
      deployReads: QUEUE_MAX_DEPLOY_READS,
    };
    expect(bounds).toEqual(closedSets.bounds);
  });

  test("no capacity, bandwidth, concurrency, or CI-slot key or reason exists", () => {
    for (const forbidden of ["capacity", "bandwidth", "concurrency", "ci-slot", "ci-slots"]) {
      expect((QUEUE_BLOCKING_REASONS as readonly string[]).includes(forbidden)).toBe(false);
      expect((QUEUE_LANE_IDLE_REASONS as readonly string[]).includes(forbidden)).toBe(false);
    }
  });
});

describe("TC-VOCAB-001 record kinds and the derived document", () => {
  test("exactly six additive kinds plus one derived document, with declared keys", () => {
    expect(QUEUE_RECORD_DECLARATIONS).toHaveLength(6);
    const declared = recordKinds.records;
    for (const expected of declared) {
      const declaration = QUEUE_RECORD_DECLARATIONS.find(
        (candidate) => candidate.kind === expected.kind,
      );
      expect(declaration, expected.kind).toMatchObject({
        payloadSchema: expected.payloadSchema,
        keyPrefix: expected.keyPrefix,
        identityField: expected.identityField,
      });
    }
    expect([
      QUEUE_ENTRY_RECORD_KIND,
      QUEUE_DEPENDENCY_RECORD_KIND,
      QUEUE_LEASE_RECORD_KIND,
      QUEUE_PARK_RECORD_KIND,
      QUEUE_INCIDENT_RECORD_KIND,
      QUEUE_REMOVAL_RECORD_KIND,
    ]).toEqual(declared.map((record) => record.kind));
    expect([
      QUEUE_ENTRY_SCHEMA,
      QUEUE_DEPENDENCY_SCHEMA,
      QUEUE_LEASE_SCHEMA,
      QUEUE_PARK_SCHEMA,
      QUEUE_INCIDENT_SCHEMA,
      QUEUE_REMOVAL_SCHEMA,
    ]).toEqual(declared.map((record) => record.payloadSchema));
    expect([
      QUEUE_ENTRY_KEY_PREFIX,
      QUEUE_DEPENDENCY_KEY_PREFIX,
      QUEUE_LEASE_KEY_PREFIX,
      QUEUE_PARK_KEY_PREFIX,
      QUEUE_INCIDENT_KEY_PREFIX,
      QUEUE_REMOVAL_KEY_PREFIX,
    ]).toEqual(declared.map((record) => record.keyPrefix));
    expect(QUEUE_GRAPH_SCHEMA).toBe(recordKinds.derivedDocument.schema);
    expect(QUEUE_GRAPH_DOCUMENT_NAME).toBe(recordKinds.derivedDocument.name);
    expect(STATE_SCHEMA_VERSION).toBe(recordKinds.stateSchemaVersion);
  });

  test("the payload schema ids are distinct from state, command, and engine ids", () => {
    const schemas = QUEUE_RECORD_DECLARATIONS.map((declaration) => declaration.payloadSchema);
    expect(new Set(schemas).size).toBe(schemas.length);
    for (const schema of [...schemas, QUEUE_GRAPH_SCHEMA]) {
      expect(schema).not.toBe(STATE_SCHEMA_VERSION);
      expect(schema.startsWith("delivery.state.")).toBe(false);
      expect(schema.startsWith("delivery.command.")).toBe(false);
      expect(schema.startsWith("delivery.engine.")).toBe(false);
      expect(schema.startsWith("delivery.queue.")).toBe(true);
    }
    expect(QUEUE_SCHEMA_VERSION).toBe("delivery.queue.v1");
    expect(QUEUE_LANES_SCHEMA_VERSION).toBe("delivery.lanes.v1");
    expect([...QUEUE_MUTATION_RESULTS]).toEqual(closedSets.mutationResults);
    expect([...QUEUE_CLAIM_RESULTS]).toEqual(["claimed", "renewed", "taken-over"]);
    expect([...QUEUE_RELEASE_RESULTS]).toEqual(["released", "parked", "noop"]);
    expect([...QUEUE_DEGRADATION_REASONS]).toEqual(["daemon-unreachable"]);
    expect([...QUEUE_REMOVAL_REASONS]).toEqual(closedSets.removalReasons);
    expect([...QUEUE_REMOVAL_RESULTS]).toEqual(closedSets.removalResults);
    expect([...QUEUE_DEPENDENCY_MUTATION_RESULTS]).toEqual(closedSets.dependencyMutationResults);
    expect([...QUEUE_RECONCILE_RESULTS]).toEqual(closedSets.reconcileResults);
  });

  test("queue.park carries clearObservedAt and recoveryState from its first write", () => {
    const park = QUEUE_RECORD_DECLARATIONS.find((entry) => entry.kind === "queue.park");
    expect(park?.fields).toContain("clearObservedAt");
    expect(park?.fields).toContain("recoveryState");
    expect(park?.vocabularies?.recoveryState).toEqual(closedSets.recoveryStates);
  });

  test("queue.removal declares the reason-bearing tombstone with its closed vocabulary", () => {
    const removal = QUEUE_RECORD_DECLARATIONS.find((entry) => entry.kind === "queue.removal");
    expect(removal).toMatchObject({
      payloadSchema: "delivery.queue.removal.v1",
      keyPrefix: "queue.removals:",
      identityField: "ref",
    });
    expect(removal?.fields).toEqual(["schema", "ref", "reason", "recordedAt", "callerPrincipal"]);
    expect(removal?.vocabularies?.reason).toEqual(closedSets.removalReasons);
  });
});

describe("TC-VOCAB-002 / TC-VOCAB-003 error identities stay synchronized", () => {
  test("the machine table carries the seven rows and fixtures reference them", () => {
    const queueRows = ERROR_TABLE.filter((entry) => entry.domainKind === "queue");
    expect(queueRows.map((entry) => entry.code)).toEqual(errorsFixture.queueRows);
    expect([...QUEUE_ERROR_CODES]).toEqual(errorsFixture.queueRows);
    expect(QUEUE_STUCK_PARK_FINDING_CODE).toBe("queue.park-condition-stuck");
    expect((DOMAIN_KINDS as readonly string[]).includes("queue")).toBe(true);
  });

  test("the collector-id set extends to exactly {tracker, lanes}", () => {
    expect([...BOARD_COLLECTOR_IDS]).toEqual(errorsFixture.collectorIds);
  });

  test("the documented table carries the queue rows and the lanes collector row", () => {
    const doc = readFileSync(join(ROOT, "doc/spec/features/feature-result-contract.md"), "utf8");
    for (const code of errorsFixture.queueRows) {
      expect(doc).toContain(`| ${code} |`);
    }
    expect(doc).toContain(
      `| ${errorsFixture.collectorFamily.prefix}lanes${errorsFixture.collectorFamily.suffix} |`,
    );
  });
});

describe("TC-VOCAB-004 typed queue configuration branch", () => {
  test("an absent branch resolves to the shipped defaults with defaults origins", () => {
    const resolved = resolveConfig({});
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.values.queue).toEqual({
      "lease-ttl": configCases.defaults.leaseTtlMs,
      "park-recheck": configCases.defaults.parkRecheckMs,
    });
    expect(resolved.value.origins.queue?.layer).toBe("defaults");
    const settings = resolveQueueSettings(resolved.value.values, resolved.value.origins);
    expect(settings).toEqual({
      ok: true,
      value: {
        leaseTtlMs: configCases.defaults.leaseTtlMs,
        parkRecheckMs: configCases.defaults.parkRecheckMs,
      },
    });
  });

  test("a valid override changes only the named value", () => {
    const settings = resolveQueueSettings({
      queue: {
        "lease-ttl": configCases.valid.leaseTtlMs,
        "park-recheck": configCases.valid.parkRecheckMs,
      },
    });
    expect(settings).toEqual({
      ok: true,
      value: {
        leaseTtlMs: configCases.valid.leaseTtlMs,
        parkRecheckMs: configCases.valid.parkRecheckMs,
      },
    });
  });

  test("an invalid value is config.value.invalid naming the key, never a silent fallback", () => {
    for (const { key, value, code } of configCases.invalidValues) {
      const values =
        key === QUEUE_CONFIG_KEY_LEASE_TTL
          ? { queue: { "lease-ttl": value } }
          : {
              queue: {
                "lease-ttl": configCases.defaults.leaseTtlMs,
                "park-recheck": { [key.split(".").slice(2).join(".")]: value },
              },
            };
      const settings = resolveQueueSettings(values);
      expect(settings.ok, key).toBe(false);
      if (!settings.ok) {
        expect(settings.error.code).toBe(code);
        expect(settings.error.key).toBe(key);
      }
    }
  });

  test("an unknown park-recheck child or queue key is config.key.unknown naming the key", () => {
    for (const { key } of configCases.unknownKeys) {
      const values =
        key === `${QUEUE_CONFIG_KEY_PARK_RECHECK}.preempted-for-close-item`
          ? {
              queue: {
                "lease-ttl": configCases.defaults.leaseTtlMs,
                "park-recheck": { "preempted-for-close-item": 60000 },
              },
            }
          : { queue: { "lease-ttl": configCases.defaults.leaseTtlMs, capacity: 2 } };
      const settings = resolveQueueSettings(values);
      expect(settings.ok, key).toBe(false);
      if (!settings.ok) {
        expect(settings.error.code).toBe("config.key.unknown");
        expect(settings.error.key).toBe(key);
      }
    }
  });

  test("the catalog declares the queue branch and no capacity-style key", () => {
    expect(PRODUCTION_CATALOG.queue).toBeDefined();
    const fields =
      PRODUCTION_CATALOG.queue.type === "object" ? PRODUCTION_CATALOG.queue.fields : {};
    expect(Object.keys(fields).sort()).toEqual(["lease-ttl", "park-recheck"]);
  });
});

describe("contract module discipline", () => {
  test("the module is data-only and imports the delivered ready vocabulary", () => {
    const text = readFileSync(join(ROOT, CONTRACT), "utf8");
    expect(dataOnlyViolations(text)).toEqual([]);
    expect(text).toContain("./queue-ready.js");
    expect(text).not.toMatch(/QUEUE_READY_CONDITION_ORDER\s*=/);
    expect(text).not.toContain("node:");
    expect(text).not.toContain("bun:");
  });

  test("a rogue call expression fails the data-only detector", () => {
    const mutated = `${readFileSync(join(ROOT, CONTRACT), "utf8")}\nexport const rogue = Date.now();\n`;
    expect(dataOnlyViolations(mutated).some((line) => line.includes("CallExpression"))).toBe(true);
  });
});

/**
 * TC-VOCAB-001 completion (Phase 5): the lease, park, and incident records
 * round-trip through the real ledgers with their Appendix D schema ids and
 * store keys; `queue.park` carries `clearObservedAt`/`recoveryState` from its
 * first write and the clear-observed marker is another record of that same
 * kind, not a sixth kind.
 */
describe("TC-VOCAB-001 lease/park/incident round-trip through the ledgers", () => {
  test("claim, release-with-park, and recovery land the declared kinds and keys", () => {
    const { store } = makeAuditStore("queue-vocab-roundtrip");
    const declared = declareQueueEntry(store, {
      ref: "GH-320",
      repository: "github.com/owner/repo-alpha",
      repositoryRoot: "/work/repo-alpha",
      priority: 1,
      recordedAt: "2026-11-07T10:00:00Z",
      fenceToken: "vocab-entry",
    });
    expect(declared.ok).toBe(true);
    const claimed = claimQueueLease(store, {
      ref: "GH-320",
      holder: "holder-a",
      runner: "runner-a",
      weightClass: "standard",
      nowIso: "2026-11-07T10:00:00Z",
      nowMs: Date.parse("2026-11-07T10:00:00Z"),
      fenceToken: "vocab-claim",
    });
    expect(claimed.ok).toBe(true);
    const released = releaseQueueLease(store, {
      ref: "GH-320",
      holder: "holder-a",
      park: {
        cause: "provider-window",
        condition: { type: "provider-window", expiresAt: "2026-11-07T11:00:00Z" },
      },
      nowIso: "2026-11-07T10:05:00Z",
      nowMs: Date.parse("2026-11-07T10:05:00Z"),
      fenceToken: "vocab-release",
    });
    expect(released.ok).toBe(true);
    if (released.ok) {
      expect(released.value.result).toBe("parked");
      expect(released.value.park?.schema).toBe("delivery.queue.park.v1");
      expect(released.value.park?.clearObservedAt).toBeUndefined();
      expect(released.value.park?.recoveryState).toBe("parked");
    }
    const leases = readQueueLeases(store);
    expect(leases.ok).toBe(true);
    if (leases.ok) {
      expect(leases.records.every((record) => record.schema === "delivery.queue.lease.v1")).toBe(
        true,
      );
    }
    const parks = readQueueParks(store);
    expect(parks.ok).toBe(true);
    if (parks.ok) {
      expect(parks.records).toHaveLength(1);
      expect(parks.records[0]?.schema).toBe("delivery.queue.park.v1");
    }
    const recovered = recoverQueueParks(store, {
      nowIso: "2026-11-07T11:00:01Z",
      nowMs: Date.parse("2026-11-07T11:00:01Z"),
      context: { providerAvailable: true, leaseHeldRepositories: [] },
      fenceToken: "vocab-recover",
    });
    expect(recovered.ok).toBe(true);
    const after = readQueueParks(store);
    if (after.ok) {
      expect(after.records.map((record) => record.schema)).toEqual([
        "delivery.queue.park.v1",
        "delivery.queue.park.v1",
        "delivery.queue.park.v1",
      ]);
      expect(after.records[1]?.recoveryState).toBe("clear-observed");
      expect(after.records[2]?.recoveryState).toBe("recovered");
    }
    const incidents = readQueueIncidents(store);
    if (incidents.ok) {
      expect(incidents.records[0]?.schema).toBe("delivery.queue.incident.v1");
    }
  });
});

describe("TC-LANES-006 / TC-VOCAB-003 lane vocabulary and collector resolution", () => {
  test("lane states are exactly six and no stored lane record kind exists", () => {
    expect([...QUEUE_LANE_STATES]).toEqual(closedSets.laneStates);
    expect(QUEUE_LANE_STATES).toHaveLength(6);
    const kinds = QUEUE_RECORD_DECLARATIONS.map((declaration) => declaration.kind);
    expect(kinds.some((kind) => kind.includes("lane"))).toBe(false);
  });

  test("the lanes collector id resolves through the declared family", () => {
    const row = ERROR_TABLE.find((entry) => entry.code === "status.collector.lanes.unavailable");
    expect(row).toMatchObject({
      domainKind: "status",
      category: "platform",
      projectionClass: "platform-provider",
    });
  });
});
