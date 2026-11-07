/**
 * TC-SPEND-027 — digest section 8 becomes a real `observed` section with the
 * spend evidence, and the retired placeholder renders nowhere.
 */
import { describe, expect, test } from "bun:test";
import { STATUS_SECTION_DERIVATION } from "../../packages/core/src/contracts/index";
import { aggregateStatus, renderStatusHuman } from "../../packages/core/src/domain/index";
import { baseFacts, capturedSpend, runStatusCli, statusRuntime } from "../fixtures/status/harness";
import { SYNTHETIC_BRAND } from "../golden/helpers";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sectionOf = (facts = baseFacts({ spend: capturedSpend() })) => {
  const digest = aggregateStatus(facts);
  const section = digest.sections[7];
  if (section === undefined) throw new Error("section 8 missing");
  return { digest, section };
};

describe("TC-SPEND-027 digest section 8 is observed", () => {
  test("section 8 is the spend collector in the observed state", () => {
    const { section } = sectionOf();
    expect(section.id).toBe("spend");
    expect(section.kind).toBeUndefined();
    expect(section.state).toBe("observed");
    expect(section.evidence.sources).toEqual([{ source: "state-log", outcome: "read" }]);
    expect(section.evidence.reasons).toEqual(["observed"]);
    expect(section.spend).toMatchObject({
      state: "observed",
      captured: true,
      restarts: 1,
      ratio: 2,
    });
    if (section.spend?.state !== "observed" || !section.spend.captured) {
      throw new Error("spend projection missing");
    }
    expect(section.spend.tokensByClass).toEqual({
      input: 1000,
      output: 400,
      reasoning: 50,
      cacheRead: 20,
      cacheWrite: 10,
    });
  });

  test("the placeholder line and its note/capability/expectedStory fields are gone", () => {
    const { digest, section } = sectionOf();
    expect(section.capability).toBeUndefined();
    expect(section.expectedStory).toBeUndefined();
    expect(section.note).toBeUndefined();
    const human = renderStatusHuman(digest, SYNTHETIC_BRAND);
    expect(human).not.toContain("spend summary arrives with M1-S19");
    expect(JSON.stringify(digest)).not.toContain("spend summary arrives with M1-S19");
    expect(JSON.stringify(digest)).not.toContain("spend-summary");
  });

  test("the derivation row admits only observed and unknown", () => {
    expect(STATUS_SECTION_DERIVATION.spend).toEqual(["observed", "unknown"]);
    expect(STATUS_SECTION_DERIVATION.spend).not.toContain("not-delivered");
  });

  test("the status command renders the spend section with the same figures", async () => {
    const facts = baseFacts({
      spend: capturedSpend({ input: 1120, output: 20, restarts: 3, ratio: 9.333 }),
    });
    const run = await runStatusCli(["--json", "status"], statusRuntime(facts));
    expect(run.exitCode).toBe(0);
    const envelope = JSON.parse(run.stdout) as unknown;
    if (!isRecord(envelope) || !isRecord(envelope.data)) throw new Error("envelope shape");
    const sections = envelope.data.sections;
    if (!Array.isArray(sections)) throw new Error("sections missing");
    const spend = sections[7];
    if (!isRecord(spend)) throw new Error("spend section missing");
    expect(spend.state).toBe("observed");
    const projection = spend.spend;
    if (!isRecord(projection) || !isRecord(projection.tokensByClass)) {
      throw new Error("spend projection missing");
    }
    expect(projection.tokensByClass.input).toBe(1120);
    expect(projection.restarts).toBe(3);
    expect(projection.ratio).toBe(9.333);
  });

  test("the human spend line carries the observed figures within bounds", () => {
    const human = renderStatusHuman(
      aggregateStatus(baseFacts({ spend: capturedSpend({ input: 7, ratio: 1 }) })),
      SYNTHETIC_BRAND,
    );
    expect(human).toContain(
      "spend      observed  input 7 | output 400 | reasoning 50 | cacheRead 20 | cacheWrite 10 | restarts 1 | amplification 1",
    );
    expect(human.split("\n").filter((line) => line !== "").length).toBeLessThanOrEqual(32);
  });
});
