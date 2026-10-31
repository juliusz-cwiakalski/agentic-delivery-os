import { describe, expect, test } from "bun:test";
import { clearTransport, createHarness, outageTransport } from "./provider-harness";

describe("TC-PROV-053/036 announcements on the declared surfaces", () => {
  test("resolve announcements are in data and warnings are on stderr", async () => {
    const harness = createHarness();
    try {
      const machine = await harness.run(["resolve", "--json"], outageTransport);
      const data = machine.data as { announcements: Array<{ code: string }> };
      expect(data.announcements.map((entry) => entry.code)).toContain(
        "provider.quota.unreachable",
      );
      expect(machine.stderr).toContain("provider");
      const quota = await harness.run(["quota", "--json"], clearTransport);
      expect(quota.error).toBeUndefined();
    } finally {
      harness.dispose();
    }
  });
});
