/**
 * GH-354 §7.2, NFR-7 — every new suite and fixture is isolated to the approved
 * temp base (TC-FIXTURE-003).
 *
 * The declared list matches the on-disk set, every fixture root comes from the
 * repository-local approved base, and a representative read leaves the operator's
 * real state directory fingerprint identical.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import { realStateDirectory, realStateFingerprint } from "../fixtures/projects/state-scope";
import { createOperatorHarness, OPERATOR_REF } from "../fixtures/dispatch/operator/harness";
import { createTranscriptDouble } from "../fixtures/dispatch/operator/transcript";

const ROOT = process.cwd();
const brand = (() => {
  const resolved = resolveBrandIdentity({ workingName: "delivery-os" });
  if (!resolved.ok) throw new Error("brand resolution failed");
  return resolved.value;
})();

const OPERATOR_SUITES = [
  "tests/conformance/dispatch/dispatch-operator-status.test.ts",
  "tests/conformance/dispatch/dispatch-operator-isdel.test.ts",
  "tests/conformance/dispatch/dispatch-operator-log.test.ts",
  "tests/conformance/dispatch/dispatch-operator-message.test.ts",
  "tests/conformance/dispatch/dispatch-operator-grammar.test.ts",
  "tests/conformance/dispatch/dispatch-operator-persist.test.ts",
  "tests/conformance/dispatch/dispatch-operator-matrix.test.ts",
  "tests/conformance/dispatch/dispatch-operator-posture.test.ts",
  "tests/behaviour/dispatch-operator-log-bounds.test.ts",
  "tests/behaviour/dispatch-operator-artifact-writer.test.ts",
  "tests/behaviour/dispatch-operator-message-composition.test.ts",
  "tests/behaviour/dispatch-operator-transcript-opencode.test.ts",
  "tests/behaviour/dispatch-operator-latency.test.ts",
  "tests/structure/dispatch-operator-composition.test.ts",
  "tests/checks/operator-contract-invariance.test.ts",
  "tests/checks/operator-seam-identity.test.ts",
  "tests/checks/operator-proof-boundary.test.ts",
  "tests/checks/dispatch-operator-test-isolation.test.ts",
] as const;

const OPERATOR_FIXTURES = [
  "tests/fixtures/dispatch/operator/harness.ts",
  "tests/fixtures/dispatch/operator/matrix.ts",
  "tests/fixtures/dispatch/operator/probe.ts",
  "tests/fixtures/dispatch/operator/streams.ts",
  "tests/fixtures/dispatch/operator/logs.ts",
  "tests/fixtures/dispatch/operator/transcript.ts",
  "tests/fixtures/dispatch/operator/decoys.ts",
  "tests/fixtures/dispatch/operator/bounds.ts",
  "tests/fixtures/dispatch/operator/contract-baseline.ts",
] as const;

/**
 * The suites whose SOURCE is scanned. This guard is excluded because it names
 * the forbidden shapes it rejects; scanning itself would be self-defeating.
 */
const SCANNED_SUITES = OPERATOR_SUITES.filter(
  (file) => file !== "tests/checks/dispatch-operator-test-isolation.test.ts",
);

describe("TC-FIXTURE-003 test isolation", () => {
  test("every declared suite and fixture exists on disk", () => {
    for (const file of [...OPERATOR_SUITES, ...OPERATOR_FIXTURES]) {
      expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
  });

  test("no operator fixture uses tmpdir() directly and every root is under tmp/tmpdir", () => {
    for (const file of OPERATOR_FIXTURES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes("node:os"), file).toBe(false);
      expect(text.includes("tmpdir()"), file).toBe(false);
      if (text.includes("mkdtempSync")) {
        expect(text.includes('"tmp", "tmpdir"') || text.includes("APPROVED_BASE"), file).toBe(true);
      }
    }
    for (const file of SCANNED_SUITES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes("node:os"), file).toBe(false);
    }
  });

  test("no operator suite composes the repository root as its working directory", () => {
    for (const file of SCANNED_SUITES) {
      const text = readFileSync(join(ROOT, file), "utf8");
      expect(text.includes("cwd: process.cwd()"), file).toBe(false);
      expect(text.includes("workingDirectory: process.cwd()"), file).toBe(false);
    }
  });

  test("a representative read leaves the real state directory unchanged", async () => {
    const before = realStateFingerprint(brand);
    const transcript = createTranscriptDouble({ messages: { "ses-isolated": "done" } });
    const h = createOperatorHarness({ label: "isolation", transcriptRead: transcript.read });
    try {
      h.seedLane({ ref: OPERATOR_REF, state: "terminal", sessionId: "ses-isolated" });
      await h.run(["dispatch", "status", OPERATOR_REF, "--json"]);
      await h.run(["dispatch", "last-message", OPERATOR_REF, "--json"]);
    } finally {
      h.dispose();
    }
    expect(realStateFingerprint(brand)).toBe(before);
    // The harness's own state lives under the repo-local temp base, not there.
    expect(realStateDirectory(brand).startsWith(ROOT)).toBe(false);
  });
});
