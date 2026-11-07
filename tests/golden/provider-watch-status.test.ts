/**
 * TC-PROFILE-045 (golden half) — normalized provider watch status data and
 * human output.
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

describe("TC-PROFILE-045 watch-status golden", () => {
  test("machine data matches the committed golden", async () => {
    const result = await runGolden(["watch", "status", "--json"]);
    expect(result.exitCode).toBe(0);
    const envelope = JSON.parse(result.stdout) as { data: unknown };
    expect(envelope.data).toEqual(golden("watch-status.json"));
  });

  test("human output matches the committed golden", async () => {
    const result = await runGolden(["watch", "status"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(text("watch-status.txt"));
  });
});
