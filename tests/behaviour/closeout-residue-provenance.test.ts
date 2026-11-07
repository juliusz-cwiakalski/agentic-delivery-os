/** TC-CAP-035 — every residue kind has exactly one producer and none is fabricated. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { CAPSULE_RESIDUE_KINDS } from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";

const PRODUCERS: Readonly<Record<string, string>> = {
  "unresolved-human-thread": "closeout-thread-policy",
  "ambiguous-flip-hit": "closeout-diff-sweep",
  "capsule-event-gap": "closeout capsule cross-check",
  "review-verdict-unreadable": "closeout review ingestion",
  "retro-coverage-unavailable": "closeout retro coverage",
  "worktree-retained": "closeout worktree predicate",
  "session-attribution-gap": "closeout session compaction",
  "capsule-cap-reached": "closeout residue cap",
};

describe("TC-CAP-035 residue provenance", () => {
  test("every kind has exactly one named producer", () => {
    expect(Object.keys(PRODUCERS).sort()).toEqual([...CAPSULE_RESIDUE_KINDS].sort());
  });

  test("no residue is fabricated for a missing PM-notes file", () => {
    const plan = buildCloseoutPlan(makeFacts());
    expect(plan.residue ?? []).toEqual([]);
  });

  test("the review-artifact producer is named in the closeout domain", () => {
    const source = readFileSync("packages/core/src/domain/closeout.ts", "utf8");
    expect(source.includes("review-verdict-unreadable")).toBe(true);
  });
});
