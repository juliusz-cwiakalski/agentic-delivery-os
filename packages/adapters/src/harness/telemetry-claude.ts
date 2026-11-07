/**
 * The Claude Code telemetry extractor (GH-233 F-7, DEC-5, NFR-2, NFR-3, §20).
 *
 * Read-only local-file parsing: files are opened for reading only, bounded by a
 * declared per-file byte and line cap with explicit truncation marks, and only
 * statistics structures are parsed — a privacy canary planted in message
 * content never enters the output. Malformed lines degrade with warnings;
 * missing files are classified capture outcomes. No shell-out occurs.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  HARNESS_MAX_AGENTS,
  HARNESS_MAX_FILE_BYTES,
  HARNESS_MAX_FILE_LINES,
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
} from "@delivery-os/core/contracts";

/** One read result; a missing or unreadable file is data. */
export type HarnessFileRead =
  | { readonly ok: true; readonly bytes: number; readonly text: string }
  | { readonly ok: false; readonly code: "missing" | "unreadable" };

/** The injected read-only file reader. */
export type HarnessFileReader = {
  readonly list: (
    directory: string,
  ) => { readonly ok: true; readonly paths: readonly string[] } | { readonly ok: false };
  readonly read: (path: string) => HarnessFileRead;
};

/** Production reader: local filesystem, read-only. */
export const createNodeFileReader = (): HarnessFileReader => ({
  list: (directory) => {
    try {
      return {
        ok: true,
        paths: readdirSync(directory)
          .filter((entry) => entry.endsWith(".jsonl"))
          .map((entry) => join(directory, entry))
          .sort(),
      };
    } catch {
      return { ok: false };
    }
  },
  read: (path) => {
    try {
      const info = statSync(path);
      return { ok: true, bytes: info.size, text: readFileSync(path, "utf8") };
    } catch (error) {
      const code = (error as { readonly code?: unknown }).code;
      return { ok: false, code: code === "ENOENT" ? "missing" : "unreadable" };
    }
  },
});

export type ClaudeTelemetryOptions = {
  readonly directory: string;
  readonly reader: HarnessFileReader;
  readonly now: () => string;
  readonly pinnedVersion?: string;
  readonly maxFileBytes?: number;
  readonly maxFileLines?: number;
  readonly maxSessions?: number;
};

export type ClaudeTelemetryExtractor = {
  readonly extract: (input: {
    readonly workItemRef: string;
    readonly runId: string;
  }) => HarnessResult<HarnessTelemetryCapture>;
};

type Usage = {
  input?: number;
  output?: number;
  reasoning?: number;
  cacheRead?: number;
  cacheWrite?: number;
  cost?: number;
};

type SessionFacts = {
  sessionId: string;
  parentId: string | null;
  workItemRef: string | null;
  harnessVersion: string | null;
  agent: string | null;
  model: string | null;
  calls: number;
  tools: Map<string, number>;
  tokens: Record<Exclude<keyof Usage, "cost">, number>;
  tokenSeen: Record<Exclude<keyof Usage, "cost">, boolean>;
  costPresent: boolean;
  costBad: boolean;
  costSum: number;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const numberField = (
  record: Record<string, unknown>,
  key: string,
): { readonly value: number | undefined; readonly bad: boolean } => {
  if (!Object.hasOwn(record, key)) return { value: undefined, bad: false };
  const value = record[key];
  if (typeof value === "number" && Number.isFinite(value)) return { value, bad: false };
  if (value === null) return { value: undefined, bad: false };
  return { value: undefined, bad: true };
};

const failure = (summary: string): HarnessResult<never> => ({
  ok: false,
  error: { kind: "harness", code: "harness.telemetry.extraction-failed", summary },
});

const capEntries = <T extends { readonly calls: number }>(
  entries: readonly T[],
  cap: number,
  name: (entry: T) => string,
): { kept: readonly T[]; truncation?: { truncated: true; omitted: number; cap: number } } => {
  const sorted = [...entries].sort((left, right) =>
    right.calls !== left.calls ? right.calls - left.calls : name(left) < name(right) ? -1 : 1,
  );
  return sorted.length <= cap
    ? { kept: sorted }
    : {
        kept: sorted.slice(0, cap),
        truncation: { truncated: true, omitted: sorted.length - cap, cap },
      };
};

/** Build the Claude Code extractor over the injected read-only file reader. */
export const createClaudeTelemetryExtractor = (
  options: ClaudeTelemetryOptions,
): ClaudeTelemetryExtractor => ({
  extract: ({ workItemRef, runId }) => {
    const maxBytes = options.maxFileBytes ?? HARNESS_MAX_FILE_BYTES;
    const maxLines = options.maxFileLines ?? HARNESS_MAX_FILE_LINES;
    const maxSessions = options.maxSessions ?? HARNESS_MAX_SESSIONS;
    const listed = options.reader.list(options.directory);
    if (!listed.ok) return failure("the Claude Code session directory could not be listed");
    const sessions = new Map<string, SessionFacts>();
    const warnings: HarnessTelemetryWarning[] = [];
    const failedSessions: Array<{
      readonly sessionId: string | null;
      readonly reason:
        | "unattributable-session"
        | "invalid-session-identity"
        | "session-capture-failed";
    }> = [];
    let truncatedSessions = 0;

    const factsFor = (sessionId: string): SessionFacts => {
      const existing = sessions.get(sessionId);
      if (existing !== undefined) return existing;
      const created: SessionFacts = {
        sessionId,
        parentId: null,
        workItemRef: null,
        harnessVersion: null,
        agent: null,
        model: null,
        calls: 0,
        tools: new Map(),
        tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
        tokenSeen: {
          input: false,
          output: false,
          reasoning: false,
          cacheRead: false,
          cacheWrite: false,
        },
        costPresent: false,
        costBad: false,
        costSum: 0,
      };
      sessions.set(sessionId, created);
      return created;
    };

    for (const path of listed.paths) {
      const read = options.reader.read(path);
      if (!read.ok) {
        failedSessions.push({ sessionId: null, reason: "session-capture-failed" });
        warnings.push({
          reason: "session-capture-failed",
          field: `${path}:${read.code}`,
        });
        continue;
      }
      let text = read.text;
      if (text.length > maxBytes) {
        text = text.slice(0, maxBytes);
        warnings.push({
          reason: "truncated",
          field: `${path}:omitted-bytes=${read.bytes - maxBytes}`,
        });
      }
      const lines = text.split("\n").filter((line) => line.length > 0);
      const bounded = lines.slice(0, maxLines);
      if (lines.length > maxLines) {
        warnings.push({
          reason: "truncated",
          field: `${path}:omitted-lines=${lines.length - maxLines}`,
        });
      }
      for (const [index, line] of bounded.entries()) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(line);
        } catch {
          warnings.push({ reason: "malformed-line", field: `${path}:${index + 1}` });
          continue;
        }
        if (!isRecord(parsed)) {
          warnings.push({ reason: "malformed-line", field: `${path}:${index + 1}` });
          continue;
        }
        const sessionId = str(parsed.sessionId) ?? str(parsed.session_id);
        if (sessionId === undefined) {
          failedSessions.push({ sessionId: null, reason: "invalid-session-identity" });
          continue;
        }
        const facts = factsFor(sessionId);
        if (parsed.type === "session") {
          facts.parentId = str(parsed.parentId) ?? null;
          facts.workItemRef = str(parsed.workItemRef) ?? null;
          facts.harnessVersion = str(parsed.harnessVersion) ?? null;
          facts.agent = str(parsed.agent) ?? facts.agent;
          facts.model = str(parsed.model) ?? facts.model;
          continue;
        }
        if (parsed.type !== "usage") continue;
        facts.calls += 1;
        facts.agent = str(parsed.agent) ?? facts.agent;
        facts.model = str(parsed.model) ?? facts.model;
        const tool = str(parsed.tool);
        if (tool !== undefined) facts.tools.set(tool, (facts.tools.get(tool) ?? 0) + 1);
        const usage = isRecord(parsed.usage) ? parsed.usage : parsed;
        const mapping: Array<[Exclude<keyof Usage, "cost">, string]> = [
          ["input", "input_tokens"],
          ["output", "output_tokens"],
          ["reasoning", "reasoning_tokens"],
          ["cacheRead", "cache_read_input_tokens"],
          ["cacheWrite", "cache_creation_input_tokens"],
        ];
        for (const [key, name] of mapping) {
          const value = numberField(usage, name);
          if (value.bad) {
            warnings.push({ reason: "non-numeric-value", field: `${name}@${sessionId}` });
            continue;
          }
          if (value.value !== undefined) {
            facts.tokens[key] += value.value;
            facts.tokenSeen[key] = true;
          }
        }
        const cost = numberField(usage, "cost");
        if (cost.bad) {
          facts.costBad = true;
          warnings.push({ reason: "non-numeric-value", field: `cost@${sessionId}` });
        }
        if (cost.value !== undefined) {
          facts.costPresent = true;
          facts.costSum += cost.value;
        }
      }
    }

    const roots = [...sessions.values()].filter((session) => session.parentId === null);
    const childrenOf = new Map<string, SessionFacts[]>();
    for (const session of sessions.values()) {
      if (session.parentId === null) continue;
      const list = childrenOf.get(session.parentId) ?? [];
      list.push(session);
      childrenOf.set(session.parentId, list);
    }
    const records: HarnessTelemetryRecord[] = [];
    let considered = 0;
    for (const root of roots) {
      if (root.workItemRef === null) {
        failedSessions.push({ sessionId: root.sessionId, reason: "unattributable-session" });
        continue;
      }
      if (root.workItemRef !== workItemRef) continue;
      const tree: SessionFacts[] = [];
      const queue: Array<{ readonly session: SessionFacts; readonly chain: readonly string[] }> = [
        { session: root, chain: [] },
      ];
      while (queue.length > 0) {
        const next = queue.shift();
        if (next === undefined) break;
        tree.push(next.session);
        for (const child of childrenOf.get(next.session.sessionId) ?? []) {
          queue.push({ session: child, chain: [...next.chain, next.session.sessionId] });
        }
      }
      for (const session of tree) {
        if (considered >= maxSessions) {
          truncatedSessions += 1;
          continue;
        }
        considered += 1;
        if (session.agent === null || session.model === null) {
          failedSessions.push({ sessionId: session.sessionId, reason: "invalid-session-identity" });
          continue;
        }
        const recordWarnings: HarnessTelemetryWarning[] = [
          ...warnings.filter((warning) => warning.field.includes(session.sessionId)),
        ];
        const tokens: HarnessTokenCounts = {
          input: session.tokenSeen.input ? session.tokens.input : null,
          output: session.tokenSeen.output ? session.tokens.output : null,
          reasoning: session.tokenSeen.reasoning ? session.tokens.reasoning : null,
          cacheRead: session.tokenSeen.cacheRead ? session.tokens.cacheRead : null,
          cacheWrite: session.tokenSeen.cacheWrite ? session.tokens.cacheWrite : null,
        };
        for (const key of ["input", "output", "reasoning", "cacheRead", "cacheWrite"] as const) {
          if (tokens[key] === null) {
            recordWarnings.push({ reason: "optional-field-absent", field: key });
          }
        }
        const cost: number | null =
          session.costBad || !session.costPresent ? null : session.costSum;
        if (!session.costPresent) recordWarnings.push({ reason: "cost-missing", field: "cost" });
        if (session.costBad) recordWarnings.push({ reason: "non-numeric-value", field: "cost" });
        if (
          options.pinnedVersion !== undefined &&
          session.harnessVersion !== null &&
          session.harnessVersion !== options.pinnedVersion
        ) {
          recordWarnings.push({
            reason: "version-drift",
            field: `harnessVersion(expected=${options.pinnedVersion},observed=${session.harnessVersion})`,
          });
        }
        const tools = [...session.tools.entries()].map(([tool, calls]) => ({ tool, calls }));
        const cappedTools = capEntries(tools, HARNESS_MAX_TOOLS_PER_AGENT, (entry) => entry.tool);
        records.push({
          schemaId: HARNESS_TELEMETRY_SCHEMA_ID,
          workItemRef,
          runId,
          sessionId: session.sessionId,
          harnessKind: "claude-code",
          harnessVersion: session.harnessVersion,
          agent: session.agent,
          model: session.model,
          treeRoot: root.sessionId,
          parentChain:
            session.parentId === null
              ? []
              : (() => {
                  const chain: string[] = [];
                  let current: SessionFacts | undefined = session;
                  while (current !== undefined && current.parentId !== null) {
                    chain.unshift(current.parentId);
                    current = sessions.get(current.parentId);
                  }
                  return chain;
                })(),
          tokens,
          calls: session.calls,
          toolCounts: cappedTools.kept,
          ...(cappedTools.truncation === undefined
            ? {}
            : { toolTruncation: cappedTools.truncation }),
          cost,
          capturedAt: options.now(),
          warnings: recordWarnings,
        });
      }
    }

    const agentTotals = new Map<string, number>();
    const modelTotals = new Map<string, number>();
    for (const record of records) {
      agentTotals.set(record.agent, (agentTotals.get(record.agent) ?? 0) + record.calls);
      modelTotals.set(record.model, (modelTotals.get(record.model) ?? 0) + record.calls);
    }
    const agentCounts: HarnessAgentCount[] = [...agentTotals.entries()].map(([agent, calls]) => ({
      agent,
      calls,
    }));
    const modelCounts: HarnessModelCount[] = [...modelTotals.entries()].map(([model, calls]) => ({
      model,
      calls,
    }));
    const agents = capEntries(agentCounts, HARNESS_MAX_AGENTS, (entry) => entry.agent);
    const models = capEntries(modelCounts, HARNESS_MAX_MODELS, (entry) => entry.model);
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
        warnings: [...warnings, ...records.flatMap((record) => record.warnings)],
        ...(truncatedSessions > 0
          ? {
              sessionTruncation: {
                truncated: true as const,
                omitted: truncatedSessions,
                cap: maxSessions,
              },
            }
          : {}),
        ...(agents.truncation === undefined ? {} : { agentTruncation: agents.truncation }),
        ...(models.truncation === undefined ? {} : { modelTruncation: models.truncation }),
      },
    };
  },
});
