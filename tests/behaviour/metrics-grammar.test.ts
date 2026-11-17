/**
 * TC-METRICS-003/004 — the window and invocation grammar is refused before any
 * read, every refusal is attributable to its rule (accepting twins included),
 * and the family declares exactly one report invocation with no verbs.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { fullBaseline } from "../fixtures/metrics/baseline";
import { burnRateConfig } from "../fixtures/metrics/config";
import {
  METRICS_REF,
  type MetricsFixture,
  makeMetricsFixture,
  runMetrics,
} from "../fixtures/metrics/harness";

const fixtures: MetricsFixture[] = [];
const context = (): MetricsFixture => {
  const fixture = makeMetricsFixture({ label: "grammar", activeRef: METRICS_REF });
  fixture.setConfig(burnRateConfig());
  fixture.setBaseline(fullBaseline());
  fixtures.push(fixture);
  return fixture;
};

afterEach(() => {
  for (const fixture of fixtures.splice(0)) fixture.dispose();
});

const expectNoReads = (fixture: MetricsFixture): void => {
  expect(fixture.reads.storeReads).toEqual([]);
  expect(fixture.reads.documentReads).toEqual([]);
};

describe("TC-METRICS-003 the window grammar is refused before the read pass", () => {
  const cells: readonly (readonly [string, readonly string[]])[] = [
    ["lone --from", ["metrics", "--from", "2026-11-01T00:00:00Z", "--json"]],
    ["lone --through", ["metrics", "--through", "2026-11-02T00:00:00Z", "--json"]],
    ["non-ISO", ["metrics", "--from", "not-a-date", "--through", "2026-11-02T00:00:00Z", "--json"]],
    [
      "date-only",
      ["metrics", "--from", "2026-11-01", "--through", "2026-11-02T00:00:00Z", "--json"],
    ],
    [
      "dangling-zone",
      ["metrics", "--from", "2026-11-01T00:00:00+", "--through", "2026-11-02T00:00:00Z", "--json"],
    ],
    [
      "reversed",
      ["metrics", "--from", "2026-11-03T00:00:00Z", "--through", "2026-11-02T00:00:00Z", "--json"],
    ],
    ["empty value", ["metrics", "--from", "", "--through", "2026-11-02T00:00:00Z", "--json"]],
  ];

  for (const [label, argv] of cells) {
    test(`${label} is input.value.rejected at exit 1 with zero reads`, async () => {
      const fixture = context();
      const result = await runMetrics(fixture, argv);
      expect(result.exitCode).toBe(1);
      expect(result.envelope?.error?.code).toBe("input.value.rejected");
      expect(result.envelope?.error?.category).toBe("user");
      expect(result.envelope?.error?.consequence).toBe("not_landed");
      expect(result.envelope?.data).toBeUndefined();
      expectNoReads(fixture);
    });
  }

  test("the accepting twins answer at exit 0 with the expected window", async () => {
    const fixture = context();
    const zulu = await runMetrics(fixture, [
      "metrics",
      "--from",
      "2026-11-01T00:00:00Z",
      "--through",
      "2026-11-02T00:00:00Z",
      "--json",
    ]);
    expect(zulu.exitCode).toBe(0);
    expect(zulu.envelope?.data?.window).toEqual({
      from: "2026-11-01T00:00:00Z",
      through: "2026-11-02T00:00:00Z",
    });
    const offset = await runMetrics(fixture, [
      "metrics",
      "--from",
      "2026-11-01T01:00:00+01:00",
      "--through",
      "2026-11-02T00:00:00Z",
      "--json",
    ]);
    expect(offset.exitCode).toBe(0);
    const equal = await runMetrics(fixture, [
      "metrics",
      "--from",
      "2026-11-01T00:00:00Z",
      "--through",
      "2026-11-01T00:00:00Z",
      "--json",
    ]);
    expect(equal.exitCode).toBe(0);
  });
});

describe("TC-METRICS-004 ref resolution and grammar refusals", () => {
  test("a malformed ref, an unresolvable ref, and a missing value refuse before any read", async () => {
    for (const argv of [
      ["metrics", "--ref", "gh-299", "--json"],
      ["metrics", "--ref", "GH299", "--json"],
      ["metrics", "--ref", "GH_299", "--json"],
      ["metrics", "--ref", "--json"],
    ]) {
      const fixture = context();
      const result = await runMetrics(fixture, argv);
      expect(result.exitCode, argv.join(" ")).toBe(1);
      expect(result.envelope?.error?.code).toBe("input.value.rejected");
      expectNoReads(fixture);
    }
  });

  test("an unbound checkout is a classified value refusal", async () => {
    const fixture = makeMetricsFixture({ label: "unbound", activeRef: null });
    fixtures.push(fixture);
    fixture.setConfig(burnRateConfig());
    fixture.setBaseline(fullBaseline());
    const result = await runMetrics(fixture, ["metrics", "--json"]);
    expect(result.exitCode).toBe(1);
    expect(result.envelope?.error?.code).toBe("input.value.rejected");
    expectNoReads(fixture);
  });

  test("undeclared flags, positionals, and every declared verb are fallback.invocation", async () => {
    for (const argv of [
      ["metrics", "--verbose-metrics", "--json"],
      ["metrics", "GH-299", "--json"],
      ["metrics", "history", "--json"],
      ["metrics", "report", "--json"],
      ["metrics", "list", "--json"],
    ]) {
      const fixture = context();
      const result = await runMetrics(fixture, argv);
      expect(result.exitCode, argv.join(" ")).toBe(1);
      expect(result.envelope?.error?.code).toBe("fallback.invocation");
      expectNoReads(fixture);
    }
  });

  test("the emitted refusal code set is exactly the two delivered identities", async () => {
    const codes = new Set<string>();
    for (const argv of [
      ["metrics", "--ref", "gh-299", "--json"],
      ["metrics", "history", "--json"],
    ]) {
      const fixture = context();
      const result = await runMetrics(fixture, argv);
      const code = result.envelope?.error?.code;
      if (typeof code === "string") codes.add(code);
    }
    expect([...codes].sort()).toEqual(["fallback.invocation", "input.value.rejected"]);
  });
});
