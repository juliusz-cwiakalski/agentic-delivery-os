/**
 * TC-STATUS-031 — byte-for-byte golden digest and human text at a cap-sized
 * fixture with a fixed run id, clock, and synthetic brand.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  capSizedFacts,
  makeWorkItem,
  reservedSlotFacts,
  runStatusCli,
  statusRuntime,
  workItemRead,
} from "../fixtures/status/harness";

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/status/golden";
const digestPath = join(ROOT, GOLDEN, "digest.json");
const humanPath = join(ROOT, GOLDEN, "human.txt");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("TC-STATUS-031 golden full-digest snapshot", () => {
  test("the machine digest equals the committed golden bytes", async () => {
    const run = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(digestPath, "utf8"));
  });

  test("the human text equals the committed golden bytes", async () => {
    const run = await runStatusCli(["status"], statusRuntime(capSizedFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(humanPath, "utf8"));
  });

  test("the golden outputs are within the declared bounds", () => {
    const digest = JSON.parse(readFileSync(digestPath, "utf8")) as unknown;
    if (!isRecord(digest) || !isRecord(digest.data)) throw new Error("golden digest shape");
    expect(JSON.stringify(digest.data).length).toBeLessThanOrEqual(65536);
    expect(digest).not.toHaveProperty("error");
    if (!Array.isArray(digest.data.sections)) throw new Error("sections missing");
    expect(digest.data.sections).toHaveLength(9);
    const human = readFileSync(humanPath, "utf8");
    const lines = human.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(32);
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(6144);
    for (const label of [
      "tracker",
      "changes",
      "ci",
      "lanes",
      "providers",
      "parked",
      "ready",
      "spend",
      "questions",
      "attention",
    ]) {
      expect(lines.some((line) => line.startsWith(label))).toBe(true);
    }
  });

  test("changing one fact breaks the golden comparison (live control)", async () => {
    const mutatedFacts = capSizedFacts();
    const mutated = {
      ...mutatedFacts,
      tracker: workItemRead([
        makeWorkItem({ entityId: "GH-999", title: "Mutated", labels: ["hand-back"] }),
      ]),
    };
    const run = await runStatusCli(["--json", "status"], statusRuntime(mutated));
    expect(run.stdout).not.toBe(readFileSync(digestPath, "utf8"));
    const restored = await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
    expect(restored.stdout).toBe(readFileSync(digestPath, "utf8"));
  });

  test("the golden files are not rewritten by the suite", async () => {
    const beforeDigest = statSync(digestPath).mtimeMs;
    const beforeHuman = statSync(humanPath).mtimeMs;
    await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts()));
    await runStatusCli(["status"], statusRuntime(capSizedFacts()));
    expect(statSync(digestPath).mtimeMs).toBe(beforeDigest);
    expect(statSync(humanPath).mtimeMs).toBe(beforeHuman);
  });
});

/**
 * TC-COORD-063 (golden half, GH-241): the reserved escalation slot golden is the
 * only permitted digest diff; the control golden above is unchanged.
 */
describe("TC-COORD-063 reserved-slot digest golden", () => {
  const reservedDigest = join(ROOT, GOLDEN, "reserved-digest.json");
  const reservedHuman = join(ROOT, GOLDEN, "reserved-human.txt");

  test("the reserved-slot machine digest equals its committed bytes", async () => {
    const run = await runStatusCli(["--json", "status"], statusRuntime(reservedSlotFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(reservedDigest, "utf8"));
  });

  test("the reserved-slot human text equals its committed bytes", async () => {
    const run = await runStatusCli(["status"], statusRuntime(reservedSlotFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(reservedHuman, "utf8"));
  });

  test("the reserved question is index 0 and one question is omitted", () => {
    const digest = JSON.parse(readFileSync(reservedDigest, "utf8")) as {
      data: { sections: { id: string; questions?: { id: string }[]; counts: { omitted: number } }[] };
    };
    const section = digest.data.sections.find((entry) => entry.id === "typed-questions");
    expect(section?.questions?.[0]?.id).toBe("q-escalation");
    expect(section?.counts.omitted).toBe(1);
  });

  test("the control golden is untouched by the slot addition", () => {
    const control = readFileSync(digestPath, "utf8");
    expect(control).not.toContain("q-escalation");
    expect(control).not.toContain("coordinator-main#epoch-1");
  });
});
