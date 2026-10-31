/**
 * Testkit source scan (GH-189 TC-CONF-025).
 *
 * Proves testkit conformance source contains no ambient time, randomness, or
 * environment access. Lives under `tests/`; the reusable scan can also be
 * pointed at an in-memory file map so its negative control fires.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One scan hit. */
export type SourceHit = {
  readonly file: string;
  readonly pattern: string;
};

/** One closed-set ambient pattern. */
export type AmbientPattern = {
  readonly id: string;
  readonly pattern: RegExp;
};

/** The ambient patterns the testkit source must never contain. */
export const AMBIENT_PATTERNS: readonly AmbientPattern[] = [
  { id: "Date.now", pattern: /\bDate\.now\b/ },
  { id: "new Date()", pattern: /new\s+Date\(\s*\)/ },
  { id: "Math.random", pattern: /\bMath\.random\b/ },
  { id: "process.env", pattern: /\bprocess\.env\b/ },
  { id: "Bun.env", pattern: /\bBun\.env\b/ },
  { id: "Deno.env", pattern: /\bDeno\.env\b/ },
];

/** Scan one file's text. */
export const scanSourceText = (file: string, text: string): SourceHit[] =>
  AMBIENT_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => ({
    file,
    pattern: entry.id,
  }));

/** Scan an in-memory file map. */
export const scanSourceMap = (files: Readonly<Record<string, string>>): SourceHit[] =>
  Object.entries(files).flatMap(([file, text]) => scanSourceText(file, text));

const listTypeScriptFiles = (root: string, relative: string): string[] => {
  const files: string[] = [];
  for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === "dist" || entry.name === "node_modules") continue;
      files.push(...listTypeScriptFiles(root, next));
    } else if (entry.name.endsWith(".ts")) {
      files.push(next);
    }
  }
  return files.sort();
};

/** Scan every testkit source file under the repository root. */
export const scanTestkitSource = (root: string): SourceHit[] =>
  listTypeScriptFiles(root, "packages/testkit/src").flatMap((file) =>
    scanSourceText(file, readFileSync(join(root, file), "utf8")),
  );
