/**
 * Shared parity assertions: the CLI is the live oracle and the committed golden
 * is the second pin. Every golden comparison carries a mutation control so a
 * self-fulfilling fixture cannot pass.
 */
import { expect } from "bun:test";
import { readFileSync } from "node:fs";
import { canonicalBytes, canonicalJson } from "./canonical";
import { goldenPath, type ToolParityCase } from "./cases";
import { envelopeLeaks, errorKeyViolations } from "./harness";

/** Parse the committed golden for one success case. */
export const readGolden = (parityCase: ToolParityCase): unknown =>
  JSON.parse(readFileSync(goldenPath(parityCase.tool, parityCase.id), "utf8")) as unknown;

const firstMutableLeaf = (value: unknown): { parent: Record<string, unknown>; key: string } => {
  if (typeof value !== "object" || value === null) {
    throw new Error("golden is not an object");
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (typeof child !== "object" || child === null) return { parent: record, key };
  }
  const [key] = Object.keys(record);
  if (key === undefined) throw new Error("golden has no keys");
  return { parent: record, key };
};

/** Assert one success case across CLI, MCP, and the committed golden. */
export const assertSuccessPair = async (parityCase: ToolParityCase): Promise<void> => {
  const cli = await parityCase.runCli();
  const mcp = await parityCase.runMcp();
  expect(cli.ok).toBe(true);
  expect(mcp.ok).toBe(true);
  if (!cli.ok || !mcp.ok) return;

  expect(canonicalJson(mcp.data)).toBe(canonicalJson(cli.data));
  expect(canonicalJson(mcp.data)).toBe(canonicalJson(readGolden(parityCase)));
  expect(envelopeLeaks(mcp.data)).toEqual([]);
  expect(canonicalBytes(mcp.data)).toBe(canonicalBytes(cli.data));

  if (typeof cli.data === "object" && cli.data !== null && !Array.isArray(cli.data)) {
    expect(Object.keys(mcp.data as object).sort()).toEqual(Object.keys(cli.data as object).sort());
  }
  const data = mcp.data as Record<string, unknown>;
  if (parityCase.expectation.kind === "success" && parityCase.expectation.schemaVersion) {
    expect(data.schemaVersion).toBe(parityCase.expectation.schemaVersion);
  } else {
    expect(data.schemaVersion).toBeUndefined();
  }
};

/** A mutation control: one changed field breaks the golden comparison. */
export const assertMutationControl = (parityCase: ToolParityCase): void => {
  const golden = readGolden(parityCase);
  const mutated = JSON.parse(JSON.stringify(golden)) as unknown;
  const { parent, key } = firstMutableLeaf(mutated);
  parent[key] = `${String(parent[key])}-mutated`;
  expect(canonicalJson(mutated)).not.toBe(canonicalJson(golden));
};

/** Assert one failure case across CLI and MCP with the full contracted shape. */
export const assertFailurePair = async (parityCase: ToolParityCase): Promise<void> => {
  const cli = await parityCase.runCli();
  const mcp = await parityCase.runMcp();
  expect(cli.ok).toBe(false);
  expect(mcp.ok).toBe(false);
  if (cli.ok || mcp.ok) return;

  expect(mcp.error).toEqual(cli.error);
  expect(errorKeyViolations(mcp.error)).toEqual([]);
  expect(envelopeLeaks(mcp.error)).toEqual([]);
  expect(mcp.error.code).toBe(
    parityCase.expectation.kind === "failure" ? parityCase.expectation.code : undefined,
  );
};
