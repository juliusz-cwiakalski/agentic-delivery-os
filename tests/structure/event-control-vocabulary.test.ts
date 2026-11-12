/**
 * TC-EVT-070 and the vocabulary half of TC-EVT-042 — the only control-vocabulary
 * change is the additive topic widening; the wire types, frame kinds, degraded
 * reasons, stop modes, protocol, and subscription bound are unchanged.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogPaths, PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import {
  CONTROL_DEGRADED_REASONS,
  CONTROL_FRAME_KINDS,
  CONTROL_PROTOCOL_CURRENT,
  CONTROL_PROTOCOL_FLOOR,
  CONTROL_STOP_MODES,
  CONTROL_TOPICS,
  CONTROL_WIRE_TYPES,
} from "../../packages/core/src/contracts/control";
import { DAEMON_DEFAULT_SUBSCRIPTION_BUFFER } from "../../packages/core/src/contracts/daemon";
import { TAXONOMY } from "../../packages/core/src/contracts/taxonomy";

const ROOT = process.cwd();
const fixture = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/events/delivered-vocabularies.json"), "utf8"),
) as Record<string, unknown>;

describe("TC-EVT-070 delivered control vocabulary", () => {
  test("the wire types, frame kinds, degraded reasons, and stop modes are unchanged", () => {
    expect([...CONTROL_WIRE_TYPES]).toEqual(fixture.CONTROL_WIRE_TYPES as string[]);
    expect([...CONTROL_FRAME_KINDS]).toEqual(fixture.CONTROL_FRAME_KINDS as string[]);
    expect([...CONTROL_DEGRADED_REASONS]).toEqual(fixture.CONTROL_DEGRADED_REASONS as string[]);
    expect([...CONTROL_STOP_MODES]).toEqual(fixture.CONTROL_STOP_MODES as string[]);
  });

  test("the protocol version, floor, and subscription bound are unchanged", () => {
    expect(CONTROL_PROTOCOL_CURRENT).toBe(fixture.CONTROL_PROTOCOL_CURRENT as number);
    expect(CONTROL_PROTOCOL_FLOOR).toBe(fixture.CONTROL_PROTOCOL_FLOOR as number);
    expect(DAEMON_DEFAULT_SUBSCRIPTION_BUFFER).toBe(fixture.SUBSCRIPTION_BUFFER_DEFAULT as number);
    expect(fixture.SUBSCRIPTION_BUFFER_SETTING).toBe("daemon.subscription-buffer");
  });

  test("CONTROL_TOPICS has six members, the declared names, with the delivered pair as a prefix", () => {
    expect(CONTROL_TOPICS).toHaveLength(6);
    expect([...CONTROL_TOPICS]).toEqual(TAXONOMY.topics.map((topic) => topic.name));
    expect([...CONTROL_TOPICS].slice(0, 2)).toEqual(["queue", "lanes"]);
  });

  test("no wire type named event was added: the event is a frame kind", () => {
    expect((CONTROL_WIRE_TYPES as readonly string[]).includes("event")).toBe(false);
    expect(CONTROL_FRAME_KINDS as readonly string[]).toContain("event");
  });

  test("no overflow value entered the degraded-reason vocabulary", () => {
    expect(CONTROL_DEGRADED_REASONS as readonly string[]).not.toContain("repoll");
    expect(CONTROL_DEGRADED_REASONS).toHaveLength(3);
  });

  test("one capacity key governs every topic; no per-topic capacity key exists", () => {
    const paths = catalogPaths(PRODUCTION_CATALOG).map(([path]) => path);
    expect(paths).toContain("daemon.subscription-buffer");
    const capacityKeys = paths.filter((path) => /buffer|capacity|overflow/u.test(path));
    expect(capacityKeys).toEqual(["daemon.subscription-buffer"]);
  });
});
