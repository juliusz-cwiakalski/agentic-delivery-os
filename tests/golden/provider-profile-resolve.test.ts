/**
 * TC-PROFILE-043/044 (golden half) — normalized provider profile resolve data
 * and human output. No absolute paths, wall-clock timestamps, or unstable order.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runGolden } from "../fixtures/provider/profile/golden/run";

const GOLDEN = "tests/fixtures/provider/profile/golden";
const golden = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDEN, name), "utf8")) as Record<string, unknown>;
const text = (name: string): string =>
  readFileSync(join(process.cwd(), GOLDEN, name), "utf8").trim();

describe("TC-PROFILE-044 profile-resolve golden", () => {
  test("machine data matches the committed golden", async () => {
    const result = await runGolden(["profile", "resolve", "--for-spawn", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as { data: unknown };
    expect(envelope.data).toMatchObject(golden("profile-resolve.json"));
  });

  test("human output matches the committed golden", async () => {
    const result = await runGolden(["profile", "resolve"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(text("profile-resolve.txt"));
  });
});
