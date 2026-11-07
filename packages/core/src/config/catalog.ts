import type {
  ConfigFailure,
  ConfigNodeOrigins,
  ConfigOrigin,
  ConfigValue,
  QueueParkConditionType,
  Result,
} from "#contracts";
import { QUEUE_PARK_CONDITION_TYPES, QUEUE_PARK_RECHECK_DEFAULTS } from "#contracts";

type DefaultMetadata = { readonly defaultOrigin?: ConfigOrigin & { readonly layer: "defaults" } };

type FieldMeta = {
  readonly nullable?: boolean;
  readonly deprecated?: boolean;
  readonly env?: boolean;
  readonly flag?: string;
} & (
  | {
      readonly required: true;
      readonly source: "environment-only";
      readonly default?: never;
      readonly defaultOrigin?: never;
    }
  | { readonly required?: false; readonly source: "environment-only" }
  | { readonly required?: boolean; readonly source?: "machine-path" }
);
type Defaultable<T> =
  | { readonly default?: never; readonly defaultOrigin?: never }
  | ({ readonly default: T } & DefaultMetadata);
export type ScalarField = FieldMeta &
  (
    | ({ readonly type: "string" } & Defaultable<string>)
    | ({ readonly type: "number" } & Defaultable<number>)
    | ({ readonly type: "boolean" } & Defaultable<boolean>)
  );
export type ListField = FieldMeta & {
  readonly type: "array";
  readonly items: CatalogField;
} & Defaultable<readonly ConfigValue[]>;
export type MapField = FieldMeta & {
  readonly type: "object";
  readonly fields: Readonly<Record<string, CatalogField>>;
} & Defaultable<Readonly<Record<string, ConfigValue>>>;
/** A dynamic-name map: any child key, one declared value shape (GH-182 PD-F). */
export type RecordField = FieldMeta & {
  readonly type: "record";
  readonly value: CatalogField;
} & Defaultable<Readonly<Record<string, ConfigValue>>>;
export type CatalogField = ScalarField | ListField | MapField | RecordField;
export type ConfigCatalog = Readonly<Record<string, CatalogField>>;

/** Bootstrap identity is supplied before discovery; it is never a resolved key. */
export const BOOTSTRAP_DESCRIPTOR = {
  workingName: { type: "string", required: true },
} as const;
const PROVIDER_CREDENTIAL_VALUE = {
  type: "object",
  required: true,
  fields: {
    sourceKey: {
      type: "object",
      required: true,
      fields: {
        style: { type: "string", required: true },
        name: { type: "string" },
        suffix: { type: "string" },
      },
    },
  },
} as const satisfies CatalogField;

const PROVIDER_PEAK = {
  type: "object",
  fields: {
    timezone: { type: "string", default: "UTC" },
    startSecondsOfDay: { type: "number", required: true },
    endSecondsOfDay: { type: "number", required: true },
    bufferSeconds: { type: "number", default: 0 },
  },
} as const satisfies CatalogField;

const PROVIDER_QUOTA = {
  type: "object",
  fields: {
    enabled: { type: "boolean", default: true },
    endpoint: { type: "string", required: true },
    credentialRef: { type: "string", required: true },
    timeoutMs: { type: "number", default: 15000 },
    thresholdPercent: { type: "number", default: 100 },
    maxSleepLoops: { type: "number", default: 24 },
    outageParkTtlSeconds: { type: "number", default: 300 },
    credentialParkTtlSeconds: { type: "number", default: 900 },
    capParkTtlSeconds: { type: "number", default: 300 },
  },
} as const satisfies CatalogField;

const PROVIDER_ENTRY_VALUE = {
  type: "object",
  required: true,
  fields: {
    class: { type: "string", required: true },
    enabled: { type: "boolean", default: true },
    peak: PROVIDER_PEAK,
    quota: PROVIDER_QUOTA,
  },
} as const satisfies CatalogField;

const PROVIDER_CHAIN_VALUE = {
  type: "object",
  required: true,
  fields: {
    entries: { type: "array", items: { type: "string" }, required: true },
    allowPaidFallback: { type: "boolean", default: false },
  },
} as const satisfies CatalogField;

/**
 * The typed `provider.profiles` branch (GH-234 F-1, DM-1..DM-5).
 *
 * Dynamic-name maps use the `record` field kind (tiers, profiles, rungs, watch
 * targets); lists replace whole (preference chain, goal priorities); fixed
 * subshapes keep exact unknown-key discipline. The branch ships empty by
 * default (DEC-9), so a fresh installation declares nothing and fails closed.
 */
const PROVIDER_PROFILE_SEAT = {
  type: "object",
  required: true,
  fields: {
    model: { type: "string", required: true },
    pacingClass: { type: "string", required: true },
    capability: { type: "string", required: true },
    envName: { type: "string" },
  },
} as const satisfies CatalogField;

const PROVIDER_PROFILE_VALUE = {
  type: "object",
  required: true,
  fields: {
    tier: { type: "string", required: true },
    providers: { type: "array", items: { type: "string" }, required: true },
    seats: { type: "record", value: PROVIDER_PROFILE_SEAT, required: true },
    agentOverrides: { type: "record", value: { type: "string" } },
  },
} as const satisfies CatalogField;

const PROVIDER_PACING_RUNG = {
  type: "object",
  required: true,
  fields: {
    thresholdPercent: { type: "number", required: true },
    executionModel: { type: "string", required: true },
  },
} as const satisfies CatalogField;

const PROVIDER_WATCH_TARGET = {
  type: "object",
  required: true,
  fields: {
    mapping: { type: "string", required: true },
    endpoint: { type: "string", required: true },
    credentialRef: { type: "string", required: true },
    floor: { type: "number" },
    thresholdPercent: { type: "number" },
  },
} as const satisfies CatalogField;

const PROVIDER_PROFILES = {
  type: "object",
  fields: {
    tiers: {
      type: "record",
      value: {
        type: "object",
        fields: { description: { type: "string" } },
      },
    },
    profiles: { type: "record", value: PROVIDER_PROFILE_VALUE },
    preferenceChain: {
      type: "object",
      fields: {
        base: { type: "string", required: true },
        fallbacks: { type: "array", items: { type: "string" } },
      },
    },
    pacing: {
      type: "object",
      fields: {
        goalPriorities: { type: "array", items: { type: "string" } },
        tailThresholdPercent: { type: "number" },
        rungs: { type: "record", value: PROVIDER_PACING_RUNG },
      },
    },
    watch: { type: "record", value: PROVIDER_WATCH_TARGET },
    envRecord: {
      type: "object",
      fields: {
        header: { type: "string" },
        namePattern: { type: "string" },
        maxBytes: { type: "number" },
        maxLineBytes: { type: "number" },
        maxRecords: { type: "number" },
      },
    },
  },
} as const satisfies CatalogField;

/**
 * One declared gate entry (GH-225 DM-4). The closed recipe vocabulary and the
 * mandatory-built-in / reserved-id rules are semantic and validated by the
 * merge domain; this schema pins the entry shape.
 */
const MERGE_GATE_ENTRY = {
  type: "object",
  required: true,
  fields: {
    id: { type: "string", required: true },
    recipe: { type: "string", required: true },
    surface: { type: "string", required: true },
    class: { type: "string" },
    job: { type: "string" },
  },
} as const satisfies CatalogField;

/** The typed `merge` branch (GH-225 F-1, F-2, F-6). */
const MERGE_BRANCH = {
  type: "object",
  fields: {
    "gate-freshness": { type: "number" },
    gates: {
      type: "object",
      fields: {
        schemaVersion: { type: "string", required: true },
        entries: { type: "array", items: MERGE_GATE_ENTRY, required: true },
      },
    },
    "deploy-expectations": {
      type: "object",
      fields: {
        steps: { type: "array", items: { type: "string" } },
        artifacts: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const satisfies CatalogField;

/**
 * The typed `harness` branch (GH-233 F-6, DM-3, DEC-8).
 *
 * Selection, per-harness store locations, and the declared environment
 * allowlist are configuration data. The allowlist carries variable names and
 * credential references only; a literal value beside a credential reference is
 * rejected with the existing secret-forbidden identity.
 */
const HARNESS_ENVIRONMENT_ENTRY = {
  type: "object",
  required: true,
  fields: {
    name: { type: "string", required: true },
    credentialRef: { type: "string" },
    value: { type: "string" },
  },
} as const satisfies CatalogField;

const HARNESS_BRANCH = {
  type: "object",
  fields: {
    kind: { type: "string" },
    execution: {
      type: "object",
      fields: {
        kind: { type: "string" },
      },
    },
    stores: {
      type: "object",
      fields: {
        opencode: {
          type: "object",
          fields: {
            databasePath: { type: "string" },
          },
        },
        "claude-code": {
          type: "object",
          fields: {
            sessionDirectory: { type: "string" },
          },
        },
      },
    },
    environment: {
      type: "array",
      items: HARNESS_ENVIRONMENT_ENTRY,
    },
  },
} as const satisfies CatalogField;

/**
 * The typed `lane` branch (GH-235 F-7, DM-6, DEC-5, D-12).
 *
 * `lane.liveness-interval` is the lane liveness evaluation cadence in
 * milliseconds (integer > 0). `lane.restart-budget` is the per-delivery restart
 * bound (integer >= 0; zero is a valid admit-no-restarts policy). Both keys are
 * policy-as-data: the shipped defaults live in the defaults layer, and no bound
 * literal lives in the gate.
 */
export const LANE_BRANCH = {
  type: "object",
  fields: {
    "liveness-interval": { type: "number" },
    "restart-budget": { type: "number" },
  },
} as const satisfies CatalogField;

/**
 * The typed `queue` branch (GH-237 F-8, F-12, Appendix E).
 *
 * `queue.lease-ttl` is the lease staleness bound in integer milliseconds;
 * `queue.park-recheck` is a dynamic-name record whose valid child names are the
 * closed park condition-type set and whose values are integer milliseconds. The
 * shipped defaults live in the defaults layer. No capacity, bandwidth,
 * concurrency, or CI-slot key is declared or reserved.
 */
export const QUEUE_BRANCH = {
  type: "object",
  fields: {
    "lease-ttl": { type: "number" },
    "park-recheck": { type: "record", value: { type: "number" } },
  },
} as const satisfies CatalogField;

/**
 * The production catalog. `provider` is a typed branch (GH-182 F-1); its
 * dynamic-name maps use the additive record field kind (PD-F), while every
 * fixed branch keeps exact unknown-key discipline.
 */
export const PRODUCTION_CATALOG = {
  provider: {
    type: "object",
    fields: {
      defaultChain: { type: "string" },
      credentials: { type: "record", value: PROVIDER_CREDENTIAL_VALUE },
      entries: { type: "record", value: PROVIDER_ENTRY_VALUE },
      chains: { type: "record", value: PROVIDER_CHAIN_VALUE },
      profiles: PROVIDER_PROFILES,
    },
  },
  commit: {
    type: "object",
    fields: {
      phaseCommit: { type: "boolean" },
    },
  },
  merge: MERGE_BRANCH,
  harness: HARNESS_BRANCH,
  lane: LANE_BRANCH,
  queue: QUEUE_BRANCH,
} as const satisfies ConfigCatalog;

export const fieldAt = (
  catalog: ConfigCatalog,
  path: readonly string[],
): CatalogField | undefined => {
  let fields: ConfigCatalog = catalog;
  let field: CatalogField | undefined;
  for (const segment of path) {
    field = fields[segment];
    if (!field) return undefined;
    fields = field.type === "object" ? field.fields : {};
  }
  return field;
};

export const catalogPaths = (catalog: ConfigCatalog): Array<[string, CatalogField]> => {
  const result: Array<[string, CatalogField]> = [];
  const walk = (fields: ConfigCatalog, prefix: string): void => {
    for (const [name, field] of Object.entries(fields)) {
      const path = prefix ? `${prefix}.${name}` : name;
      result.push([path, field]);
      if (field.type === "object") walk(field.fields, path);
    }
  };
  walk(catalog, "");
  return result;
};

/** The resolved lane branch: cadence and bound, with units declared. */
export type LaneSettings = {
  /** Lane liveness evaluation cadence in milliseconds. */
  readonly livenessIntervalMs: number;
  /** Restarts per delivery; zero admits no restarts. */
  readonly restartBudget: number;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const laneFailure = (
  code: ConfigFailure["code"],
  origins: ConfigNodeOrigins,
  key: string,
): Result<never, ConfigFailure> => {
  const origin = origins[key];
  return {
    ok: false,
    error: {
      kind: "config",
      code,
      key,
      ...(origin === undefined
        ? {}
        : origin.layer === "environment" || origin.layer === "cli"
          ? { layer: origin.layer }
          : { layer: origin.layer, file: origin.file, line: origin.line }),
    },
  };
};

/**
 * Validate the resolved `lane` branch and project it into typed settings. The
 * schema has already rejected wrong types and unknown keys; this function
 * enforces the integer domains and reuses the existing configuration identities.
 */
export const resolveLaneSettings = (
  values: Readonly<Record<string, ConfigValue>>,
  origins: ConfigNodeOrigins = {},
): Result<LaneSettings, ConfigFailure> => {
  const branch = values.lane;
  if (!isPlainRecord(branch)) return laneFailure("config.value.invalid", origins, "lane");
  for (const key of Object.keys(branch)) {
    if (key !== "liveness-interval" && key !== "restart-budget") {
      return laneFailure("config.key.unknown", origins, `lane.${key}`);
    }
  }
  const interval = branch["liveness-interval"];
  if (typeof interval !== "number" || !Number.isInteger(interval) || interval <= 0) {
    return laneFailure("config.value.invalid", origins, "lane.liveness-interval");
  }
  const budget = branch["restart-budget"];
  if (typeof budget !== "number" || !Number.isInteger(budget) || budget < 0) {
    return laneFailure("config.value.invalid", origins, "lane.restart-budget");
  }
  return { ok: true, value: { livenessIntervalMs: interval, restartBudget: budget } };
};

/** The resolved `queue` branch: lease TTL and per-condition-type recheck. */
export type QueueSettings = {
  /** Lease staleness bound in milliseconds. */
  readonly leaseTtlMs: number;
  /** Recheck cadence per closed park condition type. */
  readonly parkRecheckMs: Readonly<Record<QueueParkConditionType, number>>;
};

/**
 * Validate the resolved `queue` branch and project it into typed settings.
 *
 * The dynamic-name `park-recheck` record is validated against the closed
 * condition-type set here (the JSON schema cannot close dynamic names); an
 * unknown child is `config.key.unknown`, and a non-integer, zero, or negative
 * value is `config.value.invalid`, both naming the key. No invalid input
 * silently falls back.
 */
export const resolveQueueSettings = (
  values: Readonly<Record<string, ConfigValue>>,
  origins: ConfigNodeOrigins = {},
): Result<QueueSettings, ConfigFailure> => {
  const branch = values.queue;
  if (branch === undefined) {
    return {
      ok: true,
      value: {
        leaseTtlMs: 90_000,
        parkRecheckMs: { ...QUEUE_PARK_RECHECK_DEFAULTS },
      },
    };
  }
  if (!isPlainRecord(branch)) return laneFailure("config.value.invalid", origins, "queue");
  for (const key of Object.keys(branch)) {
    if (key !== "lease-ttl" && key !== "park-recheck") {
      return laneFailure("config.key.unknown", origins, `queue.${key}`);
    }
  }
  const ttl = branch["lease-ttl"];
  if (typeof ttl !== "number" || !Number.isInteger(ttl) || ttl <= 0) {
    return laneFailure("config.value.invalid", origins, "queue.lease-ttl");
  }
  const recheckRaw = branch["park-recheck"];
  const recheck: Record<QueueParkConditionType, number> = {
    "provider-window": QUEUE_PARK_RECHECK_DEFAULTS["provider-window"],
    "provider-quota": QUEUE_PARK_RECHECK_DEFAULTS["provider-quota"],
    preemption: QUEUE_PARK_RECHECK_DEFAULTS.preemption,
  };
  if (recheckRaw !== undefined) {
    if (!isPlainRecord(recheckRaw)) {
      return laneFailure("config.value.invalid", origins, "queue.park-recheck");
    }
    for (const [child, value] of Object.entries(recheckRaw)) {
      if (!(QUEUE_PARK_CONDITION_TYPES as readonly string[]).includes(child)) {
        return laneFailure("config.key.unknown", origins, `queue.park-recheck.${child}`);
      }
      if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
        return laneFailure("config.value.invalid", origins, `queue.park-recheck.${child}`);
      }
      recheck[child as QueueParkConditionType] = value;
    }
  }
  return { ok: true, value: { leaseTtlMs: ttl, parkRecheckMs: recheck } };
};
