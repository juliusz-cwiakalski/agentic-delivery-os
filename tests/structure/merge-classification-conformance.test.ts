/**
 * TC-ENGINE-054 — classification conformance is total and non-vacuous over the
 * production merge composition's exported `MERGE_COMPOSITION_EMITTABLE_CODES`.
 *
 * The constant is imported from the composition (never a fixture copy), so the
 * case ranges over the composition's own declaration. Every member resolves to a
 * declared error-table row whose `domainKind` agrees with the kind the
 * composition emits for it, the classifier agrees per member, the mismatch
 * control is live, and no row, kind, or exit class was added.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { classifyThrown, resolveAppErrorCode } from "../../packages/cli/src/classify";
import { DOMAIN_KINDS, ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { readFileSync as read } from "node:fs";
import { MERGE_COMPOSITION_EMITTABLE_CODES } from "../../packages/cli/src/production";

const ROOT = process.cwd();
const members: readonly string[] = MERGE_COMPOSITION_EMITTABLE_CODES;

/** The kind the composition emits for one code, read from the delivered rows. */
const emittedKindOf = (code: string): string | undefined => {
  const row = ERROR_TABLE.find((entry) => entry.code === code);
  return row?.domainKind;
};

describe("TC-ENGINE-054 the emittable declaration is total and non-vacuous", () => {
  test("non-empty, duplicate-free, and spanning the declared kinds it can emit", () => {
    expect(members.length).toBeGreaterThan(0);
    expect(new Set(members).size).toBe(members.length);
    // The composition emits three declared kinds: `config` (credential read),
    // `provider` (read faults), and `merge` (its own refusals, including the
    // state-read refusal `merge.state-unverified`, which is the declared
    // identity for that branch — a `state.*` member would name a code the
    // composition never emits).
    const kinds = new Set(
      members.map((code) => ERROR_TABLE.find((entry) => entry.code === code)?.domainKind),
    );
    expect([...kinds].sort()).toEqual(["config", "merge", "provider"]);
    for (const prefix of ["config.", "provider.", "merge."]) {
      expect(
        members.some((code) => code.startsWith(prefix)),
        `missing ${prefix} member`,
      ).toBe(true);
    }
  });

  test("every member resolves to a declared row and agrees with its emitting kind", () => {
    for (const code of members) {
      const resolved = resolveAppErrorCode(code);
      expect(resolved.ok, `${code}: ${resolved.ok ? "" : resolved.reason}`).toBe(true);
      if (!resolved.ok) continue;
      expect(resolved.entry.code).toBe(code);
      expect(emittedKindOf(code)).toBe(resolved.entry.domainKind);
    }
  });

  test("the classifier agrees per member: no member is contained", () => {
    for (const code of members) {
      const row = ERROR_TABLE.find((entry) => entry.code === code);
      if (row === undefined) throw new Error(`no row for ${code}`);
      const classified = classifyThrown({ kind: row.domainKind, code });
      expect(classified.code, code).toBe(code);
      expect(classified.code).not.toBe("fallback.internal");
    }
  });

  test("the mismatch control is live, so a pass cannot be vacuous", () => {
    const contained = classifyThrown({ kind: "provider", code: "config.credential.missing" });
    expect(contained.code).toBe("fallback.internal");
    const declared = classifyThrown({ kind: "config", code: "config.credential.missing" });
    expect(declared.code).toBe("config.credential.missing");
  });

  test("no error-table row, domain kind, or exit class was added", () => {
    // The delivered per-kind counts are the baseline this change must not move.
    const counts = new Map<string, number>();
    for (const row of ERROR_TABLE) {
      counts.set(row.domainKind, (counts.get(row.domainKind) ?? 0) + 1);
    }
    expect(counts.get("config")).toBe(10);
    expect(counts.get("state")).toBe(9);
    expect(counts.get("provider")).toBe(13);
    expect(counts.get("merge")).toBe(7);
    expect([...DOMAIN_KINDS]).toContain("config");
    expect([...DOMAIN_KINDS]).not.toContain("handover");
    for (const row of ERROR_TABLE) {
      expect(["success", "user-validation", "platform-provider", "attention"]).toContain(
        row.projectionClass,
      );
    }
  });

  test("every refusal site in the composition names a declared member", () => {
    const source = read(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    // The scan covers the whole merge composition, not one helper's block: a
    // refusal that returns a literal, or an outcome that carries a literal
    // `code`, is a refusal site wherever it sits.
    const start = source.indexOf("const mergeReadCodeOf");
    const end = source.indexOf("const closeout = createCloseoutComposition");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const block = source.slice(start, end);
    const emitted = [
      ...block.matchAll(/(?:return|\bcode:)\s*"((?:config|provider|merge|state|input)\.[a-z0-9.-]+)"/gu),
    ].map((match) => match[1] as string);
    expect(emitted.length).toBeGreaterThan(0);
    for (const code of emitted) {
      expect(members, `refusal site ${code} is outside the declaration`).toContain(code);
    }
    // The scan is non-vacuous: the credential and request branches are present.
    expect(emitted).toContain("config.credential.missing");
    expect(emitted).toContain("merge.transaction-aborted");
    expect(members.length).toBeGreaterThanOrEqual(emitted.length);
    expect(
      readFileSync(join(ROOT, "packages/core/src/domain/merge-transaction.ts"), "utf8"),
    ).toContain("ERROR_TABLE.find");
  });

  test("a forwarded configuration code is taxonomy-typed and carries a member", () => {
    const source = read(join(ROOT, "packages/cli/src/production.ts"), "utf8");
    // The configuration-read branch forwards the acquisition's or resolver's own
    // code, so its literals are the only codes the composition emits without a
    // `return`/`code:` site: they are declared in one tuple.
    const start = source.indexOf("const MERGE_COMPOSITION_CONFIGURATION_CODES");
    const end = source.indexOf("export const MERGE_COMPOSITION_EMITTABLE_CODES");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const forwarded = [
      ...source.slice(start, end).matchAll(/"((?:config)\.[a-z0-9.-]+)"/gu),
    ].map((match) => match[1] as string);
    expect(forwarded.length).toBeGreaterThan(0);
    for (const code of forwarded) {
      expect(members, `forwarded configuration code ${code} is outside the declaration`).toContain(
        code,
      );
      // Every forwarded code is a configuration row, never another domain's.
      expect(emittedKindOf(code), code).toBe("config");
    }
    // The branch's own refusal cases are members, not a claim about them.
    expect(forwarded).toContain("config.file.malformed");
    expect(forwarded).toContain("config.value.invalid");
    // The forwarded value is the delivered taxonomy's code, so a code the
    // taxonomy does not declare cannot reach the declaration unchecked.
    expect(source).toContain("code: ConfigErrorCode");
  });
});
