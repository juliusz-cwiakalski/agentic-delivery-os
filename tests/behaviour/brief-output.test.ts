/**
 * TC-BRIEF-006 — one-screen bounds, explicit truncation markers, decision-first
 * order, and plain deterministic text over cap-sized and above-cap worlds.
 */
import { describe, expect, test } from "bun:test";
import {
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  STATUS_MAX_MACHINE_BYTES,
} from "../../packages/core/src/contracts/index";
import {
  aggregateStatus,
  projectBrief,
  renderBriefHuman,
} from "../../packages/core/src/domain/index";
import { briefCases } from "../fixtures/brief/cases";
import { baseFacts, capSizedFacts } from "../fixtures/brief/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const linesOf = (text: string): string[] => text.split("\n").filter((line) => line.length > 0);

const markerFor = (human: string, label: string): string | undefined =>
  linesOf(human).find((line) => line.startsWith(label));

describe("TC-BRIEF-006 output bounds and ordering", () => {
  test("the cap-sized human screen stays within 24 lines and 4096 bytes", () => {
    const human = renderBriefHuman(projectBrief(capSizedFacts()), SYNTHETIC_BRAND);
    expect(linesOf(human).length).toBeLessThanOrEqual(STATUS_MAX_HUMAN_LINES);
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(STATUS_MAX_HUMAN_BYTES);
  });

  test("the machine payload stays within 65536 bytes", () => {
    const payload = projectBrief(capSizedFacts());
    expect(Buffer.byteLength(JSON.stringify(payload), "utf8")).toBeLessThanOrEqual(
      STATUS_MAX_MACHINE_BYTES,
    );
  });

  test("decision-first anchors precede every context surface in digest order", () => {
    const human = renderBriefHuman(projectBrief(capSizedFacts()), SYNTHETIC_BRAND);
    const order = [
      "ready-to-merge",
      "blocker-questions",
      "owner-gate-ages",
      "gate-sla-states",
      "tracker",
      "changes-and-prs",
      "ci",
      "lanes-or-queue",
      "providers",
      "parked-work",
    ];
    const positions = order.map((label) => human.indexOf(label));
    for (const [index, position] of positions.entries()) {
      expect(position, order[index]).toBeGreaterThanOrEqual(0);
      if (index > 0) {
        const previous = positions[index - 1] ?? -1;
        expect(position, order[index]).toBeGreaterThan(previous);
      }
    }
  });

  test("every truncated surface and anchor group carries a non-empty marker", () => {
    const brief = projectBrief(capSizedFacts());
    const human = renderBriefHuman(brief, SYNTHETIC_BRAND);
    const tracker = markerFor(human, "tracker");
    expect(tracker).toContain("+");
    for (const marker of brief.truncation) {
      if (marker.target === "owner-gate-ages" || marker.target === "ready-to-merge") continue;
      const line = markerFor(human, marker.target);
      if (line === undefined) throw new Error(`missing line for ${marker.target}`);
      expect(line, marker.target).toContain("+");
    }
  });

  test("an untruncated context surface carries no marker", () => {
    const human = renderBriefHuman(projectBrief(capSizedFacts()), SYNTHETIC_BRAND);
    const providers = markerFor(human, "providers");
    if (providers === undefined) throw new Error("providers line missing");
    expect(providers).not.toContain("+more");
    expect(providers).not.toMatch(/\+\d/);
  });

  test("at, one-above, and far-above cap worlds keep the ordering and the bound", () => {
    for (const name of ["cap-sized", "ready-cap-dropped", "source-at-limit"]) {
      const testCase = briefCases.find((entry) => entry.name === name);
      if (testCase === undefined) throw new Error(`missing case ${name}`);
      const human = renderBriefHuman(projectBrief(testCase.facts), SYNTHETIC_BRAND);
      expect(linesOf(human).length, name).toBeLessThanOrEqual(STATUS_MAX_HUMAN_LINES);
      expect(Buffer.byteLength(human, "utf8"), name).toBeLessThanOrEqual(STATUS_MAX_HUMAN_BYTES);
      expect(human.indexOf("ready-to-merge")).toBeLessThan(human.indexOf("tracker"));
    }
  });

  test("the human text is plain deterministic text", () => {
    for (const testCase of [briefCases[0], briefCases[2]]) {
      if (testCase === undefined) continue;
      const human = renderBriefHuman(projectBrief(testCase.facts), SYNTHETIC_BRAND);
      expect(human).not.toContain("\r");
      expect(human.includes(`${String.fromCodePoint(0x1b)}[`)).toBe(false);
      for (const character of human) {
        if (character === "\n") continue;
        expect(character.codePointAt(0) ?? 0).toBeGreaterThanOrEqual(0x20);
      }
    }
    expect(renderBriefHuman(projectBrief(baseFacts()), SYNTHETIC_BRAND)).toBe(
      renderBriefHuman(projectBrief(baseFacts()), SYNTHETIC_BRAND),
    );
    expect(aggregateStatus(baseFacts()).sections).toHaveLength(6);
  });
});
