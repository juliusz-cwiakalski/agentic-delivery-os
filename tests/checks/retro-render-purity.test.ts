/**
 * TC-RETRO-003 — the render-path purity check is green on the tree and fails on
 * every planted inference, network, or ambient-clock violation.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRetroRenderPurity } from "../../scripts/checks/retro-render-purity";

const root = process.cwd();

const probe = (content: string): string => {
  const directory = mkdtempSync(join(tmpdir(), "render-purity-"));
  writeFileSync(join(directory, "probe.ts"), content);
  return directory;
};

describe("TC-RETRO-003 render purity", () => {
  test("the delivered render path is clean and reports a positive scope", () => {
    const report = checkRetroRenderPurity({ root });
    expect(report.failures).toEqual([]);
    expect(report.scanned).toBeGreaterThan(0);
    expect(report.scanned).toBe(report.files.length);
  });

  test("a planted inference import fails naming the file", () => {
    const directory = probe(
      'import { createInferenceTransport } from "@delivery-os/adapters/inference";\n',
    );
    const report = checkRetroRenderPurity({ root: directory, files: ["probe.ts"] });
    expect(report.failures.some((failure) => failure.includes("probe.ts"))).toBe(true);
    expect(report.failures.some((failure) => failure.includes("inference"))).toBe(true);
  });

  test("a planted fetch call and a planted ambient clock read each fail", () => {
    const fetchDirectory = probe("export const call = () => fetch('https://example.invalid');\n");
    expect(
      checkRetroRenderPurity({ root: fetchDirectory, files: ["probe.ts"] }).failures.some(
        (failure) => failure.includes("fetch"),
      ),
    ).toBe(true);

    const clockDirectory = probe("export const now = () => Date.now();\n");
    expect(
      checkRetroRenderPurity({ root: clockDirectory, files: ["probe.ts"] }).failures.some(
        (failure) => failure.includes("Date.now"),
      ),
    ).toBe(true);
  });
});
