/**
 * GH-354 §7.1 — every case drives a real production seam, and a reimplementation
 * is rejected BY NAME (TC-FIXTURE-001).
 *
 * Three mechanisms, all asserted here: import identity through `SEAM_MANIFEST`,
 * a forbidden-signature scan over the operator surface, and a planted control
 * that must be rejected with the seam's name.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  importIdentityViolations,
  REIMPLEMENTATION_SCAN_ROOTS,
  reimplementationViolations,
} from "../fixtures/dispatch/parity/seams";

const ROOT = process.cwd();

describe("TC-FIXTURE-001 production seam identity", () => {
  test("every declared seam resolves to its one production module and is mounted", async () => {
    expect(await importIdentityViolations(ROOT)).toEqual([]);
  });

  test("the operator seams are declared in the manifest", () => {
    const { SEAM_MANIFEST } = require("../fixtures/dispatch/parity/seams") as {
      SEAM_MANIFEST: readonly { readonly seam: string }[];
    };
    for (const seam of [
      "lane-view",
      "delivering-fold",
      "artifact-tail",
      "transcript-read",
      "log-sink",
    ]) {
      expect(
        SEAM_MANIFEST.some((entry) => entry.seam === seam),
        seam,
      ).toBe(true);
    }
  });

  test("no operator suite re-expresses a read decision", () => {
    expect(reimplementationViolations(ROOT)).toEqual([]);
  });

  test("a planted reimplementation is rejected by name", () => {
    const base = join(ROOT, "tmp", "tmpdir");
    mkdirSync(base, { recursive: true });
    const root = mkdtempSync(join(base, "gh354-seam-control-"));
    try {
      // Plant a local 1 048 576 cap with no production constant reference: the
      // artifact-tail signature must name the seam and the file.
      const directory = join(root, "tests/conformance/dispatch");
      mkdirSync(directory, { recursive: true });
      writeFileSync(
        join(directory, "planted.test.ts"),
        "export const CAP = 1_048_576;\nexport const tail = (lines: string[]) => lines.slice(-1);\n",
      );
      // A local 512 cut is the transcript-read signature.
      writeFileSync(
        join(directory, "planted2.test.ts"),
        "export const cut = (text: string) => text.slice(0, 512);\n",
      );
      const violations = reimplementationViolations(root);
      // Each hit names the seam and the offending file (the temp root prefix
      // makes the absolute path, so the assertion matches on the suffix).
      expect(
        violations.some(
          (violation) =>
            violation.startsWith("reimplementation of artifact-tail") &&
            violation.endsWith("tests/conformance/dispatch/planted.test.ts"),
        ),
      ).toBe(true);
      expect(
        violations.some(
          (violation) =>
            violation.startsWith("reimplementation of transcript-read") &&
            violation.endsWith("tests/conformance/dispatch/planted2.test.ts"),
        ),
      ).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the scan covers the declared operator surface roots", () => {
    expect([...REIMPLEMENTATION_SCAN_ROOTS]).toContain("tests/conformance/dispatch");
    expect([...REIMPLEMENTATION_SCAN_ROOTS]).toContain("tests/fixtures/dispatch/parity");
  });
});
