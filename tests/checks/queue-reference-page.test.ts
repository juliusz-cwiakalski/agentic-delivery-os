/**
 * TC-QLC-071 — the queue reference page resolves as the help-guide page root
 * and documents every delivered verb, the closed reason vocabulary, the
 * refusal identities with the envelope-root holder, the per-ref single-flight
 * precedence, the reconcile contract, and the exit matrix (GH-292 F-7,
 * AC-F7-2). Token checks prove presence and absence only (GAP-T4); sentence
 * truth is a review attestation.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COVERAGE_PATH, runHelpGuideCoverage } from "../../scripts/checks/help-guide-coverage";

const ROOT = process.cwd();
const PAGE = "doc/planning/oss-tooling/milestones/m1/commands/queue.md";

const page = (): string => readFileSync(join(ROOT, PAGE), "utf8");

/** Collapse whitespace so a prose token never fails on a line wrap. */
const flat = (text: string): string => text.replace(/\s+/g, " ");

/** Normalized containment: the token must appear with any line wrapping. */
const expectToken = (span: string, token: string): void => {
  expect(flat(span)).toContain(flat(token));
};

/** Resolve one `## heading` span, failing loudly when missing or empty. */
const sectionOf = (text: string, heading: string): string => {
  const start = text.indexOf(`## ${heading}`);
  if (start < 0) throw new Error(`missing section heading: ${heading}`);
  const rest = text.slice(start);
  const end = rest.indexOf("\n## ", 1);
  const span = end < 0 ? rest : rest.slice(0, end);
  if (span.trim().length === 0) throw new Error(`empty section span: ${heading}`);
  return span;
};

const readCoverage = (): {
  readonly commands: readonly string[];
  readonly referencePages: readonly string[];
} =>
  JSON.parse(readFileSync(join(ROOT, COVERAGE_PATH), "utf8")) as {
    readonly commands: readonly string[];
    readonly referencePages: readonly string[];
  };

describe("TC-QLC-071 the queue page root resolves", () => {
  test("the coverage inventory resolves queue to the M1 reference page", () => {
    const inventory = readCoverage();
    expect(inventory.commands).toContain("queue");
    expect(inventory.referencePages).toContain(PAGE);
  });

  test("help-guide coverage reports zero failures for the queue family", () => {
    const failures = runHelpGuideCoverage().filter((failure) => failure.id === "queue");
    expect(failures).toEqual([]);
  });

  test("the page carries the help and version self-description", () => {
    const text = page();
    expect(text).toContain("--help");
    expect(text).toContain("--version");
  });
});

describe("TC-QLC-071 the page documents every delivered verb", () => {
  test("the synopsis names all ten verbs and the three dependency forms", () => {
    const synopsis = sectionOf(page(), "SYNOPSIS");
    const verbs = [
      "ready",
      "list",
      "plan",
      "add",
      "prioritize",
      "dep",
      "claim",
      "release",
      "remove",
      "reconcile",
    ];
    const missing = verbs.filter((verb) => !flat(synopsis).includes(`<binary> queue ${verb}`));
    expect(missing).toEqual([]);
    expectToken(synopsis, "<binary> queue dep <ref> <on-ref>");
    expectToken(synopsis, "<binary> queue dep add <ref> <on-ref>");
    expectToken(synopsis, "<binary> queue dep remove <ref> <on-ref>");
    expectToken(
      synopsis,
      "<binary> queue remove <ref> --reason <landed|abandoned|superseded|reconciled>",
    );
    expectToken(synopsis, "<binary> queue reconcile [--ref <ref>]");
  });

  test("the shipped GH-292 contract names the new verbs and the preserved two-positional add", () => {
    const shipped = sectionOf(page(), "Shipped contract (GH-292)");
    for (const verb of ["queue remove", "queue dep add", "queue dep remove", "queue reconcile"]) {
      expectToken(shipped, verb);
    }
    expectToken(shipped, "two-positional");
  });

  test("the closed reason vocabulary is named and --reason is required", () => {
    const shipped = sectionOf(page(), "Shipped contract (GH-292)");
    for (const reason of ["landed", "abandoned", "superseded", "reconciled"]) {
      expectToken(shipped, reason);
    }
    expectToken(shipped, "closed four-value vocabulary");
    expectToken(shipped, "queue.reason-missing");
    expectToken(shipped, "input.value.rejected");
  });
});

describe("TC-QLC-071 the page states the refusal identities and the holder slot", () => {
  test("the exit matrix and the errors section name the delivered identities", () => {
    const text = page();
    const errors = sectionOf(text, "ERRORS");
    for (const identity of [
      "queue.reason-missing",
      "queue.single-flight",
      "queue.entry.unobserved",
      "queue.precondition.unmet",
      "queue.lease-conflict",
      "queue.dependency-cycle",
      "input.value.rejected",
      "provider.auth.rejected",
      "provider.outage",
      "provider.quota.exceeded",
      "state.*",
    ]) {
      expectToken(errors, identity);
    }
    const exit = sectionOf(text, "EXIT STATUS");
    expectToken(exit, "Exit matrix");
    expectToken(exit, "queue.reason-missing");
    expectToken(exit, "queue.single-flight");
    expectToken(exit, "queue.entry.unobserved");
    expectToken(exit, "queue.lease-conflict");
    expectToken(exit, "no exit outside {0, 1, 2}");
  });

  test("the refusal holder is named at the envelope root and the error keeps six fields", () => {
    const shipped = sectionOf(page(), "Shipped contract (GH-292)");
    expectToken(shipped, "detail.holder");
    expectToken(shipped, "128 characters");
    expectToken(shipped, "CommandResultError");
    expectToken(shipped, "error.detail");
  });

  test("release is never described as removal", () => {
    const text = page();
    expectToken(text, "never removes an entry");
    expect(flat(text.toLowerCase())).not.toContain("release removes");
  });
});

describe("TC-QLC-071 the page shows the per-ref single-flight precedence", () => {
  test("the precedence table covers both paths, the stale takeover, and the per-pass distinction", () => {
    const shipped = sectionOf(page(), "Shipped contract (GH-292)");
    for (const cell of [
      "Per-ref single-flight precedence",
      "recorded ref = requested ref, any holder",
      "recorded ref ≠ requested ref, any holder",
      "same ref, caller's own holder",
      "same ref, another holder",
      "other ref, any holder",
      "stale lease (heartbeat age ≥ TTL)",
      "taken-over",
      "renewed",
      "queue.lease-conflict",
      "queue.single-flight",
      "per-pass single-flight",
      "A refusal appends nothing and publishes no event",
      "one (repository, ref, holder)",
    ]) {
      expectToken(shipped, cell);
    }
  });
});

describe("TC-QLC-071 the page documents the reconcile and closeout contracts", () => {
  test("reconcile is bounded, fail-closed, and reconciles done or canceled entries", () => {
    const shipped = sectionOf(page(), "Shipped contract (GH-292)");
    for (const token of [
      "queue reconcile [--ref <ref>]",
      "`done` or `canceled`",
      "`unobserved`",
      "100 entries",
      "truncated",
      "removes nothing",
      "reports the second observation truthfully",
    ]) {
      expectToken(shipped, token);
    }
  });

  test("the closeout block and its outcome and skip vocabularies are named", () => {
    const shipped = sectionOf(page(), "Shipped contract (GH-292)");
    for (const token of ["closeout --apply", "landed", "queueRemoval"]) {
      expectToken(shipped, token);
    }
    for (const outcome of ["removed", "would-remove", "satisfied", "skipped"]) {
      expectToken(shipped, outcome);
    }
    for (const skip of ["no-merge-truth", "lease-held", "state-unavailable", "ref-not-canonical"]) {
      expectToken(shipped, skip);
    }
    expectToken(shipped, "never changes a step outcome");
  });
});
