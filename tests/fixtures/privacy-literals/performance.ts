/**
 * Deterministic performance corpus generator. The corpus is generated in a
 * temp tree and never committed as a large blob; it exercises every registered
 * length with markerless filler.
 */

const UNIT = "zq7x9m2p4r6t8v0";

export const valueForLength = (length: number): string =>
  UNIT.repeat(Math.ceil(length / UNIT.length)).slice(0, length);

export const REGISTERED_LENGTHS = [4, 5, 7, 16, 64, 512] as const;

/** A deterministic corpus with every registered length and bounded line shape. */
export const generateCorpus = (targetBytes: number): string => {
  const lengths = REGISTERED_LENGTHS;
  const lines: string[] = [];
  let total = 0;
  let index = 0;
  while (total < targetBytes) {
    const length = lengths[index % lengths.length] as number;
    const line = `line-${index} ${valueForLength(length)} ${"q".repeat(48)}\n`;
    lines.push(line);
    total += line.length;
    index += 1;
  }
  return lines.join("");
};

/** Long lines of near-miss shapes to stress the matcher without matching. */
export const generatePathological = (): string => {
  const line = `${"ZQ7X".repeat(2048)} Bearer ${"short ".repeat(128)}\n`;
  return line.repeat(2);
};

/** Valid registry entries whose digests are not present in the corpus. */
export const NON_MATCHING_HASHES = REGISTERED_LENGTHS.map((length, index) => ({
  id: `performance-entry-${length}`,
  class: "private-literal" as const,
  algorithm: "sha256" as const,
  hash: (index + 1).toString(16).padStart(64, "0"),
  length,
  reason: "Synthetic performance entry that must not match the corpus.",
}));

/** A match-dense single-line corpus: many credential assignments on one line. */
export const generateMatchDense = (matches: number): string => {
  const value = "ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6";
  return Array.from(
    { length: matches },
    (_, index) => `api_key = "${value}${index.toString(16).padStart(4, "0")}"`,
  ).join(" ");
};
