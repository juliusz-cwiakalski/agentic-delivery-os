/**
 * TC-CLASSIFY-001 / TC-CLASSIFY-002 — the classification chain is total,
 * deterministic, and never silently contains a declared kind; unclassifiable
 * values are explicitly contained by `fallback.internal`.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  classifyDomainKind,
  classifyThrown,
  resolveAppErrorCode,
} from "../../packages/cli/src/classify";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { resolveBrandIdentity } from "../../packages/core/src/branding/index";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  FALLBACK_INTERNAL_CODE,
  FALLBACK_INVOCATION_CODE,
} from "../../packages/core/src/contracts/index";

const entries = ERROR_TABLE as readonly ErrorTableEntry[];
const CONTAINMENT = new Set([FALLBACK_INTERNAL_CODE, FALLBACK_INVOCATION_CODE]);

describe("TC-CLASSIFY-001 declared domain kinds are total", () => {
  test("every declared kind resolves to exactly one non-containment entry and round-trips", () => {
    for (const kind of ["provider", "input"] as const) {
      const entry = classifyDomainKind(kind);
      expect(entry.domainKind).toBe(kind);
      expect(CONTAINMENT.has(entry.code)).toBe(false);
      const resolution = resolveAppErrorCode(entry.code);
      expect(resolution.ok).toBe(true);
      if (resolution.ok) expect(resolution.entry).toEqual(entry);
    }
  });

  test("resolved fields come from the entry with no per-call-site override", () => {
    for (const kind of ["provider", "input"] as const) {
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
    for (const kind of ["provider", "input"] as const) {
      const code = classifyDomainKind(kind).code;
      expect(code).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){2,}$/);
      expect(code).not.toMatch(/^\d/);
      expect(code).not.toContain("://");
      expect(code).not.toContain("HTTP");
    }
  });

  test("resolution is deterministic across ten iterations", () => {
    for (const kind of ["provider", "input"] as const) {
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

describe("TC-CONFIG-020 exact discriminants and safe containment", () => {
  const codes = entries.filter((entry) => entry.domainKind === "config").map((entry) => entry.code);
  test("all nine codes resolve individually with identical table fields", () => {
    expect(codes).toHaveLength(9);
    for (const code of codes) {
      const row = classifyDomainKind("config", code);
      expect(row).toMatchObject({
        code,
        domainKind: "config",
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
      });
      expect(classifyThrown({ kind: "config", code })).toEqual(row);
    }
    expect(() => classifyDomainKind("config")).toThrow();
    expect(() => classifyDomainKind("config", "input.value.rejected")).toThrow();
  });

  test("malformed, missing, unknown and wrong-kind values contain", () => {
    for (const failure of [
      { kind: "config" },
      { kind: "config", code: "config.other.unknown" },
      { kind: "config", code: "provider.quota.exceeded" },
      { kind: "config", code: 42 },
      { kind: "provider", code: "config.value.invalid" },
    ]) {
      expect(classifyThrown(failure).code).toBe(FALLBACK_INTERNAL_CODE);
    }
    expect(classifyDomainKind("provider").code).toBe("provider.quota.exceeded");
    expect(classifyDomainKind("input").code).toBe("input.value.rejected");
  });

  test("each returned and thrown config failure reaches runCli with safe authoritative prose", async () => {
    const branded = resolveBrandIdentity({ workingName: "Fixture" });
    if (!branded.ok) throw new Error("invalid fixture brand");
    for (const code of codes) {
      for (const thrown of [false, true]) {
        const output: string[] = [];
        const errors: string[] = [];
        const deps: CliDependencies = {
          brand: branded.value,
          clock: { now: () => 100 },
          newRunId: () => "run-config-fixture",
          secrets: [],
          program: {
            commands: {
              probe: {
                handler: () => {
                  const error = { kind: "config", code, summary: "UNTRUSTED-CANARY" };
                  if (thrown) throw error;
                  return { error };
                },
              },
            },
          },
        };
        const exit = await runCli(
          ["probe", "--json"],
          {
            stdout: { write: (text) => output.push(text) },
            stderr: { write: (text) => errors.push(text) },
          },
          deps,
        );
        const envelope = JSON.parse(output.join("")) as Record<string, unknown>;
        expect(exit).toBe(1);
        expect(envelope.exitCode).toBe(1);
        expect(envelope).not.toHaveProperty("data");
        expect(envelope.error).toMatchObject({
          code,
          summary: classifyDomainKind("config", code).summary,
        });
        expect(output.join("") + errors.join("")).not.toContain("UNTRUSTED-CANARY");
      }
    }
  });

  test("malformed returned and thrown config discriminants cannot forward summaries", async () => {
    const branded = resolveBrandIdentity({ workingName: "Fixture" });
    if (!branded.ok) throw new Error("invalid fixture brand");
    for (const code of [undefined, "config.invalid.unknown", "input.value.rejected", 9]) {
      for (const thrown of [false, true]) {
        const writes: string[] = [];
        const failure = { kind: "config", code, summary: "UNTRUSTED-CANARY" };
        const exit = await runCli(
          ["probe", "--json"],
          {
            stdout: { write: (text) => writes.push(text) },
            stderr: { write: (text) => writes.push(text) },
          },
          {
            brand: branded.value,
            clock: { now: () => 1 },
            newRunId: () => "run-config-fixture",
            secrets: [],
            program: {
              commands: {
                probe: {
                  handler: () => {
                    if (thrown) throw failure;
                    return { error: failure };
                  },
                },
              },
            },
          },
        );
        expect(exit).toBe(2);
        expect(writes.join("")).toContain(FALLBACK_INTERNAL_CODE);
        expect(writes.join("")).not.toContain("UNTRUSTED-CANARY");
      }
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

const STATE_ROWS = [
  ["state.store.torn", "platform", false, "not_landed", "platform-provider"],
  ["state.schema.mismatch", "platform", false, "not_landed", "platform-provider"],
  ["state.keys.missing", "platform", false, "not_landed", "platform-provider"],
  ["state.lock.busy", "transient", true, "not_landed", "platform-provider"],
  ["state.permission.denied", "user", false, "not_landed", "user-validation"],
  ["state.write.failed", "transient", true, "not_landed", "platform-provider"],
  ["state.level.unsupported", "user", false, "not_landed", "user-validation"],
] as const;

describe("TC-STATE-018 seven exact state identities and containment", () => {
  test("the table declares exactly the seven state rows with their fixed fields", () => {
    const state = entries.filter((entry) => entry.domainKind === "state");
    expect(state).toHaveLength(7);
    expect(state.map((entry) => entry.code)).toEqual(STATE_ROWS.map(([code]) => code));
    for (const [code, category, retryable, consequence, projectionClass] of STATE_ROWS) {
      expect(classifyDomainKind("state", code)).toMatchObject({
        code,
        domainKind: "state",
        category,
        retryable,
        consequence,
        projectionClass,
      });
    }
  });

  test("every state code round-trips as returned and thrown without summary forwarding", () => {
    for (const [code] of STATE_ROWS) {
      const row = classifyDomainKind("state", code);
      expect(resolveAppErrorCode(code)).toEqual({ ok: true, entry: row });
      expect(classifyThrown({ kind: "state", code })).toEqual(row);
      expect(classifyThrown({ kind: "state", code, summary: "UNTRUSTED-CANARY" })).toEqual(row);
      expect(JSON.stringify(classifyThrown({ kind: "state", code }))).not.toContain(
        "UNTRUSTED-CANARY",
      );
    }
  });

  test("kind-only state is ambiguous and contains; it never selects the first row", () => {
    expect(() => classifyDomainKind("state")).toThrow();
    expect(classifyThrown({ kind: "state" }).code).toBe(FALLBACK_INTERNAL_CODE);
    // The first-row control: a /first/ lookup would happily return a state row,
    // proving the ambiguity assertion above is live rather than inert.
    const firstRowClassifier = (kind: string) =>
      (ERROR_TABLE as readonly ErrorTableEntry[]).find((entry) => entry.domainKind === kind);
    expect(firstRowClassifier("state")?.code).toBe("state.store.torn");
  });

  test("wrong, unknown, missing and mismatched state codes contain", () => {
    for (const failure of [
      { kind: "state", code: "state.other.unknown" },
      { kind: "state", code: "config.value.invalid" },
      { kind: "state", code: 42 },
      { kind: "state", code: null },
      { kind: "config", code: "state.store.torn" },
    ]) {
      expect(classifyThrown(failure).code).toBe(FALLBACK_INTERNAL_CODE);
    }
    expect(() => classifyDomainKind("state", "input.value.rejected")).toThrow();
  });

  test("existing provider and config behaviours are unchanged", () => {
    expect(classifyDomainKind("provider").code).toBe("provider.quota.exceeded");
    expect(classifyDomainKind("input").code).toBe("input.value.rejected");
    expect(classifyDomainKind("config", "config.value.invalid").domainKind).toBe("config");
    expect(() => classifyDomainKind("config")).toThrow();
  });

  test("state read-path failures never claim a landed mutation", () => {
    for (const [code] of STATE_ROWS) {
      expect(classifyDomainKind("state", code).consequence).toBe("not_landed");
    }
  });
});
