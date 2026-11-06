/**
 * The only writer for the committed MCP fixture artifacts.
 *
 * Run explicitly with `bun run tests/fixtures/mcp/regenerate.ts --write`; tests
 * open the artifacts read-only and assert their mtime is unchanged. Golden
 * parity artifacts are produced by the parity regenerator when it is present.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describeTools } from "../../../packages/mcp/src/commands/catalog";
import { SYNTHETIC_BRAND } from "../../golden/helpers";

const ROOT = process.cwd();
const SNAPSHOT = join(ROOT, "tests/fixtures/mcp/tool-list.snapshot.json");

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
};

/** Canonical JSON: recursively sorted keys, preserved array order. */
export const canonicalJson = (value: unknown): string => JSON.stringify(canonical(value));

const main = async (): Promise<void> => {
  if (!process.argv.includes("--write")) {
    console.error("regenerate: pass --write to rewrite the committed MCP fixtures");
    process.exit(1);
  }
  const tools = describeTools(SYNTHETIC_BRAND);
  writeFileSync(SNAPSHOT, `${JSON.stringify(canonical(tools), null, 2)}\n`);
  console.log(`regenerate: wrote ${SNAPSHOT} (${tools.length} tools)`);

  const parity = await import("./parity/regenerate.ts").catch(() => undefined);
  if (parity !== undefined && typeof parity.regenerateParityGoldens === "function") {
    await parity.regenerateParityGoldens();
  }
};

if (import.meta.main) {
  await main();
}
