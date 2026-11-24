/**
 * GH-406 TC-DPKKEY-001/002, TC-DPKALI-001, TC-DPKACC-001 (unit half) — the
 * additive declared-product-key and clone-key contracts, proven at
 * introduction (the owner amendment 7138707234 names the exports:
 * DECLARED_PRODUCT_KEY_PATTERN with the predicate isDeclaredProductKey).
 *
 * The grammar boundary matrix pins the exact pattern string and every rule of
 * the predicate (length, charset, hyphen position, reserved segment); the
 * alias arm pins `PROJECT_KEY_PATTERN` resolving to the identical value as
 * `CLONE_KEY_PATTERN` (NFR-2, 0 difference); the accessor arm proves the
 * resolved project scope serves `cloneKey` — the clone identity the marker
 * carries — as a pure served read of the delivered persisted value.
 */
import { describe, expect, test } from "bun:test";
import {
  projectKeyFor,
  resolveProjectScope,
  serializeProjectIdentityMarker,
} from "../../packages/core/src/app/state-scope";
import {
  CLONE_KEY_PATTERN,
  DECLARED_PRODUCT_KEY_PATTERN,
  DECLARED_PRODUCT_KEY_REJECTIONS,
  isDeclaredProductKey,
  PROJECT_IDENTITY_SCHEMA,
  PROJECT_KEY_PATTERN,
  PROJECT_UNBOUND_SEGMENT,
  PROJECTS_CONTAINER_SEGMENT,
} from "../../packages/core/src/contracts/projects";

const MARKER_KEY = "alpha-5f1e2d3c";
const MARKER_IDENTIFIER = "5f1e2d3c4b5a69788796a5b4c3d2e1f0";
const MARKER_BASENAME = "alpha";

const markerText = (): string =>
  serializeProjectIdentityMarker({
    schema: PROJECT_IDENTITY_SCHEMA,
    projectKey: MARKER_KEY,
    projectIdentifier: MARKER_IDENTIFIER,
    basename: MARKER_BASENAME,
  });

const resolvedScope = () => {
  const persisted: string[] = [];
  const outcome = resolveProjectScope({
    environment: { HOME: "/srv/operator" },
    environmentPrefix: "JAISHIP_",
    stateDirectoryName: "state",
    homeDirectory: "/srv/operator",
    defaultRootExists: { current: true, prior: false },
    checkout: {
      kind: "resolved",
      checkoutRoot: "/srv/work/alpha",
      commonDir: "/srv/work/alpha/.git",
    },
    ports: {
      readMarker: () => ({ state: "present", text: markerText() }),
      writeMarker: (_commonDir, text) => {
        persisted.push(text);
        return text;
      },
      newProjectIdentifier: () => MARKER_IDENTIFIER,
    },
  });
  if (!outcome.ok) throw new Error(`scope resolution failed: ${outcome.error.code}`);
  return { outcome: outcome.value, persisted };
};

describe("TC-DPKKEY-001 the declared product-key grammar boundary matrix", () => {
  test("the exported pattern is the exact pinned string under its amended name", () => {
    expect(DECLARED_PRODUCT_KEY_PATTERN).toBe("^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$");
    expect([...DECLARED_PRODUCT_KEY_REJECTIONS]).toEqual([
      "length",
      "charset",
      "hyphen-position",
      "reserved-segment",
    ]);
  });

  test("accepts the grammar's interior: 2-char, 64-char, hyphenated keys", () => {
    const long = `a${"b".repeat(62)}a`;
    expect(long).toHaveLength(64);
    for (const key of ["ab", long, "a-b", "a--b", "0x-y9", "my-unbound", "projects-x"]) {
      const verdict = isDeclaredProductKey(key);
      expect(verdict.valid, key).toBe(true);
    }
  });

  test("rejects every outside case naming the violated rule", () => {
    const long65 = `a${"b".repeat(63)}a`;
    expect(long65).toHaveLength(65);
    const rejects: Array<[string, string]> = [
      ["", "length"],
      ["a", "length"],
      [long65, "length"],
      ["AB", "charset"],
      ["a_b", "charset"],
      ["a.b", "charset"],
      ["-abc", "hyphen-position"],
      ["abc-", "hyphen-position"],
      ["---", "hyphen-position"],
    ];
    for (const [key, rule] of rejects) {
      const verdict = isDeclaredProductKey(key);
      expect(verdict.valid, key).toBe(false);
      if (!verdict.valid) expect(verdict.rejection, key).toBe(rule);
    }
  });
});

describe("TC-DPKKEY-002 the reserved state segments are refused", () => {
  test("unbound and projects are refused despite being grammar-valid", () => {
    for (const segment of [PROJECT_UNBOUND_SEGMENT, PROJECTS_CONTAINER_SEGMENT]) {
      const verdict = isDeclaredProductKey(segment);
      expect(verdict.valid, segment).toBe(false);
      if (!verdict.valid) expect(verdict.rejection, segment).toBe("reserved-segment");
    }
  });

  test("the refusal is exact-match: substring-containing keys are accepted", () => {
    for (const key of ["projects-x", "my-unbound", "unbound-2"]) {
      const verdict = isDeclaredProductKey(key);
      expect(verdict.valid, key).toBe(true);
    }
  });

  test("reserved-segment checking rides the lowercase grammar, not a case rule", () => {
    // The uppercase spellings are already refused by the grammar's charset rule.
    for (const key of ["UNBOUND", "PROJECTS"]) {
      const verdict = isDeclaredProductKey(key);
      expect(verdict.valid, key).toBe(false);
      if (!verdict.valid) expect(verdict.rejection, key).toBe("charset");
    }
  });
});

describe("TC-DPKALI-001 the clone-key pattern name and the same-value alias", () => {
  test("CLONE_KEY_PATTERN is exported and governs delivered-style clone keys", () => {
    expect(CLONE_KEY_PATTERN.test("alpha-a1b2c3d4")).toBe(true);
    expect(CLONE_KEY_PATTERN.test("alpha-b2c3d4e5")).toBe(true);
    expect(CLONE_KEY_PATTERN.test("not-a-clone-key")).toBe(false);
    expect(CLONE_KEY_PATTERN.test("alpha-")).toBe(false);
    expect(CLONE_KEY_PATTERN.test("UPPER-A1B2C3D4")).toBe(false);
  });

  test("PROJECT_KEY_PATTERN resolves to the identical value (0 difference)", () => {
    expect(String(PROJECT_KEY_PATTERN)).toBe(String(CLONE_KEY_PATTERN));
    expect(PROJECT_KEY_PATTERN).toBe(CLONE_KEY_PATTERN);
  });
});

describe("TC-DPKACC-001 unit half the resolved scope serves the clone identity", () => {
  test("the resolved project scope exposes cloneKey equal to the marker's identity", () => {
    const { outcome } = resolvedScope();
    expect(outcome.outcome).toBe("existing");
    if (outcome.scope.kind !== "project") throw new Error("expected a project scope");
    expect(outcome.scope.cloneKey).toBe(MARKER_KEY);
    expect(outcome.scope.cloneKey).toBe(outcome.scope.projectKey);
  });

  test("the served value is what the delivered marker mint carries", () => {
    const basename = "alpha";
    const identifier = MARKER_IDENTIFIER;
    const minted = projectKeyFor(basename, identifier);
    const { outcome } = resolvedScope();
    if (outcome.scope.kind !== "project") throw new Error("expected a project scope");
    expect(outcome.scope.cloneKey).toBe(minted);
  });

  test("resolving twice yields the identical served value and writes nothing", () => {
    const first = resolvedScope();
    const second = resolvedScope();
    if (first.outcome.scope.kind !== "project" || second.outcome.scope.kind !== "project") {
      throw new Error("expected project scopes");
    }
    expect(second.outcome.scope.cloneKey).toBe(first.outcome.scope.cloneKey);
    expect(first.persisted).toEqual([]);
    expect(second.persisted).toEqual([]);
  });
});
