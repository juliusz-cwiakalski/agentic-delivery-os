/** TC-CLOSE-060 — the human digest is byte-identical and bounded. */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLOSEOUT_MAX_HUMAN_BYTES,
  CLOSEOUT_MAX_HUMAN_LINES,
} from "../../packages/core/src/contracts/index";
import { buildCloseoutPlan, renderCloseoutHuman } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";

const ROOT = process.cwd();
const GOLDEN = readFileSync(join(ROOT, "tests/fixtures/closeout/golden/human.txt"), "utf8");

const data = () => {
  const plan = buildCloseoutPlan(makeFacts());
  return {
    schemaId: "delivery.closeout.v1" as const,
    command: "closeout" as const,
    workItemRef: plan.workItemRef,
    mode: "plan" as const,
    baseRef: plan.baseRef,
    ...(plan.deliveryRequest === undefined ? {} : { deliveryRequest: plan.deliveryRequest }),
    steps: plan.steps,
    summary: plan.summary,
    ledgerKey: "closeout.operations:GH-183",
  };
};

describe("TC-CLOSE-060 human golden", () => {
  test("the rendered digest is byte-identical to the committed golden", () => {
    expect(renderCloseoutHuman(data())).toBe(GOLDEN);
  });

  test("the digest is bounded and deterministic", () => {
    const first = renderCloseoutHuman(data());
    expect(renderCloseoutHuman(data())).toBe(first);
    expect(first.split("\n").length).toBeLessThanOrEqual(CLOSEOUT_MAX_HUMAN_LINES + 1);
    expect(first.length).toBeLessThanOrEqual(CLOSEOUT_MAX_HUMAN_BYTES);
  });
});

describe("TC-CAP-052 human residue rendering", () => {
  test("the digest renders a deterministic bounded residue list and capsule summary", () => {
    const base = data();
    const withResidue = {
      ...base,
      residue: [
        {
          item: "PRRT_2 by @reviewer-bob",
          kind: "unresolved-human-thread" as const,
          location: "thread:PRRT_2",
        },
        {
          item: "ambiguous todo-marker hit",
          kind: "ambiguous-flip-hit" as const,
          location: "src/file.ts:12",
        },
        { item: "+1 more items", kind: "capsule-cap-reached" as const, location: "residue" },
      ],
      capsule: {
        closed: true,
        events: 6,
        candidates: [{ id: "candidate-one", decision: "promoted" as const, home: "lessons/x.md" }],
      },
    };
    const text = renderCloseoutHuman(withResidue);
    expect(text).toContain("\nJUDGMENT RESIDUE\n");
    expect(text).toContain("- unresolved-human-thread PRRT_2 by @reviewer-bob (thread:PRRT_2)");
    expect(text).toContain("- ambiguous-flip-hit ambiguous todo-marker hit (src/file.ts:12)");
    expect(text).toContain("- capsule-cap-reached +1 more items (residue)");
    expect(text).toContain("capsule: closed=true events=6 candidates=1");
    expect(text.indexOf("unresolved-human-thread")).toBeLessThan(
      text.indexOf("ambiguous-flip-hit"),
    );
    expect(text.split("\n").length).toBeLessThanOrEqual(CLOSEOUT_MAX_HUMAN_LINES + 1);
    expect(text.length).toBeLessThanOrEqual(CLOSEOUT_MAX_HUMAN_BYTES);
    expect(renderCloseoutHuman(withResidue)).toBe(text);
  });
});
