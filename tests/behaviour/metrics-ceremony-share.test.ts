/**
 * TC-METRICS-023 — ceremony share is native through the delivered runner fold;
 * an empty window names `sample.n == 0` and reports no value.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { makeMetricsCase } from "../fixtures/metrics/case";
import {
  expectedCeremonyShare,
  inWindowCeremonies,
  outOfWindowCeremonies,
} from "../fixtures/metrics/ceremony";
import {
  drawnWindow,
  entriesById,
  type MetricsFixture,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const ceremonyEntry = async (fixture: MetricsFixture): Promise<Record<string, unknown>> => {
  fixtures.push(fixture);
  const run = await runMetrics(fixture, ["metrics", "--json"]);
  expect(run.exitCode).toBe(0);
  return entriesById(run.envelope?.data as Record<string, unknown>)["MET-CEREMONY-SHARE"] ?? {};
};

describe("TC-METRICS-023 ceremony share is native through the runner fold", () => {
  test("the value is the fixture run time over the window elapsed time", async () => {
    const fixture = makeMetricsCase({ label: "ceremony-share" });
    const runs = inWindowCeremonies(fixture.nowMs - 3_600_000);
    const entry = await ceremonyEntry(fixture);
    expect(entry.measurementKind).toBe("native");
    expect(entry.basis).toBe("ceremony-runner-fold");
    const window = drawnWindow(fixture.nowMs);
    const expected = expectedCeremonyShare(
      runs,
      Date.parse(window.from),
      Date.parse(window.through),
    );
    expect(Number(entry.value)).toBeCloseTo(expected, 12);
    expect((entry.sample as { n: number }).n).toBe(3);
    expect((entry.sample as { runs?: number }).runs).toBe(3);
    expect((entry.sample as { steps?: number }).steps).toBe(7);
  });

  test("the entry cites the committed definition and never restates the proxy figure", async () => {
    const entry = await ceremonyEntry(makeMetricsCase({ label: "ceremony-proxy" }));
    expect(entry.definitionRef).toMatchObject({
      logPath: "doc/planning/oss-tooling/measurement-baseline.yaml",
      sourceCommit: "75b4e7602ad89bd26f96912ac06ed8bfcb72a5ae",
    });
    expect(JSON.stringify(entry)).not.toContain("0.406648");
    expect(String(entry.limitation)).toContain("not interchangeable");
  });

  test("a window holding only out-of-window runs names sample.n == 0 and no value", async () => {
    const fixture = makeMetricsCase({
      label: "ceremony-outside",
      ceremony: outOfWindowCeremonies(),
    });
    const entry = await ceremonyEntry(fixture);
    expect(entry.status).toBe("UNAVAILABLE");
    expect(entry.value).toBeUndefined();
    expect((entry.sample as { n: number }).n).toBe(0);
    expect(String(entry.limitation)).toContain("sample.n is 0");
    expect(entry.excluded).toContainEqual({ reason: "outside_window", count: 1 });
  });

  test("an empty window is the same classified absence, never a zero share", async () => {
    const fixture = makeMetricsCase({ label: "ceremony-empty", ceremony: [] });
    const entry = await ceremonyEntry(fixture);
    expect(entry.status).toBe("UNAVAILABLE");
    expect((entry.sample as { n: number }).n).toBe(0);
    expect(entry.value).toBeUndefined();
  });
});
