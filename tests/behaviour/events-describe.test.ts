/**
 * TC-EVT-012, TC-EVT-013, TC-EVT-016, TC-EVT-051 — one topic's reference page,
 * the verb-independent machine record, the per-kind payload detail, and the
 * snapshot-topic declaration.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EVENT_ENVELOPE_FIELDS } from "../../packages/core/src/contracts/taxonomy";
import { createSurfaceHarness } from "../fixtures/events/surface-harness";
import { CONTRACT_PAYLOAD_FIELDS, TOPIC_NAMES } from "../fixtures/events/taxonomy-cases";

const ROOT = process.cwd();
const goldenBody = (name: string): string => {
  const text = readFileSync(join(ROOT, "tests/fixtures/events/goldens", name), "utf8");
  const marker = "--- output ---\n";
  const index = text.indexOf(marker);
  return index < 0 ? text : text.slice(index + marker.length);
};

const probe = createSurfaceHarness();

describe("TC-EVT-012 describe queue.graph text", () => {
  test("renders the committed golden byte-for-byte", async () => {
    const run = await probe.run(["events", "describe", "queue.graph"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(goldenBody("events-describe-queue-graph.txt"));
  });

  test("names the topic, shape=event, and parent=queue", async () => {
    const run = await probe.run(["events", "describe", "queue.graph"]);
    expect(run.stdout).toContain("topic=queue.graph");
    expect(run.stdout).toContain("shape=event");
    expect(run.stdout).toContain("parent=queue");
  });

  test("renders each kind with its emitted state; remove alone is not emitted", async () => {
    const run = await probe.run(["events", "describe", "queue.graph"]);
    for (const kind of ["entry", "dependency-edge", "release", "remove"]) {
      expect(run.stdout).toContain(kind);
    }
    const notEmitted = run.stdout
      .split("\n")
      .filter((line) => line.includes("not emitted (declared; no v1 producer)"));
    expect(notEmitted).toHaveLength(1);
    expect(notEmitted[0]).toContain("remove");
  });

  test("renders every per-kind payload list verbatim, with no park or truncation field", async () => {
    const run = await probe.run(["events", "describe", "queue.graph"]);
    for (const [kind, fields] of Object.entries(
      CONTRACT_PAYLOAD_FIELDS["queue.graph"] as Record<string, string[]>,
    )) {
      expect(run.stdout).toContain(`${kind}  `);
      expect(run.stdout).toContain(`payload=${fields.join(",")}`);
    }
    expect(run.stdout).toContain("repository?,priority");
    expect(run.stdout).not.toContain("parkCause");
    expect(run.stdout).not.toContain("truncated");
    expect(run.stdout).not.toContain("truncationReason");
  });

  test("names lane, ordering, overflow, and the eight-field frame", async () => {
    const run = await probe.run(["events", "describe", "queue.graph"]);
    expect(run.stdout).toContain("lane=ref");
    expect(run.stdout).toContain("ordering=sequence-per-lane");
    expect(run.stdout).toContain("ordered per lane");
    expect(run.stdout).toContain("overflow=repoll");
    expect(run.stdout).toContain(`frame=${EVENT_ENVELOPE_FIELDS.join(",")}`);
  });

  test("stays inside the human bounds with no ANSI escape", async () => {
    const run = await probe.run(["events", "describe", "queue.graph"]);
    expect(run.stdout).not.toContain("\u001b[");
    expect(run.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(40);
    expect(new TextEncoder().encode(run.stdout).length).toBeLessThanOrEqual(8_192);
  });
});

describe("TC-EVT-051 describe a snapshot topic", () => {
  test("renders the committed lanes golden byte-for-byte", async () => {
    const run = await probe.run(["events", "describe", "lanes"]);
    expect(run.exitCode).toBe(0);
    expect(run.stdout).toBe(goldenBody("events-describe-lanes.txt"));
  });

  test("declares shape=snapshot, no kind, no payload field, and the three-field frame", async () => {
    const run = await probe.run(["events", "describe", "lanes", "--json"]);
    const record = run.data?.topics[0];
    expect(record).toMatchObject({
      name: "lanes",
      shape: "snapshot",
      lane: "none",
      ordering: "snapshot-revision",
      overflow: "repoll",
      kinds: [],
      payloadFields: [],
      frame: ["topic", "cursor", "snapshot"],
    });
    expect(record).not.toHaveProperty("parent");
    const text = (await probe.run(["events", "describe", "lanes"])).stdout;
    expect(text).toContain("a snapshot topic declares no kind");
    expect(text).toContain("snapshot revision");
    expect(text).not.toContain("per lane");
    expect(text).not.toContain("per-lane");
  });
});

describe("TC-EVT-013 describe --json adds nothing to the machine shape", () => {
  test("returns exactly the list element for every topic", async () => {
    const list = await probe.run(["events", "list", "--json"]);
    for (const name of TOPIC_NAMES) {
      const run = await probe.run(["events", "describe", name, "--json"]);
      expect(run.exitCode).toBe(0);
      expect(run.data?.command).toBe("events describe");
      expect(run.data?.taxonomyVersion).toBe("v1");
      expect(run.data?.topics).toHaveLength(1);
      expect(run.data?.envelope).toEqual(list.data?.envelope);
      const element = list.data?.topics.find((topic) => topic.name === name);
      expect(run.data?.topics[0]).toEqual(element);
    }
  });
});

describe("TC-EVT-016 queue.graph per-kind payload detail", () => {
  test("every kind carries its declared non-empty payload list and only remove is unemitted", async () => {
    const run = await probe.run(["events", "describe", "queue.graph", "--json"]);
    const record = run.data?.topics[0];
    expect(record?.kinds).toHaveLength(4);
    for (const kind of record?.kinds ?? []) expect(kind.payloadFields.length).toBeGreaterThan(0);
    const unemitted = (record?.kinds ?? [])
      .filter((kind) => !kind.emitted)
      .map((kind) => kind.name);
    expect(unemitted).toEqual(["remove"]);
  });

  test("the topic union is the first-seen union of the four lists", async () => {
    const run = await probe.run(["events", "describe", "queue.graph", "--json"]);
    const record = run.data?.topics[0];
    const seen = new Set<string>();
    const union: string[] = [];
    for (const kind of record?.kinds ?? []) {
      for (const field of kind.payloadFields) {
        if (seen.has(field)) continue;
        seen.add(field);
        union.push(field);
      }
    }
    expect(record?.payloadFields).toEqual(union);
  });

  test("the other three event topics carry non-empty per-kind lists and derived unions", async () => {
    for (const name of ["dispatch.attempt", "phase.state", "blockers.state"] as const) {
      const run = await probe.run(["events", "describe", name, "--json"]);
      const record = run.data?.topics[0];
      expect(record?.kinds.length, name).toBeGreaterThan(0);
      for (const kind of record?.kinds ?? []) {
        expect(kind.payloadFields.length, `${name}/${kind.name}`).toBeGreaterThan(0);
        expect(kind.payloadFields).toEqual(CONTRACT_PAYLOAD_FIELDS[name]?.[kind.name] as string[]);
      }
      const union = [...new Set((record?.kinds ?? []).flatMap((kind) => kind.payloadFields))];
      expect(record?.payloadFields).toEqual(union);
    }
  });

  test("remove's reason vocabulary is the S15 set and no v1 path emits it", async () => {
    const run = await probe.run(["events", "describe", "queue.graph", "--json"]);
    const remove = run.data?.topics[0]?.kinds.find((kind) => kind.name === "remove");
    expect(remove?.emitted).toBe(false);
    expect(remove?.payloadFields).toEqual(["ref", "reason", "recordedAt"]);
  });
});
