/**
 * TC-TAX-002 — the `tracker.` literal scan has an exact two-tree scope and a
 * single-file allowlist. The live trees start empty outside the taxonomy module;
 * a planted literal fails naming file and construct, while the pre-existing
 * core/CLI/MCP vocabulary is out of scope.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SCAN_TREES = ["packages/testkit/src", "packages/adapters/src"] as const;
const ALLOWLIST = ["packages/testkit/src/conformance/tracker-error-taxonomy.ts"] as const;

/** One literal hit: the file plus the construct kind and the literal text. */
export type TrackerLiteralHit = {
  readonly file: string;
  readonly construct: string;
  readonly literal: string;
};

const isScannedPath = (file: string): boolean =>
  SCAN_TREES.some((tree) => file.startsWith(`${tree}/`));

const isAllowlisted = (file: string): boolean => ALLOWLIST.some((entry) => entry === file);

/** Scan one file's text for string literals beginning `tracker.`. */
export const scanTrackerLiterals = (file: string, text: string): TrackerLiteralHit[] => {
  if (!isScannedPath(file) || isAllowlisted(file)) return [];
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const hits: TrackerLiteralHit[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      node.text.startsWith("tracker.")
    ) {
      hits.push({ file, construct: "string-literal expression", literal: node.text });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return hits;
};

/** Scan an in-memory file map under the exact two-tree scope. */
export const scanTrackerLiteralMap = (
  files: Readonly<Record<string, string>>,
): TrackerLiteralHit[] =>
  Object.entries(files).flatMap(([file, text]) => scanTrackerLiterals(file, text));

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

const liveHits = (): TrackerLiteralHit[] =>
  SCAN_TREES.flatMap((tree) =>
    listTypeScriptFiles(ROOT, tree).flatMap((file) =>
      scanTrackerLiterals(file, readFileSync(join(ROOT, file), "utf8")),
    ),
  );

describe("TC-TAX-002 the tracker literal scan", () => {
  test("scope and allowlist are exact collections", () => {
    expect([...SCAN_TREES]).toEqual(["packages/testkit/src", "packages/adapters/src"]);
    expect([...ALLOWLIST]).toEqual(["packages/testkit/src/conformance/tracker-error-taxonomy.ts"]);
  });

  test("the live two-tree scan is empty outside the one allowed module", () => {
    expect(liveHits()).toEqual([]);
  });

  test("the taxonomy module is the only file in the scope carrying the literal", () => {
    const allowed = readFileSync(join(ROOT, ALLOWLIST[0]), "utf8");
    expect(allowed).toContain('"tracker.capability.unsupported"');
    expect(scanTrackerLiterals(ALLOWLIST[0], allowed)).toEqual([]);
  });

  test("a planted literal in each scanned tree fails naming file and construct", () => {
    const jira = readFileSync(join(ROOT, "packages/adapters/src/jira/client.ts"), "utf8");
    const coverage = readFileSync(
      join(ROOT, "packages/testkit/src/conformance/coverage.ts"),
      "utf8",
    );
    const hits = scanTrackerLiteralMap({
      "packages/adapters/src/jira/client.ts": `${jira}\nconst planted = "tracker.payload.invalid";\n`,
      "packages/testkit/src/conformance/coverage.ts": `${coverage}\nconst planted = "tracker.x";\n`,
    });
    expect(hits.map((hit) => hit.file).sort()).toEqual([
      "packages/adapters/src/jira/client.ts",
      "packages/testkit/src/conformance/coverage.ts",
    ]);
    for (const hit of hits) {
      expect(hit.construct).toBe("string-literal expression");
      expect(hit.literal.startsWith("tracker.")).toBe(true);
    }
  });

  test("the pre-existing core vocabulary is out of scope and does not fail the scan", () => {
    const status = readFileSync(join(ROOT, "packages/core/src/contracts/status.ts"), "utf8");
    expect(status).toMatch(/tracker\./);
    expect(scanTrackerLiteralMap({ "packages/core/src/contracts/status.ts": status })).toEqual([]);
  });
});
