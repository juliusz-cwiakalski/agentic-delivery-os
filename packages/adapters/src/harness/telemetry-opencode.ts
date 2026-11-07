/**
 * The opencode telemetry extractor (GH-233 F-7, DEC-5, NFR-2, NFR-3).
 *
 * Strictly read-only over the session store: read-only connection, query-only
 * pragma before the first read, bounded indexed queries only, parent-recursion
 * session-tree aggregation with an explicit session cap, and one neutral record
 * per session. Missing or unreadable stores are classified failures, never
 * crashes. The extractor never reads conversation content.
 */
import {
  HARNESS_MAX_AGENTS,
  HARNESS_MAX_MODELS,
  HARNESS_MAX_SESSIONS,
  HARNESS_MAX_TOOLS_PER_AGENT,
  HARNESS_TELEMETRY_SCHEMA_ID,
  type HarnessAgentCount,
  type HarnessModelCount,
  type HarnessResult,
  type HarnessTelemetryCapture,
  type HarnessTelemetryRecord,
  type HarnessTelemetryWarning,
  type HarnessTokenCounts,
  type HarnessToolCount,
} from "@delivery-os/core/contracts";
import {
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

export type OpencodeTelemetryExtractor = {
  readonly extract: (input: {
    readonly workItemRef: string;
    readonly runId: string;
  }) => HarnessResult<HarnessTelemetryCapture>;
};

type SessionRow = {
  readonly id: string;
  readonly parentId: string | null;
  readonly workItemRef: string | null;
  readonly harnessVersion: string | null;
};

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const num = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const sessionRow = (row: HarnessSqliteRow): SessionRow | undefined => {
  const id = str(row.id);
  if (id === undefined) return undefined;
  return {
    id,
    parentId: str(row.parent_id) ?? null,
    workItemRef: str(row.work_item_ref) ?? null,
    harnessVersion: str(row.harness_version) ?? null,
  };
};

const tokenColumn = (columns: ReadonlySet<string>, name: string): string | undefined =>
  columns.has(name) ? name : undefined;

const aggregateColumn = (column: string | undefined, alias: string): string =>
  column === undefined ? `NULL AS ${alias}` : `SUM(${column}) AS ${alias}`;

const badColumn = (column: string | undefined, alias: string): string =>
  column === undefined
    ? `0 AS ${alias}`
    : `SUM(CASE WHEN ${column} IS NOT NULL AND typeof(${column}) NOT IN ('integer','real') THEN 1 ELSE 0 END) AS ${alias}`;

const capCounts = <T extends { readonly calls: number }>(
  entries: readonly T[],
  cap: number,
  nameOf: (entry: T) => string,
): { kept: readonly T[]; truncation?: { truncated: true; omitted: number; cap: number } } => {
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

const failure = (summary: string): HarnessResult<never> => ({
  ok: false,
  error: { kind: "harness", code: "harness.telemetry.extraction-failed", summary },
});

/**
 * The per-session (agent, model) group cap (F-3, F-7).
 *
 * One telemetry record is emitted per group; a session spanning more groups
 * than this cap truncates with an explicit `truncated` warning carrying the
 * omitted group count. Never a silent drop.
 */
const MAX_AGENT_MODEL_GROUPS = 16;

/** Build the opencode extractor over the injected read-only store seam. */
export const createOpencodeTelemetryExtractor = (
  options: OpencodeTelemetryOptions,
): OpencodeTelemetryExtractor => ({
  extract: ({ workItemRef, runId }) => {
    const maxSessions = options.maxSessions ?? HARNESS_MAX_SESSIONS;
    const opened = openHarnessStoreReadOnly(options.opener, options.storePath, options.onStatement);
    if (!opened.ok) return failure("the opencode session store could not be opened read-only");
    const handle = opened.handle;
    try {
      const messageColumns = new Set(
        handle
          .query("PRAGMA table_info(message)")
          .map((row) => row.name)
          .filter((name): name is string => typeof name === "string"),
      );
      const input = tokenColumn(messageColumns, "input_tokens");
      const output = tokenColumn(messageColumns, "output_tokens");
      const reasoning = tokenColumn(messageColumns, "reasoning_tokens");
      const cacheRead = tokenColumn(messageColumns, "cache_read_tokens");
      const cacheWrite = tokenColumn(messageColumns, "cache_write_tokens");
      const cost = tokenColumn(messageColumns, "cost");

      const roots = handle
        .query(
          "SELECT id, parent_id, work_item_ref, harness_version FROM session WHERE parent_id IS NULL AND work_item_ref = ? ORDER BY id LIMIT ?",
          [workItemRef, maxSessions + 1],
        )
        .map(sessionRow)
        .filter((row): row is SessionRow => row !== undefined);
      const failedSessions: Array<{
        readonly sessionId: string | null;
        readonly reason: HarnessTelemetryCapture["failedSessions"][number]["reason"];
      }> = [];
      // Store-scoped disclosure: parentless sessions without a work-item port
      // belong to no delivery. They are counted as a bounded store warning,
      // never fabricated as this delivery's failed sessions (GH-233 F-11).
      const outOfPortOrphans =
        num(
          handle.query(
            "SELECT COUNT(*) AS total FROM (SELECT id FROM session WHERE parent_id IS NULL AND (work_item_ref IS NULL OR work_item_ref = '') LIMIT ?)",
            [maxSessions + 1],
          )[0]?.total,
        ) ?? 0;
      const invalidIdentityRows =
        num(
          handle.query(
            "SELECT COUNT(*) AS total FROM (SELECT id FROM session WHERE id IS NULL OR id = '' LIMIT ?)",
            [maxSessions + 1],
          )[0]?.total,
        ) ?? 0;

      const rootTotal =
        roots.length > maxSessions
          ? (num(
              handle.query(
                "SELECT COUNT(*) AS total FROM session WHERE parent_id IS NULL AND work_item_ref = ? LIMIT 1",
                [workItemRef],
              )[0]?.total,
            ) ?? roots.length)
          : roots.length;
      const sessionTruncation =
        roots.length > maxSessions
          ? { truncated: true as const, omitted: rootTotal - maxSessions, cap: maxSessions }
          : undefined;
      const selectedRoots = roots.slice(0, maxSessions);
      const tree: Array<{ session: SessionRow; root: SessionRow; parentChain: readonly string[] }> =
        [];
      for (const root of selectedRoots) {
        tree.push({ session: root, root, parentChain: [] });
        const queue: Array<{ session: SessionRow; chain: readonly string[] }> = [
          { session: root, chain: [] },
        ];
        while (queue.length > 0 && tree.length < maxSessions) {
          const next = queue.shift();
          if (next === undefined) break;
          const children = handle
            .query(
              "SELECT id, parent_id, work_item_ref, harness_version FROM session WHERE parent_id = ? ORDER BY id LIMIT ?",
              [next.session.id, maxSessions + 1],
            )
            .map(sessionRow)
            .filter((row): row is SessionRow => row !== undefined);
          for (const child of children) {
            if (tree.length >= maxSessions) break;
            const chain = [...next.chain, next.session.id];
            tree.push({ session: child, root, parentChain: chain });
            queue.push({ session: child, chain });
          }
        }
      }

      const records: HarnessTelemetryRecord[] = [];
      const groupTruncationWarnings: HarnessTelemetryWarning[] = [];
      for (const entry of tree) {
        const aggregate = handle.query(
          `SELECT agent, model, COUNT(*) AS calls,
             ${aggregateColumn(input, "input")}, ${aggregateColumn(output, "output")},
             ${aggregateColumn(reasoning, "reasoning")},
             ${aggregateColumn(cacheRead, "cacheRead")},
             ${aggregateColumn(cacheWrite, "cacheWrite")},
             ${cost === undefined ? "NULL" : `SUM(${cost})`} AS cost,
             ${badColumn(input, "badInput")}, ${badColumn(output, "badOutput")},
             ${badColumn(reasoning, "badReasoning")}, ${badColumn(cacheRead, "badCacheRead")},
             ${badColumn(cacheWrite, "badCacheWrite")}, ${badColumn(cost, "badCost")}
           FROM message WHERE session_id = ? GROUP BY agent, model
           ORDER BY calls DESC, agent ASC, model ASC LIMIT ?`,
          [entry.session.id, MAX_AGENT_MODEL_GROUPS + 1],
        );
        if (aggregate.length === 0) {
          failedSessions.push({ sessionId: entry.session.id, reason: "invalid-session-identity" });
          continue;
        }
        if (aggregate.length > MAX_AGENT_MODEL_GROUPS) {
          const total =
            num(
              handle.query(
                "SELECT COUNT(*) AS total FROM (SELECT 1 FROM message WHERE session_id = ? GROUP BY agent, model) LIMIT 1",
                [entry.session.id],
              )[0]?.total,
            ) ?? aggregate.length;
          groupTruncationWarnings.push({
            reason: "truncated",
            field: `agent-model-groups(omitted=${Math.max(
              total - MAX_AGENT_MODEL_GROUPS,
              0,
            )},cap=${MAX_AGENT_MODEL_GROUPS})`,
          });
        }
        const harnessVersion = entry.root.harnessVersion;
        for (const row of aggregate.slice(0, MAX_AGENT_MODEL_GROUPS)) {
          const warnings: HarnessTelemetryWarning[] = [];
          const agent = str(row.agent);
          const model = str(row.model);
          if (agent === undefined || model === undefined) {
            failedSessions.push({
              sessionId: entry.session.id,
              reason: "invalid-session-identity",
            });
            continue;
          }
          const tokenFor = (
            alias: string,
            badAlias: string,
            column: string | undefined,
            field: string,
          ): number | null => {
            if (column === undefined) {
              warnings.push({ reason: "optional-field-absent", field });
              return null;
            }
            if ((num(row[badAlias]) ?? 0) > 0) {
              warnings.push({ reason: "non-numeric-value", field });
              return null;
            }
            return num(row[alias]);
          };
          const tokens: HarnessTokenCounts = {
            input: tokenFor("input", "badInput", input, "input"),
            output: tokenFor("output", "badOutput", output, "output"),
            reasoning: tokenFor("reasoning", "badReasoning", reasoning, "reasoning"),
            cacheRead: tokenFor("cacheRead", "badCacheRead", cacheRead, "cacheRead"),
            cacheWrite: tokenFor("cacheWrite", "badCacheWrite", cacheWrite, "cacheWrite"),
          };
          let recordCost = num(row.cost);
          if (cost === undefined) {
            warnings.push({ reason: "cost-missing", field: "cost" });
            recordCost = null;
          } else if ((num(row.badCost) ?? 0) > 0) {
            warnings.push({ reason: "non-numeric-value", field: "cost" });
            recordCost = null;
          } else if (recordCost === null) {
            warnings.push({ reason: "cost-missing", field: "cost" });
          }

          const toolRows = handle
            .query(
              "SELECT part.tool AS tool, COUNT(*) AS calls FROM part JOIN message ON message.id = part.message_id WHERE part.session_id = ? AND message.agent = ? AND message.model = ? GROUP BY part.tool ORDER BY calls DESC, part.tool ASC LIMIT ?",
              [entry.session.id, agent, model, HARNESS_MAX_TOOLS_PER_AGENT + 1],
            )
            .flatMap((toolRow): HarnessToolCount[] => {
              const tool = str(toolRow.tool);
              const calls = num(toolRow.calls);
              if (tool === undefined || calls === null) return [];
              return [{ tool, calls }];
            });
          const toolTruncation =
            toolRows.length > HARNESS_MAX_TOOLS_PER_AGENT
              ? {
                  truncated: true as const,
                  omitted: toolRows.length - HARNESS_MAX_TOOLS_PER_AGENT,
                  cap: HARNESS_MAX_TOOLS_PER_AGENT,
                }
              : undefined;
          if (
            options.pinnedVersion !== undefined &&
            harnessVersion !== null &&
            harnessVersion !== options.pinnedVersion
          ) {
            warnings.push({
              reason: "version-drift",
              field: `harnessVersion(expected=${options.pinnedVersion},observed=${harnessVersion})`,
            });
          }
          records.push({
            schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
            workItemRef,
            runId,
            sessionId: entry.session.id,
            harnessKind: "opencode",
            harnessVersion,
            agent,
            model,
            treeRoot: entry.root.id,
            parentChain: entry.parentChain,
            tokens,
            calls: num(row.calls) ?? 0,
            toolCounts: toolRows.slice(0, HARNESS_MAX_TOOLS_PER_AGENT),
            ...(toolTruncation === undefined ? {} : { toolTruncation }),
            cost: recordCost,
            capturedAt: options.now(),
            warnings,
          });
        }
      }

      const agentCounts: HarnessAgentCount[] = [];
      const modelCounts: HarnessModelCount[] = [];
      for (const record of records) {
        const existingAgent = agentCounts.find((entry) => entry.agent === record.agent);
        if (existingAgent === undefined)
          agentCounts.push({ agent: record.agent, calls: record.calls });
        else
          agentCounts[agentCounts.indexOf(existingAgent)] = {
            agent: existingAgent.agent,
            calls: existingAgent.calls + record.calls,
          };
        const existingModel = modelCounts.find((entry) => entry.model === record.model);
        if (existingModel === undefined)
          modelCounts.push({ model: record.model, calls: record.calls });
        else
          modelCounts[modelCounts.indexOf(existingModel)] = {
            model: existingModel.model,
            calls: existingModel.calls + record.calls,
          };
      }
      const agents = capCounts(agentCounts, HARNESS_MAX_AGENTS, (entry) => entry.agent);
      const models = capCounts(modelCounts, HARNESS_MAX_MODELS, (entry) => entry.model);
      const warnings = [
        ...records.flatMap((record) => record.warnings),
        ...groupTruncationWarnings,
        ...(outOfPortOrphans === 0
          ? []
          : [
              {
                reason: "unattributable-session" as const,
                field: `store:out-of-port-orphans=${outOfPortOrphans}`,
              },
            ]),
        ...(invalidIdentityRows === 0
          ? []
          : [
              {
                reason: "invalid-session-identity" as const,
                field: `store:invalid-identity=${invalidIdentityRows}`,
              },
            ]),
      ];
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
          warnings,
          ...(sessionTruncation === undefined ? {} : { sessionTruncation }),
          ...(agents.truncation === undefined ? {} : { agentTruncation: agents.truncation }),
          ...(models.truncation === undefined ? {} : { modelTruncation: models.truncation }),
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
