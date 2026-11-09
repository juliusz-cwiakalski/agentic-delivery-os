/**
 * TC-COORD-064 — the reserved slot adds no new anchor, section, or type, and the
 * digest and brief agree.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { STATUS_SECTION_ORDER, BRIEF_ANCHOR_GROUPS } from "../../packages/core/src/contracts/index";
import { capSizedFacts, reservedSlotFacts, runStatusCli, statusRuntime } from "../fixtures/status/harness";
import { briefRuntime, runBriefCli } from "../fixtures/brief/harness";

const ROOT = process.cwd();

const sectionIds = (digest: Record<string, unknown>): string[] => {
  const data = digest["data"] as { sections?: { id: string }[] };
  return data.sections?.map((section) => section.id) ?? [];
};

describe("TC-COORD-064 the reserved slot adds no new surface", () => {
  test("the digest keeps the same nine sections with or without the slot", async () => {
    const control = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
    const reserved = await runStatusCli(["--json", "status"], statusRuntime(reservedSlotFacts()));
    expect(sectionIds(JSON.parse(control.stdout) as Record<string, unknown>)).toEqual([
      ...STATUS_SECTION_ORDER,
    ]);
    expect(sectionIds(JSON.parse(reserved.stdout) as Record<string, unknown>)).toEqual([
      ...STATUS_SECTION_ORDER,
    ]);
    expect(STATUS_SECTION_ORDER).toHaveLength(9);
  });

  test("the brief keeps the same anchors and renders the escalation first", async () => {
    const control = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    const reserved = await runBriefCli(["--json", "brief"], briefRuntime(reservedSlotFacts()));
    const controlEnvelope = JSON.parse(control.stdout) as { data: { anchors: { group: string }[] } };
    const reservedEnvelope = JSON.parse(reserved.stdout) as { data: { anchors: { group: string }[] } };
    expect(controlEnvelope.data.anchors.map((anchor) => anchor.group)).toEqual([...BRIEF_ANCHOR_GROUPS]);
    expect(reservedEnvelope.data.anchors.map((anchor) => anchor.group)).toEqual([...BRIEF_ANCHOR_GROUPS]);
    const human = await runBriefCli(["brief"], briefRuntime(reservedSlotFacts()));
    expect(human.stdout).toContain("q-escalation");
    const blockerLine = human.stdout
      .split("\n")
      .find((line) => line.startsWith("blocker-questions"));
    expect(blockerLine?.indexOf("q-escalation")).toBeLessThan(
      blockerLine?.indexOf("q-old-1") ?? Number.POSITIVE_INFINITY,
    );
  });

  test("the digest and brief agree on the reserved question", async () => {
    const digest = JSON.parse(
      (await runStatusCli(["--json", "status"], statusRuntime(reservedSlotFacts()))).stdout,
    ) as Record<string, unknown>;
    const brief = JSON.parse(
      (await runBriefCli(["--json", "brief"], briefRuntime(reservedSlotFacts()))).stdout,
    ) as Record<string, unknown>;
    const digestData = digest["data"] as {
      sections: { id: string; questions?: { id: string }[] }[];
    };
    const typed = digestData.sections.find((section) => section.id === "typed-questions");
    expect(typed?.questions?.[0]?.id).toBe("q-escalation");
    expect(JSON.stringify(brief)).toContain("q-escalation");
  });

  test("no new question type or anchor is declared for the slot", () => {
    const contracts = readFileSync(join(ROOT, "packages/core/src/contracts/blockers.ts"), "utf8");
    const types = contracts.slice(
      contracts.indexOf("BLOCKER_QUESTION_TYPES"),
      contracts.indexOf("BLOCKER_ANSWER_CHANNEL_BY_TYPE"),
    );
    expect(types).toContain("decision-needed");
    expect(types).not.toContain("coordinator-escalation");
    expect(BRIEF_ANCHOR_GROUPS).not.toContain("escalation");
  });

  test("the slot reads no coordinator state", () => {
    const statusDomain = readFileSync(join(ROOT, "packages/core/src/domain/status.ts"), "utf8");
    const briefDomain = readFileSync(join(ROOT, "packages/core/src/domain/brief.ts"), "utf8");
    for (const text of [statusDomain, briefDomain]) {
      expect(text).not.toContain("coordinator.fence");
      expect(text).not.toContain("readCoordinatorRecords");
      expect(text).not.toContain("coordinator.exhaustion");
    }
  });
});
