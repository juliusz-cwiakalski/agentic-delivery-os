/**
 * TC-ERRROW-004 — TDR-0013 records the session-guard reversal, the GH-227 DEC-6
 * supersession, the retained one-shot, and the error-row retirement, and the
 * GH-242 spec references the record.
 *
 * TC-HARNESS-010 (record-content half) — the GH-335 decision set: the integration-mode
 * record, the adapters-contract record, TDR-0041 and TDR-0040 are present with the
 * decision-record convention's frontmatter, each carries an R2 body (problem framing,
 * alternatives, consequences, verification criteria), each has its index row, the
 * adapters-contract record cites TDR-0040 and DEC-13 for the seat rule, and the
 * independent decision review artifact names every record with a tri-state verdict.
 *
 * The constant-equality half of TC-HARNESS-010 (the record's chosen mode equals the
 * contract's `DEFAULT_HARNESS_MODE`) is asserted in the GH-335 contract phase, where
 * that constant is declared.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_HARNESS_MODE, HARNESS_MODES } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const TDR = "doc/decisions/TDR-0013-agent-session-commit-guard-reversal.md";
const INDEX = "doc/decisions/00-index.md";
const SPEC = "doc/changes/2026-11/2026-11-07--GH-242--agent-integration/chg-GH-242-spec.md";

const read = (relative: string): string => readFileSync(join(ROOT, relative), "utf8");

const GH335_PREFIX = "doc/changes/2026-11/2026-11-17--GH-335--opencode-harness-telemetry";
const MODE_RECORD = "doc/decisions/TDR-0042-opencode-integration-mode.md";
const ADAPTERS_RECORD = "doc/decisions/TDR-0043-opencode-harness-adapter-contract.md";
const ENVELOPE_RECORD = "doc/decisions/TDR-0041-harness-dispatch-outcome-envelope-detail.md";
const SEAT_RECORD = "doc/decisions/TDR-0040-harness-seat-spawn-cardinality-and-seat-resolution.md";
const REVIEW = `${GH335_PREFIX}/chg-GH-335-decision-review.md`;

const GH335_RECORDS = [MODE_RECORD, ADAPTERS_RECORD, ENVELOPE_RECORD, SEAT_RECORD] as const;

/** The R2 body every GH-335 record must carry (the decision template's required sections). */
const R2_SECTIONS = [
  "## Problem Framing (Clarified)",
  "## Alternatives Considered",
  "## Trade-offs & Consequences",
  "## Verification Criteria",
] as const;

/** Reads one `## ` section's body, dropping the heading itself. */
const sectionBody = (document: string, heading: string): string => {
  const start = document.indexOf(heading);
  if (start < 0) return "";
  const rest = document.slice(start + heading.length);
  const next = rest.search(/\n## /);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
};

describe("TC-ERRROW-004 TDR-0013", () => {
  test("the record exists with its id, reversal, and supersession", () => {
    const tdr = read(TDR);
    expect(tdr).toContain("id: TDR-0013");
    expect(tdr).toContain("status: Proposed");
    expect(tdr).toContain("supersede GH-227 DEC-6");
    expect(tdr.toLowerCase()).toContain("reversal");
  });

  test("the record states the retained one-shot and the error-row retirement", () => {
    const tdr = read(TDR);
    expect(tdr).toContain("harness one-shot");
    expect(tdr).toContain("error domain from six rows to five");
    expect(tdr).toContain("commit.session.context-refused");
  });

  test("the index carries the record row", () => {
    const index = read(INDEX);
    expect(index).toContain("[TDR-0013](TDR-0013-agent-session-commit-guard-reversal.md)");
    expect(index).toContain("Proposed");
  });

  test("the GH-242 spec references the record in its decision log", () => {
    expect(read(SPEC)).toContain("TDR-0013");
  });
});

describe("TC-HARNESS-010 GH-335 decision records", () => {
  test("all four records are present with the convention's frontmatter", () => {
    for (const relative of GH335_RECORDS) {
      expect(existsSync(join(ROOT, relative)), `${relative} must exist`).toBe(true);
      const body = read(relative);
      const id = /^id: (TDR-\d{4})$/m.exec(body)?.[1];
      expect(id, `${relative} must declare its record id`).toBeDefined();
      expect(relative).toContain(id as string);
      expect(body).toContain("decision_type: tdr");
      expect(body).toContain("status: Proposed");
      expect(body).toContain("rigor: R2");
    }
  });

  test("every record carries a non-empty R2 body", () => {
    for (const relative of GH335_RECORDS) {
      const body = read(relative);
      for (const heading of R2_SECTIONS) {
        const section = sectionBody(body, heading);
        expect(section.length, `${relative} ${heading} must be non-empty`).toBeGreaterThan(120);
      }
    }
  });

  test("every record has its index row", () => {
    const index = read(INDEX);
    for (const relative of GH335_RECORDS) {
      const file = relative.slice("doc/decisions/".length);
      expect(index, `${file} needs an index row`).toContain(`](${file})`);
    }
  });

  test("the integration-mode record names the three declared mode surfaces and a chosen mode", () => {
    const mode = read(MODE_RECORD);
    expect(mode).toContain("--standalone");
    expect(mode).toContain("service start");
    expect(mode).toContain("--server");
    expect(mode).toContain("**Chosen mode value:** `per-invocation-private-server`");
    // The record states the read-only direct-store rationale for the telemetry path.
    expect(mode.toLowerCase()).toContain("read-only direct-store rationale");
    expect(mode).toContain("PRAGMA query_only");
  });

  test("the adapters-contract record cites TDR-0040 and DEC-13 for the seat rule, reference-only", () => {
    const adapters = read(ADAPTERS_RECORD);
    expect(adapters).toContain("TDR-0040");
    expect(adapters).toContain("DEC-13");
    // The record states the rule and its delivery value, never a frozen pair as the rule.
    expect(adapters).toContain("current minor line at delivery time plus one previous minor");
    expect(adapters).toContain("2.3.x");
    expect(adapters).toContain("2.2.x");
    // The seat/carrier rules stay TDR-0040's home; this record cites rather than restates.
    expect(adapters).toContain("By reference only");
    // The expressibility refusal is a predicate: no catalogue and no second child process.
    expect(adapters).toContain("NO recognised-agent or recognised-model catalogue");
    // The observed-axis absence marker and its supersession of the delivered classification.
    expect(adapters).toContain("absentObservedAxes");
    expect(adapters).toContain("invalid-session-identity");
  });
});

describe("TC-HARNESS-010 the record and the code cannot drift", () => {
  test("the integration-mode record's chosen mode equals the delivered constant", () => {
    const mode = read(MODE_RECORD);
    expect(HARNESS_MODES as readonly string[]).toContain(DEFAULT_HARNESS_MODE);
    expect(DEFAULT_HARNESS_MODE).toBe("per-invocation-private-server");
    expect(mode).toContain(`**Chosen mode value:** \`${DEFAULT_HARNESS_MODE}\``);
    for (const member of HARNESS_MODES) {
      expect(mode, member).toContain(member);
    }
  });
});

describe("TC-HARNESS-010 independent decision review", () => {
  test("the review artifact names every committed record with a tri-state verdict", () => {
    expect(existsSync(join(ROOT, REVIEW)), `${REVIEW} must exist`).toBe(true);
    const review = read(REVIEW);
    expect(review).toContain("@decision-critic");
    for (const id of ["TDR-0040", "TDR-0041", "TDR-0042", "TDR-0043"]) {
      expect(review, `the review must name ${id}`).toContain(id);
    }
    const verdicts = review.match(/\b(PASS_WITH_RISKS|PASS|REWORK)\b/g) ?? [];
    expect(verdicts.length).toBeGreaterThanOrEqual(4);
    for (const verdict of verdicts) {
      expect(["PASS", "PASS_WITH_RISKS", "REWORK"]).toContain(verdict);
    }
    expect(review).not.toContain("REWORK");
  });
});

describe("TC-PEAK-027 TDR-0077 states the dispatch-owned watch and the one new row", () => {
  test("the record names dispatch.resume-parked, the terminal-lane refusal, and the watch ownership", () => {
    const record = readFileSync(
      join(ROOT, "doc/decisions/TDR-0077-dispatch-owned-window-watch.md"),
      "utf8",
    );
    expect(record).toContain("dispatch.resume-parked");
    expect(record).toContain("platform-provider");
    expect(record.toLowerCase()).toContain("pre-session refusal");
    expect(record).toContain("exit 2");
    expect(record.toLowerCase()).toContain("dispatch-owned");
  });
});
