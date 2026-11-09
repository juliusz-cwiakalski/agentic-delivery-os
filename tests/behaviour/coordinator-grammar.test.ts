/**
 * TC-COORD-003 — the command grammar is the declared four-subcommand family and
 * unknown input is classified.
 */
import { describe, expect, test } from "bun:test";
import { createCoordinatorHarness } from "../fixtures/coordinator/harness";

const cases: readonly (readonly string[])[] = [
  ["coordinator"],
  ["coordinator", "supervise"],
  ["coordinator", "start", "extra"],
  ["coordinator", "tick", "--foreground"],
  ["coordinator", "status", "--fresh-budget"],
  ["coordinator", "stop", "--live"],
  ["coordinator", "start", "--live"],
  ["coordinator", "status", "--unknown-flag"],
];

describe("TC-COORD-003 the grammar is the declared four-subcommand family", () => {
  test("unknown input is fallback.invocation at exit 1", async () => {
    for (const argv of cases) {
      const harness = createCoordinatorHarness({ label: "grammar" });
      const result = await harness.run([...argv, "--json"]);
      expect(result.code, argv.join(" ")).toBe(1);
      const envelope = result.json as { error?: { code?: string } };
      expect(envelope.error?.code, argv.join(" ")).toBe("fallback.invocation");
    }
  });

  test("a bare start names --foreground and the M1-S18 seam", async () => {
    const harness = createCoordinatorHarness({ label: "grammar-bare-start" });
    const result = await harness.run(["coordinator", "start", "--json"]);
    expect(result.code).toBe(1);
    const envelope = result.json as { error?: { code?: string; summary?: string } };
    expect(envelope.error?.code).toBe("fallback.invocation");
    expect(envelope.error?.summary).toContain("--foreground");
    expect(envelope.error?.summary).toContain("M1-S18");
  });

  test("the four declared subcommands are accepted", async () => {
    for (const argv of [
      ["coordinator", "status"],
      ["coordinator", "status", "--live"],
      ["coordinator", "tick"],
    ]) {
      const harness = createCoordinatorHarness({ label: "grammar-accepted" });
      const result = await harness.run([...argv, "--json"]);
      expect(result.code, argv.join(" ")).toBe(0);
    }
    const harness = createCoordinatorHarness({ label: "grammar-stop" });
    expect((await harness.run(["coordinator", "stop", "--json"])).code).toBe(0);
    const started = createCoordinatorHarness({
      label: "grammar-start",
      cycle: { cycles: 0 },
      session: { liveness: "alive" },
      alive: { 9001: true },
    });
    expect((await started.run(["coordinator", "start", "--foreground", "--json"])).code).toBe(0);
  });
});
