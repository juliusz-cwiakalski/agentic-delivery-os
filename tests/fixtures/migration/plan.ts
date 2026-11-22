/**
 * GH-365 P5 migration plan helpers: the human block's bound, ANSI-freedom, and
 * the temp-root canonicaliser the deterministic double-run comparison uses.
 */

export const humanLines = (text: string): readonly string[] =>
  text.split("\n").filter((line) => line.length > 0);

export const lineCount = (text: string): number => humanLines(text).length;

export const hasAnsi = (text: string): boolean => text.includes("\u001b[");

export const maxLineBytes = (text: string): number =>
  humanLines(text).reduce((max, line) => Math.max(max, Buffer.byteLength(line, "utf8")), 0);

/** Replace the scratch root so two identical worlds compare byte-identically. */
export const canonicalize = (text: string, base: string): string =>
  base.length === 0 ? text : text.split(base).join("<base>");
