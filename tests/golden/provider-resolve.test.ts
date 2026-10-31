import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearTransport, createHarness, exhaustedTransport } from "./provider-harness";

const GOLDEN = "tests/fixtures/provider/golden";
const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDEN, name), "utf8")) as unknown;
const text = (name: string): string => readFileSync(join(process.cwd(), GOLDEN, name), "utf8");

describe("TC-PROV-053 resolve goldens", () => {
  test("selected machine data and human summary match", async () => {
    const harness = createHarness();
    try {
      const machine = await harness.run(["resolve", "--json"], clearTransport);
      expect(machine.data).toMatchObject(golden("resolve-selected.json") as object);
      const human = await harness.run(["resolve"], clearTransport);
      expect(human.stdout).toContain(text("resolve-selected.txt").trim());
    } finally {
      harness.dispose();
    }
  });

  test("parked machine data and human summary match", async () => {
    const harness = createHarness();
    try {
      const machine = await harness.run(["resolve", "--json"], exhaustedTransport);
      expect(machine.data).toMatchObject(golden("resolve-parked.json") as object);
      const human = await harness.run(["resolve"], exhaustedTransport);
      expect(human.stdout).toContain(text("resolve-parked.txt").trim());
    } finally {
      harness.dispose();
    }
  });
});
