/**
 * TC-QLC-072 — the M2 queue planning page is reconciled to the delivered
 * identities and envelope: the three delivered queue identities are named,
 * neither duplicate identity survives, no example envelope carries a
 * top-level `ok`/`command` field, the removal kind is spelled
 * `queue.graph/remove`, and the closeout outcome/skip vocabularies and the
 * 100-entry reconcile cap are documented (GH-292 F-7, AC-F7-2, GAP-T4).
 * Scanned sections must resolve to non-empty spans, so a deleted page or a
 * renamed heading fails instead of scanning nothing.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PAGE = "doc/planning/oss-tooling/milestones/m2/commands/queue.md";

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

/** Parsed JSON envelopes from the fenced blocks of a section. */
const jsonEnvelopes = (section: string): readonly Record<string, unknown>[] => {
  const envelopes: Record<string, unknown>[] = [];
  for (const match of section.matchAll(/```[a-z]*\n([\s\S]*?)```/g)) {
    const body = match[1];
    if (body === undefined) continue;
    const brace = body.indexOf("{");
    if (brace < 0) continue;
    const trimmed = body.slice(brace).trim();
    if (!trimmed.endsWith("}")) continue;
    envelopes.push(JSON.parse(trimmed) as Record<string, unknown>);
  }
  return envelopes;
};

const hasKeyDeep = (value: unknown, key: string): boolean => {
  if (Array.isArray(value)) return value.some((entry) => hasKeyDeep(entry, key));
  if (value !== null && typeof value === "object") {
    return (
      Object.hasOwn(value, key) ||
      Object.values(value as Record<string, unknown>).some((entry) => hasKeyDeep(entry, key))
    );
  }
  return false;
};

describe("TC-QLC-072 the M2 page resolves to non-empty sections", () => {
  test("every scanned section exists with a non-empty span", () => {
    const text = page();
    for (const heading of [
      "NAME",
      "SYNOPSIS",
      "DESCRIPTION",
      "OPTIONS",
      "OUTPUT",
      "EXIT STATUS",
      "EXAMPLES",
      "ERRORS",
      "SEE ALSO",
    ]) {
      expect(sectionOf(text, heading).length, heading).toBeGreaterThan(0);
    }
  });
});

describe("TC-QLC-072 delivered identities are named, duplicates are gone", () => {
  test("the errors table names the three delivered queue identities", () => {
    const errors = sectionOf(page(), "ERRORS");
    for (const identity of [
      "queue.reason-missing",
      "queue.single-flight",
      "queue.entry.unobserved",
    ]) {
      expectToken(errors, identity);
    }
  });

  test("neither duplicate identity appears anywhere on the page", () => {
    const text = page();
    expect(text).not.toContain("queue.entry-unknown");
    expect(text).not.toContain("queue.state-unavailable");
  });
});

describe("TC-QLC-072 every example envelope is the delivered shape", () => {
  test("the examples parse as CommandResult envelopes with no ok or command key", () => {
    const envelopes = jsonEnvelopes(sectionOf(page(), "EXAMPLES"));
    expect(envelopes.length).toBeGreaterThanOrEqual(3);
    for (const envelope of envelopes) {
      const keys = Object.keys(envelope);
      for (const key of keys) {
        expect([
          "schemaVersion",
          "runId",
          "exitCode",
          "timing",
          "data",
          "error",
          "detail",
        ]).toContain(key);
      }
      expect(keys).toContain("schemaVersion");
      expect(keys).toContain("runId");
      expect(keys).toContain("exitCode");
      expect(keys).toContain("timing");
      const hasOutcome = keys.includes("data") || keys.includes("error");
      expect(hasOutcome).toBe(true);
      expect(hasKeyDeep(envelope, "ok")).toBe(false);
      expect(hasKeyDeep(envelope, "command")).toBe(false);
    }
  });

  test("the schema version is the delivered result contract", () => {
    const envelopes = jsonEnvelopes(sectionOf(page(), "EXAMPLES"));
    for (const envelope of envelopes) {
      expect(envelope["schemaVersion"]).toBe("delivery.result.v1");
    }
  });

  test("the single-flight refusal example names the holder at the envelope root", () => {
    const envelopes = jsonEnvelopes(sectionOf(page(), "EXAMPLES"));
    const refusal = envelopes.find(
      (envelope) =>
        envelope["error"] !== null &&
        typeof envelope["error"] === "object" &&
        Object.hasOwn(envelope["error"] as Record<string, unknown>, "code") &&
        (envelope["error"] as Record<string, unknown>)["code"] === "queue.single-flight",
    );
    expect(refusal).toBeDefined();
    expect(Object.hasOwn(refusal as Record<string, unknown>, "detail")).toBe(true);
    expect(Object.hasOwn(refusal as Record<string, unknown>, "data")).toBe(false);
    const detail = (refusal as Record<string, unknown>)["detail"] as Record<string, unknown>;
    expect(typeof detail["holder"]).toBe("string");
  });

  test("the removal example publishes the remove kind, never removed", () => {
    const text = page();
    expect(text).toContain("queue.graph/remove");
    expect(text).not.toContain("queue.graph/removed");
    expect(text).toContain('"kind": "remove"');
    expect(text).not.toContain('"kind": "removed"');
  });
});

describe("TC-QLC-072 the reconcile and closeout contracts are documented", () => {
  test("the page documents the reconcile result keys and the 100-entry cap", () => {
    const output = sectionOf(page(), "OUTPUT");
    for (const token of [
      "checked",
      "removed[]",
      "retained[]",
      "unobserved[]",
      "truncated",
      "remainder",
      "100 entries",
    ]) {
      expectToken(output, token);
    }
  });

  test("the closeout outcome and skip vocabularies are named", () => {
    const errors = sectionOf(page(), "ERRORS");
    for (const outcome of ["removed", "would-remove", "satisfied", "skipped"]) {
      expectToken(errors, outcome);
    }
    for (const skip of ["no-merge-truth", "lease-held", "state-unavailable", "ref-not-canonical"]) {
      expectToken(errors, skip);
    }
    expectToken(errors, "never changes a step outcome");
  });

  test("the reconcile staleness fact is the delivered deliveryState pair", () => {
    const description = sectionOf(page(), "DESCRIPTION");
    expectToken(description, "deliveryState");
    expectToken(description, "`done` or `canceled`");
    expectToken(description, "reconciled");
  });

  test("the dep grammar and the preserved two-positional add are named", () => {
    const description = sectionOf(page(), "DESCRIPTION");
    for (const token of ["`dep add`", "`dep remove`", "two-positional"]) {
      expectToken(description, token);
    }
    const synopsis = sectionOf(page(), "SYNOPSIS");
    expectToken(synopsis, "<binary> queue dep <ref> <on-ref>");
    expectToken(synopsis, "<binary> queue dep add <ref> <on-ref>");
    expectToken(synopsis, "<binary> queue dep remove <ref> <on-ref>");
  });
});
