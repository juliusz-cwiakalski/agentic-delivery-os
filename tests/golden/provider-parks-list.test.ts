import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { clearTransport, createHarness, exhaustedTransport } from "./provider-harness";

const GOLDEN = "tests/fixtures/provider/golden";
const golden = (name: string): unknown =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDEN, name), "utf8")) as unknown;
const text = (name: string): string => readFileSync(join(process.cwd(), GOLDEN, name), "utf8");

describe("TC-PROV-053 parks list goldens", () => {
  test("active and --all views match", async () => {
    const harness = createHarness();
    try {
      await harness.run(["resolve", "--json"], exhaustedTransport);
      const active = await harness.run(["parks", "list", "--json"], clearTransport);
      const activeData = active.data as { parks: Array<{ name: string }> };
      expect(activeData.parks.map((park) => park.name)).toContain(
        (golden("parks-list-active.json") as { parks: Array<{ name: string }> }).parks[0]?.name,
      );
      const all = await harness.run(["parks", "list", "--all", "--json"], clearTransport);
      const allData = all.data as { parks: Array<{ name: string }> };
      expect(allData.parks.map((park) => park.name)).toContain(
        (golden("parks-list-all.json") as { parks: Array<{ name: string }> }).parks[0]?.name,
      );
      const human = await harness.run(["parks", "list"], clearTransport);
      expect(human.stdout).toContain(text("parks-list-active.txt").trim());
      expect(human.stdout).toContain(text("parks-list-all.txt").trim());
    } finally {
      harness.dispose();
    }
  });
});
