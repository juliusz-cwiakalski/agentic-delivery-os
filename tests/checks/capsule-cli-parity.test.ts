/** TC-CAP-039 — worktree removal is not a CLI command family. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("capsule CLI parity", () => {
  test("no new command family and no db change", () => {
    const commands = readFileSync("packages/cli/src/commands/closeout.ts", "utf8");
    expect(commands.includes("worktree")).toBe(false);
    const contracts = readFileSync("packages/core/src/contracts/session.ts", "utf8");
    expect(contracts.includes("worktree")).toBe(false);
  });
});
