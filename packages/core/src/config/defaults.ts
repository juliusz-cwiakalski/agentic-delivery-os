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
