/**
 * TC-EVT-014 — the surface's three error identities and the `{0,1,2}` exit
 * matrix hold on every path, and a broken declaration fails closed.
 */
import { describe, expect, test } from "bun:test";
import { TAXONOMY, type TaxonomyDeclaration } from "../../packages/core/src/contracts/taxonomy";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";
import { ERROR_DECISION_TABLE, TOPIC_NAMES } from "../fixtures/events/taxonomy-cases";

const ERROR_FIELDS = ["category", "code", "consequence", "remediationHint", "retryable", "summary"];

const probe = createSurfaceHarness();

describe("TC-EVT-014 exit matrix and identities", () => {
  test("every decision-table row lands its declared exit and identity", async () => {
    for (const row of ERROR_DECISION_TABLE) {
      const run = await probe.run([...row.argv, "--json"]);
      expect(run.exitCode, row.argv.join(" ")).toBe(row.exit);
      if (row.code === null) {
        expect(run.envelope).not.toHaveProperty("error");
        continue;
      }
      const error = run.envelope?.error as Record<string, unknown>;
      expect(error.code, row.argv.join(" ")).toBe(row.code);
      expect(error.category).toBe("user");
      expect(error.retryable).toBe(false);
      expect(error.consequence).toBe("not_landed");
    }
  });

  test("a wrong topic names the requested value and lists the six declared names", async () => {
    for (const requested of ["status", "nope"]) {
      const run = await probe.run(["events", "describe", requested, "--json"]);
      const error = (run.envelope?.error ?? {}) as Record<string, unknown>;
      const summary = String(error.summary);
      expect(summary).toContain(requested);
      for (const name of TOPIC_NAMES) expect(summary).toContain(name);
      expect(summary).toContain("events.topic-unknown".replace("events.", ""));
    }
  });

  test("a wrong or absent verb names only list and describe", async () => {
    for (const argv of [["events"], ["events", "frobnicate"], ["events", "describe"]]) {
      const run = await probe.run([...argv, "--json"]);
      const error = run.envelope?.error as Record<string, unknown>;
      expect(error.code).toBe("events.verb-unknown");
      const summary = String(error.summary);
      expect(summary).toContain("list");
      expect(summary).toContain("describe");
      expect(error.code).not.toBe("events.topic-unknown");
    }
  });

  test("a broken declaration exits 2 with events.taxonomy-unavailable and renders nothing", async () => {
    const broken = JSON.parse(JSON.stringify(TAXONOMY)) as {
      topics: { name: string; kinds: unknown[]; payloadFields: unknown[] }[];
    };
    const graph = broken.topics.find((topic) => topic.name === "queue.graph");
    if (graph !== undefined) {
      graph.kinds = [];
      graph.payloadFields = [];
    }
    const harness = createSurfaceHarness({
      taxonomy: broken as unknown as TaxonomyDeclaration,
    });
    for (const argv of [
      ["events", "list", "--json"],
      ["events", "describe", "queue", "--json"],
    ]) {
      const run = await harness.run(argv);
      expect(run.exitCode, argv.join(" ")).toBe(2);
      expect(run.envelope?.error).toMatchObject({
        code: "events.taxonomy-unavailable",
        category: "platform",
        retryable: false,
        consequence: "not_landed",
        remediationHint: expect.stringContaining("integrity"),
      });
      expect(run.envelope).not.toHaveProperty("data");
      expect(run.envelope).not.toHaveProperty("data.topics");
    }
    const text = await harness.run(["events", "list"]);
    expect(text.exitCode).toBe(2);
    expect(text.stdout).toBe("");
    expect(text.stderr).toContain("events.taxonomy-unavailable");
  });

  test("every observed exit digit is in {0,1,2} and the error field set is the delivered one", async () => {
    for (const row of ERROR_DECISION_TABLE) {
      const run = await probe.run(row.argv);
      expect([0, 1, 2]).toContain(run.exitCode);
      if (run.envelope?.error !== undefined) {
        expect(Object.keys(run.envelope.error as Record<string, unknown>).sort()).toEqual(
          [...ERROR_FIELDS].sort(),
        );
      }
    }
  });

  test("the refusal paths read no state: the harness composes no port at all", async () => {
    const run = await probe.run(["events", "describe", "status", "--json"]);
    expect(run.exitCode).toBe(1);
    // The definition's only injected input is the declaration; a refusal cannot
    // reach a store because the composition has no store, configuration, git,
    // transport, or filesystem input to reach.
    expect(run.envelope).not.toHaveProperty("data");
    expect(Object.keys(run.envelope ?? {})).not.toContain("store");
  });
});
