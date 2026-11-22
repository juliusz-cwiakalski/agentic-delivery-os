/**
 * The explicit FX-5 golden capture entry (GH-381 TC-TELEMETRY-046).
 *
 * Captures the delivered single-ref results of the per-ref telemetry families
 * read — record collections with ordering, the verified-empty flag, the
 * evidence pair, and every delivered tear identity and location — into the
 * committed golden `foreign-ref-skip-golden.ts`. The capture MUST run against
 * delivered behavior BEFORE the GH-381 branch edit (test-plan §8.2 ordering
 * constraint), and re-running it after the fix must produce a byte-identical
 * file: any diff is a deliberate review decision, never a rewrite.
 *
 *   TMPDIR=<scratch> bun tests/fixtures/telemetry/foreign-ref-skip-golden-run.ts
 *
 * Every temp root the capture builds is removed before it exits; the golden
 * holds no absolute path — the per-run state directory is normalized to the
 * `<stateDirectory>` placeholder. The data is serialized in the repository's
 * canonical formatter style (unquoted identifier keys, trailing commas,
 * two-space indent), so a regenerated file stays formatter-clean.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  buildGh381GoldenCases,
  GH381_FOREIGN_REF,
  GH381_REF,
  normalizeGh381Read,
  normalizeGh381Tear,
} from "./index";

const cases = buildGh381GoldenCases();

const golden = {
  requestedRef: GH381_REF,
  foreignRef: GH381_FOREIGN_REF,
  healthy: normalizeGh381Read(cases.healthy.identity, cases.healthy.read),
  emptyLedger: normalizeGh381Read(cases.emptyLedger.identity, cases.emptyLedger.read),
  tears: {
    bareStepPrefix: normalizeGh381Tear(
      cases.tears.bareStepPrefix.identity,
      cases.tears.bareStepPrefix.read,
    ),
    bareBaselinePrefix: normalizeGh381Tear(
      cases.tears.bareBaselinePrefix.identity,
      cases.tears.bareBaselinePrefix.read,
    ),
    stepKindMismatch: normalizeGh381Tear(
      cases.tears.stepKindMismatch.identity,
      cases.tears.stepKindMismatch.read,
    ),
    baselineKindMismatch: normalizeGh381Tear(
      cases.tears.baselineKindMismatch.identity,
      cases.tears.baselineKindMismatch.read,
    ),
    stepMalformedPayload: normalizeGh381Tear(
      cases.tears.stepMalformedPayload.identity,
      cases.tears.stepMalformedPayload.read,
    ),
  },
};

cases.dispose();

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
 * TC-TELEMETRY-046 committed golden: the delivered single-ref results of the
 * per-ref telemetry families read — records with ordering, the verified-empty
 * flag, the evidence pair, and every delivered tear identity and location —
 * captured from delivered behavior before the GH-381 branch edit (test-plan
 * §8.2 ordering constraint).
 *
 * Regenerate only with the explicit capture entry, never by hand and never as
 * a blanket rewrite; a golden change that alters a tear case must fail review:
 *
 *   bun tests/fixtures/telemetry/foreign-ref-skip-golden-run.ts
 *
 * The <stateDirectory> placeholder stands for the per-run temp state root, so
 * the golden holds no absolute path.
 */
import type { Gh381NormalizedRead, Gh381NormalizedTear } from "./index";

export type ForeignRefSkipGolden = {
  readonly requestedRef: string;
  readonly foreignRef: string;
  readonly healthy: Gh381NormalizedRead;
  readonly emptyLedger: Gh381NormalizedRead;
  readonly tears: {
    readonly bareStepPrefix: Gh381NormalizedTear;
    readonly bareBaselinePrefix: Gh381NormalizedTear;
    readonly stepKindMismatch: Gh381NormalizedTear;
    readonly baselineKindMismatch: Gh381NormalizedTear;
    readonly stepMalformedPayload: Gh381NormalizedTear;
  };
};

export const FOREIGN_REF_SKIP_GOLDEN: ForeignRefSkipGolden = ${serializeGolden(golden)};
`;

const target = fileURLToPath(new URL("./foreign-ref-skip-golden.ts", import.meta.url));
writeFileSync(target, file);
console.log(`captured the FX-5 golden (7 arms) -> ${target}`);
