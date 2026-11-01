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
