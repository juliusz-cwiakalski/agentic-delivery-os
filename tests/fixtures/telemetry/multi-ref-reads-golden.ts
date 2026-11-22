/**
 * TC-TELEMETRY-053 / TC-TELEMETRY-055 committed golden: both halves of the
 * named GH-384 regression pair — the pre-fix failure shapes captured at the
 * change's branch point (FX-R1: the steps read tearing on the leading foreign
 * step record; FX-R2: ref B's capture tearing in the idempotency pre-read on
 * ref A's baseline record) and the corrected success shapes captured after
 * the fix — plus the FX-13 delivered single-ref golden (records with
 * ordering, the verified-empty flag, the evidence store path, the capture
 * outcomes, and every tear identity and location).
 *
 * Regenerate only with the explicit capture entry, never by hand and never as
 * a blanket rewrite; a golden change that alters a tear case must fail review:
 *
 *   TMPDIR=$PWD/tmp/tmpdir bun tests/fixtures/telemetry/multi-ref-reads-golden-run.ts
 *
 * The <stateDirectory> placeholder stands for the per-run temp state root, so
 * the golden holds no absolute path. The pre-fix halves are a fixed
 * historical record: the entry refuses to overwrite them once a corrected
 * half exists, and the FX-13 section must be byte-identical pre- and post-fix.
 */
import type { Gh384MultiRefReadsGolden } from "./index";

export const MULTI_REF_READS_GOLDEN: Gh384MultiRefReadsGolden = {
  requestedRef: "GH-384",
  foreignRef: "GH-380",
  absentRef: "GH-000",
  fxR1: {
    preFix: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 1,
      },
    },
    corrected: null,
  },
  fxR2: {
    preFix: {
      kind: "state",
      code: "state.store.torn",
      consequence: "not_landed",
      location: {
        path: "<stateDirectory>/ledger.workspace-a.jsonl",
        record: 1,
      },
    },
    corrected: null,
  },
  singleRef: {
    healthy: {
      stepsRead: {
        records: [
          {
            schemaId: "delivery.harness.telemetry.step.v1",
            storageVersion: "delivery.telemetry.storage.v1",
            workItemRef: "GH-384",
            runId: "run-gh384-GH-384",
            sessionId: "ses-gh384-GH-384-s1",
            harnessKind: "opencode",
            harnessVersion: "2.2.5",
            treeRoot: "/work/checkout-a",
            model: "model-alpha",
            ticket: "GH-384",
            repository: "/work/checkout-a",
            lane: "lane-alpha",
            agentRole: "coder",
            tokens: {
              input: 10,
              output: 5,
              reasoning: 0,
              cacheRead: 0,
              cacheWrite: 0,
            },
            calls: 1,
            cost: 0.25,
            startedAt: null,
            finishedAt: "2026-11-12T08:10:00.000Z",
            warnings: [],
            capturedAt: "2026-11-12T08:10:00.000Z",
          },
          {
            schemaId: "delivery.harness.telemetry.step.v1",
            storageVersion: "delivery.telemetry.storage.v1",
            workItemRef: "GH-384",
            runId: "run-gh384-GH-384",
            sessionId: "ses-gh384-GH-384-s2",
            harnessKind: "opencode",
            harnessVersion: "2.2.5",
            treeRoot: "/work/checkout-a",
            model: "model-alpha",
            ticket: "GH-384",
            repository: "/work/checkout-a",
            lane: "lane-alpha",
            agentRole: "coder",
            tokens: {
              input: 20,
              output: 10,
              reasoning: 0,
              cacheRead: 0,
              cacheWrite: 0,
            },
            calls: 2,
            cost: 0.5,
            startedAt: null,
            finishedAt: "2026-11-12T08:10:00.000Z",
            warnings: [],
            capturedAt: "2026-11-12T08:10:00.000Z",
          },
        ],
        verifiedEmpty: false,
        evidence: {
          storePath: "<stateDirectory>/ledger.workspace-a.jsonl",
        },
      },
      first: {
        appended: true,
        sequence: 3,
      },
      repeat: {
        appended: false,
      },
    },
    emptyLedger: {
      stepsRead: {
        records: [],
        verifiedEmpty: true,
        evidence: {
          storePath: "<stateDirectory>/ledger.workspace-a.jsonl",
        },
      },
    },
    tears: {
      bareStepPrefix: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: {
          path: "<stateDirectory>/ledger.workspace-a.jsonl",
          record: 3,
        },
      },
      bareBaselinePrefix: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: {
          path: "<stateDirectory>/ledger.workspace-a.jsonl",
          record: 3,
        },
      },
      stepKindMismatch: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: {
          path: "<stateDirectory>/ledger.workspace-a.jsonl",
          record: 3,
        },
      },
      baselineKindMismatch: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: {
          path: "<stateDirectory>/ledger.workspace-a.jsonl",
          record: 3,
        },
      },
      stepMalformedPayload: {
        kind: "state",
        code: "state.store.torn",
        consequence: "not_landed",
        location: {
          path: "<stateDirectory>/ledger.workspace-a.jsonl",
          record: 3,
        },
      },
    },
  },
};
