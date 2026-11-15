/**
 * TC-XQUEUE-001/002/005/006 (GH-310 F-2, F-4, DM-6, DEC-2, DEC-21):
 * `queue add` materializes one entry and one lane per declared member, each
 * member entry is bound to its own repository, the declared dependency edge is
 * per member, and leases/releases are per member ref — one member's held lease
 * never blocks another member's release.
 */
import { describe, expect, test } from "bun:test";
import { API_MEMBER, CHANGE_REF, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  createMemberQueueHarness,
  MEMBER_REFS,
  type MemberQueueHarness,
} from "../fixtures/cross-repository/queue";

const json = (text: string): Record<string, unknown> => JSON.parse(text) as Record<string, unknown>;
const data = (text: string): Record<string, unknown> => json(text).data as Record<string, unknown>;
const entries = (text: string): Array<Record<string, unknown>> =>
  data(text).entries as Array<Record<string, unknown>>;
const lanes = (text: string): Array<Record<string, unknown>> =>
  data(text).lanes as Array<Record<string, unknown>>;

const addMembers = async (world: MemberQueueHarness): Promise<void> => {
  const added = await world.harness.run(["queue", "add", CHANGE_REF, "--json"]);
  expect(added.exitCode).toBe(0);
};

describe("TC-XQUEUE-001 one entry and one lane per declared member", () => {
  test("add returns the delivered payload plus ordered members; list and lanes are per member", async () => {
    const world = createMemberQueueHarness("entries");
    await addMembers(world);
    const added = await world.harness.run(["queue", "add", CHANGE_REF, "--json"]);
    // A replay is the delivered noop: nothing new is materialized.
    expect(data(added.stdout).result).toBe("noop");
    expect(data(added.stdout).members).toEqual([
      { ref: MEMBER_REFS.api, repoKey: API_MEMBER.repoKey, lane: MEMBER_REFS.api },
      { ref: MEMBER_REFS.web, repoKey: WEB_MEMBER.repoKey, lane: MEMBER_REFS.web },
    ]);

    const listed = await world.harness.run(["queue", "list", "--json"]);
    expect(listed.exitCode).toBe(0);
    const listedEntries = entries(listed.stdout);
    expect(listedEntries.map((entry) => entry.ref)).toEqual([MEMBER_REFS.api, MEMBER_REFS.web]);
    expect(listedEntries[0]?.repository).toBe(API_MEMBER.repoKey);
    expect(listedEntries[1]?.repository).toBe(WEB_MEMBER.repoKey);
    expect(listedEntries.some((entry) => entry.ref === CHANGE_REF)).toBe(false);
    // The auto-declared declared edge rides the delivered dependency field.
    expect(listedEntries[1]?.deps).toEqual([MEMBER_REFS.api]);
    expect(listedEntries[0]?.deps).toEqual([]);

    const laneRead = await world.harness.run(["lanes", "list", "--json"]);
    expect(laneRead.exitCode).toBe(0);
    const laneRefs = lanes(laneRead.stdout).map((lane) => lane.ref);
    expect(laneRefs).toEqual([MEMBER_REFS.api, MEMBER_REFS.web]);
    expect(laneRefs).not.toContain(CHANGE_REF);
    for (const lane of lanes(laneRead.stdout)) {
      expect([MEMBER_REFS.api, MEMBER_REFS.web]).toContain(lane.ref as string);
    }
  });

  test("a member-less change keeps the delivered payload without a members array", async () => {
    const world = createMemberQueueHarness("memberless", { withMembers: false });
    const added = await world.harness.run(["queue", "add", CHANGE_REF, "--json"]);
    expect(added.exitCode).toBe(0);
    expect(data(added.stdout).members).toBeUndefined();
    expect(data(added.stdout).ref).toBe(CHANGE_REF);
    expect(data(added.stdout).edges).toEqual([]);
  });
});

describe("TC-XQUEUE-002 the declared edge makes the dependent member not-ready", () => {
  test("web carries the edge and dependency-open; api is unaffected and repeats are identical", async () => {
    const world = createMemberQueueHarness("dependency");
    await addMembers(world);
    const first = await world.harness.run(["queue", "list", "--json"]);
    const second = await world.harness.run(["queue", "list", "--json"]);
    expect(first.stdout).toBe(second.stdout);

    const read = entries(first.stdout);
    const web = read.find((entry) => entry.ref === MEMBER_REFS.web);
    const api = read.find((entry) => entry.ref === MEMBER_REFS.api);
    expect(web?.deps).toEqual([MEMBER_REFS.api]);
    // The delivered readiness projection marks an unmet declared edge `held`
    // with the closed `dependency-open` reason; the rule is per member, and the
    // prerequisite member is never penalized.
    expect(web?.state).toBe("held");
    const blocking = (web?.blocking ?? []) as Array<Record<string, unknown>>;
    expect(blocking.some((block) => block.reason === "dependency-open")).toBe(true);
    expect((api?.blocking ?? []) as unknown[]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ reason: "dependency-open" })]),
    );
    expect(api?.state).toBe("ready");

    const laneRead = await world.harness.run(["lanes", "list", "--json"]);
    const laneRefs = lanes(laneRead.stdout).map((lane) => lane.ref);
    expect(laneRefs).toEqual([MEMBER_REFS.api, MEMBER_REFS.web]);
  });
});

describe("TC-XQUEUE-005 per-member leases and release keep the entries", () => {
  test("each member ref leases independently, releases keep both entries, and lanes return idle", async () => {
    const world = createMemberQueueHarness("lease", { apiDeliveryState: "done" });
    await addMembers(world);
    for (const ref of [MEMBER_REFS.api, MEMBER_REFS.web]) {
      const claimed = await world.harness.run([
        "queue",
        "claim",
        ref,
        "--holder",
        "holder-1",
        "--json",
      ]);
      expect(claimed.exitCode).toBe(0);
      expect(data(claimed.stdout).result).toBe("claimed");
    }
    const held = await world.harness.run(["queue", "list", "--json"]);
    const heldLeases = data(held.stdout).leases as Array<Record<string, unknown>>;
    expect(heldLeases.map((lease) => lease.ref).sort()).toEqual(
      [MEMBER_REFS.api, MEMBER_REFS.web].sort(),
    );

    for (const ref of [MEMBER_REFS.api, MEMBER_REFS.web]) {
      const released = await world.harness.run(["queue", "release", ref, "--json"]);
      expect(released.exitCode).toBe(0);
      expect(data(released.stdout).result).toBe("released");
    }
    const after = await world.harness.run(["queue", "list", "--json"]);
    expect(entries(after.stdout).map((entry) => entry.ref)).toEqual([
      MEMBER_REFS.api,
      MEMBER_REFS.web,
    ]);
    expect((data(after.stdout).leases as unknown[]).length).toBe(0);

    // A second claim on one member ref is admitted while the other is untouched.
    const reClaim = await world.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.api,
      "--holder",
      "holder-2",
      "--json",
    ]);
    expect(reClaim.exitCode).toBe(0);
    expect(data(reClaim.stdout).result).toBe("claimed");
    const final = await world.harness.run(["queue", "list", "--json"]);
    const finalLeases = data(final.stdout).leases as Array<Record<string, unknown>>;
    expect(finalLeases.map((lease) => lease.ref)).toEqual([MEMBER_REFS.api]);
    expect(
      lanes((await world.harness.run(["lanes", "list", "--json"])).stdout).some(
        (lane) => lane.ref === CHANGE_REF,
      ),
    ).toBe(false);
  });
});

describe("TC-XQUEUE-006 release addresses exactly one member ref", () => {
  test("release B while A's lease is held by another holder leaves A unchanged", async () => {
    const world = createMemberQueueHarness("release", { apiDeliveryState: "done" });
    await addMembers(world);
    const apiClaim = await world.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.api,
      "--holder",
      "holder-a",
      "--json",
    ]);
    expect(apiClaim.exitCode).toBe(0);
    const webClaim = await world.harness.run([
      "queue",
      "claim",
      MEMBER_REFS.web,
      "--holder",
      "holder-b",
      "--json",
    ]);
    expect(webClaim.exitCode).toBe(0);
    const apiLease = data(apiClaim.stdout).lease as Record<string, unknown>;

    const released = await world.harness.run(["queue", "release", MEMBER_REFS.web, "--json"]);
    expect(released.exitCode).toBe(0);
    expect(data(released.stdout).result).toBe("released");
    expect((data(released.stdout).lease as Record<string, unknown>).repository).toBe(
      WEB_MEMBER.repoKey,
    );

    const listed = await world.harness.run(["queue", "list", "--json"]);
    expect(entries(listed.stdout).map((entry) => entry.ref)).toEqual([
      MEMBER_REFS.api,
      MEMBER_REFS.web,
    ]);
    const leases = data(listed.stdout).leases as Array<Record<string, unknown>>;
    expect(leases.map((lease) => lease.repository)).toEqual([API_MEMBER.repoKey]);
    expect(leases[0]?.holder).toBe(apiLease.holder);
    expect(leases[0]?.leaseId).toBe(apiLease.leaseId);

    // A repeat release is the delivered truthful repeat result, A still untouched.
    const repeat = await world.harness.run(["queue", "release", MEMBER_REFS.web, "--json"]);
    expect(repeat.exitCode).toBe(0);
    expect(data(repeat.stdout).result).toBe("noop");
    const final = await world.harness.run(["queue", "list", "--json"]);
    const finalLeases = data(final.stdout).leases as Array<Record<string, unknown>>;
    expect(finalLeases.map((lease) => lease.holder)).toEqual(["holder-a"]);
  });
});
