/**
 * The bounded deterministic ceremony human render (GH-296 §10).
 *
 * One line per ceremony for `list`, one line per step plus a verdict line for
 * `run`/`resume`, and one line per ceremony plus a total for `catch-up`. At most
 * 32 lines and 6 144 bytes with an explicit omission marker. Pure data lookup;
 * no stream, clock, or state read.
 */
const MAX_LINES = 32;
const MAX_BYTES = 6_144;

const utf8Bytes = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const bound = (lines: readonly string[]): string => {
  const kept = [...lines];
  let omitted = 0;
  while (kept.length > MAX_LINES - (omitted > 0 ? 1 : 0)) {
    kept.pop();
    omitted += 1;
  }
  if (omitted > 0) kept.push(`omitted: ${String(omitted)} line(s)`);
  let text = `${kept.join("\n")}\n`;
  while (utf8Bytes(text) > MAX_BYTES && kept.length > 0) {
    kept.pop();
    omitted += 1;
    kept.push(`omitted: ${String(omitted)} line(s)`);
    text = `${kept.join("\n")}\n`;
  }
  return text;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const listLines = (data: Record<string, unknown>): readonly string[] => {
  const ceremonies = Array.isArray(data.ceremonies) ? data.ceremonies : [];
  return ceremonies.map((entry) => {
    const record = isRecord(entry) ? entry : {};
    const last = isRecord(record.lastRun) ? record.lastRun : undefined;
    return `${String(record.id)} (${String(record.origin)}) tiers=${(Array.isArray(record.tiers) ? record.tiers : []).join(",")} trigger=${(Array.isArray(record.triggers) ? record.triggers : []).join(",")} catchUp=${String(record.catchUp)} last=${last === undefined ? "none" : `${String(last.runId)}:${String(last.verdict)}`}`;
  });
};

const runLines = (data: Record<string, unknown>): readonly string[] => {
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const lines = [
    `ceremony ${String(data.ceremony)} run ${String(data.runId)} window ${isRecord(data.window) ? `${String(data.window.start)}..${String(data.window.end)}` : "unknown"}`,
  ];
  for (const entry of steps) {
    const step = isRecord(entry) ? entry : {};
    lines.push(
      `  ${String(step.index)} ${String(step.kind)} ${String(step.outcome)} verify=${String(step.verification)}${step.reason === undefined ? "" : ` reason=${String(step.reason)}`}`,
    );
  }
  lines.push(`verdict: ${String(data.verdict)}${data.reused === true ? " (reused)" : ""}`);
  return lines;
};

const catchUpLines = (data: Record<string, unknown>): readonly string[] => {
  const ceremonies = Array.isArray(data.ceremonies) ? data.ceremonies : [];
  const lines = ceremonies.map((entry) => {
    const record = isRecord(entry) ? entry : {};
    return `${String(record.ceremony)}: ${String(record.disposition)}${record.reason === undefined ? "" : ` (${String(record.reason)})`}`;
  });
  lines.push(`outcome: ${String(data.outcome)}; appended ${String(data.appendedRuns)} run(s)`);
  return lines;
};

/** Render one ceremony result as bounded deterministic human text. */
export const renderCeremonyText = (data: unknown): string => {
  if (!isRecord(data)) return bound(["ceremony: no data"]);
  if (Array.isArray(data.steps) || data.verdict !== undefined) return bound(runLines(data));
  if (data.outcome !== undefined) return bound(catchUpLines(data));
  return bound(listLines(data));
};

/** The bounded output bounds, exposed for the honesty battery. */
export const CEREMONY_HUMAN_BOUNDS = { maxLines: MAX_LINES, maxBytes: MAX_BYTES } as const;
