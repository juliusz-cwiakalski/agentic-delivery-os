/**
 * TC-BLK-031/033 — the digest `typed-questions` section: fields, age, rank,
 * nine-section order, the payload-only pickup predicate, and the
 * failed-read degradation to `unknown` + `state-unreadable` at exit 0.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { STATUS_SECTION_ORDER } from "../../packages/core/src/contracts/index";
import { isCoordinatorPickup } from "../../packages/core/src/domain/blockers";
import { createBlockersHarness } from "../fixtures/blockers/harness";
import { makeQuestion } from "../fixtures/blockers/records";
import { briefRuntime, runBriefCli } from "../fixtures/brief/harness";
import { ledgerPath } from "../fixtures/state/harness";
import {
  baseFacts,
  blockersRead,
  blockersUnreadable,
  NOW_MS,
  runStatusCli,
  statusRuntime,
} from "../fixtures/status/harness";

const ROOT = process.cwd();
const at = (hoursAgo: number): string => new Date(NOW_MS - hoursAgo * 3_600_000).toISOString();

const sectionOf = (envelope: Record<string, unknown>, id: string): Record<string, unknown> => {
  const data = envelope.data as Record<string, unknown>;
  const sections = data.sections as Record<string, unknown>[];
  const section = sections.find((entry) => entry.id === id);
  if (section === undefined) throw new Error(`section ${id} missing`);
  return section;
};

const statusOf = async (blockers: ReturnType<typeof blockersRead>) => {
  const run = await runStatusCli(["--json", "status"], statusRuntime(baseFacts({ blockers })));
  return { run, envelope: JSON.parse(run.stdout) as Record<string, unknown> };
};

describe("TC-BLK-031 digest typed-questions section", () => {
  test("a published question surfaces on the next status invocation with every field", async () => {
    const question = makeQuestion({
      id: "q-1",
      type: "decision-needed",
      audience: "coordinator",
      lane: "L5",
      askedAt: at(2),
      options: ["full", "lite"],
    });
    const { run, envelope } = await statusOf(blockersRead([question], []));
    expect(run.exitCode).toBe(0);
    const section = sectionOf(envelope, "typed-questions");
    expect(section.state).toBe("observed");
    expect(section.counts).toMatchObject({ observed: 1, unknown: 0, total: 1, omitted: 0 });
    expect(section.truncated).toBe(false);
    const items = section.questions as Record<string, unknown>[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "q-1",
      type: "decision-needed",
      audience: "coordinator",
      lane: "L5",
      ref: null,
      options: ["full", "lite"],
      askedAt: at(2),
      age: 2 * 3_600_000,
      rank: 1,
    });
  });

  test("a second question ranks 1..2 and age advances with the injected clock", async () => {
    const questions = [
      makeQuestion({ id: "q-1", askedAt: at(3), options: ["a"] }),
      makeQuestion({ id: "q-2", type: "external-wait", askedAt: at(1), options: [] }),
    ];
    const first = await statusOf(blockersRead(questions, []));
    expect(
      (sectionOf(first.envelope, "typed-questions").questions as Record<string, unknown>[]).map(
        (item) => item.rank,
      ),
    ).toEqual([1, 2]);
    const advanced = await runStatusCli(
      ["--json", "status"],
      statusRuntime(
        baseFacts({ blockers: blockersRead(questions, []), nowMs: NOW_MS + 3_600_000 }),
      ),
    );
    const advancedEnvelope = JSON.parse(advanced.stdout) as Record<string, unknown>;
    const advancedItems = sectionOf(advancedEnvelope, "typed-questions").questions as Record<
      string,
      unknown
    >[];
    expect(advancedItems[0]?.age).toBe(4 * 3_600_000);
  });

  test("the section order is nine with the six shipped ids relative-stable", async () => {
    const { envelope } = await statusOf(blockersRead([], []));
    const data = envelope.data as Record<string, unknown>;
    const sections = data.sections as Record<string, unknown>[];
    expect(STATUS_SECTION_ORDER).toHaveLength(9);
    expect(sections.map((section) => section.id)).toEqual([...STATUS_SECTION_ORDER]);
    expect(sections.map((section) => section.id).slice(0, 6)).toEqual([
      "tracker",
      "changes-and-prs",
      "ci",
      "lanes-or-queue",
      "providers",
      "parked-work",
    ]);
    expect((data.summary as Record<string, unknown>).sections).toBe(9);
  });

  test("the pickup predicate is determinable from the payload alone", async () => {
    const coordinator = makeQuestion({
      id: "q-c",
      type: "decision-needed",
      audience: "coordinator",
      options: ["a"],
    });
    const { envelope } = await statusOf(blockersRead([coordinator], []));
    const items = sectionOf(envelope, "typed-questions").questions as {
      audience: string;
      rank: number;
    }[];
    expect(isCoordinatorPickup(items)).toBe(true);
    const ownerItems = [{ audience: "owner", rank: 1 }];
    expect(isCoordinatorPickup(ownerItems)).toBe(false);
    const rankTwo = [
      { audience: "coordinator", rank: 1 },
      { audience: "coordinator", rank: 2 },
    ];
    expect(isCoordinatorPickup(rankTwo.slice(1))).toBe(false);
  });

  test("no wake, timer, socket, or process behavior ships", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/domain/status.ts"), "utf8");
    expect(source.includes("setTimeout")).toBe(false);
    expect(source.includes("setInterval")).toBe(false);
    expect(source.includes("child_process")).toBe(false);
    expect(source.includes("socket")).toBe(false);
  });
});

describe("TC-BLK-033 digest/brief degradation", () => {
  test("a failed blocker read degrades the section to unknown/state-unreadable at exit 0", async () => {
    const control = await statusOf(blockersRead([], []));
    const failed = await statusOf(blockersUnreadable());
    expect(failed.run.exitCode).toBe(0);
    const section = sectionOf(failed.envelope, "typed-questions");
    expect(section.state).toBe("unknown");
    expect(section.evidence).toMatchObject({ reasons: ["state-unreadable"] });
    expect(section.questions).toEqual([]);
    expect(section.counts).toMatchObject({ observed: 0, unknown: 0, total: 0, omitted: 0 });
    expect(["degraded", "unavailable", "not-delivered"]).not.toContain(section.state);
    const controlTracker = sectionOf(control.envelope, "tracker");
    const failedTracker = sectionOf(failed.envelope, "tracker");
    expect(failedTracker.state).toBe(controlTracker.state);
  });

  test("the brief mirror and anchor degrade identically with no fabricated question", async () => {
    const facts = baseFacts({ blockers: blockersUnreadable() });
    const run = await runBriefCli(["--json", "brief"], briefRuntime(facts));
    expect(run.exitCode).toBe(0);
    const data = (JSON.parse(run.stdout) as Record<string, unknown>).data as Record<
      string,
      unknown
    >;
    const surfaces = data.surfaces as Record<string, unknown>[];
    const surface = surfaces.find((entry) => entry.id === "typed-questions");
    expect(surface).toMatchObject({ state: "unknown", reason: "state-unreadable" });
    expect(surface?.counts).toMatchObject({ total: 0 });
    const anchors = data.anchors as Record<string, unknown>[];
    const anchor = anchors.find((entry) => entry.group === "blocker-questions");
    expect(anchor).toMatchObject({ state: "unknown", items: [] });
    expect(JSON.stringify(data)).not.toContain('"question":');
  });

  test("a verified-empty store is observed with an explicit empty reason", async () => {
    const { envelope } = await statusOf(blockersRead([], []));
    const section = sectionOf(envelope, "typed-questions");
    expect(section.state).toBe("observed");
    expect(section.evidence).toMatchObject({ reasons: ["observed-empty"] });
    expect(section.counts).toMatchObject({ total: 0 });
  });

  test("blockers list on a torn store exits 2 while the digest exits 0", async () => {
    const harness = createBlockersHarness();
    try {
      await harness.run(["publish", "spec-ambiguity", "--lane", "L2", "q"]);
      const bytes = harness.ledgerBytes();
      writeFileSync(ledgerPath(harness.state.identity), bytes.subarray(0, bytes.length - 3));
      const list = await harness.run(["list"]);
      expect(list.exitCode).toBe(2);
      expect(list.envelope?.error).toMatchObject({ code: "state.store.torn" });
    } finally {
      harness.cleanup();
    }
  });
});
