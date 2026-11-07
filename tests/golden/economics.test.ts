/**
 * TC-ECON-033 (golden half) and TC-ECON-080 — canonical economics views and
 * refusal decisions are committed goldens. Normalization is narrow (run id,
 * timestamps, temp roots only); regeneration is explicit and reviewed:
 *
 *   ECONOMICS_UPDATE_GOLDENS=1 bun test tests/golden/economics.test.ts
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT } from "./helpers";
import {
  createEconomicsRuntime,
  runtimeEvidence,
  seedRestarts,
  type EconomicsRuntime,
} from "../fixtures/economics/harness";

const GOLDEN_ROOT = join(ROOT, "tests/fixtures/economics/golden");
const UPDATE = process.env.ECONOMICS_UPDATE_GOLDENS === "1";

const runtimes: EconomicsRuntime[] = [];
afterEach(() => {
  for (const created of runtimes.splice(0)) created.close();
});

const runtime = (label: string): EconomicsRuntime => {
  const created = createEconomicsRuntime({ bound: 3, label });
  runtimes.push(created);
  return created;
};

const input = () => ({
  workItemRef: "GH-235",
  reason: "session-interrupted" as const,
  evidence: runtimeEvidence(),
});

const normalize = (value: unknown): unknown =>
  JSON.parse(JSON.stringify(value).split("run-golden").join("<run-id>"));

const readGolden = (name: string, rendered: string): void => {
  const path = join(GOLDEN_ROOT, name);
  if (UPDATE) {
    mkdirSync(GOLDEN_ROOT, { recursive: true });
    writeFileSync(path, `${rendered}\n`);
    return;
  }
  expect(`${rendered}\n`).toBe(readFileSync(path, "utf8"));
};

describe("TC-ECON-033/080 canonical economics goldens", () => {
  test("the three-restart view matches its committed golden and is read-only", () => {
    const created = runtime("golden-view");
    seedRestarts(created.store, 3);
    const path = join(GOLDEN_ROOT, "view-three.json");
    const before = UPDATE ? 0 : statSync(path).mtimeMs;
    const rendered = JSON.stringify(normalize(created.view("GH-235")), null, 2);
    readGolden("view-three.json", rendered);
    if (!UPDATE) {
      expect(statSync(path).mtimeMs).toBe(before);
      expect(rendered).toContain('"ordinal": 3');
      expect(rendered).toContain('"reason": "session-interrupted"');
      expect(rendered).toContain('"resumeAmplification": 0.75');
    }
  });

  test("the terminal view matches its committed golden and carries the reason", () => {
    const created = runtime("golden-terminal");
    seedRestarts(created.store, 3);
    created.supervised.attempt(input());
    const rendered = JSON.stringify(normalize(created.view("GH-235")), null, 2);
    readGolden("view-terminal.json", rendered);
    if (!UPDATE) {
      expect(rendered).toContain('"terminal": true');
      expect(rendered).toContain('"reason": "dispatch.restart-budget-exceeded"');
      expect(rendered).toContain('"historyRef": "economics/GH-235"');
    }
  });

  test("the past-budget refusal decision matches its committed golden", () => {
    const created = runtime("golden-budget");
    seedRestarts(created.store, 3);
    const decision = created.supervised.attempt(input());
    const rendered = JSON.stringify(normalize(decision), null, 2);
    readGolden("decision-past-budget.json", rendered);
    if (!UPDATE) {
      expect(rendered).toContain('"code": "dispatch.restart-budget-exceeded"');
      expect(rendered).toContain("reason=dispatch.restart-budget-exceeded");
      expect(rendered).toContain("historyRef=economics/GH-235");
    }
  });

  test("the uneconomical refusal decision matches its committed golden", () => {
    const created = runtime("golden-uneconomical");
    seedRestarts(created.store, 1);
    const decision = created.supervised.attempt({
      ...input(),
      evidence: runtimeEvidence({
        repayTokens: { inputTokens: 900, outputTokens: 0 },
        observedUniqueProgressTokens: 100,
      }),
    });
    const rendered = JSON.stringify(normalize(decision), null, 2);
    readGolden("decision-uneconomical.json", rendered);
    if (!UPDATE) {
      expect(rendered).toContain('"code": "dispatch.resume-uneconomical"');
      expect(rendered).toContain("repayTokens=900");
      expect(rendered).toContain("economicsRef=economics/GH-235");
    }
  });

  test("no golden file was rewritten by a read-only run", () => {
    if (UPDATE) return;
    const names = [
      "view-three.json",
      "view-terminal.json",
      "decision-past-budget.json",
      "decision-uneconomical.json",
    ];
    for (const name of names) {
      expect(statSync(join(GOLDEN_ROOT, name)).isFile()).toBe(true);
    }
  });
});
