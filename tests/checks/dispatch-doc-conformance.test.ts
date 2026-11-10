/**
 * TC-PLANREC-001 (phase 7) — the two story-owned planning surfaces carry the
 * amended evidence-based bar: the dispatch reference page and SC-M1-29/SC-M1-30.
 * The scan's file allowlist proves it never inspects the ticket body or any other
 * planning document.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

/** The complete file allowlist: the only planning surfaces this story may edit. */
const ALLOWLIST = [
  "doc/planning/oss-tooling/milestones/m1/commands/dispatch.md",
  "doc/planning/oss-tooling/milestones/m1/test-scenarios.md",
] as const;

const STALE_PHRASES = [
  "two clean weeks",
  "two-week window",
  "fourteen days",
  "eligibility logic = clean window met",
] as const;

const REQUIRED_ON_PAGE = [
  "zero false-success incidents",
  "zero unresolved divergences",
  "all eleven",
  "20 counted dispatches",
  "7 consecutive UTC dates",
  "corroborat",
  "floor",
  "dispatch dual-run resolve",
  "dispatch handover",
  "--revert",
  "claimLease",
  "GITHUB_TOKEN",
  "github-read",
  "config.credential.missing",
  "provider.auth.rejected",
  "provider.outage",
  "provider.payload.invalid",
  "input.value.rejected",
  "404",
  "repository scope",
  "delivered-evidence divergence",
  "(repository, work-item reference)",
  "non-interactive",
  "unshipped",
] as const;

const REQUIRED_ON_SCENARIOS = [
  "zero false-success incidents",
  "zero unresolved divergences",
  "all eleven",
  "20 counted dispatches",
  "7 consecutive UTC dates",
  "corroborat",
  "floor",
  "dispatch handover",
  "--revert",
] as const;

const page = (): string =>
  readFileSync(join(ROOT, "doc/planning/oss-tooling/milestones/m1/commands/dispatch.md"), "utf8");

const seededScenarios = (): string => {
  const text = readFileSync(
    join(ROOT, "doc/planning/oss-tooling/milestones/m1/test-scenarios.md"),
    "utf8",
  );
  const start = text.indexOf("### SC-M1-29");
  const end = text.indexOf("## Coverage map");
  expect(start).toBeGreaterThan(0);
  expect(end).toBeGreaterThan(start);
  return text.slice(start, end);
};

describe("TC-PLANREC-001 story-owned planning surfaces carry the evidence bar", () => {
  test("the reference page carries the four-condition bar and the extra surfaces", () => {
    const text = page().replace(/\s+/gu, " ");
    for (const phrase of REQUIRED_ON_PAGE) {
      expect(text.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
  });

  test("the two seeded scenarios carry the amended bar", () => {
    const text = seededScenarios().replace(/\s+/gu, " ");
    for (const phrase of REQUIRED_ON_SCENARIOS) {
      expect(text.toLowerCase(), phrase).toContain(phrase.toLowerCase());
    }
  });

  test("no stale calendar proxy remains on the allowlisted surfaces", () => {
    for (const file of ALLOWLIST) {
      const text = readFileSync(join(ROOT, file), "utf8").toLowerCase();
      for (const stale of STALE_PHRASES) {
        expect(text, `${file}: ${stale}`).not.toContain(stale);
      }
    }
  });

  test("the scan's allowlist excludes the ticket body and every other planning file", () => {
    expect(ALLOWLIST).toHaveLength(2);
    for (const file of ALLOWLIST) {
      expect(file.startsWith("doc/planning/oss-tooling/milestones/m1/")).toBe(true);
    }
    expect(ALLOWLIST.some((file) => file.includes("backlog"))).toBe(false);
    expect(ALLOWLIST.some((file) => file.includes("roadmap"))).toBe(false);
    expect(ALLOWLIST.some((file) => file.includes("ticket"))).toBe(false);
  });
});
