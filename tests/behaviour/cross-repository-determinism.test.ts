/**
 * TC-XBOUND-003 (GH-310 AC-NFR2-1, DoD-11): the queue and lanes projections are
 * byte-identical over unchanged two-member state — entry order, dependency
 * order, and blocker order are stable, and the member refs are derived, never
 * generated.
 */
import { describe, expect, test } from "bun:test";
import { CHANGE_REF } from "../fixtures/cross-repository/constants";
import { createMemberQueueHarness, MEMBER_REFS } from "../fixtures/cross-repository/queue";

describe("TC-XBOUND-003 queue and lanes repeated-run determinism", () => {
  test("list, ready, plan, and lanes list are byte-identical across two runs each", async () => {
    const world = createMemberQueueHarness("determinism", { apiDeliveryState: "done" });
    const harness = world.harness;
    expect((await harness.run(["queue", "add", CHANGE_REF, "--json"])).exitCode).toBe(0);
    // One held lease (the prerequisite member) and one parked lane (the dependent).
    expect(
      (await harness.run(["queue", "claim", MEMBER_REFS.api, "--holder", "holder-api", "--json"]))
        .exitCode,
    ).toBe(0);
    expect(
      (await harness.run(["queue", "claim", MEMBER_REFS.web, "--holder", "holder-web", "--json"]))
        .exitCode,
    ).toBe(0);
    expect(
      await harness.run([
        "queue",
        "release",
        MEMBER_REFS.web,
        "--park",
        "provider-window",
        "--until",
        "2026-11-07T12:00:00Z",
        "--json",
      ]),
    ).toMatchObject({ exitCode: 0 });

    for (const argv of [
      ["queue", "list", "--json"],
      ["queue", "ready", CHANGE_REF, "--json"],
      ["queue", "plan", "--json"],
      ["lanes", "list", "--json"],
    ] as const) {
      const first = await harness.run(argv);
      const second = await harness.run(argv);
      expect(first.exitCode, `${argv.join(" ")} exit`).toBe(0);
      expect(second.exitCode, `${argv.join(" ")} exit`).toBe(first.exitCode);
      expect(second.stdout, `${argv.join(" ")} stdout`).toBe(first.stdout);
    }

    const listed = await harness.run(["queue", "list", "--json"]);
    const data = JSON.parse(listed.stdout).data as {
      readonly entries: Array<{ readonly ref: string }>;
    };
    expect(data.entries.map((entry) => entry.ref)).toEqual([MEMBER_REFS.api, MEMBER_REFS.web]);
  });
});
