/**
 * TC-SLA-024 structure half — the audience seam is typed, the evaluator is
 * owner-agnostic, and no M1-S16 behaviour is pre-built.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { OWNER_GATE_SLA_AUDIENCES } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const ENGINE = "packages/core/src/domain/owner-gate-sla.ts";

const source = (): string => readFileSync(join(ROOT, ENGINE), "utf8");

const labelViolations = (text: string): string[] => {
  const violations: string[] = [];
  for (const literal of ["hand-back", "human-input-needed"]) {
    if (text.includes(`"${literal}"`) || text.includes(`'${literal}'`)) {
      violations.push(`owner-attention label literal ${literal}`);
    }
  }
  for (const forbidden of [
    "commands/board",
    "routing",
    "blocker-channel",
    "blockerChannel",
    "coordinator-channel",
  ]) {
    if (text.includes(forbidden)) violations.push(`surface or M1-S16 marker ${forbidden}`);
  }
  return violations;
};

describe("TC-SLA-024 audience seam", () => {
  test("the audience vocabulary is exactly owner and coordinator", () => {
    expect([...OWNER_GATE_SLA_AUDIENCES]).toEqual(["owner", "coordinator"]);
  });

  test("the evaluator carries no owner-specific label, surface, routing, or M1-S16 code", () => {
    expect(labelViolations(source())).toEqual([]);
  });

  test("a temp evaluator copy with a hard-coded owner label fails the detector", () => {
    const root = mkdtempSync(join(tmpdir(), "audience-probe-"));
    try {
      const target = join(root, "engine.ts");
      writeFileSync(target, `${source()}\nconst ownerLabel = "hand-back";\n`);
      expect(labelViolations(readFileSync(target, "utf8"))).toContain(
        "owner-attention label literal hand-back",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
