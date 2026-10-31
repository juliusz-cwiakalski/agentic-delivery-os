import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearTransport, createHarness, outageTransport } from "./provider-harness";

const GOLDEN = "tests/fixtures/provider/golden";
const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDEN, name), "utf8")) as unknown;
const text = (name: string): string => readFileSync(join(process.cwd(), GOLDEN, name), "utf8");

describe("TC-PROV-053 quota goldens", () => {
  test("success machine and human output match", async () => {
    const harness = createHarness();
    try {
      const machine = await harness.run(["quota", "--json"], clearTransport);
      expect(machine.data).toMatchObject(golden("quota-success.json") as object);
      const human = await harness.run(["quota"], clearTransport);
      expect(human.stdout).toContain(text("quota-success.txt").trim());
    } finally {
      harness.dispose();
    }
  });

  test("failure machine error and diagnostic match", async () => {
    const harness = createHarness();
    try {
      const machine = await harness.run(["quota", "--json"], outageTransport);
      expect(machine.error).toMatchObject(
        (golden("quota-failure.json") as { error: object }).error,
      );
      expect(machine.stderr).toContain(text("quota-failure.txt").trim());
    } finally {
      harness.dispose();
    }
  });
});
