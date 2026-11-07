/**
 * Shared deterministic boundary-fixture builder for GH-251 source-size limits.
 *
 * Every builder returns a valid document whose UTF-8 byte length is exactly the
 * requested target and self-verifies the count with Buffer.byteLength (the
 * test-only oracle) before returning. Comment padding keeps the document valid
 * and leaves parser-visible facts untouched.
 */

export const LIMIT_BYTES = 1_048_576;

export type PadUnit = "ascii" | "two" | "three" | "four";

type UnitDefinition = {
  readonly text: string;
  readonly bytes: number;
};

const UNITS: Record<PadUnit, UnitDefinition> = {
  ascii: { text: "a", bytes: 1 },
  two: { text: "é", bytes: 2 },
  three: { text: "€", bytes: 3 },
  four: { text: "😀", bytes: 4 },
};

export const utf8Bytes = (text: string): number => Buffer.byteLength(text, "utf8");

export const CONFIG_PREFIX = "x-test: ok\n";

export const PM_NOTES_PREFIX = [
  "change_id: GH-251",
  "title: source limit fixture",
  "phases:",
  "  delivery:",
  '    started: "2026-11-06T00:00:00Z"',
  "    completed: null",
  "",
].join("\n");

/**
 * Builds one YAML comment line occupying exactly `bytes` UTF-8 bytes. The
 * padding is a repeated multibyte fill plus a bounded ASCII tail, so 1 MiB
 * targets are constructed in a handful of string operations.
 */
export const buildCommentPadding = (bytes: number, unit: PadUnit): string => {
  if (bytes === 0) return "";
  if (bytes < 3) throw new Error(`unreachable comment padding target: ${bytes} bytes`);
  const definition = UNITS[unit];
  const contentBytes = bytes - 3; // "# " + content + "\n"
  const repeats = Math.floor(contentBytes / definition.bytes);
  const tail = contentBytes - repeats * definition.bytes;
  const content = definition.text.repeat(repeats) + "a".repeat(tail);
  const padding = `# ${content}\n`;
  const actual = utf8Bytes(padding);
  if (actual !== bytes) {
    throw new Error(`padding target ${bytes} produced ${actual} bytes`);
  }
  return padding;
};

const buildDocument = (prefix: string, targetBytes: number, unit: PadUnit): string => {
  const prefixBytes = utf8Bytes(prefix);
  if (targetBytes < prefixBytes) {
    throw new Error(`target ${targetBytes} is smaller than the document prefix`);
  }
  const text = prefix + buildCommentPadding(targetBytes - prefixBytes, unit);
  const actual = utf8Bytes(text);
  if (actual !== targetBytes) {
    throw new Error(`document target ${targetBytes} produced ${actual} bytes`);
  }
  return text;
};

export const buildConfigSource = (targetBytes: number, unit: PadUnit): string =>
  buildDocument(CONFIG_PREFIX, targetBytes, unit);

export const buildPmNotesSource = (targetBytes: number, unit: PadUnit): string =>
  buildDocument(PM_NOTES_PREFIX, targetBytes, unit);

export type BoundaryClass = {
  readonly label: string;
  readonly targetBytes: number;
  readonly unit: PadUnit;
  readonly expectOk: boolean;
  readonly discriminatesCodeUnits: boolean;
};

export const BOUNDARY_CLASSES: readonly BoundaryClass[] = [
  {
    label: "exact-limit-multibyte",
    targetBytes: LIMIT_BYTES,
    unit: "three",
    expectOk: true,
    discriminatesCodeUnits: false,
  },
  {
    label: "one-byte-over",
    targetBytes: LIMIT_BYTES + 1,
    unit: "three",
    expectOk: false,
    discriminatesCodeUnits: false,
  },
  {
    label: "one-byte-under",
    targetBytes: LIMIT_BYTES - 1,
    unit: "three",
    expectOk: true,
    discriminatesCodeUnits: false,
  },
  {
    label: "code-units-under-bytes-over",
    targetBytes: LIMIT_BYTES + 8,
    unit: "four",
    expectOk: false,
    discriminatesCodeUnits: true,
  },
  {
    label: "ascii-at-limit",
    targetBytes: LIMIT_BYTES,
    unit: "ascii",
    expectOk: true,
    discriminatesCodeUnits: false,
  },
];

export const SITE_KEYS = ["yaml-config", "pm-notes-parse", "pm-notes-stage"] as const;

/** 3 sites x 5 classes; asserted so the matrix cannot silently shrink. */
export const EXPECTED_BOUNDARY_CASE_COUNT = BOUNDARY_CLASSES.length * SITE_KEYS.length;
