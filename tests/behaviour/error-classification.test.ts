/**
 * TC-CLASSIFY-001 / TC-CLASSIFY-002 — the classification chain is total,
 * deterministic, and never silently contains a declared kind; unclassifiable
 * values are explicitly contained by `fallback.internal`.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyDomainKind,
  classifyThrown,
  resolveAppErrorCode,
} from "../../packages/cli/src/classify";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
} from "../../packages/core/src/contracts/index";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];
const CONTAINMENT = new Set([FALLBACK_INTERNAL_CODE, FALLBACK_INVOCATION_CODE]);

describe("TC-CLASSIFY-001 declared domain kinds are total", () => {
  test("every declared kind resolves to exactly one non-containment entry and round-trips", () => {
    for (const kind of DOMAIN_KINDS) {
      const entry = classifyDomainKind(kind);
      expect(entry.domainKind).toBe(kind);
      expect(CONTAINMENT.has(entry.code)).toBe(false);
      const resolution = resolveAppErrorCode(entry.code);
      expect(resolution.ok).toBe(true);
      if (resolution.ok) expect(resolution.entry).toEqual(entry);
    }
  });

  test("resolved fields come from the entry with no per-call-site override", () => {
    for (const kind of DOMAIN_KINDS) {
      const entry = classifyDomainKind(kind);
      expect(entry.category).toBe(
        entries.find((candidate) => candidate.code === entry.code)?.category,
      );
      expect(entry.retryable).toBe(
        entries.find((candidate) => candidate.code === entry.code)?.retryable,
      );
      expect(entry.consequence).toBe(
        entries.find((candidate) => candidate.code === entry.code)?.consequence,
      );
      expect(entry.remediationHint).toBe(
        entries.find((candidate) => candidate.code === entry.code)?.remediationHint,
      );
    }
  });

  test("identity is symbolic and hierarchical, not numeric or URI-shaped", () => {
    for (const kind of DOMAIN_KINDS) {
      const code = classifyDomainKind(kind).code;
      expect(code).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/);
      expect(code).not.toMatch(/^\d/);
      expect(code).not.toContain("://");
      expect(code).not.toContain("HTTP");
    }
  });

  test("resolution is deterministic across ten iterations", () => {
    for (const kind of DOMAIN_KINDS) {
      const first = JSON.stringify(classifyDomainKind(kind));
      for (let index = 0; index < 10; index += 1) {
        expect(JSON.stringify(classifyDomainKind(kind))).toBe(first);
      }
    }
  });

  test("a temp-copy kind with no mapping is reported by name", () => {
    const root = mkdtempSync(join(tmpdir(), "classification-"));
    const path = join(root, "error-table.ts");
    try {
      writeFileSync(
        path,
        [
          'export const DOMAIN_KINDS = ["provider", "input", "mystery"] as const;',
          "export const ERROR_TABLE = [",
          '  { code: "provider.quota.exceeded", domainKind: "provider" },',
          '  { code: "input.value.rejected", domainKind: "input" },',
          "] as const;",
        ].join("\n"),
      );
      const source = readFileSync(path, "utf8");
      const declaration = source
        .split("\n")
        .find((line) => line.includes("export const DOMAIN_KINDS"));
      const kinds = [...(declaration ?? "").matchAll(/"([a-z]+)"/g)].map(
        (match) => match[1] as string,
      );
      const mapped = [...source.matchAll(/domainKind:\s*"([a-z]+)"/g)].map(
        (match) => match[1] as string,
      );
      const missing = kinds.filter((kind) => !mapped.includes(kind));
      expect(missing).toContain("mystery");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("TC-CLASSIFY-002 unclassifiable values contain to fallback.internal", () => {
  test("undeclared kinds and non-Error values all resolve to fallback.internal", () => {
    const values: unknown[] = [
      { kind: "mystery" },
      { kind: 42 },
      "thrown string",
      undefined,
      null,
      {},
      new TypeError("boom"),
    ];
    for (const value of values) {
      const entry = classifyThrown(value);
      expect(entry.code).toBe(FALLBACK_INTERNAL_CODE);
      expect(entry.category).toBe("platform");
      expect(entry.retryable).toBe(false);
      expect(entry.consequence).toBe("unknown");
      expect(entry.projectionClass).toBe("platform-provider");
      expect(entry.remediationHint.length).toBeGreaterThan(0);
    }
  });

  test("the two containment routes are distinct", () => {
    const invocation = resolveAppErrorCode(FALLBACK_INVOCATION_CODE);
    const internal = resolveAppErrorCode(FALLBACK_INTERNAL_CODE);
    expect(invocation.ok).toBe(true);
    expect(internal.ok).toBe(true);
    if (invocation.ok && internal.ok) {
      expect(invocation.entry.code).not.toBe(internal.entry.code);
      expect(invocation.entry.category).toBe("user");
      expect(internal.entry.category).toBe("platform");
    }
  });

  test("thrown message content never enters the classified entry", () => {
    const sensitiveMessage =
      "Error: at /home/somebody/secret.ts:12 planted-fake-secret-0001\n    at stack";
    const entry = classifyThrown(new Error(sensitiveMessage));
    const serialized = JSON.stringify(entry);
    expect(serialized).not.toContain("planted-fake-");
    expect(serialized).not.toContain("/home/somebody");
    expect(serialized).not.toContain("at stack");
    expect(serialized).not.toContain("Error:");
  });

  test("classification is deterministic", () => {
    const first = JSON.stringify(classifyThrown({ kind: "mystery" }));
    for (let index = 0; index < 5; index += 1) {
      expect(JSON.stringify(classifyThrown({ kind: "mystery" }))).toBe(first);
    }
  });
});
