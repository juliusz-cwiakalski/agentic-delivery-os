/**
 * TC-BRIEF-005 — read-cost parity: the brief performs exactly the status read
 * set (one binding read, one tracker page, one PR page, one check-runs page, one
 * config resolve, one park fold, one local-context read) and no retries.
 */
import { describe, expect, test } from "bun:test";
import { projectBrief } from "../../packages/core/src/domain/index";
import {
  baseFacts,
  briefRuntime,
  capSizedFacts,
  createStatusRecorder,
  runBriefCli,
} from "../fixtures/brief/harness";
import { runStatusCli, statusRuntime } from "../fixtures/status/harness";

const STATUS_MEMBERS = [
  "readRepository",
  "readWorkItems",
  "readDeliveryRequests",
  "readPipelineRuns",
  "readProviderConfig",
  "readProviderParks",
  "readLocalContext",
  "readBlockers",
  "nowIso",
  "nowMs",
] as const;

const count = (calls: readonly string[], member: string): number =>
  calls.filter((call) => call === member).length;

describe("TC-BRIEF-005 read-cost parity", () => {
  test("status and brief invoke the identical reader member set on the same facts", async () => {
    const statusRecorder = createStatusRecorder();
    await runStatusCli(["--json", "status"], statusRuntime(capSizedFacts(), statusRecorder), {
      recorder: statusRecorder,
    });
    const briefRecorder = createStatusRecorder();
    await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts(), briefRecorder), {
      recorder: briefRecorder,
    });
    expect(briefRecorder.calls).toEqual(statusRecorder.calls);
    expect(new Set(briefRecorder.calls)).toEqual(new Set(STATUS_MEMBERS));
  });

  test("each declared read happens exactly once", async () => {
    const recorder = createStatusRecorder();
    await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts(), recorder), { recorder });
    for (const member of STATUS_MEMBERS) expect(count(recorder.calls, member), member).toBe(1);
    expect(recorder.calls.filter((call) => call.startsWith("read")).length).toBe(8);
  });

  test("the pure projection consumes no reader", () => {
    const recorder = createStatusRecorder();
    projectBrief(baseFacts());
    projectBrief(baseFacts());
    expect(recorder.calls).toEqual([]);
  });

  test("there are no retries, pagination loops, or brief-only members", async () => {
    const recorder = createStatusRecorder();
    await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts(), recorder), { recorder });
    const total = recorder.calls.length;
    await runBriefCli(["--json", "brief"], briefRuntime(capSizedFacts(), recorder), { recorder });
    expect(recorder.calls.length).toBe(total * 2);
    const briefOnly = Object.keys(briefRuntime(baseFacts())).filter(
      (key) => !(STATUS_MEMBERS as readonly string[]).includes(key),
    );
    expect(briefOnly).toEqual([]);
  });
});
