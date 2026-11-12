/**
 * The `events` human text rendering (GH-290 F-2, AC-F2-2, NFR-1).
 *
 * Pure string building over the machine payload: no I/O, no clock, and the only
 * dynamic fact is the injected binary name. Both pages stay inside the delivered
 * human bounds (≤ 40 lines, ≤ 8 192 bytes) and carry no ANSI escape.
 */
import type { BrandIdentity } from "@delivery-os/core/contracts";
import type { EventsData, EventsTopicRecord } from "../commands/events.js";

const NAME_COLUMN = 16;

const shapeCell = (shape: string): string => `shape=${shape}`.padEnd(17);

/** Render the six-topic reference table (declared order, declared grammar). */
export const renderEventsListText = (data: EventsData): string => {
  const rows = data.topics.map((topic) => {
    const kinds = topic.kinds.length;
    const parent = topic.parent === undefined ? "" : `parent=${topic.parent}  `;
    const ordering =
      topic.ordering === "snapshot-revision" ? "ordered by snapshot revision" : "ordered per lane";
    return `${topic.name.padEnd(NAME_COLUMN)}  ${topic.version}  ${shapeCell(topic.shape)}kinds=${kinds}  ${parent}${ordering}  overflow=${topic.overflow}`;
  });
  return `${rows.join("\n")}\n`;
};

const kindLine = (kind: EventsTopicRecord["kinds"][number]): string => {
  const state = kind.emitted ? "emitted" : "not emitted (declared; no v1 producer)";
  return `  ${kind.name}  ${state}  payload=${kind.payloadFields.join(",")}`;
};

const describeLines = (topic: EventsTopicRecord, brand: BrandIdentity): string[] => {
  const lines = [
    `${brand.binaryName} events describe ${topic.name}`,
    "",
    `topic=${topic.name}`,
    `version=${topic.version}`,
    `shape=${topic.shape}`,
    ...(topic.parent === undefined ? [] : [`parent=${topic.parent}`]),
    `lane=${topic.lane}`,
    `ordering=${topic.ordering}`,
    `overflow=${topic.overflow}`,
    `frame=${topic.frame.join(",")}`,
    "",
  ];
  if (topic.shape === "snapshot") {
    lines.push(
      "kinds: [] (a snapshot topic declares no kind)",
      `payloadFields=${topic.payloadFields.join(",") || "[]"}`,
      "",
      "ordering rule: the cursor is a snapshot revision, not an ordering guarantee; no lane ordering is promised.",
      "overflow policy: overflow=repoll -- repoll current state and continue from a fresh baseline.",
    );
    return lines;
  }
  lines.push("kinds:");
  for (const kind of topic.kinds) lines.push(kindLine(kind));
  lines.push(
    "",
    `payloadFields=${topic.payloadFields.join(",")}`,
    "",
    "ordering rule: events are ordered per lane by sequence-per-lane; a client's baseline is its first observed value, and a gap or any value at or below the last observed is a discontinuity that requires a repoll; the counter is process-scoped, so a daemon restart is a declared discontinuity.",
    "overflow policy: overflow=repoll -- repoll current state and continue from a fresh baseline.",
  );
  return lines;
};

/** Render one topic's reference page. */
export const renderEventsDescribeText = (data: EventsData, brand: BrandIdentity): string => {
  const topic = data.topics[0];
  if (topic === undefined) return "";
  return `${describeLines(topic, brand).join("\n")}\n`;
};
