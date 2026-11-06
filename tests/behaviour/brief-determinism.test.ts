/**
 * TC-BRIEF-017 — determinism replay and human-content discipline: identical
 * inputs produce byte-identical bytes, ranking is independent of input order,
 * and human text carries no time, run id, payload, or generated prose.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import {
  aggregateStatus,
  projectBrief,
  renderBriefHuman,
} from "../../packages/core/src/domain/index";
import {
  baseFacts,
  briefRuntime,
  capSizedFacts,
  deliveryRequestRead,
  makeDeliveryRequest,
  REVIEWS_AVAILABLE,
  runBriefCli,
} from "../fixtures/brief/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const reverse = <T>(items: readonly T[]): T[] => [...items].reverse();
const permutedFacts = () => {
  const facts = capSizedFacts();
  const tracker = facts.tracker;
  const changes = facts.changes;
  const ci = facts.ci;
  const providerFacts = facts.providers;
  const parks = providerFacts.parks;
  return {
    ...facts,
    tracker: tracker.ok ? { ...tracker, items: reverse(tracker.items) } : tracker,
    changes: changes.ok ? { ...changes, items: reverse(changes.items) } : changes,
    ci: ci.ok ? { ...ci, items: reverse(ci.items) } : ci,
    providers: {
      config: providerFacts.config,
      parks: parks.ok ? { ...parks, parks: reverse(parks.parks) } : parks,
    },
    localContext: facts.localContext.ok
      ? {
          ...facts.localContext,
          context: {
            ...facts.localContext.context,
            parkedChanges: reverse(facts.localContext.context.parkedChanges),
          },
        }
      : facts.localContext,
  };
};

describe("TC-BRIEF-017 determinism", () => {
  test("--json and human replays are byte-identical across rebuilt runtimes", async () => {
    const jsonFirst = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    const jsonSecond = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    expect(jsonFirst.stdout).toBe(jsonSecond.stdout);

    const humanFirst = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
    const humanSecond = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
    expect(humanFirst.stdout).toBe(humanSecond.stdout);
  });

  test("human text carries no timestamp, run id, or raw payload fragment", async () => {
    const run = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
    expect(run.stdout).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(run.stdout).not.toContain("run-brief-fixture");
    expect(run.stdout).not.toContain("schemaVersion");
    expect(run.stdout).not.toContain("delivery.brief.v1");
    expect(run.stdout).not.toContain("{");
    expect(run.stdout).not.toContain("}");
  });

  test("the pure renderer is a function of the payload and changes only the brand token", () => {
    const brief = projectBrief(capSizedFacts());
    const first = renderBriefHuman(brief, SYNTHETIC_BRAND);
    const second = renderBriefHuman(brief, SYNTHETIC_BRAND);
    expect(second).toBe(first);

    const renamed = renderBriefHuman(brief, { ...SYNTHETIC_BRAND, binaryName: "renamed-brief" });
    expect(renamed).toBe(first.replace(SYNTHETIC_BRAND.binaryName, "renamed-brief"));
  });

  test("fact order permutation never changes the payload bytes", () => {
    const ordered = projectBrief(capSizedFacts());
    const permuted = projectBrief(permutedFacts());
    expect(permuted).toEqual(ordered);
    expect(JSON.stringify(permuted)).toBe(JSON.stringify(ordered));
  });

  test("ranking is by declared keys, not by input order", () => {
    const facts = capSizedFacts();
    const changed = facts.changes;
    if (!changed.ok) throw new Error("changes read failed");
    const items = [
      ...changed.items,
      makeDeliveryRequest({ entityId: "900", reviewState: "approved" }),
      makeDeliveryRequest({ entityId: "901", reviewState: "approved" }),
      makeDeliveryRequest({ entityId: "902", reviewState: "approved" }),
    ];
    const brief = projectBrief({
      ...facts,
      changes: deliveryRequestRead(items, REVIEWS_AVAILABLE),
    });
    const ready = brief.anchors.find((anchor) => anchor.group === "ready-to-merge");
    expect(ready?.items.map((item) => item.identity)).toEqual(["900", "901", "902"]);
  });

  test("date- and map-order-driven renderers are not present in the production module", () => {
    const source = readFileSync("packages/core/src/domain/brief.ts", "utf8");
    expect(source).not.toContain("Date.now");
    expect(source).not.toContain("new Map(Object.entries");
    expect(aggregateStatus(baseFacts()).sections).toHaveLength(9);
  });
});
