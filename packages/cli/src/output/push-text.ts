/**
 * The `push` answer renderer (GH-416 DM-5, §8.1).
 *
 * One bounded key=value block in the declared order: `ref`, `repository`,
 * `lanePush`, `branch`, `head`, `cause` only when present, `recorded`, and
 * `recordedAt` only when the record landed. Every value is single-line; the
 * block is at most the declared eight lines and well inside 2 KiB.
 */

const MAX_VALUE_CHARS = 240;

const singleLine = (value: string): string => {
  const single = value.replace(/[\r\n]+/gu, " ").trim();
  return single.length <= MAX_VALUE_CHARS ? single : `${single.slice(0, MAX_VALUE_CHARS - 1)}…`;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPushData = (
  value: unknown,
): value is {
  readonly ref: string;
  readonly repository: string;
  readonly lanePush: {
    readonly verdict: string;
    readonly branch: string;
    readonly head: string;
    readonly cause?: string;
    readonly recorded: boolean;
    readonly recordedAt?: string;
  };
} => {
  if (!isRecord(value) || !isRecord(value.lanePush)) return false;
  const lanePush = value.lanePush;
  return (
    typeof value.ref === "string" &&
    typeof value.repository === "string" &&
    typeof lanePush.verdict === "string" &&
    typeof lanePush.branch === "string" &&
    typeof lanePush.head === "string" &&
    typeof lanePush.recorded === "boolean" &&
    (lanePush.cause === undefined || typeof lanePush.cause === "string") &&
    (lanePush.recordedAt === undefined || typeof lanePush.recordedAt === "string")
  );
};

/** Render the push answer's bounded key=value block, or `undefined` when malformed. */
export const renderPushText = (data: unknown): string | undefined => {
  if (!isPushData(data)) return undefined;
  const { lanePush } = data;
  const lines = [
    `ref=${singleLine(data.ref)}`,
    `repository=${singleLine(data.repository)}`,
    `lanePush=${singleLine(lanePush.verdict)}`,
    `branch=${singleLine(lanePush.branch)}`,
    `head=${singleLine(lanePush.head)}`,
    ...(lanePush.cause === undefined ? [] : [`cause=${singleLine(lanePush.cause)}`]),
    `recorded=${lanePush.recorded ? "true" : "false"}`,
    ...(lanePush.recordedAt === undefined
      ? []
      : [`recordedAt=${singleLine(lanePush.recordedAt)}`]),
  ];
  return `${lines.join("\n")}\n`;
};
