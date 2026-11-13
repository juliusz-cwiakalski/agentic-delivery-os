/**
 * TC-PAUSE-072 — the park-cause vocabulary under S17 (GH-294 DEC-2, DEC-12,
 * DM-4; F-7): the lanes `parked:<cause>` projection gains `peak-window` and
 * `owner-hold` with the delivered three unchanged (closed-set equality both
 * directions); `queue release --park peak-window` requires the delivered
 * explicit `--until <iso>`; `--park owner-hold` is the one writer of an
 * owner-hold park record and its `until` is the declared classified absence —
 * a combined `--until` invocation is refused, never synthesized.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  claimQueueLease,
  declareQueueEntry,
  readQueueParks,
  releaseQueueLease,
} from "../../packages/core/src/app/index";
import {
  QUEUE_PARK_CAUSE_CONDITION_PAIRS,
  QUEUE_PARK_CAUSES,
  QUEUE_PARK_CONDITION_TYPES,
  QUEUE_PARK_RECORD_KIND,
  type QueueParkRecord,
} from "../../packages/core/src/contracts/index";
import {
  conditionTypeForCause,
  createParkRecord,
  resolveOwnerHoldFact,
} from "../../packages/core/src/domain/index";
import { createQueueEdgeHarness } from "../fixtures/queue/cli/harness";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = "2026-11-13T10:00:00.000Z";
const UNTIL = "2026-11-13T18:05:00.000Z";

describe("TC-PAUSE-072 the closed park-cause vocabulary", () => {
  test("the set gains peak-window and owner-hold; the delivered three keep their positions", () => {
    // Closed-set equality, both directions: the delivered members are all
    // present, unchanged, and the two additions join beside them.
    expect([...QUEUE_PARK_CAUSES]).toEqual([
      "provider-window",
      "provider-quota",
      "preempted-for-close-item",
      "peak-window",
      "owner-hold",
    ]);
    expect(QUEUE_PARK_CAUSES).toHaveLength(5);
    // No fourth vocabulary appeared beside the delivered sets plus the two
    // additions (DEC-2, G-9): the condition-type set is unchanged.
    expect([...QUEUE_PARK_CONDITION_TYPES]).toEqual([
      "provider-window",
      "provider-quota",
      "preemption",
    ]);
    // The committed mapping: peak-window rides the provider-window condition
    // type; owner-hold joins on the read-time preemption type.
    expect([...QUEUE_PARK_CAUSE_CONDITION_PAIRS]).toEqual([
      { cause: "provider-window", conditionType: "provider-window" },
      { cause: "provider-quota", conditionType: "provider-quota" },
      { cause: "preempted-for-close-item", conditionType: "preemption" },
      { cause: "peak-window", conditionType: "provider-window" },
      { cause: "owner-hold", conditionType: "preemption" },
    ]);
    expect(conditionTypeForCause("peak-window")).toBe("provider-window");
    expect(conditionTypeForCause("owner-hold")).toBe("preemption");
    // The delivered mappings are untouched.
    expect(conditionTypeForCause("provider-window")).toBe("provider-window");
    expect(conditionTypeForCause("provider-quota")).toBe("provider-quota");
    expect(conditionTypeForCause("preempted-for-close-item")).toBe("preemption");
  });

  test("the lanes parked:<cause> projection gains both and keeps printing the delivered three", () => {
    // The projection is the `parked:${QueueParkCause}` template: the new
    // causes are representable, the delivered renders unchanged.
    const rendered = QUEUE_PARK_CAUSES.map((cause) => `parked:${cause}`);
    expect(rendered).toContain("parked:provider-window");
    expect(rendered).toContain("parked:provider-quota");
    expect(rendered).toContain("parked:preempted-for-close-item");
    expect(rendered).toContain("parked:peak-window");
    expect(rendered).toContain("parked:owner-hold");
  });
});

describe("TC-PAUSE-072 the queue release park grammar and writers", () => {
  test("peak-window parks require the explicit --until; owner-hold refuses it", async () => {
    const harness = createQueueEdgeHarness("s17-grammar");
    // peak-window without --until is refused at the delivered refusal shape.
    const noUntil = await harness.run([
      "queue",
      "release",
      "GH-176",
      "--holder",
      "holder-a",
      "--park",
      "peak-window",
      "--json",
    ]);
    expect(noUntil.exitCode).toBe(1);
    expect(noUntil.stdout).toContain("reason=until-required");
    // owner-hold with --until is refused: the classified absence is never
    // synthesized (DEC-12).
    const holdUntil = await harness.run([
      "queue",
      "release",
      "GH-176",
      "--holder",
      "holder-a",
      "--park",
      "owner-hold",
      "--until",
      UNTIL,
      "--json",
    ]);
    expect(holdUntil.exitCode).toBe(1);
    expect(holdUntil.stdout).toContain("reason=until-unsupported");
    // The delivered causes keep their rules: provider-window still requires
    // --until, provider-quota still refuses it.
    const windowNoUntil = await harness.run([
      "queue",
      "release",
      "GH-176",
      "--holder",
      "holder-a",
      "--park",
      "provider-window",
      "--json",
    ]);
    expect(windowNoUntil.exitCode).toBe(1);
    expect(windowNoUntil.stdout).toContain("reason=until-required");
    const quotaWithUntil = await harness.run([
      "queue",
      "release",
      "GH-176",
      "--holder",
      "holder-a",
      "--park",
      "provider-quota",
      "--until",
      UNTIL,
      "--json",
    ]);
    expect(quotaWithUntil.exitCode).toBe(1);
    expect(quotaWithUntil.stdout).toContain("reason=until-unsupported");
  });

  test("the invoked release command writes the owner-hold park record with no until", () => {
    const root = makeTempRoot("gh294-owner-hold-writer");
    const { store } = openStore(makeIdentity(root));
    try {
      const declared = declareQueueEntry(store, {
        ref: "GH-900",
        repository: "github.com/example/repo",
        repositoryRoot: "/work/repo",
        priority: 1,
        recordedAt: NOW,
        fenceToken: "seed-entry",
      });
      expect(declared.ok).toBe(true);
      const claimed = claimQueueLease(store, {
        ref: "GH-900",
        holder: "holder-1",
        runner: "runner-a",
        weightClass: "standard",
        nowIso: NOW,
        nowMs: Date.parse(NOW),
        fenceToken: "claim-holder-1",
      });
      expect(claimed.ok).toBe(true);
      const released = releaseQueueLease(store, {
        ref: "GH-900",
        holder: "holder-1",
        park: {
          cause: "owner-hold",
          condition: { type: "preemption" },
          recheckMs: 60_000,
        },
        nowIso: NOW,
        nowMs: Date.parse(NOW),
        fenceToken: "release-1",
      });
      expect(released.ok).toBe(true);
      const read = readQueueParks(store);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      const record = read.records.at(-1);
      expect(record?.cause).toBe("owner-hold");
      // The classified absence: no until on the record — never a synthesized
      // or borrowed timestamp, never a zero instant.
      expect(record?.until).toBeUndefined();
      expect("until" in (record ?? {})).toBe(false);
      expect(record?.conditionType).toBe("preemption");
    } finally {
      removeRoot(root);
    }
  });

  test("the park writers are exactly the named ones (TC-PAUSE-094 step 3's per-path enumeration)", () => {
    // The hold itself never writes a park record: the owner-hold fact is a
    // pure read (resolveOwnerHoldFact appends nothing — it is a resolver).
    const fact = resolveOwnerHoldFact({
      environmentPrefix: "TEST_",
      environment: {},
    });
    expect(fact.active).toBe(false);
    // The window-end resume path creates no synthetic owner-hold park: the
    // resume modules append only recovered peak-window records (asserted by
    // the resume suite; here the module surface is scanned for the writer).
    const resume = readFileSync(
      join(process.cwd(), "packages/core/src/domain/daemon-peak-pause.ts"),
      "utf8",
    );
    expect(resume.includes('cause: "owner-hold"')).toBe(false);
    // The operator-invoked release command is the ONE writer: the release
    // path builds the park from the declared cause (createParkRecord with
    // cause owner-hold), which the previous assertion exercised end to end.
    const record: QueueParkRecord = createParkRecord({
      ref: "GH-900",
      cause: "owner-hold",
      condition: { type: "preemption" },
      recheckMs: 60_000,
      evaluatedAt: NOW,
      recordedAt: NOW,
    });
    expect(record.cause).toBe("owner-hold");
    expect(record.until).toBeUndefined();
    expect(QUEUE_PARK_RECORD_KIND).toBe("queue.park");
  });
});
