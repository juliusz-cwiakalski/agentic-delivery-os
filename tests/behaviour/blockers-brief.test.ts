/**
 * TC-BLK-032 — the brief keeps nine surfaces, mirrors the digest
 * `typed-questions` section by id, retires the placeholder (catalog 3 -> 2),
 * makes `blocker-questions` a real ranked anchor, and keeps decision-first order.
 */
import { describe, expect, test } from "bun:test";
import {
  BRIEF_ANCHOR_GROUPS,
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_SURFACE_ORDER,
  type BriefPayload,
} from "../../packages/core/src/contracts/index";
import {
  aggregateStatus,
  projectBrief,
  renderBriefHuman,
} from "../../packages/core/src/domain/index";
import { makeAnswer, makeQuestion } from "../fixtures/blockers/records";
import { baseFacts, briefRuntime, NOW_MS, runBriefCli } from "../fixtures/brief/harness";
import { blockersRead } from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const at = (hoursAgo: number): string => new Date(NOW_MS - hoursAgo * 3_600_000).toISOString();

const facts = () =>
  baseFacts({
    blockers: blockersRead(
      [
        makeQuestion({
          id: "q-1",
          type: "decision-needed",
          audience: "coordinator",
          askedAt: at(1),
          options: ["a"],
        }),
        makeQuestion({
          id: "q-2",
          type: "spec-ambiguity",
          audience: "owner",
          askedAt: at(2),
          options: [],
        }),
        makeQuestion({
          id: "q-3",
          type: "decision-needed",
          audience: "owner",
          askedAt: at(3),
          options: ["a"],
        }),
      ],
      [makeAnswer({ questionId: "q-3", answeringAudience: "owner", choice: "a" })],
    ),
  });

const audit = (payload: BriefPayload): string[] => {
  const failures: string[] = [];
  if (payload.surfaces.length !== 9) failures.push("surfaces: expected 9");
  const typed = payload.surfaces.filter((surface) => surface.id === "typed-questions");
  if (typed.length !== 1) failures.push("surfaces: expected exactly one typed-questions");
  if (payload.placeholders.length !== 2) failures.push("placeholders: expected 2");
  if (payload.placeholders.some((entry) => entry.capability === "typed-questions")) {
    failures.push("placeholders: typed-questions must be retired");
  }
  if (
    JSON.stringify(payload.anchors.map((anchor) => anchor.group)) !==
    JSON.stringify([...BRIEF_ANCHOR_GROUPS])
  ) {
    failures.push("anchors: expected the three decision-first groups");
  }
  return failures;
};

describe("TC-BLK-032 brief integration", () => {
  test("nine surfaces with exactly one typed-questions mirror", () => {
    const payload = projectBrief(facts());
    expect(audit(payload)).toEqual([]);
    expect(BRIEF_SURFACE_ORDER).toHaveLength(9);
    expect(new Set(BRIEF_SURFACE_ORDER).size).toBe(9);
    const digest = aggregateStatus(facts());
    const section = digest.sections.find((entry) => entry.id === "typed-questions");
    const surface = payload.surfaces.find((entry) => entry.id === "typed-questions");
    expect(surface).toMatchObject({
      state: section?.state,
      counts: section?.counts,
      truncated: section?.truncated,
      reason: section?.evidence.reasons[0],
    });
    expect(surface?.title).toBe("Typed questions");
  });

  test("the placeholder catalog is exactly the two remaining ids", () => {
    const payload = projectBrief(facts());
    expect(payload.placeholders.map((entry) => entry.capability)).toEqual([
      "gate-sla-states",
      "lane-queue-engine",
    ]);
    expect(BRIEF_PLACEHOLDER_CATALOG).toHaveLength(2);
    const mutated = {
      ...payload,
      placeholders: [
        ...payload.placeholders,
        { capability: "typed-questions", owningStory: "M1-S16", state: "not-delivered" },
      ],
    } as unknown as BriefPayload;
    expect(audit(mutated).some((line) => line.startsWith("placeholders"))).toBe(true);
  });

  test("three anchors in decision-first order with a real ranked blocker group", () => {
    const payload = projectBrief(facts());
    expect(payload.anchors.map((anchor) => anchor.group)).toEqual([
      "ready-to-merge",
      "blocker-questions",
      "owner-gate-ages",
    ]);
    const anchor = payload.anchors.find((entry) => entry.group === "blocker-questions");
    if (anchor === undefined) throw new Error("blocker-questions anchor missing");
    expect(anchor.state).toBe("observed");
    expect(anchor.items.map((item) => item.identity)).toEqual(["q-1", "q-2"]);
    for (const item of anchor.items) {
      const evidence = item.evidence;
      expect(evidence.kind).toBe("blocker-question");
      if (evidence.kind === "blocker-question") {
        expect(typeof evidence.rank).toBe("number");
        expect(evidence.audience).toBeDefined();
        expect(evidence.type).toBeDefined();
        expect(evidence.lane).toBeDefined();
      }
    }
    const digestItems = aggregateStatus(facts())
      .sections.find((entry) => entry.id === "typed-questions")
      ?.questions?.map((question) => question.id);
    expect(anchor.items.map((item) => item.identity)).toEqual(digestItems);
  });

  test("an empty open set renders an explicit empty group, never a placeholder", () => {
    const payload = projectBrief(baseFacts({ blockers: blockersRead([], []) }));
    const anchor = payload.anchors.find((entry) => entry.group === "blocker-questions");
    expect(anchor).toMatchObject({ state: "observed", items: [], truncated: false, omitted: 0 });
    const human = renderBriefHuman(payload, SYNTHETIC_BRAND);
    expect(human).toContain("blocker-questions  observed (observed-empty)  none");
    expect(human).not.toContain("typed-questions (M1-S16)");
  });

  test("the human brief renders real blocker lines between ready and owner ages", () => {
    const payload = projectBrief(facts());
    const human = renderBriefHuman(payload, SYNTHETIC_BRAND);
    expect(human).toContain("q-1");
    expect(human).toContain("audience=coordinator");
    expect(human).toContain("1.");
    const ready = human.indexOf("ready-to-merge");
    const blockers = human.indexOf("blocker-questions");
    const owners = human.indexOf("owner-gate-ages");
    expect(ready).toBeLessThan(blockers);
    expect(blockers).toBeLessThan(owners);
    expect(human.indexOf("gate-sla-states")).toBeGreaterThan(owners);
  });

  test("the other surfaces mirror their digest sections and the two placeholders", () => {
    const payload = projectBrief(facts());
    const digest = aggregateStatus(facts());
    for (const id of [
      "tracker",
      "changes-and-prs",
      "ci",
      "lanes-or-queue",
      "providers",
      "parked-work",
    ]) {
      const section = digest.sections.find((entry) => entry.id === id);
      const surface = payload.surfaces.find((entry) => entry.id === id);
      expect(surface, id).toMatchObject({
        state: section?.state,
        counts: section?.counts,
        truncated: section?.truncated,
      });
    }
    for (const id of ["gate-sla-states", "lane-queue-engine"]) {
      const surface = payload.surfaces.find((entry) => entry.id === id);
      expect(surface).toMatchObject({ state: "not-delivered", counts: { total: 0 } });
    }
  });

  test("the CLI brief payload matches the pure projection", async () => {
    const run = await runBriefCli(["--json", "brief"], briefRuntime(facts()));
    expect(run.exitCode).toBe(0);
    const data = (JSON.parse(run.stdout) as Record<string, unknown>).data;
    expect(data).toEqual(JSON.parse(JSON.stringify(projectBrief(facts()))));
  });
});
