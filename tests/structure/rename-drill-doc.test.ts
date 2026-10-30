/**
 * TC-BRANDING-020 — the rename drill is complete, self-contained, name-free, and
 * states its execution obligation; the doc is a registered scanned user-facing
 * document.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchSeedLiteral, scan } from "../../scripts/checks/forbidden-literals";
import { liveRegistry, ROOT } from "../checks/fixture-repo";

const DRILL = "doc/guides/rename-drill.md";
const VALID_MARKERS = ["redistributable", "internal", "project-generated"];
const SEED_LITERALS = ["ados", "ADOS_", "~/.ados"];
const SYNTHETIC_NAMES = [".renamed-product", ".alt-brand", ".synthetic", "example-product"];
const OBLIGATION = "The drill must pass before release and whenever branding changes.";
const REQUIRED_ROWS: Record<string, string[]> = {
  "RD-1": ["temporary", "legacy", "mapping"],
  "RD-2": ["pnpm typecheck"],
  "RD-3": ["pnpm test"],
  "RD-4": ["tests/boundaries", "check:boundaries"],
  "RD-5": ["forbidden-literals"],
  "RD-6": ["pnpm build"],
  "RD-7": ["publish", "--dry-run"],
  "RD-8": ["MCP", "snapshot"],
  "RD-9": ["OpenCode", "snapshot"],
  "RD-10": [".gitignore", "config.local.yaml", "name-free or derived from branding"],
  "RD-11": [],
};

const frontmatter = (text: string): string => {
  const lines = text.split("\n");
  const end = lines.indexOf("---", 1);
  if (lines[0] !== "---" || end < 0) return "";
  return lines.slice(1, end).join("\n");
};

const rowFor = (text: string, anchor: string): string | undefined =>
  text.split("\n").find((line) => line.startsWith(`| ${anchor} |`));

export const validateDrillDoc = (text: string): string[] => {
  const failures: string[] = [];
  const marker = /^ados_distribution:[ \t]*(\S+)[ \t]*$/m.exec(frontmatter(text))?.[1];
  if (marker === undefined) {
    failures.push(`${DRILL}: missing ados_distribution marker`);
  } else if (!VALID_MARKERS.includes(marker)) {
    failures.push(`${DRILL}: invalid ados_distribution marker ${marker}`);
  }

  for (const forbidden of ["doc/changes/", ".ai/local/"]) {
    if (text.includes(forbidden)) {
      failures.push(`${DRILL}: must be self-contained (references ${forbidden})`);
    }
  }

  const content = text
    .split("\n")
    .filter((line) => !line.includes("ados_distribution:"))
    .join("\n");
  const seed = matchSeedLiteral(content, SEED_LITERALS);
  if (seed !== undefined) failures.push(`${DRILL}: must be name-free (contains seed ${seed})`);
  for (const name of SYNTHETIC_NAMES) {
    if (text.includes(name)) failures.push(`${DRILL}: must not embed fixture name ${name}`);
  }
  for (const term of ["the CLI", "the runtime", "the product directory"]) {
    if (!text.includes(term)) failures.push(`${DRILL}: missing generic term ${term}`);
  }

  for (const [anchor, tokens] of Object.entries(REQUIRED_ROWS)) {
    const row = rowFor(text, anchor);
    if (row === undefined) {
      failures.push(`${DRILL}: missing battery row ${anchor}`);
      continue;
    }
    for (const token of tokens) {
      if (!row.includes(token)) {
        failures.push(`${DRILL}: ${anchor} is missing ${token}`);
      }
    }
  }

  if (!text.includes(OBLIGATION)) {
    failures.push(`${DRILL}: missing the execution obligation sentence`);
  }
  return failures;
};

const readDrill = (): string => readFileSync(join(ROOT, DRILL), "utf8");

describe("rename drill document", () => {
  test("is complete, self-contained, name-free, and gates on its obligation", () => {
    expect(validateDrillDoc(readDrill())).toEqual([]);
  });

  test("declares a valid distribution marker", () => {
    const marker = /^ados_distribution:[ \t]*(\S+)[ \t]*$/m.exec(frontmatter(readDrill()))?.[1];
    expect(VALID_MARKERS).toContain(marker as string);
  });

  test("is registered and scanned as a baseline-anchored user-facing doc", () => {
    expect(liveRegistry().registered).toContain(DRILL);
    const outcome = scan(ROOT);
    expect(outcome.failures).toEqual([]);
    expect(outcome.registeredDocs).toContain(DRILL);
    expect(outcome.classes.find((entry) => entry.id === "userFacingDocs")?.files).toBe(
      liveRegistry().registered.length,
    );
  });

  test("removing a battery row fails naming the row", () => {
    const mutated = readDrill()
      .split("\n")
      .filter((line) => !line.startsWith("| RD-5 |"))
      .join("\n");
    expect(validateDrillDoc(mutated).some((message) => message.includes("RD-5"))).toBe(true);
  });

  test("removing the obligation sentence fails", () => {
    const directory = mkdtempSync(join(tmpdir(), "rename-drill-"));
    const path = join(directory, "rename-drill.md");
    try {
      writeFileSync(path, readDrill().replace(`\n${OBLIGATION}\n`, "\n"));
      const mutated = readFileSync(path, "utf8");
      expect(validateDrillDoc(mutated).some((message) => message.includes("obligation"))).toBe(
        true,
      );
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
