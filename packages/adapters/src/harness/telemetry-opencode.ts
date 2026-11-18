/**
 * The opencode telemetry extractor over the OBSERVED store contract
 * (GH-335 F-5, F-6; DM-10, DEC-4, DEC-9, DEC-13; TDR-0032 decision 4).
 *
 * Strictly read-only: read-only connection, the query-only pragma before the
 * first read, bounded statements scoped by a held session identity, and no
 * content projection. Two observed generations coexist (`session_v2`/
 * `session_message` and `session`/`message`); the current one is read first and
 * the legacy one is tolerated. A session's own `version` is the stamp, the seat
 * and resolved model come from the recording attempt's binding, durations come
 * from the store's timestamp pair, and an observed identity axis the store
 * states nowhere lands with the declared absence marker and the empty-string
 * placeholder rather than a fabricated value.
 */
import {
  HARNESS_MAX_AGENTS,
  HARNESS_MAX_MODELS,
  HARNESS_MAX_SESSIONS,
  HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessAgentCount,
  type HarnessCaptureAbsence,
  type HarnessModelCount,
  type HarnessObservedAxis,
  type HarnessResult,
  type HarnessSeatBinding,
  type HarnessTelemetryCapture,
  type HarnessTelemetryDurations,
  type HarnessTelemetryRecord,
  type HarnessTelemetryWarning,
  type HarnessTokenCounts,
  type HarnessTruncation,
} from "@delivery-os/core/contracts";
import {
  type HarnessSqliteHandle,
  type HarnessSqliteRow,
  type HarnessStoreOpener,
  openHarnessStoreReadOnly,
} from "./sqlite-loader.js";

export type OpencodeTelemetryOptions = {
  readonly opener: HarnessStoreOpener;
  readonly storePath: string;
  readonly now: () => string;
  readonly pinnedVersion?: string;
  readonly maxSessions?: number;
  readonly onStatement?: (sql: string) => void;
};

/**
 * One capture request: the work item still stamps the row, while the observed
 * session identities the work item's recorded attempts hold select it (DM-8).
 */
export type OpencodeTelemetryInput = {
  readonly workItemRef: string;
  readonly runId: string;
  /** The union of held session identities; an empty union is the caller's `skipped-gap`. */
  readonly heldSessionIds: readonly string[];
  /** Each held identity's recording binding, where its attempt recorded one. */
  readonly bindings?: Readonly<Record<string, HarnessSeatBinding>>;
  /** Recorded attempts that held no identity, counted and never inferred. */
  readonly unattributedAttempts?: number;
  /** The bounded attempt read's counted truncation, disclosed never silent. */
  readonly attemptTruncation?: HarnessTruncation;
};

export type OpencodeTelemetryExtractor = {
  readonly extract: (input: OpencodeTelemetryInput) => HarnessResult<HarnessTelemetryCapture>;
};

type StoreGeneration = "current" | "legacy";

type SessionFacts = {
  readonly id: string;
  readonly version: string | null;
  readonly agent: string | null;
  readonly model: string | null;
  readonly cost: number | null;
  readonly tokens: HarnessTokenCounts;
  readonly timeCreated: number | null;
  readonly timeUpdated: number | null;
  readonly hasUsage: boolean;
};

type MessageFacts = {
  readonly agent: string | null;
  readonly model: string | null;
  readonly cost: number | null;
  readonly tokens: HarnessTokenCounts;
};

/** The per-session (agent, model) group cap (F-3, F-7). */
const MAX_AGENT_MODEL_GROUPS = 16;

/** The per-session message read bound (NFR-3): bounded, never a table scan. */
const MAX_MESSAGES_PER_SESSION = 512;

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

/** Canonicalize one observed model object to a single identifier. */
const canonicalModel = (value: unknown): string | null => {
  const record = asRecord(value);
  if (record === undefined) return str(value) ?? null;
  const provider = str(record.providerID) ?? str(record.providerId);
  const id = str(record.id);
  if (provider === undefined || id === undefined) return null;
  const variant = str(record.variant);
  return variant === undefined || variant === "default"
    ? `${provider}/${id}`
    : `${provider}/${id}#${variant}`;
};

const tokenOf = (source: Record<string, unknown> | undefined, name: string): number | null =>
  source === undefined ? null : num(source[name]);

/** Normalize one observed `tokens` object. */
const tokensOf = (value: unknown): HarnessTokenCounts => {
  const tokens = asRecord(value);
  const cache = tokens === undefined ? undefined : asRecord(tokens.cache);
  return {
    input: tokenOf(tokens, "input"),
    output: tokenOf(tokens, "output"),
    reasoning: tokenOf(tokens, "reasoning"),
    cacheRead: tokenOf(cache, "read"),
    cacheWrite: tokenOf(cache, "write"),
  };
};

/** Whether any token class states a non-zero count (a usage fact). */
const hasAnyToken = (tokens: HarnessTokenCounts): boolean =>
  [tokens.input, tokens.output, tokens.reasoning, tokens.cacheRead, tokens.cacheWrite].some(
    (value) => value !== null && value > 0,
  );

const addCounts = (left: number | null, right: number | null): number | null => {
  if (left === null) return right;
  if (right === null) return left;
  return left + right;
};

const failure = (summary: string): HarnessResult<never> => ({
  ok: false,
  error: { kind: "harness", code: "harness.telemetry.extraction-failed", summary },
});

const fingerprint = <T extends { readonly calls: number }>(
  entries: readonly T[],
  cap: number,
  nameOf: (entry: T) => string,
): { kept: readonly T[]; truncation?: HarnessTruncation } => {
  const sorted = [...entries].sort((left, right) => {
    if (right.calls !== left.calls) return right.calls - left.calls;
    return nameOf(left) < nameOf(right) ? -1 : 1;
  });
  if (sorted.length <= cap) return { kept: sorted };
  return {
    kept: sorted.slice(0, cap),
    truncation: { truncated: true, omitted: sorted.length - cap, cap },
  };
};

const sessionFacts = (row: HarnessSqliteRow): SessionFacts | undefined => {
  const id = str(row.id);
  if (id === undefined) return undefined;
  const tokens: HarnessTokenCounts = {
    input: num(row.tokens_input),
    output: num(row.tokens_output),
    reasoning: num(row.tokens_reasoning),
    cacheRead: num(row.tokens_cache_read),
    cacheWrite: num(row.tokens_cache_write),
  };
  const cost = num(row.cost);
  return {
    id,
    version: str(row.version) ?? null,
    agent: str(row.agent) ?? null,
    model: canonicalModel(row.model),
    cost,
    tokens,
    timeCreated: num(row.time_created),
    timeUpdated: num(row.time_updated),
    // A reported zero is recorded as reported, but a session with no message
    // and only zeros states no observable usage fact (OQ-8).
    hasUsage: (cost ?? 0) > 0 || hasAnyToken(tokens),
  };
};

const messageFacts = (row: HarnessSqliteRow): MessageFacts => {
  const data = asRecord(row.data) ?? {};
  return {
    agent: str(data.agent) ?? null,
    model: canonicalModel(data.model),
    cost: num(data.cost),
    tokens: tokensOf(data.tokens),
  };
};

/**
 * Project one ordered message stream into usage rows, applying the observed
 * transitions (GH-335 F-6, spec §8.3).
 *
 * `agent-switched` updates the running agent and `model-switched` the running
 * model; a usage row that states no value inherits the running baseline, so a
 * mid-session switch scopes the following groups correctly. A legacy row carries
 * no type and is treated as a usage row.
 */
const projectMessages = (
  rows: readonly HarnessSqliteRow[],
  baseline: { readonly agent: string | null; readonly model: string | null },
): readonly MessageFacts[] => {
  let runningAgent = baseline.agent;
  let runningModel = baseline.model;
  const facts: MessageFacts[] = [];
  for (const row of rows) {
    const type = str(row.type);
    const data = asRecord(row.data) ?? {};
    if (type === "agent-switched") {
      runningAgent = str(data.agent) ?? runningAgent;
      continue;
    }
    if (type === "model-switched") {
      runningModel = canonicalModel(data.model) ?? runningModel;
      continue;
    }
    const usage = messageFacts(row);
    facts.push({
      agent: usage.agent ?? runningAgent,
      model: usage.model ?? runningModel,
      cost: usage.cost,
      tokens: usage.tokens,
    });
  }
  return facts;
};

const SESSION_COLUMNS =
  "id, parent_id, version, agent, model, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated";

/**
 * Per-message usage rows: the current generation reads the assistant usage rows
 * AND the observed `agent-switched` / `model-switched` transition rows in `seq`
 * order (spec §8.3, plan 5.1); the legacy generation has no type column and is
 * read in timestamp order.
 */
const messageSql = (generation: StoreGeneration): string =>
  generation === "current"
    ? `SELECT type, data FROM session_message WHERE session_id = ? AND type IN ('assistant', 'agent-switched', 'model-switched') ORDER BY seq LIMIT ${String(MAX_MESSAGES_PER_SESSION)}`
    : `SELECT data FROM message WHERE session_id = ? ORDER BY time_created, id LIMIT ${String(MAX_MESSAGES_PER_SESSION)}`;

const detectGeneration = (handle: HarnessSqliteHandle): StoreGeneration | undefined => {
  const tables = new Set(
    handle
      .query("SELECT name FROM sqlite_master WHERE type = 'table'")
      .map((row) => str(row.name))
      .filter((name): name is string => name !== undefined),
  );
  if (tables.has("session_v2") && tables.has("session_message")) return "current";
  if (tables.has("session") && tables.has("message")) return "legacy";
  return undefined;
};

/** The representable `Date` range in epoch milliseconds (±8.64e15). */
const MAX_DATE_MS = 8.64e15;

const isoOf = (milliseconds: number): string | undefined => {
  if (!Number.isFinite(milliseconds) || Math.abs(milliseconds) > MAX_DATE_MS) return undefined;
  try {
    return new Date(milliseconds).toISOString();
  } catch {
    return undefined;
  }
};

const durationsOf = (session: SessionFacts): HarnessTelemetryDurations => {
  const start = session.timeCreated;
  const end = session.timeUpdated;
  if (start === null || end === null) return { status: "absent", reason: "duration-absent" };
  const elapsedMs = end - start;
  if (elapsedMs < 0) return { status: "absent", reason: "duration-absent" };
  const startIso = isoOf(start);
  const endIso = isoOf(end);
  if (startIso === undefined || endIso === undefined) {
    return { status: "absent", reason: "duration-absent" };
  }
  return {
    status: "sourced",
    start: startIso,
    end: endIso,
    elapsedMs,
  };
};

/**
 * Normalize one stored session version (GH-335 F-7, AC-F5-1).
 *
 * The observed session row carries a bare semantic version (`2.2.5`); a `v`
 * prefix or a product-token line is normalized too. Anything unparseable is
 * `null` with the declared absence warning — never a raw, unnormalized stamp.
 */
const normalizeStoredVersion = (raw: string): string | null => {
  // The observed session column carries a bare semantic version (DM-10); a `v`
  // prefix is normalized away and anything else is not this column's shape, so
  // it is an explicit absence rather than a guessed identity. The probe-line
  // grammar lives in the contracts/domain tier and is not duplicated here.
  const bare = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(raw.trim());
  if (bare === null) return null;
  const [major, minor, patch] = [bare[1], bare[2], bare[3]];
  if (major === undefined || minor === undefined || patch === undefined) return null;
  return `${major}.${minor}.${patch}`;
};

type Group = {
  readonly agent: string | null;
  readonly model: string | null;
  readonly calls: number;
  readonly tokens: HarnessTokenCounts;
  readonly cost: number | null;
};

/** Group one session's usage-bearing messages by observed (agent, model). */
const groupsOf = (session: SessionFacts, messages: readonly MessageFacts[]): readonly Group[] => {
  if (messages.length === 0) {
    if (!session.hasUsage) return [];
    return [
      {
        agent: session.agent,
        model: session.model,
        calls: 0,
        tokens: session.tokens,
        cost: session.cost,
      },
    ];
  }
  const groups = new Map<string, Group>();
  for (const message of messages) {
    const agent = message.agent ?? session.agent;
    const model = message.model ?? session.model;
    const key = `${agent ?? ""}\u0000${model ?? ""}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, { agent, model, calls: 1, tokens: message.tokens, cost: message.cost });
      continue;
    }
    groups.set(key, {
      agent: existing.agent,
      model: existing.model,
      calls: existing.calls + 1,
      tokens: {
        input: addCounts(existing.tokens.input, message.tokens.input),
        output: addCounts(existing.tokens.output, message.tokens.output),
        reasoning: addCounts(existing.tokens.reasoning, message.tokens.reasoning),
        cacheRead: addCounts(existing.tokens.cacheRead, message.tokens.cacheRead),
        cacheWrite: addCounts(existing.tokens.cacheWrite, message.tokens.cacheWrite),
      },
      cost: addCounts(existing.cost, message.cost),
    });
  }
  return [...groups.values()].sort((left, right) => {
    if (right.calls !== left.calls) return right.calls - left.calls;
    const leftKey = `${left.agent ?? ""}/${left.model ?? ""}`;
    const rightKey = `${right.agent ?? ""}/${right.model ?? ""}`;
    return leftKey < rightKey ? -1 : 1;
  });
};

/** Build the opencode extractor over the injected read-only store seam. */
export const createOpencodeTelemetryExtractor = (
  options: OpencodeTelemetryOptions,
): OpencodeTelemetryExtractor => ({
  extract: ({
    workItemRef,
    runId,
    heldSessionIds,
    bindings = {},
    unattributedAttempts,
    attemptTruncation,
  }) => {
    const maxSessions = options.maxSessions ?? HARNESS_MAX_SESSIONS;
    const opened = openHarnessStoreReadOnly(options.opener, options.storePath, options.onStatement);
    if (!opened.ok) return failure("the opencode session store could not be opened read-only");
    const handle = opened.handle;
    try {
      const generation = detectGeneration(handle);
      if (generation === undefined) {
        return failure("the opencode session store carries no recognised session generation");
      }
      const sessionTableName = generation === "current" ? "session_v2" : "session";
      const readSession = (id: string): SessionFacts | undefined => {
        const row = handle.query(
          `SELECT ${SESSION_COLUMNS} FROM ${sessionTableName} WHERE id = ? LIMIT 1`,
          [id],
        )[0];
        return row === undefined ? undefined : sessionFacts(row);
      };
      const readChildren = (parentId: string): readonly string[] =>
        handle
          .query(
            `SELECT id FROM ${sessionTableName} WHERE parent_id = ? ORDER BY id LIMIT ${String(maxSessions + 1)}`,
            [parentId],
          )
          .map((row) => str(row.id))
          .filter((id): id is string => id !== undefined);
      const readMessages = (session: SessionFacts): readonly MessageFacts[] =>
        projectMessages(handle.query(messageSql(generation), [session.id]), {
          agent: session.agent,
          model: session.model,
        });

      const held = [...new Set(heldSessionIds)].sort();
      const absences: HarnessCaptureAbsence[] = [];
      const failedSessions: HarnessTelemetryCapture["failedSessions"][number][] = [];
      const records: HarnessTelemetryRecord[] = [];
      const truncationWarnings: HarnessTelemetryWarning[] = [];
      let considered = 0;

      for (const heldId of held) {
        if (considered >= maxSessions) break;
        const root = readSession(heldId);
        if (root === undefined) {
          absences.push({ sessionId: heldId, reason: "session-not-in-store" });
          continue;
        }
        const tree: { readonly session: SessionFacts; readonly parentChain: readonly string[] }[] =
          [{ session: root, parentChain: [] }];
        const queue: { readonly session: SessionFacts; readonly chain: readonly string[] }[] = [
          { session: root, chain: [] },
        ];
        while (queue.length > 0 && considered + tree.length < maxSessions) {
          const next = queue.shift();
          if (next === undefined) break;
          for (const childId of readChildren(next.session.id)) {
            if (considered + tree.length >= maxSessions) break;
            const child = readSession(childId);
            if (child === undefined) continue;
            const chain = [...next.chain, next.session.id];
            tree.push({ session: child, parentChain: chain });
            queue.push({ session: child, chain });
          }
        }
        for (const entry of tree) {
          considered += 1;
          const groups = groupsOf(entry.session, readMessages(entry.session));
          if (groups.length === 0) {
            failedSessions.push({ sessionId: entry.session.id, reason: "no-usage-fact" });
            continue;
          }
          if (groups.length > MAX_AGENT_MODEL_GROUPS) {
            truncationWarnings.push({
              reason: "truncated",
              field: `agent-model-groups(omitted=${String(groups.length - MAX_AGENT_MODEL_GROUPS)},cap=${String(MAX_AGENT_MODEL_GROUPS)})`,
            });
          }
          const binding = bindings[heldId];
          const durations = durationsOf(entry.session);
          for (const group of groups.slice(0, MAX_AGENT_MODEL_GROUPS)) {
            const warnings: HarnessTelemetryWarning[] = [];
            const absentAxes: HarnessObservedAxis[] = [];
            if (group.agent === null) {
              absentAxes.push("agent");
              warnings.push({ reason: "optional-field-absent", field: "agent" });
            }
            if (group.model === null) {
              absentAxes.push("model");
              warnings.push({ reason: "optional-field-absent", field: "model" });
            }
            // The seat claim cites the recording attempt's binding, and attaches
            // only to the group whose observed agent equals the binding's agent.
            const bindsThisGroup = binding !== undefined && group.agent === binding.agent;
            if (!bindsThisGroup) {
              warnings.push({ reason: "unresolved-seat", field: "seat" });
            } else if (group.model !== null && group.model !== binding.resolvedModel) {
              warnings.push({ reason: "model-divergence", field: "model" });
            }
            if (binding !== undefined && group.agent !== null && group.agent !== binding.agent) {
              warnings.push({ reason: "agent-divergence", field: "agent" });
            }
            const harnessVersion =
              entry.session.version === null ? null : normalizeStoredVersion(entry.session.version);
            if (harnessVersion === null) {
              warnings.push({ reason: "optional-field-absent", field: "harnessVersion" });
            } else if (
              options.pinnedVersion !== undefined &&
              harnessVersion !== options.pinnedVersion
            ) {
              warnings.push({ reason: "version-drift", field: "harnessVersion" });
            }
            if (durations.status === "absent") {
              warnings.push({ reason: "duration-absent", field: "durations" });
            }
            // No observed generation exposes a populated tool source.
            warnings.push({ reason: "no-tool-source", field: "toolCounts" });
            if (group.cost === null && !hasAnyToken(group.tokens)) {
              failedSessions.push({ sessionId: entry.session.id, reason: "no-usage-fact" });
              continue;
            }
            records.push({
              schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
              workItemRef,
              runId,
              sessionId: entry.session.id,
              harnessKind: "opencode",
              harnessVersion,
              agent: group.agent ?? HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
              model: group.model ?? HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,
              treeRoot: root.id,
              parentChain: entry.parentChain,
              tokens: group.tokens,
              calls: group.calls,
              toolCounts: [],
              cost: group.cost,
              capturedAt: options.now(),
              warnings,
              seat: bindsThisGroup ? (binding?.seat ?? null) : null,
              resolvedModel: bindsThisGroup ? (binding?.resolvedModel ?? null) : null,
              durations,
              ...(absentAxes.length === 0 ? {} : { absentObservedAxes: absentAxes }),
            });
          }
        }
      }

      const agentTotals = new Map<string, number>();
      const modelTotals = new Map<string, number>();
      for (const record of records) {
        agentTotals.set(record.agent, (agentTotals.get(record.agent) ?? 0) + record.calls);
        modelTotals.set(record.model, (modelTotals.get(record.model) ?? 0) + record.calls);
      }
      const agentCounts: HarnessAgentCount[] = [...agentTotals].map(([agent, calls]) => ({
        agent,
        calls,
      }));
      const modelCounts: HarnessModelCount[] = [...modelTotals].map(([model, calls]) => ({
        model,
        calls,
      }));
      const agents = fingerprint(agentCounts, HARNESS_MAX_AGENTS, (entry) => entry.agent);
      const models = fingerprint(modelCounts, HARNESS_MAX_MODELS, (entry) => entry.model);
      const sessionTruncation: HarnessTruncation | undefined =
        considered < held.length
          ? { truncated: true, omitted: held.length - considered, cap: maxSessions }
          : undefined;
      return {
        ok: true,
        value: {
          workItemRef,
          runId,
          capturedAt: options.now(),
          records,
          agents: agents.kept,
          models: models.kept,
          failedSessions,
          warnings: [...records.flatMap((record) => record.warnings), ...truncationWarnings],
          ...(sessionTruncation === undefined ? {} : { sessionTruncation }),
          ...(agents.truncation === undefined ? {} : { agentTruncation: agents.truncation }),
          ...(models.truncation === undefined ? {} : { modelTruncation: models.truncation }),
          ...(absences.length === 0 ? {} : { absences }),
          ...(unattributedAttempts === undefined || unattributedAttempts === 0
            ? {}
            : { unattributedAttempts }),
          ...(attemptTruncation === undefined ? {} : { attemptTruncation }),
        },
      };
    } catch {
      return failure("the opencode session store could not be read");
    } finally {
      try {
        handle.close();
      } catch {
        // Closing a read-only handle is best effort; the store is untouched.
      }
    }
  },
});
