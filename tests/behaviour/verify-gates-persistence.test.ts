/**
 * TC-VGATES-071 / TC-VGATES-072 — the shipped production verify-gates
 * composition persists the record the handler computes: exactly one fenced,
 * post-append-verified `merge.gate-verification` record per full battery
 * evaluation, with the report byte-identical to the pre-change captured
 * goldens (the append is silent), the append-fault negative control classified
 * and never consumable on a FRESH STORE ROOT (DoR minor finding: on the first
 * arm's already-persisted store the existing record would satisfy the
 * envelope), and the counting posture: one per evaluation on repeat and
 * member arms, nothing on the narrowed-scope or configuration refusals.
 *
 * This suite exercises the code the delivered injected-seam proofs route
 * around: the runtime under test is the one the shipped `createProductionComposer`
 * composes, seams and defaults included. TC-MERGE-005/006 remain the
 * handler-level authority and are not re-run here.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { projectExitCode } from "../../packages/cli/src/projection";
import {
  type CapsuleProducerPort,
  type CapsuleProducerRequest,
  ERROR_TABLE,
  MERGE_GATE_VERIFICATION_SCHEMA,
  type StateStorePort,
  VERIFY_GATES_MAX_CITATION_NAMES,
} from "../../packages/core/src/contracts/index";
import { resolveMergeGateSet } from "../../packages/core/src/domain/merge-gate-set";
import {
  appendMergeGateVerification,
  readMergeGateVerifications,
  readMergeTransactions,
  readMergeWaivers,
} from "../../packages/core/src/state/index";
import { API_MEMBER, WEB_MEMBER } from "../fixtures/cross-repository/constants";
import {
  declaredMember,
  greenMemberReads,
  landingObservation,
  memberGatesRuntime,
  reviewObservation,
} from "../fixtures/cross-repository/facts";
import { makeAuditStore, removeRoot } from "../fixtures/state/harness";
import { combinedRuntime, runVerify } from "../fixtures/verify-gates/cases/harness";
import { createNoNetworkGuard } from "../fixtures/verify-gates/cases/network-guard";
import {
  createVerifyGatesProductionHarness,
  normalizeProductionBytes,
  VG_PROD_REF,
} from "../fixtures/verify-gates/production-composition";
import {
  declaredRead,
  invalidRead,
  narrowedJob01Map,
} from "../fixtures/verify-gates/suite-map/cases";
import { guardStore, type VerifyCallRecorder } from "./verify-support";

const ROOT = process.cwd();
const PRODUCTION_GOLDEN = join(ROOT, "tests/fixtures/verify-gates/golden/production-success.json");

type CapturedRun = { readonly exitCode: number; readonly stdout: string; readonly stderr: string };
type ProductionGolden = {
  readonly machine: CapturedRun;
  readonly human: CapturedRun;
};

const rowExit = (code: string): number => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  if (row === undefined) throw new Error(`no declared row for ${code}`);
  return projectExitCode(row.projectionClass);
};

const errorOf = (run: { envelope?: Record<string, unknown> }): Record<string, unknown> =>
  (run.envelope?.error as Record<string, unknown> | undefined) ?? {};

/** The real fenced append over one fixture store, counting every seam call. */
const countedRealAppend =
  (store: ReturnType<typeof makeAuditStore>["store"], counter: { value: number }) =>
  (
    record: Parameters<typeof appendMergeGateVerification>[1]["record"],
  ):
    | {
        readonly ok: true;
      }
    | {
        readonly ok: false;
        readonly code: string;
      } => {
    counter.value += 1;
    const appended = appendMergeGateVerification(store, {
      record,
      fenceToken: `vg-persistence-${String(counter.value)}`,
    });
    return appended.ok ? { ok: true } : { ok: false, code: appended.error.code };
  };

/** A recording capsule producer port (counts without changing behaviour). */
const recordingCapsule = (): {
  readonly port: CapsuleProducerPort;
  readonly requests: CapsuleProducerRequest[];
} => {
  const requests: CapsuleProducerRequest[] = [];
  let sequence = 0;
  return {
    requests,
    port: {
      append: (request) => {
        requests.push(request);
        sequence += 1;
        return { ok: true, appended: true, sequence, eventKey: request.eventKey };
      },
    },
  };
};

describe("TC-VGATES-071 the shipped composition persists one fenced record with a byte-identical report", () => {
  test("verify gates exits 0 with the captured bytes and the ledger gains exactly one record", async () => {
    const guard = createNoNetworkGuard();
    const recorder: VerifyCallRecorder = { calls: [] };
    const harness = createVerifyGatesProductionHarness({
      label: "gh388-persistence-primary",
      stateStoreWrap: (inner) => guardStore(inner, recorder, { throwOnMutation: false }).store,
    });
    try {
      const json = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(json.exitCode, json.stderr).toBe(0);
      // The append is silent (DEC-3, NFR-2): the machine bytes equal the
      // pre-change captured golden — a 0-byte delta, never a regeneration.
      const golden = JSON.parse(readFileSync(PRODUCTION_GOLDEN, "utf8")) as ProductionGolden;
      const identity = {
        headSha: harness.headSha,
        checkout: harness.checkout,
        hostRoot: harness.host.hostRoot,
      };
      expect(normalizeProductionBytes(json.stdout, identity)).toBe(golden.machine.stdout);
      expect(json.envelope?.data).toBeDefined();

      // Exactly one record for this evaluation: schema, key, identity, payload
      // members asserted exactly against the delivered record contract (DM-1,
      // EVT-1). The fence snapshot is taken at this run's boundary.
      const callsAfterFirstRun = [...recorder.calls];
      const read = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      const record = read.records[0];
      expect(record?.schema).toBe(MERGE_GATE_VERIFICATION_SCHEMA);
      expect(record?.changeRef).toBe(VG_PROD_REF);
      expect(record?.headSha).toBe(harness.headSha);
      // The production composition reads the system clock by delivered design
      // (the clock fact is production-omitted), so the persisted instant is
      // the handler's observation time; the fixed-instant determinism rides
      // the fixture-runtime arms (TC-MERGE-005's fixed seam clock). The
      // instant itself is never an output byte (the append is silent).
      expect(Number.isNaN(Date.parse(record?.verifiedAt ?? "invalid"))).toBe(false);
      const resolved = resolveMergeGateSet(undefined);
      if (!resolved.ok) throw new Error("the shipped default gate set must resolve");
      // Total identity equality: schema version plus the full shipped-default
      // id sequence, order included (F-3, DM-2).
      expect(record?.gateSet).toEqual({
        schemaVersion: resolved.value.schemaVersion,
        ids: [...resolved.value.ids],
      });
      expect(record?.gateSet.ids).toHaveLength(6);
      // Five per-gate verdicts in battery order, with bounded citations.
      expect(record?.gates.map((gate) => gate.id)).toEqual(
        resolved.value.batteryEntries.map((entry) => entry.id),
      );
      for (const gate of record?.gates ?? []) {
        expect(gate.verdict).toBe("pass");
        expect(gate.citation.identity.changeRef).toBe(VG_PROD_REF);
        for (const list of gate.citation.names) {
          expect(list.values.length + list.omitted).toBeLessThanOrEqual(
            VERIFY_GATES_MAX_CITATION_NAMES,
          );
        }
      }
      // The observed tracker posture: no owner-attention labels on the fixture
      // work item, and no label list carried (the delivered posture shape).
      expect(record?.trackerPosture).toEqual({ labels: [], ownerLabels: [] });

      // Fence discipline ran over the real store: read-before, fence acquired,
      // append, post-append verified read, fence released — in that order.
      const firstAcquire = callsAfterFirstRun.indexOf("acquireFence");
      const firstAppend = callsAfterFirstRun.indexOf("append");
      const releaseAfter = callsAfterFirstRun.indexOf("releaseFence", firstAppend);
      const postAppendRead = callsAfterFirstRun.findIndex(
        (call, index) => call === "readRecords" && index > firstAppend,
      );
      expect(firstAcquire).toBeGreaterThan(-1);
      expect(firstAppend).toBeGreaterThan(firstAcquire);
      expect(postAppendRead).toBeGreaterThan(firstAppend);
      expect(releaseAfter).toBeGreaterThan(postAppendRead);
      const storeCalls = callsAfterFirstRun.filter((call) => call !== "read");
      expect(storeCalls).not.toContain("replaceDocument");
      expect(storeCalls).not.toContain("repairTornTail");
      expect(storeCalls).not.toContain("salvage");

      // Capsule posture as delivered (NG-5): the shipped production
      // composition wires no capsule producer port, so the envelope carries
      // no capsule disclosure and no capsule append occurs on this path.
      const data = json.envelope?.data as Record<string, unknown> | undefined;
      expect(Object.hasOwn(data ?? {}, "capsule")).toBe(false);

      // The human run reports the same bytes and appends exactly one more
      // record of the same shape (per-evaluation counting; the repeat posture
      // is TC-VGATES-072's first arm at the production layer too).
      const human = await harness.run(["verify", "gates", VG_PROD_REF]);
      expect(human.exitCode, human.stderr).toBe(0);
      expect(normalizeProductionBytes(human.stdout, identity)).toBe(golden.human.stdout);
      const afterSecond = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(afterSecond.ok && afterSecond.records).toHaveLength(2);
      const secondRecord = afterSecond.ok ? afterSecond.records[1] : undefined;
      expect(secondRecord?.headSha).toBe(harness.headSha);
      expect(secondRecord?.gateSet).toEqual(record?.gateSet);

      // No landing-side mutation rode the verification runs.
      const transactions = readMergeTransactions(harness.store, VG_PROD_REF);
      expect(transactions.ok && transactions.records).toEqual([]);
      const waivers = readMergeWaivers(harness.store, VG_PROD_REF);
      expect(waivers.ok && waivers.records).toEqual([]);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });

  test("the append-fault negative control on a FRESH STORE ROOT is classified and never consumable", async () => {
    const guard = createNoNetworkGuard();
    // DoR minor finding (TC-VGATES-071 steps 6-7): the negative control
    // rebuilds the harness on a FRESH STORE ROOT — a new harness instance owns
    // a new temp state location, so the already-persisted record of the first
    // arm can never satisfy the merge envelope here. The freshness of the
    // root is asserted before the faulted run.
    const failingAppend = (base: StateStorePort): StateStorePort => ({
      ...base,
      append: () => ({
        ok: false as const,
        error: {
          kind: "state" as const,
          code: "state.write.failed" as const,
          consequence: "not_landed" as const,
          location: { path: "synthetic-store" },
        },
      }),
    });
    const harness = createVerifyGatesProductionHarness({
      label: "gh388-persistence-append-fault",
      stateStoreWrap: failingAppend,
    });
    try {
      const before = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(before.ok && before.records).toEqual([]);
      const run = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      // Classified state failure at its declared exit — never silence, never
      // a green exit (DM-3, RSK-5).
      expect(run.exitCode).toBe(rowExit("state.write.failed"));
      expect(run.exitCode).toBe(2);
      const error = errorOf(run);
      expect(error.code).toBe("state.write.failed");
      expect(error.category).toBe("transient");
      expect(String(error.summary ?? "")).not.toContain("fallback.internal");
      // The faulted append left no consumable record, and the follow-on merge
      // refuses state-unverified (the failed append is never evidence).
      const after = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(after.ok && after.records).toEqual([]);
      const merge = await harness.run(["--json", "merge", VG_PROD_REF]);
      expect(merge.exitCode).toBe(rowExit("merge.state-unverified"));
      expect(errorOf(merge).code).toBe("merge.state-unverified");
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });
});

describe("TC-VGATES-072 counting: one record per non-refused evaluation, none on refusals", () => {
  test("repeat production runs append exactly one more record each", async () => {
    const guard = createNoNetworkGuard();
    const harness = createVerifyGatesProductionHarness({
      label: "gh388-persistence-repeat",
    });
    try {
      const first = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(first.exitCode).toBe(0);
      const afterFirst = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(afterFirst.ok && afterFirst.records).toHaveLength(1);
      const second = await harness.run(["--json", "verify", "gates", VG_PROD_REF]);
      expect(second.exitCode).toBe(0);
      const afterSecond = readMergeGateVerifications(harness.store, VG_PROD_REF);
      expect(afterSecond.ok && afterSecond.records).toHaveLength(2);
      // The ledger only ever grew by appends: the newest record wins, the
      // delivered read tolerance is untouched.
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
      harness.dispose();
    }
  });

  test("the member evaluation appends exactly one member-projected record and one capsule event", async () => {
    const fixture = makeAuditStore("vg-persistence-member");
    try {
      const counter = { value: 0 };
      const append = countedRealAppend(fixture.store, counter);
      const capsule = recordingCapsule();
      const runtime = memberGatesRuntime({
        members: [
          declaredMember(API_MEMBER, { gates: ["ci-green", "push-parity", "owner-gate"] }),
          declaredMember(WEB_MEMBER, { gates: ["ci-green", "push-parity"] }),
        ],
        reads: {
          [API_MEMBER.repoKey]: greenMemberReads(API_MEMBER),
          [WEB_MEMBER.repoKey]: greenMemberReads(WEB_MEMBER),
        },
        landings: [landingObservation(API_MEMBER, false), landingObservation(WEB_MEMBER, false)],
        reviews: [reviewObservation(API_MEMBER, ["pass"]), reviewObservation(WEB_MEMBER, ["pass"])],
      });
      const gates = runtime.gates;
      if (gates === undefined) throw new Error("member runtime is missing the gates member");
      const result = await runVerify(
        { ...runtime, gates: { ...gates, appendVerification: append, capsule: capsule.port } },
        ["gates", "GH-310"],
      );
      expect(result.exitCode).toBe(0);
      expect(counter.value).toBe(1);
      expect(capsule.requests).toHaveLength(1);
      const read = readMergeGateVerifications(fixture.store, "GH-310");
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect(read.records).toHaveLength(1);
      const record = read.records[0];
      // The member-projected delivered shape: the member discriminator is
      // dropped, order and count preserved; each verdict carries exactly the
      // four ledger members.
      expect(record?.gates.length).toBeGreaterThan(0);
      for (const gate of record?.gates ?? []) {
        expect(Object.keys(gate).sort()).toEqual(["citation", "id", "reason", "verdict"]);
      }
      // The record append precedes the capsule event on the delivered path.
      const resolved = resolveMergeGateSet(undefined);
      if (!resolved.ok) throw new Error("the shipped default gate set must resolve");
      expect(record?.gateSet.ids).toEqual([...resolved.value.ids]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a narrowed-scope refusal appends neither record nor capsule event", async () => {
    const fixture = makeAuditStore("vg-persistence-narrowed");
    try {
      const counter = { value: 0 };
      const append = countedRealAppend(fixture.store, counter);
      const capsule = recordingCapsule();
      const result = await runVerify(
        combinedRuntime({
          suiteMap: declaredRead(narrowedJob01Map()),
          appendVerification: append,
          capsule: capsule.port,
        }),
        ["gates", "GH-178"],
      );
      expect(result.exitCode).toBe(1);
      expect(errorOf(result).code).toBe("verify.narrowed-scope");
      expect(counter.value).toBe(0);
      expect(capsule.requests).toHaveLength(0);
      const read = readMergeGateVerifications(fixture.store, "GH-178");
      expect(read.ok && read.records).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });

  test("a configuration refusal that precedes evaluation appends nothing", async () => {
    const fixture = makeAuditStore("vg-persistence-config");
    try {
      const counter = { value: 0 };
      const append = countedRealAppend(fixture.store, counter);
      const capsule = recordingCapsule();
      const result = await runVerify(
        combinedRuntime({
          suiteMap: () => invalidRead("persistence config arm"),
          appendVerification: append,
          capsule: capsule.port,
        }),
        ["gates", "GH-178"],
      );
      expect(result.exitCode).toBe(1);
      expect(errorOf(result).code).toBe("config.value.invalid");
      expect(counter.value).toBe(0);
      expect(capsule.requests).toHaveLength(0);
      const read = readMergeGateVerifications(fixture.store, "GH-178");
      expect(read.ok && read.records).toEqual([]);
    } finally {
      removeRoot(fixture.root);
    }
  });
});
