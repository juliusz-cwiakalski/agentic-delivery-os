/**
 * The explicit GH-384 multi-ref-reads golden capture entry (TC-TELEMETRY-053,
 * TC-TELEMETRY-055).
 *
 * Captures, per fixture, both halves of the named regression pair — the
 * pre-fix failure shapes (FX-R1: the steps read tearing on the leading
 * foreign step record; FX-R2: ref B's capture tearing in the idempotency
 * pre-read on ref A's baseline record) and the corrected success shapes —
 * plus the FX-13 delivered single-ref golden: the steps-read results (records
 * with ordering, the verified-empty flag, the evidence store path), the
 * baseline capture outcomes (the delivered append, then its no-op repeat),
 * and every delivered tear identity and location.
 *
 * The pre-fix halves MUST be captured at this change's branch point, BEFORE
 * the read branches in packages/core/src/state/telemetry.ts are edited; the
 * corrected halves fill when the entry re-runs after the fix. The FX-13
 * section is observed fresh on every run and must be byte-identical pre- and
 * post-fix (TC-TELEMETRY-055's negative controls). The entry never exercises
 * the dual-ref healthy-baseline seeding — that call is the defect itself and
 * is the phase-2 suite's business, not a golden capture arm.
 *
 *   TMPDIR=$PWD/tmp/tmpdir bun tests/fixtures/telemetry/multi-ref-reads-golden-run.ts
 *
 * The entry exits non-zero when the freshly captured golden differs from the
 * committed one — an expected stage transition (the corrected halves filling)
 * or drift; either way the diff is a deliberate review decision, never a
 * rewrite, and a re-run must be drift-free. Every temp root the capture
 * builds is removed before it exits; the golden holds no absolute path — the
 * per-run state directory is normalized to the `<stateDirectory>` placeholder.
 * The data is serialized in the repository's canonical formatter style
 * (unquoted identifier keys, trailing commas, two-space indent), so a
 * regenerated file stays formatter-clean.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Gh381NormalizedTear, Gh384MultiRefReadsGolden } from "./index";
import {
  buildGh384RegressionCases,
  buildGh384SingleRefCases,
  GH384_ABSENT_REF,
  GH384_FOREIGN_REF,
  GH384_REF,
  normalizeGh384AppendOutcome,
  normalizeGh384CaptureTear,
  normalizeGh384StepsRead,
  normalizeGh384StepsTear,
} from "./index";

type CommittedGolden = Gh384MultiRefReadsGolden;

/** The committed golden, when one exists (absent on the branch-point first run). */
const committed = await import("./multi-ref-reads-golden")
  .then((module) => module.MULTI_REF_READS_GOLDEN as CommittedGolden)
  .catch(() => undefined);

const regressions = buildGh384RegressionCases();
const single = buildGh384SingleRefCases();

let fxR1PreFix: Gh381NormalizedTear;
let fxR1Corrected: Gh384MultiRefReadsGolden["fxR1"]["corrected"];
if (regressions.fxR1.read.ok) {
  if (committed === undefined) {
    regressions.dispose();
    single.dispose();
    throw new Error(
      "the steps read succeeds but no committed golden holds the pre-fix tear — run this entry at the change's branch point, before the read branches are edited",
    );
  }
  fxR1PreFix = committed.fxR1.preFix;
  fxR1Corrected = normalizeGh384StepsRead(regressions.fxR1.identity, regressions.fxR1.read);
} else {
  if (committed !== undefined && committed.fxR1.corrected !== null) {
    regressions.dispose();
    single.dispose();
    throw new Error(
      "the steps read regressed to the pre-fix tear after a corrected half was recorded — refusing to overwrite the golden",
    );
  }
  fxR1PreFix = normalizeGh384StepsTear(regressions.fxR1.identity, regressions.fxR1.read);
  fxR1Corrected = null;
}

let fxR2PreFix: Gh381NormalizedTear;
let fxR2Corrected: Gh384MultiRefReadsGolden["fxR2"]["corrected"];
if (regressions.fxR2.first.ok) {
  if (committed === undefined) {
    regressions.dispose();
    single.dispose();
    throw new Error(
      "ref B's capture succeeds but no committed golden holds the pre-fix tear — run this entry at the change's branch point, before the read branches are edited",
    );
  }
  fxR2PreFix = committed.fxR2.preFix;
  if (regressions.fxR2.repeat === undefined) {
    regressions.dispose();
    single.dispose();
    throw new Error("the corrected fxR2 half is missing its same-identity repeat capture");
  }
  fxR2Corrected = {
    first: normalizeGh384AppendOutcome(regressions.fxR2.first),
    repeat: normalizeGh384AppendOutcome(regressions.fxR2.repeat),
  };
} else {
  if (committed !== undefined && committed.fxR2.corrected !== null) {
    regressions.dispose();
    single.dispose();
    throw new Error(
      "ref B's capture regressed to the pre-fix tear after a corrected half was recorded — refusing to overwrite the golden",
    );
  }
  fxR2PreFix = normalizeGh384CaptureTear(regressions.fxR2.identity, regressions.fxR2.first);
  fxR2Corrected = null;
}

const singleRef: Gh384MultiRefReadsGolden["singleRef"] = {
  healthy: {
    stepsRead: normalizeGh384StepsRead(single.healthy.identity, single.healthy.stepsRead),
    first: normalizeGh384AppendOutcome(single.healthy.first),
    repeat: normalizeGh384AppendOutcome(single.healthy.repeat),
  },
  emptyLedger: {
    stepsRead: normalizeGh384StepsRead(single.emptyLedger.identity, single.emptyLedger.stepsRead),
  },
  tears: {
    bareStepPrefix: normalizeGh384StepsTear(
      single.tears.bareStepPrefix.identity,
      single.tears.bareStepPrefix.stepsRead,
    ),
    bareBaselinePrefix: normalizeGh384CaptureTear(
      single.tears.bareBaselinePrefix.identity,
      single.tears.bareBaselinePrefix.capture,
    ),
    stepKindMismatch: normalizeGh384StepsTear(
      single.tears.stepKindMismatch.identity,
      single.tears.stepKindMismatch.stepsRead,
    ),
    baselineKindMismatch: normalizeGh384CaptureTear(
      single.tears.baselineKindMismatch.identity,
      single.tears.baselineKindMismatch.capture,
    ),
    stepMalformedPayload: normalizeGh384StepsTear(
      single.tears.stepMalformedPayload.identity,
      single.tears.stepMalformedPayload.stepsRead,
    ),
  },
};

regressions.dispose();
single.dispose();

const golden: Gh384MultiRefReadsGolden = {
  requestedRef: GH384_REF,
  foreignRef: GH384_FOREIGN_REF,
  absentRef: GH384_ABSENT_REF,
  fxR1: { preFix: fxR1PreFix, corrected: fxR1Corrected },
  fxR2: { preFix: fxR2PreFix, corrected: fxR2Corrected },
  singleRef,
};

const identifierKey = (key: string): boolean => /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(key);

/** Serialize plain JSON-shaped golden data in the repository's formatter style. */
const serializeGolden = (value: unknown, indent = 0): string => {
  const pad = "  ".repeat(indent);
  const inner = "  ".repeat(indent + 1);
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((item) => `${inner}${serializeGolden(item, indent + 1)},`);
    return `[\n${items.join("\n")}\n${pad}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";
    const lines = entries.map(
      ([key, child]) =>
        `${inner}${identifierKey(key) ? key : JSON.stringify(key)}: ${serializeGolden(child, indent + 1)},`,
    );
    return `{\n${lines.join("\n")}\n${pad}}`;
  }
  throw new Error(`golden data holds a non-JSON value: ${String(value)}`);
};

const file = `/**
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

export const MULTI_REF_READS_GOLDEN: Gh384MultiRefReadsGolden = ${serializeGolden(golden)};
`;

const previous = committed === undefined ? undefined : serializeGolden(committed);
const target = fileURLToPath(new URL("./multi-ref-reads-golden.ts", import.meta.url));
writeFileSync(target, file);

if (previous === undefined) {
  console.log(
    `captured the GH-384 multi-ref-reads golden (pre-fix halves + FX-13 single-ref section) -> ${target}`,
  );
} else if (previous !== serializeGolden(golden)) {
  console.error(
    `the multi-ref-reads golden changed — a deliberate review decision is required (inspect git diff for ${target}); re-run the entry to confirm the new capture is stable`,
  );
  process.exitCode = 1;
} else {
  console.log(`the multi-ref-reads golden is drift-free -> ${target}`);
}
