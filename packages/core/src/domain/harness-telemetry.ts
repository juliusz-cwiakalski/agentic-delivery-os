/**
 * Telemetry output bounds (GH-233 NFR-4, DEC-7).
 *
 * Session records, per-agent tool counts, agent lists, and model lists are
 * capped with explicit truncation marks. The machine payload stays at or under
 * 65 536 UTF-8 bytes and the human disclosure at or under 4 096 bytes / 24
 * lines. Truncation order is deterministic.
 */
import {
  HARNESS_MAX_AGENTS,
  HARNESS_MAX_MODELS,
  HARNESS_MAX_SESSIONS,
  HARNESS_MAX_TOOLS_PER_AGENT,
  HARNESS_TELEMETRY_MAX_HUMAN_BYTES,
  HARNESS_TELEMETRY_MAX_HUMAN_LINES,
  HARNESS_TELEMETRY_MAX_MACHINE_BYTES,
  type HarnessAgentCount,
  type HarnessModelCount,
  type HarnessTelemetryCapture,
  type HarnessTelemetryRecord,
  type HarnessToolCount,
} from "#contracts";

const utf8 = (text: string): number => new TextEncoder().encode(text).length;

const capByCalls = <T extends { readonly calls: number }>(
  entries: readonly T[],
  cap: number,
  name: (entry: T) => string,
): { readonly kept: readonly T[]; readonly omitted: number } => {
  const sorted = [...entries].sort((left, right) =>
    right.calls !== left.calls ? right.calls - left.calls : name(left) < name(right) ? -1 : 1,
  );
  return { kept: sorted.slice(0, cap), omitted: Math.max(0, sorted.length - cap) };
};

const boundRecord = (record: HarnessTelemetryRecord): HarnessTelemetryRecord => {
  const tools = capByCalls<HarnessToolCount>(
    record.toolCounts,
    HARNESS_MAX_TOOLS_PER_AGENT,
    (entry) => entry.tool,
  );
  if (tools.omitted === 0) return { ...record, toolCounts: tools.kept };
  return {
    ...record,
    toolCounts: tools.kept,
    toolTruncation: {
      truncated: true,
      omitted: tools.omitted,
      cap: HARNESS_MAX_TOOLS_PER_AGENT,
    },
  };
};

/** Apply every declared cap and the machine byte bound. */
export const boundHarnessTelemetryCapture = (
  capture: HarnessTelemetryCapture,
): HarnessTelemetryCapture => {
  let records = capture.records.slice(0, HARNESS_MAX_SESSIONS).map(boundRecord);
  let omittedSessions = Math.max(0, capture.records.length - HARNESS_MAX_SESSIONS);
  const agents = capByCalls<HarnessAgentCount>(
    capture.agents,
    HARNESS_MAX_AGENTS,
    (entry) => entry.agent,
  );
  const models = capByCalls<HarnessModelCount>(
    capture.models,
    HARNESS_MAX_MODELS,
    (entry) => entry.model,
  );
  const current = (): HarnessTelemetryCapture => ({
    ...capture,
    records,
    agents: agents.kept,
    models: models.kept,
    ...(omittedSessions > 0
      ? {
          sessionTruncation: {
            truncated: true as const,
            omitted: omittedSessions,
            cap: HARNESS_MAX_SESSIONS,
          },
        }
      : {}),
    ...(agents.omitted > 0
      ? {
          agentTruncation: {
            truncated: true as const,
            omitted: agents.omitted,
            cap: HARNESS_MAX_AGENTS,
          },
        }
      : {}),
    ...(models.omitted > 0
      ? {
          modelTruncation: {
            truncated: true as const,
            omitted: models.omitted,
            cap: HARNESS_MAX_MODELS,
          },
        }
      : {}),
  });
  let bounded = current();
  while (
    utf8(JSON.stringify(bounded)) > HARNESS_TELEMETRY_MAX_MACHINE_BYTES &&
    bounded.records.length > 0
  ) {
    records = records.slice(0, -1);
    omittedSessions += 1;
    bounded = current();
  }
  return bounded;
};

/** Render a bounded human summary: 4 096 bytes / 24 lines. */
export const renderHarnessTelemetryHuman = (capture: HarnessTelemetryCapture): string => {
  const bounded = boundHarnessTelemetryCapture(capture);
  const lines: string[] = [
    `harness telemetry ${bounded.workItemRef} run=${bounded.runId} sessions=${bounded.records.length} degraded=${bounded.records.filter((record) => record.warnings.length > 0).length} failed=${bounded.failedSessions.length}`,
  ];
  for (const record of bounded.records) {
    lines.push(
      `- ${record.agent} ${record.model} ${record.harnessKind} tokens=${record.tokens.input ?? "null"}/${record.tokens.output ?? "null"} calls=${record.calls} cost=${record.cost ?? "null"}`,
    );
  }
  if (bounded.sessionTruncation !== undefined) {
    lines.push(`+${bounded.sessionTruncation.omitted} sessions omitted`);
  }
  if (bounded.agentTruncation !== undefined)
    lines.push(`+${bounded.agentTruncation.omitted} agents omitted`);
  if (bounded.modelTruncation !== undefined)
    lines.push(`+${bounded.modelTruncation.omitted} models omitted`);
  let text = `${lines.slice(0, HARNESS_TELEMETRY_MAX_HUMAN_LINES).join("\n")}\n`;
  while (utf8(text) > HARNESS_TELEMETRY_MAX_HUMAN_BYTES && text.length > 1) {
    const next = text.split("\n").slice(0, -2);
    text = `${next.join("\n")}\n`;
  }
  return text;
};
