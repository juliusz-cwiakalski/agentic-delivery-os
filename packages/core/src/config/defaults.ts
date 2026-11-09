import { type ConfigCatalog, PRODUCTION_CATALOG } from "./catalog.js";

/** The shipped overridable provider defaults (GH-182 DEC-3, DEC-13). */
export const PRODUCTION_DEFAULTS = {
  provider: {
    credentials: {
      zai: {
        sourceKey: { style: "literal", name: "ZAI_API_KEY" },
      },
    },
    entries: {
      "zai-coding-plan": {
        class: "subscription",
        enabled: true,
        peak: {
          timezone: "UTC",
          startSecondsOfDay: 21600,
          endSecondsOfDay: 36000,
          bufferSeconds: 7200,
        },
        quota: {
          enabled: true,
          endpoint: "https://api.z.ai/api/monitor/usage/quota/limit",
          credentialRef: "zai",
          timeoutMs: 15000,
          thresholdPercent: 100,
          maxSleepLoops: 24,
          outageParkTtlSeconds: 300,
          credentialParkTtlSeconds: 900,
          capParkTtlSeconds: 300,
        },
      },
    },
    chains: {},
    // GH-234 DEC-9: the profile-model branch ships empty. No tier, profile,
    // preference chain, rung, goal priority, or threshold is invented.
    profiles: {},
  },
  commit: {
    phaseCommit: true,
  },
  merge: {
    "gate-freshness": 1800,
  },
  harness: {
    kind: "opencode",
    execution: {
      kind: "host",
    },
    stores: {
      opencode: {
        databasePath: ".local/state/opencode/opencode.db",
      },
      "claude-code": {
        sessionDirectory: ".local/state/claude-code",
      },
    },
    environment: [
      { name: "PATH" },
      { name: "HOME" },
      { name: "TMPDIR", optional: true },
      { name: "DELIVERY_WORK_PATH" },
    ],
  },
  lane: {
    "liveness-interval": 30000,
    "restart-budget": 3,
  },
  queue: {
    "lease-ttl": 90000,
    "park-recheck": {
      "provider-window": 60000,
      "provider-quota": 300000,
      preemption: 60000,
    },
  },
  coordinator: {
    "stuck-window": 600000,
    "kill-grace": 20000,
    "restart-budget": 10,
    "resume-context-limit": 100000,
    "collection-interval": 30000,
    "progress-bound": 300000,
  },
  daemon: {
    "heartbeat-interval": 5000,
    "heartbeat-cycle": 60000,
    "lock-staleness": 30000,
    "poll-interval": 60000,
    "watch-poll-interval": 5000,
    "response-timeout": 2000,
    "subscription-buffer": 256,
    "frame-max-bytes": 65536,
    "reconcile-max-lanes": 200,
    transport: "unix",
  },
  poll: {
    github: { "base-interval": 5000, "max-interval": 60000, "min-spacing": 1000 },
    gitlab: { "base-interval": 5000, "max-interval": 60000, "min-spacing": 1000 },
    jira: { "base-interval": 5000, "max-interval": 60000, "min-spacing": 1000 },
  },
} as const;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isPlainRecord(value)) {
    const clone: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) clone[key] = cloneValue(child);
    return clone;
  }
  return value;
};

const mergeDefaults = (
  target: Record<string, unknown>,
  incoming: Readonly<Record<string, unknown>>,
): void => {
  for (const [key, value] of Object.entries(incoming)) {
    const current = target[key];
    if (isPlainRecord(current) && isPlainRecord(value)) {
      mergeDefaults(current, value);
      continue;
    }
    target[key] = cloneValue(value);
  }
};

/** Collect typed catalog defaults plus the shipped production defaults. */
export const defaultsFor = (catalog: ConfigCatalog): Record<string, unknown> => {
  const collect = (fields: ConfigCatalog): Record<string, unknown> => {
    const values: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      if ("default" in field && field.default !== undefined)
        values[key] = cloneValue(field.default);
      else if (field.type === "object") {
        const nested = collect(field.fields);
        if (Object.keys(nested).length) values[key] = nested;
      }
    }
    return values;
  };
  const collected = collect(catalog);
  if (catalog === PRODUCTION_CATALOG) {
    mergeDefaults(collected, PRODUCTION_DEFAULTS as unknown as Readonly<Record<string, unknown>>);
  }
  return collected;
};
