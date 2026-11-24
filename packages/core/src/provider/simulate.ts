/**
 * Offline provider-policy simulation (GH-350 F-5, DM-5, DM-6; TDR-0060).
 *
 * One strict versioned facts document replayed through the DELIVERED pure
 * engine: this module parses the fixture, supplies the engine's seams from the
 * fixture alone, calls `resolve` with `persist: false`, and assembles the
 * payload. It contains no routing, condition, park, or announcement arithmetic —
 * every decision comes from `createProviderEngine`.
 *
 * The fixture declares facts only (an instant, an optional chain/profile
 * selection, credential outcomes, per-entry transport results, spend points, an
 * optional zone step table, and the work-item ref the spend points stand for);
 * policy comes from the resolved configuration. Nothing here reads a clock, an
 * environment, a file, a store, a credential implementation, a transport, or a
 * child process.
 */
import type {
  AnnouncementCode,
  ProviderAnnouncementRecord,
  ProviderConfiguration,
  ProviderDecision,
  ProviderErrorCode,
  ProviderParkRecord,
  ProviderResolveResult,
  ProviderSkippedEntry,
  ProviderSpendTotals,
  ProviderSpendTotalsRead,
  ProviderZoneFacts,
  ProviderZonePort,
  QuotaTransportResult,
} from "#contracts";
import { enabledBudgets, isWorkItemRef } from "./budgets.js";
import { createProviderEngine } from "./engine.js";
import { bindZoneFacts } from "./peak.js";

/** The one schema identity the fixture declares and the payload discloses. */
export const PROVIDER_SIMULATE_SCHEMA_VERSION = "delivery.provider.simulate.v1" as const;

/** The closed credential-outcome vocabulary; a value is not representable. */
export const PROVIDER_SIMULATE_CREDENTIAL_OUTCOMES = ["resolved", "missing", "rejected"] as const;
export type ProviderSimulateCredentialOutcome =
  (typeof PROVIDER_SIMULATE_CREDENTIAL_OUTCOMES)[number];

/** Every recognised top-level fixture key; any other key refuses. */
export const PROVIDER_SIMULATE_KEYS = [
  "schemaVersion",
  "now",
  "chain",
  "profile",
  "workItemRef",
  "credentials",
  "quota",
  "spend",
  "zones",
] as const;

/** One zone step: the offset in effect from `fromMs` until the next step. */
export type ProviderSimulateStep = {
  readonly fromMs: number;
  readonly offsetSeconds: number;
};

/** One spend observation the fixture stands for. */
export type ProviderSimulateSpendPoint = {
  readonly atMs: number;
  readonly cost: number;
  readonly tokens: number;
};

/** The fixture's spend-totals facts; `absent` is the verified-empty reading. */
export type ProviderSimulateSpend = {
  readonly telemetryState: "present" | "absent";
  readonly points: readonly ProviderSimulateSpendPoint[];
};

/** One entry's transport result: an HTTP answer or a declared outage. */
export type ProviderSimulateQuotaBlock =
  | { readonly httpStatus: number; readonly body: string }
  | { readonly transport: "outage" };

/** The parsed fixture: canonical, typed, and free of any credential value. */
export type ProviderSimulateFixture = {
  readonly schemaVersion: typeof PROVIDER_SIMULATE_SCHEMA_VERSION;
  readonly now: string;
  readonly nowMs: number;
  readonly chain?: string;
  readonly profile?: string;
  readonly workItemRef?: string;
  readonly credentials: Readonly<Record<string, ProviderSimulateCredentialOutcome>>;
  readonly quota: Readonly<Record<string, ProviderSimulateQuotaBlock>>;
  readonly spend?: ProviderSimulateSpend;
  readonly zones: Readonly<Record<string, readonly ProviderSimulateStep[]>>;
};

/** The one bounded read's output: text plus the byte length the cap is measured on. */
export type ProviderSimulateDocument = {
  readonly text: string;
  readonly byteLength: number;
};

export type ProviderSimulateFailure = {
  readonly ok: false;
  readonly code: "input.value.rejected";
  readonly field: string;
  readonly summary: string;
};

export type ProviderSimulateParse =
  | { readonly ok: true; readonly fixture: ProviderSimulateFixture }
  | ProviderSimulateFailure;

/** One parse step: the canonical value or the classified refusal. */
type Parsed<T> = { readonly ok: true; readonly value: T } | ProviderSimulateFailure;

export type ProviderSimulateInputs = {
  readonly credentials: "fixture";
  readonly quota: "fixture";
  readonly spend: "fixture" | "none";
  readonly zones: "fixture" | "runtime";
};

export type ProviderSimulateSummary = {
  readonly decision: "selected" | "parked";
  readonly providerName?: string;
  readonly parkCause?: string;
  readonly resumeAt?: string;
  readonly skippedCount: number;
  readonly announcementCodes: readonly AnnouncementCode[];
};

export type ProviderSimulateBlock = {
  readonly fixturePath: string;
  readonly fixtureSchemaVersion: typeof PROVIDER_SIMULATE_SCHEMA_VERSION;
  readonly now: string;
  readonly workItemRef?: string;
  readonly stateWrites: 0;
  readonly inputs: ProviderSimulateInputs;
  readonly summary: ProviderSimulateSummary;
};

/** The delivered resolve payload in its delivered order, plus one additive block. */
export type ProviderSimulateData = {
  readonly summary: string;
  readonly chain: string;
  readonly decision: ProviderDecision;
  readonly skipped: readonly ProviderSkippedEntry[];
  readonly parks: readonly ProviderParkRecord[];
  readonly announcements: readonly ProviderAnnouncementRecord[];
  readonly simulation: ProviderSimulateBlock;
};

export type ProviderSimulateRequest = {
  readonly fixturePath: string;
  readonly fixture: ProviderSimulateFixture;
  readonly config: ProviderConfiguration;
  readonly profile?: { readonly name: string; readonly providers: readonly string[] };
  /** The edge's zone resolver, used only when the fixture omits its step table. */
  readonly zoneFactsFor?: (zone: string) => ProviderZoneFacts | undefined;
};

export type ProviderSimulateOutcome =
  | { readonly ok: true; readonly data: ProviderSimulateData }
  | {
      readonly ok: false;
      readonly code: ProviderErrorCode | "input.value.rejected" | `state.${string}`;
      readonly summary: string;
      readonly announcementCode?: AnnouncementCode;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const reject = (field: string, detail: string): ProviderSimulateFailure => ({
  ok: false,
  code: "input.value.rejected",
  field,
  summary: `simulate fixture ${field} ${detail}`,
});

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

/** Canonical order for a record: declarations cannot depend on document key order. */
const canonical = <T>(entries: readonly (readonly [string, T])[]): Readonly<Record<string, T>> =>
  Object.fromEntries(
    [...entries].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)),
  );

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;

const parseNow = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !ISO_INSTANT.test(value)) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const parseCredentials = (
  value: unknown,
): Parsed<Readonly<Record<string, ProviderSimulateCredentialOutcome>>> => {
  if (value === undefined) return { ok: true, value: {} };
  if (!isRecord(value)) return reject("credentials", "must be a record of credential outcomes");
  const entries: [string, ProviderSimulateCredentialOutcome][] = [];
  for (const [reference, outcome] of Object.entries(value)) {
    if (
      typeof outcome !== "string" ||
      !(PROVIDER_SIMULATE_CREDENTIAL_OUTCOMES as readonly string[]).includes(outcome)
    ) {
      return reject(
        `credentials.${reference}`,
        "must be resolved, missing, or rejected; no credential value is representable",
      );
    }
    entries.push([reference, outcome as ProviderSimulateCredentialOutcome]);
  }
  return { ok: true, value: canonical(entries) };
};

const parseQuota = (
  value: unknown,
): Parsed<Readonly<Record<string, ProviderSimulateQuotaBlock>>> => {
  if (value === undefined) return { ok: true, value: {} };
  if (!isRecord(value)) return reject("quota", "must be a record of per-entry transport results");
  const entries: [string, ProviderSimulateQuotaBlock][] = [];
  for (const [entry, block] of Object.entries(value)) {
    if (!isRecord(block)) {
      return reject(`quota.${entry}`, "must be an HTTP answer or a declared transport outage");
    }
    for (const key of Object.keys(block)) {
      if (key !== "httpStatus" && key !== "body" && key !== "transport") {
        return reject(`quota.${entry}.${key}`, "is not a declared transport fact");
      }
    }
    if (block.transport !== undefined) {
      if (block.transport !== "outage" || Object.keys(block).length !== 1) {
        return reject(`quota.${entry}.transport`, "must be exactly the string outage");
      }
      entries.push([entry, { transport: "outage" }]);
      continue;
    }
    if (!isInteger(block.httpStatus) || block.httpStatus < 100 || block.httpStatus > 599) {
      return reject(`quota.${entry}.httpStatus`, "must be an integer HTTP status");
    }
    if (typeof block.body !== "string") {
      return reject(`quota.${entry}.body`, "must be a string");
    }
    entries.push([entry, { httpStatus: block.httpStatus, body: block.body }]);
  }
  return { ok: true, value: canonical(entries) };
};

const parseSpend = (value: unknown): Parsed<ProviderSimulateSpend> | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) return reject("spend", "must be an object");
  for (const key of Object.keys(value)) {
    if (key !== "telemetryState" && key !== "points") {
      return reject(`spend.${key}`, "is not a declared spend fact");
    }
  }
  const state = value.telemetryState;
  if (state !== "present" && state !== "absent") {
    return reject("spend.telemetryState", "must be present or absent");
  }
  const rawPoints = value.points;
  if (state === "absent" && rawPoints !== undefined) {
    return reject(
      "spend.points",
      "must be absent when telemetryState is absent (an absent telemetry reading has no observations)",
    );
  }
  if (rawPoints === undefined) {
    return { ok: true, value: { telemetryState: state, points: [] } };
  }
  if (!Array.isArray(rawPoints)) return reject("spend.points", "must be an array");
  const points: ProviderSimulateSpendPoint[] = [];
  for (const [index, point] of rawPoints.entries()) {
    if (!isRecord(point)) return reject(`spend.points[${index}]`, "must be an object");
    for (const key of Object.keys(point)) {
      if (key !== "atMs" && key !== "cost" && key !== "tokens") {
        return reject(`spend.points[${index}].${key}`, "is not a declared spend fact");
      }
    }
    if (!isFiniteNumber(point.atMs))
      return reject(`spend.points[${index}].atMs`, "must be a number");
    if (!isFiniteNumber(point.cost))
      return reject(`spend.points[${index}].cost`, "must be a number");
    if (!isFiniteNumber(point.tokens)) {
      return reject(`spend.points[${index}].tokens`, "must be a number");
    }
    points.push({ atMs: point.atMs, cost: point.cost, tokens: point.tokens });
  }
  return { ok: true, value: { telemetryState: state, points } };
};

const parseZones = (
  value: unknown,
): Parsed<Readonly<Record<string, readonly ProviderSimulateStep[]>>> => {
  if (value === undefined) return { ok: true, value: {} };
  if (!isRecord(value)) return reject("zones", "must be a record of ordered offset steps");
  const entries: [string, readonly ProviderSimulateStep[]][] = [];
  for (const [zone, rawSteps] of Object.entries(value)) {
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) {
      return reject(`zones.${zone}`, "must be a non-empty ordered list of steps");
    }
    const steps: ProviderSimulateStep[] = [];
    for (const [index, step] of rawSteps.entries()) {
      if (!isRecord(step)) return reject(`zones.${zone}[${index}]`, "must be an object");
      for (const key of Object.keys(step)) {
        if (key !== "fromMs" && key !== "offsetSeconds") {
          return reject(`zones.${zone}[${index}].${key}`, "is not a declared zone fact");
        }
      }
      if (!isInteger(step.fromMs) || step.fromMs < 0) {
        return reject(`zones.${zone}[${index}].fromMs`, "must be a non-negative integer");
      }
      if (!isInteger(step.offsetSeconds)) {
        return reject(`zones.${zone}[${index}].offsetSeconds`, "must be an integer");
      }
      const previous = steps[steps.length - 1];
      if (previous !== undefined && step.fromMs <= previous.fromMs) {
        return reject(`zones.${zone}[${index}].fromMs`, "must strictly ascend");
      }
      steps.push({ fromMs: step.fromMs, offsetSeconds: step.offsetSeconds });
    }
    entries.push([zone, steps]);
  }
  return { ok: true, value: canonical(entries) };
};

/**
 * Parse and validate one `delivery.provider.simulate.v1` document.
 *
 * Strict by construction: an unknown key, a missing required key, a wrong type,
 * an unsupported version, an oversize body, or a value that is not the declared
 * shape refuses `input.value.rejected` naming the field, before any evaluation.
 * The summary never echoes document content; the fixture cannot carry a
 * credential value because the credential outcome is a closed enum.
 */
export const parseProviderSimulateFixture = (
  document: ProviderSimulateDocument,
  maxBytes: number,
): ProviderSimulateParse => {
  if (document.byteLength > maxBytes) {
    return reject("size", `is ${document.byteLength} bytes; the declared maximum is ${maxBytes}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(document.text) as unknown;
  } catch {
    return reject("fixture", "is not a JSON document");
  }
  if (!isRecord(parsed)) return reject("fixture", "must be a JSON object");
  for (const key of Object.keys(parsed)) {
    if (!(PROVIDER_SIMULATE_KEYS as readonly string[]).includes(key)) {
      return reject(key, "is not a declared fixture key");
    }
  }
  if (parsed.schemaVersion !== PROVIDER_SIMULATE_SCHEMA_VERSION) {
    return reject("schemaVersion", `must be ${PROVIDER_SIMULATE_SCHEMA_VERSION}`);
  }
  const nowMs = parseNow(parsed.now);
  if (nowMs === undefined) {
    return reject("now", "must be an ISO-8601 instant with an explicit zone");
  }
  for (const key of ["chain", "profile"] as const) {
    const value = parsed[key];
    if (value !== undefined && (typeof value !== "string" || value.length === 0)) {
      return reject(key, "must be a non-empty string");
    }
  }
  if (parsed.workItemRef !== undefined && !isWorkItemRef(parsed.workItemRef)) {
    return reject("workItemRef", "must satisfy the delivered work-item ref pattern");
  }
  const credentials = parseCredentials(parsed.credentials);
  if (!credentials.ok) return credentials;
  const quota = parseQuota(parsed.quota);
  if (!quota.ok) return quota;
  const spend = parseSpend(parsed.spend);
  if (spend !== undefined && !spend.ok) return spend;
  const zones = parseZones(parsed.zones);
  if (!zones.ok) return zones;

  return {
    ok: true,
    fixture: {
      schemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
      now: parsed.now as string,
      nowMs,
      ...(parsed.chain === undefined ? {} : { chain: parsed.chain as string }),
      ...(parsed.profile === undefined ? {} : { profile: parsed.profile as string }),
      ...(parsed.workItemRef === undefined ? {} : { workItemRef: parsed.workItemRef as string }),
      credentials: credentials.value,
      quota: quota.value,
      ...(spend === undefined ? {} : { spend: spend.value }),
      zones: zones.value,
    },
  };
};

/** The step-table zone port; a zone absent from the table is unknown, never UTC. */
export const createProviderSimulateZonePort = (
  zones: Readonly<Record<string, readonly ProviderSimulateStep[]>>,
): ProviderZonePort => {
  const tableFor = (zone: string): readonly ProviderSimulateStep[] | undefined =>
    zones[zone] ??
    zones[zone.replace(/^Etc\//u, "")] ??
    (zone === "Etc/UTC" ? zones.UTC : undefined);
  const offsetAt = (steps: readonly ProviderSimulateStep[], atMs: number): number => {
    let offset = steps[0]?.offsetSeconds ?? 0;
    for (const step of steps) {
      if (step.fromMs > atMs) break;
      offset = step.offsetSeconds;
    }
    return offset;
  };
  return {
    isKnownZone: (zone) => tableFor(zone) !== undefined,
    offsetSecondsAt: (zone, atMs) => offsetAt(tableFor(zone) ?? [], atMs),
    nextTransitionAtOrAfter: (zone, atMs) => {
      const steps = tableFor(zone) ?? [];
      for (let index = 1; index < steps.length; index += 1) {
        const step = steps[index];
        const previous = steps[index - 1];
        if (step === undefined || previous === undefined) continue;
        if (step.offsetSeconds === previous.offsetSeconds) continue;
        if (step.fromMs >= atMs) return step.fromMs;
      }
      return undefined;
    },
  };
};

/**
 * The classified missing-credential result the delivered port returns (DEC-14):
 * the simulated classification mirrors the delivered environment port — a
 * missing variable on the reference's literal name — so the forwarded
 * projection reaches the park-evidence build and the log line in simulation
 * exactly as it does in production.
 */
const credentialMissing = (referenceName: string) => ({
  ok: false as const,
  code: "config.credential.missing" as const,
  domainKind: "config" as const,
  category: "user" as const,
  retryable: false as const,
  consequence: "not_landed" as const,
  projectionClass: "user-validation" as const,
  source: `literal:${referenceName}`,
  reason: "variable-absent" as const,
});

/** One entry's declared outcome, defaulting to `resolved` for undeclared references. */
const credentialOutcome = (
  fixture: ProviderSimulateFixture,
  reference: string | undefined,
): ProviderSimulateCredentialOutcome =>
  reference === undefined ? "resolved" : (fixture.credentials[reference] ?? "resolved");

/** Endpoint → entry name, so a fixture block keyed by entry can answer the transport. */
const endpointsByEntry = (config: ProviderConfiguration): Map<string, string> => {
  const map = new Map<string, string>();
  for (const name of Object.keys(config.entries).sort()) {
    const endpoint = config.entries[name]?.quota?.endpoint;
    if (endpoint !== undefined && !map.has(endpoint)) map.set(endpoint, name);
  }
  return map;
};

/**
 * The config projection the fixture's declared facts cover: an entry whose quota
 * policy references a resolvable credential but declares no fixture block is
 * simulated as an entry without that observation ("not probed"), while a
 * `missing` or `rejected` outcome keeps the policy so the delivered engine
 * reports the declared failure. Nothing is added to policy.
 */
const projectedConfig = (
  config: ProviderConfiguration,
  fixture: ProviderSimulateFixture,
): ProviderConfiguration => {
  const entries: Record<string, (typeof config.entries)[string]> = {};
  for (const [name, descriptor] of Object.entries(config.entries)) {
    const quota = descriptor.quota;
    const probeable =
      quota?.enabled === true &&
      fixture.quota[name] === undefined &&
      credentialOutcome(fixture, quota?.credentialRef) === "resolved";
    if (!probeable) {
      entries[name] = descriptor;
      continue;
    }
    const { quota: _omitted, ...rest } = descriptor;
    entries[name] = rest;
  }
  return { ...config, entries };
};

/** The fixture's spend facts projected per requested scope, as production would. */
const spendPortFor = (spend: ProviderSimulateSpend | undefined) => ({
  read: async (input: {
    readonly scopes: readonly { readonly scopeKey: string; readonly fromMs: number }[];
  }): Promise<ProviderSpendTotalsRead> => {
    if (spend === undefined || spend.telemetryState === "absent") return { status: "empty" };
    const totals: ProviderSpendTotals[] = input.scopes.map((scope) => {
      const contributing = spend.points.filter((point) => point.atMs >= scope.fromMs);
      const cost = contributing.reduce((sum, point) => sum + point.cost, 0);
      const tokens = contributing.reduce((sum, point) => sum + point.tokens, 0);
      const newestAtMs =
        contributing.length === 0 ? null : Math.max(...contributing.map((point) => point.atMs));
      return { scopeKey: scope.scopeKey, cost, tokens, newestAtMs };
    });
    return { status: "measured", totals };
  },
});

/** The payload summary, identical in shape to the delivered `resolve` summary. */
const decisionSummary = (decision: ProviderDecision): string =>
  decision.kind === "selected"
    ? `selected ${decision.providerName} (${decision.costClass})`
    : `parked ${decision.park.name} (${decision.park.cause}) until ${decision.park.expiresAt}`;

const boundedSummary = (
  decision: ProviderDecision,
  skipped: readonly ProviderSkippedEntry[],
  announcements: readonly ProviderAnnouncementRecord[],
): ProviderSimulateSummary => ({
  decision: decision.kind,
  ...(decision.kind === "selected"
    ? { providerName: decision.providerName }
    : { parkCause: decision.park.cause, resumeAt: decision.park.expiresAt }),
  skippedCount: skipped.length,
  announcementCodes: announcements.map((announcement) => announcement.code),
});

/**
 * Replay the fixture through the delivered engine and assemble the payload.
 *
 * No state store, fence, credential implementation, real transport, child
 * process, or ambient read participates: every seam answers from the fixture,
 * `resolve` is called with `persist: false`, and the fixture's `workItemRef` is
 * the only ref source (the local delivery context is never consulted).
 */
export const simulateProviderResolution = async (
  input: ProviderSimulateRequest,
): Promise<ProviderSimulateOutcome> => {
  const { fixture, config } = input;
  // The ref rule belongs to the replay itself, so every caller (the CLI edge
  // included) gets the same pre-engine refusal: a ref is required exactly when
  // an enabled budget is declared, and the fixture is its only source.
  const refRefusal = providerSimulateRefRefusal(config, fixture);
  if (refRefusal !== undefined) return refRefusal;
  const zonePort =
    Object.keys(fixture.zones).length === 0
      ? undefined
      : createProviderSimulateZonePort(fixture.zones);
  const zoneFactsFor = zonePort
    ? (zone: string) => (zonePort.isKnownZone(zone) ? bindZoneFacts(zone, zonePort) : undefined)
    : input.zoneFactsFor;
  const endpointOf = endpointsByEntry(config);

  const engine = createProviderEngine({
    clock: { nowMs: () => fixture.nowMs },
    credentialPort: {
      resolve: (reference) =>
        credentialOutcome(fixture, reference.referenceName) === "missing"
          ? credentialMissing(reference.referenceName)
          : { ok: true, material: { value: "" } },
    },
    transport: {
      send: async (request): Promise<QuotaTransportResult> => {
        const entry = endpointOf.get(request.endpoint);
        const block = entry === undefined ? undefined : fixture.quota[entry];
        if (block !== undefined) {
          if ("transport" in block) throw new Error("simulated transport outage");
          return { status: block.httpStatus, bodyText: block.body };
        }
        const reference =
          entry === undefined ? undefined : config.entries[entry]?.quota?.credentialRef;
        if (entry !== undefined && credentialOutcome(fixture, reference) === "rejected") {
          return { status: 401, bodyText: "" };
        }
        throw new Error("the simulate transport has no declared fact for this entry");
      },
    },
    sleep: { sleep: async () => undefined },
    spendTotals: spendPortFor(fixture.spend),
    ...(zoneFactsFor === undefined ? {} : { zoneFactsFor }),
  });

  const result: ProviderResolveResult = await engine.resolve({
    config: projectedConfig(config, fixture),
    ...(fixture.chain === undefined ? {} : { chainName: fixture.chain }),
    ...(input.profile === undefined ? {} : { profile: input.profile }),
    persist: false,
    ...(fixture.workItemRef === undefined ? {} : { workItemRef: fixture.workItemRef }),
  });

  if (!result.ok) {
    return {
      ok: false,
      code: result.errorCode,
      summary: result.summary,
      ...(result.announcementCode === undefined
        ? {}
        : { announcementCode: result.announcementCode }),
    };
  }

  const simulation: ProviderSimulateBlock = {
    fixturePath: input.fixturePath,
    fixtureSchemaVersion: PROVIDER_SIMULATE_SCHEMA_VERSION,
    now: fixture.now,
    ...(fixture.workItemRef === undefined ? {} : { workItemRef: fixture.workItemRef }),
    stateWrites: 0,
    inputs: {
      credentials: "fixture",
      quota: "fixture",
      spend: fixture.spend === undefined ? "none" : "fixture",
      zones: zonePort === undefined ? "runtime" : "fixture",
    },
    summary: boundedSummary(result.decision, result.skipped, result.announcements),
  };

  return {
    ok: true,
    data: {
      summary: decisionSummary(result.decision),
      chain: result.chainName,
      decision: result.decision,
      skipped: result.skipped,
      parks: result.parks,
      announcements: result.announcements,
      simulation,
    },
  };
};

/**
 * The fixture's ref rule (TDR-0064, TC-REF-004): a ref is required exactly when
 * the resolved configuration declares an enabled budget, and the fixture is its
 * only source — simulate never reads the local delivery context.
 */
export const providerSimulateRefRefusal = (
  config: ProviderConfiguration,
  fixture: ProviderSimulateFixture,
): ProviderSimulateFailure | undefined => {
  const enabled = enabledBudgets(config.budgets);
  if (enabled.length === 0) return undefined;
  if (fixture.workItemRef !== undefined) return undefined;
  const names = enabled.map((budget) => budget.name).join(", ");
  return {
    ok: false,
    code: "input.value.rejected",
    field: "workItemRef",
    summary:
      `simulate fixture workItemRef is required because the configuration declares the enabled ` +
      `budget(s) ${names}, which measure spend per work item; add workItemRef to the fixture, ` +
      `or disable the budget. simulate never reads the local delivery context.`,
  };
};
