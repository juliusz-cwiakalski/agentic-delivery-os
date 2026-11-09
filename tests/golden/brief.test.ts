/**
 * TC-BRIEF-014 / TC-BRIEF-015 — byte-exact human and machine goldens at the
 * cap-sized fixture, golden immutability, bounds, and content discipline.
 *
 * Regenerate explicitly (never from a suite):
 *   bun run tests/fixtures/brief/golden/regenerate.ts
 */
import { describe, expect, test } from "bun:test";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import {
  briefRuntime,
  capSizedFacts,
  makeWorkItem,
  reservedSlotFacts,
  runBriefCli,
  workItemRead,
} from "../fixtures/brief/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const ROOT = process.cwd();
const GOLDEN = "tests/fixtures/brief/golden";
const humanPath = join(ROOT, GOLDEN, "human.txt");
const envelopePath = join(ROOT, GOLDEN, "envelope.json");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

describe("TC-BRIEF-014 golden human bytes", () => {
  test("the cap-sized human screen equals the committed golden bytes", async () => {
    const run = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(humanPath, "utf8"));
  });

  test("the golden is within bounds and names every surface and placeholder", () => {
    const human = readFileSync(humanPath, "utf8");
    const lines = human.split("\n").filter((line) => line.length > 0);
    expect(lines.length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(human, "utf8")).toBeLessThanOrEqual(4096);
    for (const label of [
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
    ]) {
      expect(human, label).toContain(label);
    }
    expect(human).toContain(SYNTHETIC_BRAND.binaryName);
  });

  test("the golden carries no timestamp, run id, payload fragment, or product literal", () => {
    const human = readFileSync(humanPath, "utf8");
    expect(human).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    expect(human).not.toContain("run-brief-fixture");
    expect(human).not.toContain("schemaVersion");
    expect(human).not.toContain("{");
    expect(human).not.toContain("}");
    for (const seed of ["a" + "dos", "A" + "DOS_", "~/" + "." + "ad" + "os"]) {
      expect(human.includes(seed)).toBe(false);
    }
  });

  test("a one-fact mutation changes the bytes; restore reproduces them", async () => {
    const facts = capSizedFacts();
    const mutated = {
      ...facts,
      tracker: workItemRead([
        makeWorkItem({
          entityId: "GH-999",
          title: "Mutated hand-back",
          labels: ["hand-back"],
          updatedAt: "2026-10-30T00:00:00Z",
        }),
      ]),
    };
    const changed = await runBriefCli(["brief"], briefRuntime(mutated));
    expect(changed.stdout).not.toBe(readFileSync(humanPath, "utf8"));
    const restored = await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
    expect(restored.stdout).toBe(readFileSync(humanPath, "utf8"));
  });

  test("the goldens are never rewritten by the suite", async () => {
    const beforeHuman = statSync(humanPath).mtimeMs;
    const beforeEnvelope = statSync(envelopePath).mtimeMs;
    await runBriefCli(["brief"], briefRuntime(capSizedFacts()));
    await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    expect(statSync(humanPath).mtimeMs).toBe(beforeHuman);
    expect(statSync(envelopePath).mtimeMs).toBe(beforeEnvelope);
  });
});

describe("TC-BRIEF-015 golden machine envelope", () => {
  test("the machine envelope equals the committed golden bytes", async () => {
    const run = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(envelopePath, "utf8"));
  });

  test("the envelope is contract-valid, bounded, and carries the full payload", () => {
    const envelope = JSON.parse(readFileSync(envelopePath, "utf8")) as unknown;
    expect(assertEnvelopeContract(envelope)).toEqual([]);
    if (!isRecord(envelope)) throw new Error("envelope is not an object");
    expect(envelope).not.toHaveProperty("error");
    expect(envelope.exitCode).toBe(0);
    const data = envelope.data;
    if (!isRecord(data)) throw new Error("data missing");
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(65536);
    expect(data.schemaVersion).toBe("delivery.brief.v1");
    expect(data.generatedAt).toBe("2026-10-31T00:00:00Z");
    expect(Array.isArray(data.surfaces) && data.surfaces.length).toBe(9);
    expect(Array.isArray(data.placeholders) && data.placeholders.length).toBe(2);
    expect(Array.isArray(data.truncation) && data.truncation.length).toBeGreaterThan(0);
  });

  test("a one-fact mutation changes the machine bytes; restore reproduces them", async () => {
    const facts = capSizedFacts();
    const mutated = {
      ...facts,
      localContext: facts.localContext.ok
        ? {
            ...facts.localContext,
            context: { ...facts.localContext.context, parkedChanges: [] },
          }
        : facts.localContext,
    };
    const changed = await runBriefCli(["--json", "brief"], briefRuntime(mutated));
    expect(changed.stdout).not.toBe(readFileSync(envelopePath, "utf8"));
    const restored = await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts()));
    expect(restored.stdout).toBe(readFileSync(envelopePath, "utf8"));
  });
});

/**
 * TC-COORD-064 (golden half, GH-241): the brief reserved-slot golden mirrors the
 * digest; the control golden above is unchanged.
 */
describe("TC-COORD-064 reserved-slot brief golden", () => {
  const reservedHuman = join(ROOT, GOLDEN, "reserved-human.txt");
  const reservedEnvelope = join(ROOT, GOLDEN, "reserved-envelope.json");

  test("the reserved-slot human bytes equal the committed golden", async () => {
    const run = await runBriefCli(["brief"], briefRuntime(reservedSlotFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(reservedHuman, "utf8"));
  });

  test("the reserved-slot envelope equals the committed golden", async () => {
    const run = await runBriefCli(["--json", "brief"], briefRuntime(reservedSlotFacts()));
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(readFileSync(reservedEnvelope, "utf8"));
    assertEnvelopeContract(JSON.parse(run.stdout));
  });

  test("the control brief golden is untouched by the slot addition", () => {
    expect(readFileSync(humanPath, "utf8")).not.toContain("q-escalation");
  });
});
