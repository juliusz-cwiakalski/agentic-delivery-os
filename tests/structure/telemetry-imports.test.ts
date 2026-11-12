/**
 * TC-TELEMETRY-039 (static half) — the telemetry v2 contract module is pure
 * (contracts-internal imports only, no runtime API), the token-bearing capture
 * keeps its committed shape (one session, one JSON object per line), and the
 * scenario module exposes the ingest-matrix builders so no suite scatters
 * ad-hoc frame literals.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  completeTokenFrame,
  driftedExtraFieldFrame,
  driftedRenamedClassFrame,
  driftedUnknownTypeFrame,
  omittedCallsFrame,
  omittedClassFrame,
  omittedCostFrame,
  TOKEN_BEARING_LINES,
  TOKEN_SESSION_ID,
  tokenStepFinish,
} from "../../tests/fixtures/harness/scenarios/stream";

const ROOT = process.cwd();
const CONTRACT_MODULE = join(ROOT, "packages/core/src/contracts/telemetry.ts");
const TOKEN_CAPTURE = join(ROOT, "tests/fixtures/harness/stream/opencode-v2.2.5-tokens.jsonl");
const STREAM_README = join(ROOT, "tests/fixtures/harness/stream/README.md");

const contractSource = (): string => readFileSync(CONTRACT_MODULE, "utf8");

const importSpecifiers = (source: string): readonly string[] =>
  [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1] ?? "");

describe("telemetry v2 static confinement", () => {
  test("the contract module imports only contracts-internal modules", () => {
    const specifiers = importSpecifiers(contractSource());
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier.startsWith("./")).toBe(true);
      expect(specifier.endsWith(".js")).toBe(true);
    }
  });

  test("the contract module carries no runtime API or ambient global", () => {
    const source = contractSource();
    expect(source.includes("node:")).toBe(false);
    expect(source.includes("bun:")).toBe(false);
    expect(/\bprocess\b/.test(source)).toBe(false);
    expect(/\bBun\b/.test(source)).toBe(false);
    expect(/Date\.now|Math\.random/.test(source)).toBe(false);
  });

  test("the token-bearing capture exists with the committed shape", () => {
    expect(existsSync(TOKEN_CAPTURE)).toBe(true);
    const lines = readFileSync(TOKEN_CAPTURE, "utf8")
      .split("\n")
      .filter((line) => line.trim().length > 0);
    expect(lines.length).toBe(6);
    const sessionIds = new Set<string>();
    for (const line of lines) {
      const parsed: unknown = JSON.parse(line);
      expect(typeof parsed).toBe("object");
      expect(parsed).not.toBeNull();
      const frame = parsed as Record<string, unknown>;
      expect(typeof frame.sessionID).toBe("string");
      sessionIds.add(frame.sessionID as string);
    }
    // One shape per file: a single synthetic session identity throughout.
    expect(sessionIds.size).toBe(1);
    expect(TOKEN_SESSION_ID).toBe([...sessionIds][0]);
    expect(TOKEN_BEARING_LINES.length).toBe(6);
  });

  test("the scenario module exposes the ingest-matrix builders", () => {
    const session = "ses_matrix_probe";
    for (const build of [
      completeTokenFrame,
      omittedClassFrame,
      omittedCostFrame,
      omittedCallsFrame,
      driftedExtraFieldFrame,
      driftedRenamedClassFrame,
      driftedUnknownTypeFrame,
    ]) {
      const parsed: unknown = JSON.parse(build(session));
      expect(typeof parsed).toBe("object");
      const frame = parsed as Record<string, unknown>;
      expect(frame.sessionID).toBe(session);
    }
    const drift = JSON.parse(driftedUnknownTypeFrame(session)) as Record<string, unknown>;
    expect(drift.type).not.toBe("step_finish");
    const renamed = JSON.parse(driftedRenamedClassFrame(session)) as {
      readonly part: { readonly tokens: Record<string, unknown> };
    };
    expect(renamed.part.tokens.cache_read).toBe(40);
    expect(renamed.part.tokens.cacheRead).toBeUndefined();
    expect(tokenStepFinish(session).length).toBeGreaterThan(0);
  });

  test("the capture provenance is recorded in the stream README", () => {
    const readme = readFileSync(STREAM_README, "utf8");
    expect(readme.includes("opencode-v2.2.5-tokens.jsonl")).toBe(true);
    expect(readme.includes("synthetic")).toBe(true);
  });
});
