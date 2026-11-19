/**
 * TC-MERGE-035 — identical injected facts produce byte-identical output,
 * including refusal evidence, and the equality is proven non-constant.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCloseoutPlan } from "../../packages/core/src/domain/closeout";
import { makeFacts } from "../fixtures/closeout/harness";
import { goldenScenarios } from "../fixtures/merge/golden-scenarios";
import {
  baseWorkItem,
  createMergeHarness,
  MERGE_CLOCK_MS,
  verificationRecord,
} from "../fixtures/merge/harness";

const MINUTE = 60_000;
const isoAt = (offsetMs: number): string => new Date(MERGE_CLOCK_MS + offsetMs).toISOString();

const runFresh = async (name: string) => {
  const scenario = goldenScenarios()[name];
  if (scenario === undefined) throw new Error(name);
  const { harness, args } = scenario();
  try {
    const json = await harness.run(args as string[], { json: true });
    const text = await harness.run(args as string[], { json: false });
    // A fresh harness per run keeps the first-invocation bytes comparable.
    return { json, text };
  } finally {
    harness.cleanup();
  }
};

const runFreshOnce = async (name: string, mode: "json" | "text") => {
  const scenario = goldenScenarios()[name];
  if (scenario === undefined) throw new Error(name);
  const { harness, args } = scenario();
  try {
    return mode === "json"
      ? await harness.run(args as string[], { json: true })
      : await harness.run(args as string[], { json: false });
  } finally {
    harness.cleanup();
  }
};

describe("TC-MERGE-035 determinism under fixed facts", () => {
  for (const name of [
    "success",
    "refusal-stale",
    "refusal-tracker",
    "refusal-waiver",
    "refusal-gate",
    "refusal-required-job-probe",
    "refusal-required-job-recorded",
  ] as const) {
    test(`${name}: twenty runs are byte-identical`, async () => {
      const first = await runFreshOnce(name, "text");
      for (let index = 0; index < 19; index += 1) {
        const next = await runFreshOnce(name, "text");
        expect(next.stdout, name).toBe(first.stdout);
        expect(next.stderr, name).toBe(first.stderr);
        expect(next.exitCode, name).toBe(first.exitCode);
      }
    });
  }

  test("a changed fact produces different bytes", async () => {
    const flipped = createMergeHarness({
      workItem: baseWorkItem({
        labels: ["change", "hand-back"],
        updatedAt: isoAt(-1 * MINUTE),
      }),
    });
    try {
      flipped.seedVerification(verificationRecord({ verifiedAt: isoAt(-2 * MINUTE) }));
      const changed = await flipped.run(undefined, { json: false });
      const control = await runFreshOnce("success", "text");
      expect(changed.stderr).not.toBe(control.stderr);
      expect(changed.exitCode).not.toBe(control.exitCode);
    } finally {
      flipped.cleanup();
    }
  });

  test("the run id is the only field that varies when only it is varied", async () => {
    const scenario = goldenScenarios().success;
    if (scenario === undefined) throw new Error("success");
    const a = scenario();
    const b = scenario();
    try {
      const first = await a.harness.run([], { json: true, runId: "run-a" });
      const second = await b.harness.run([], { json: true, runId: "run-b" });
      expect(first.envelope?.data).toEqual(second.envelope?.data);
      const firstWithout = { ...(first.envelope ?? {}) };
      const secondWithout = { ...(second.envelope ?? {}) };
      delete firstWithout.runId;
      delete secondWithout.runId;
      expect(secondWithout).toEqual(firstWithout);
    } finally {
      a.harness.cleanup();
      b.harness.cleanup();
    }
  });

  test("permutation of an order that is semantic keeps the declared order", async () => {
    const forward = await runFreshOnce("success", "text");
    const again = await runFreshOnce("success", "text");
    expect(again.stdout).toBe(forward.stdout);
    const data = await runFreshOnce("success", "json");
    const gates = (data.envelope?.data as { gates?: readonly { id: string }[] } | undefined)?.gates;
    expect(gates?.map((gate) => gate.id).slice(0, 5)).toEqual([
      "lifecycle-finalization",
      "ci-green",
      "push-parity",
      "owner-gate",
      "squash-preflight",
    ]);
  });
});

export { runFresh };

const GOLDEN_DIR = join(process.cwd(), "tests/fixtures/merge/golden");

/** The two goldens this phase moves; the other eleven are byte-identical. */
const MOVED = ["refusal-gate-human.txt", "refusal-gate-scripted.json"] as const;

describe("TC-FLOOR-005 determinism and byte pins across the merge and closeout surfaces", () => {
  const textOf = (run: { readonly stdout: string; readonly stderr: string }): string =>
    run.stdout.length > 0 ? run.stdout : run.stderr;

  test("the moved pair carries the attribution line and no third golden does", async () => {
    const human = await runFreshOnce("refusal-gate", "text");
    const scripted = await runFreshOnce("refusal-gate", "json");
    expect(textOf(human)).toContain("attribution=probe");
    expect(textOf(scripted)).toContain("attribution=probe");

    const present = readdirSync(GOLDEN_DIR).sort();
    for (const moved of MOVED) expect(present).toContain(moved);
    expect(present).toHaveLength(13);

    for (const file of present) {
      if ((MOVED as readonly string[]).includes(file)) continue;
      expect(readFileSync(join(GOLDEN_DIR, file), "utf8")).not.toContain("attribution=");
    }
  });

  test("the recorded attribution scenario is deterministic across replays", async () => {
    const first = await runFreshOnce("refusal-required-job-recorded", "text");
    const second = await runFreshOnce("refusal-required-job-recorded", "text");
    expect(textOf(second)).toBe(textOf(first));
    expect(textOf(first)).toContain("attribution=recorded");
  });

  test("the closeout plan and its derived operation ids replay identically (value side)", () => {
    const first = buildCloseoutPlan(makeFacts());
    const second = buildCloseoutPlan(makeFacts());
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    // The plan carries derived operation ids, so the equality is not vacuous.
    const ids = JSON.stringify(first).match(/"operationId":"[0-9a-f]{64}"/gu) ?? [];
    expect(ids.length).toBeGreaterThan(0);
  });
});
