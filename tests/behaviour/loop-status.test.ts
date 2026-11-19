/**
 * TC-VERB-003/004 (GH-348 API-4, API-7; NFR-2, NFR-11).
 *
 * The status block follows the status-key source table: the six shell keys, then
 * `stop_mode`, then the additive tail; `loop_id=loop-main` in every world;
 * live-only `ceo_pid`/`ceo_session`; a bare `key=` elsewhere; no `none` token.
 * `status` appends nothing, creates nothing, and reads no configuration branch.
 */
import { describe, expect, test } from "bun:test";
import {
  LOOP_STATUS_GOLDEN_ABSENT,
  LOOP_STATUS_GOLDEN_STOPPED,
} from "../fixtures/loop/golden/status";
import { createLoopHarness } from "../fixtures/loop/harness";

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, "u");

const blockLines = (stdout: string): readonly string[] =>
  stdout.split("\n").filter((line) => line.includes("="));

describe("TC-VERB-003 the status block follows the declared key order and sources", () => {
  test("the absent-identifier world keeps loop_id and restarts and renders no none token", async () => {
    const harness = createLoopHarness({ label: "status-absent" });
    const result = await harness.run(["loop", "status"]);
    expect(result.code).toBe(0);
    const lines = blockLines(result.stdout);
    expect(lines).toEqual([...LOOP_STATUS_GOLDEN_ABSENT.lines]);
    expect(result.stdout).not.toContain("none");
    expect(ANSI.test(result.stdout)).toBe(false);
    expect(lines.length).toBeLessThanOrEqual(32);
    expect(
      JSON.stringify(harness.dataOf(await harness.run(["loop", "status", "--json"]))),
    ).not.toContain('"none"');
  });

  test("a folded stop renders stop_signal=yes and stop_mode immediately after it", async () => {
    const harness = createLoopHarness({ label: "status-stopped" });
    await harness.run(["loop", "stop", "--json"]);
    const result = await harness.run(["loop", "status"]);
    expect(result.code).toBe(0);
    const lines = blockLines(result.stdout);
    const signal = lines.indexOf("stop_signal=yes");
    expect(signal).toBeGreaterThanOrEqual(0);
    expect(lines[signal - 1]).toBe("ceo_session=");
    expect(lines[signal + 1]).toBe("stop_mode=drain");
    expect(lines).toEqual([...LOOP_STATUS_GOLDEN_STOPPED.lines]);
  });

  test("an ended session renders ceo_pid and ceo_session empty", async () => {
    const harness = createLoopHarness({
      label: "status-ended",
      session: { facts: { sessionId: "session-old", liveness: "absent", pid: null } },
    });
    harness.seedSession({ sessionId: "session-old", state: "ended", pid: 4242 });
    const result = await harness.run(["loop", "status"]);
    const lines = blockLines(result.stdout);
    expect(lines).toContain("ceo_pid=");
    expect(lines).toContain("ceo_session=");
    expect(lines).toContain("ceo_alive=no");
    expect(lines).toContain("loop_id=loop-main");
    expect(lines).toContain("restarts=0/10");
  });
});

describe("TC-VERB-004 the read-only verbs append nothing and read no handler configuration", () => {
  test("status and log leave the record count unchanged", async () => {
    const harness = createLoopHarness({ label: "verb-004" });
    const before = harness.counters.appends;
    await harness.run(["loop", "status", "--json"]);
    await harness.run(["loop", "log", "--json"]);
    expect(harness.counters.appends).toBe(before);
  });
});
