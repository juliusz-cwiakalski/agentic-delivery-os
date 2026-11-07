/**
 * TC-PROFILE-035..038 — the carried-over env-record floor, the hardened
 * ceiling, data-not-shell values with the legacy allowlist, and the absence of
 * secret or prompt material.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildProfileEnvRecord,
  serializeEnvRecord,
  validateEnvRecord,
} from "../../packages/core/src/provider/index";
import type { ProviderProfileSeat } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const fixture = (relative: string): string =>
  readFileSync(join(ROOT, "tests/fixtures/provider/env-record", relative), "utf8");

const LEGACY_POLICY = {
  header: "ADOS_HOOK_ENV_V1",
  namePattern: "^OC_ADOS_AGENT_[A-Z0-9_]+_MODEL$",
};

describe("TC-PROFILE-035 carried-over env-record validation floor", () => {
  test("a valid record parses into exact variables", () => {
    const result = validateEnvRecord(fixture("floor/valid.txt"), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variables).toEqual({ OC_ADOS_AGENT_PM_MODEL: "claude-opus" });
    expect(result.entries).toEqual([
      { operation: "set", name: "OC_ADOS_AGENT_PM_MODEL", value: "claude-opus" },
      { operation: "unset", name: "OC_ADOS_AGENT_OLD_MODEL" },
    ]);
  });

  const rejects: ReadonlyArray<readonly [string, string]> = [
    ["floor/bad-header.txt", "provider.env-record.malformed"],
    ["floor/missing-final-lf.txt", "provider.env-record.malformed"],
    ["floor/duplicate.txt", "provider.env-record.duplicate"],
    ["floor/unauthorized.txt", "provider.env-record.unauthorized"],
  ];
  for (const [relative, code] of rejects) {
    test(`${relative} is rejected as ${code}`, () => {
      const result = validateEnvRecord(fixture(relative), undefined);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(code);
    });
  }

  test("a CR byte anywhere is rejected", () => {
    const result = validateEnvRecord(
      "# model-env data-v1\r\nset OC_ADOS_AGENT_PM_MODEL=claude-opus\r\n",
      undefined,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.env-record.malformed");
  });

  test("a NUL byte anywhere is rejected", () => {
    const result = validateEnvRecord(
      "# model-env data-v1\nset OC_ADOS_AGENT_PM_MODEL=a\0b\n",
      undefined,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("provider.env-record.malformed");
  });

  test("over-limit bytes, line, and record count are classified oversized", () => {
    const text = fixture("floor/valid.txt");
    const bytes = validateEnvRecord(text, { maxBytes: 10 });
    expect(bytes.ok === false && bytes.error.code).toBe("provider.env-record.oversized");
    const line = validateEnvRecord(text, { maxLineBytes: 5 });
    expect(line.ok === false && line.error.code).toBe("provider.env-record.oversized");
    const records = validateEnvRecord(text, { maxRecords: 1 });
    expect(records.ok === false && records.error.code).toBe("provider.env-record.oversized");
  });

  test("a boundary-sized valid payload passes", () => {
    const text = fixture("floor/valid.txt");
    const result = validateEnvRecord(text, {
      maxBytes: text.length,
      maxLineBytes: 1000,
      maxRecords: 2,
    });
    expect(result.ok).toBe(true);
  });

  test("a configured header containing LF, CR, or NUL is refused at serialization and parse", () => {
    for (const header of ["# model\nenv", "# model\renv", "# model\0env"]) {
      const serialized = serializeEnvRecord(
        [{ operation: "set", name: "OC_ADOS_AGENT_PM_MODEL", value: "m" }],
        { header },
      );
      expect(serialized.ok).toBe(false);
      if (serialized.ok) continue;
      expect(serialized.error.code).toBe("provider.env-record.malformed");
      expect(serialized.error.detail).toContain("header");

      const parsed = validateEnvRecord("# model-env data-v1\n", { header });
      expect(parsed.ok).toBe(false);
      if (parsed.ok) continue;
      expect(parsed.error.code).toBe("provider.env-record.malformed");
    }
  });
});

describe("TC-PROFILE-036 hardened env-record validation ceiling", () => {
  const rejects: readonly string[] = [
    "ceiling/embedded-equals.txt",
    "ceiling/homoglyph.txt",
    "ceiling/metacharacter-name.txt",
    "ceiling/lowercase-name.txt",
  ];
  for (const relative of rejects) {
    test(`${relative} is refused by the identifier/allowlist rules`, () => {
      const result = validateEnvRecord(fixture(relative), undefined);
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("provider.env-record.unauthorized");
    });
  }

  test("allowlist matching is exact and rejects lookalikes", () => {
    const homoglyph = validateEnvRecord(fixture("ceiling/homoglyph.txt"), undefined);
    expect(homoglyph.ok).toBe(false);
    const clean = validateEnvRecord(fixture("floor/valid.txt"), undefined);
    expect(clean.ok).toBe(true);
  });

  test("a metacharacter in the value is accepted as data", () => {
    const result = validateEnvRecord(
      fixture("legacy-carryover/value-metacharacters.txt"),
      undefined,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variables.OC_ADOS_AGENT_PM_MODEL).toBe("value with = embedded");
  });

  test("a failure never partially applies earlier valid records", () => {
    const text = "# model-env data-v1\nset OC_ADOS_AGENT_PM_MODEL=ok\nset SECRET_TOKEN=bad\n";
    const result = validateEnvRecord(text, undefined);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.record).toBe("SECRET_TOKEN");
    expect(result).not.toHaveProperty("variables");
  });
});

describe("TC-PROFILE-037 values are data and the legacy allowlist carries over", () => {
  test("shell metacharacters survive as the exact literal value", () => {
    const result = validateEnvRecord(fixture("legacy-carryover/shell-value.txt"), undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.variables.OC_ADOS_AGENT_PM_MODEL).toBe(
      '$(touch /tmp/pwned); `id`; * = \\ "quoted" && echo',
    );
  });

  test("the legacy header and allowlist are accepted when declared", () => {
    const result = validateEnvRecord(fixture("legacy-carryover/legacy-header.txt"), LEGACY_POLICY);
    expect(result.ok).toBe(true);
    const wrongHeader = validateEnvRecord(fixture("legacy-carryover/legacy-header.txt"), undefined);
    expect(wrongHeader.ok).toBe(false);
  });

  test("the built-in allowlist accepts the legacy shape and rejects others", () => {
    const accepted = validateEnvRecord(fixture("legacy-carryover/legacy-valid.txt"), undefined);
    expect(accepted.ok).toBe(true);
    const rejected = validateEnvRecord(
      "# model-env data-v1\nset OC_ADOS_AGENT_PM=value\n",
      undefined,
    );
    expect(rejected.ok).toBe(false);
  });

  test("a configured allowlist is honored and resetting returns the built-in behavior", () => {
    const custom = { namePattern: "^MODEL_[A-Z_]+$" };
    const record = serializeEnvRecord([{ operation: "set", name: "MODEL_PM", value: "x" }], custom);
    expect(record.ok).toBe(true);
    const rejected = serializeEnvRecord(
      [{ operation: "set", name: "OC_ADOS_AGENT_PM_MODEL", value: "x" }],
      custom,
    );
    expect(rejected.ok).toBe(false);
    const builtIn = serializeEnvRecord(
      [{ operation: "set", name: "OC_ADOS_AGENT_PM_MODEL", value: "x" }],
      undefined,
    );
    expect(builtIn.ok).toBe(true);
  });

  test("the legacy hook file is read-only evidence and remains the file-class oracle", () => {
    const hook = readFileSync(join(ROOT, "scripts/ceo-loop.sh"), "utf8");
    expect(hook).toContain("safe regular file");
    expect(hook).toContain("unsafe ownership or permissions");
    expect(hook).toContain("final LF");
  });
});

describe("TC-PROFILE-038 the env record carries no secret or prompt material", () => {
  test("a built record contains only seats, models, and agent role names", () => {
    const seats: Record<string, ProviderProfileSeat> = {
      pm: { model: "claude-opus", pacingClass: "judgment", capability: "vision-capable" },
      coder: { model: "claude-sonnet", pacingClass: "execution", capability: "text-only" },
    };
    const canary = "CANARY-PROMPT-abc";
    const built = buildProfileEnvRecord({
      seatModels: { pm: canary, coder: "claude-sonnet" },
      seats,
      namePrefix: "ADOS",
    });
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.record.serialized).toContain("OC_ADOS_AGENT_PM_MODEL");
    expect(built.record.serialized).not.toContain("authorization");
    expect(built.record.serialized).not.toContain("Bearer");
    expect(built.record.entries.every((entry) => entry.operation === "set")).toBe(true);
  });
});
