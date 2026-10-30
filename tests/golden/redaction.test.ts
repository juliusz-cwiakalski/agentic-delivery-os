/**
 * TC-REDACT-001..003 — planted secrets never survive on either stream; the
 * chokepoint covers success payloads, failure summaries, nested shapes, keys,
 * embedded substrings, and escaping. Vacuity controls prove detection.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { type CliDependencies, type CommandProgram, runCli } from "../../packages/cli/src/index";
import { redact } from "../../packages/cli/src/output/serialize";
import { loadGoldenCases } from "../../packages/testkit/src/result-conformance";
import {
  bufferSink,
  GOLDEN_ROOT,
  isSingleJsonDocument,
  loadProgram,
  ROOT,
  runCase,
  SYNTHETIC_BRAND,
} from "./helpers";

type CorpusCase = {
  readonly id: string;
  readonly payload: unknown;
  readonly secrets: readonly string[];
  readonly expected: unknown;
  readonly fragments?: readonly string[];
};

const corpus = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/result/redaction/cases.json"), "utf8"),
) as { cases: CorpusCase[] };
const cases = await loadGoldenCases(GOLDEN_ROOT);
const secretSuccess = cases.find((entry) => entry.id === "secret-success");
const secretFailure = cases.find((entry) => entry.id === "secret-failure");
if (secretSuccess === undefined || secretFailure === undefined) {
  throw new Error("secret goldens are missing");
}

const decode = (text: string): string =>
  text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");

const markerCount = (text: string): number => (text.match(/planted-fake-/g) ?? []).length;

const runPayload = async (
  payload: unknown,
  secrets: readonly string[],
  asFailure = false,
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  const program: CommandProgram = {
    commands: {
      "synthetic.ok": {
        handler: () => {
          if (asFailure) throw { kind: "input", summary: JSON.stringify(payload) };
          return { data: payload };
        },
      },
    },
  };
  const stdout = bufferSink();
  const stderr = bufferSink();
  const ticks = [1000, 1007] as const;
  let tick = 0;
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: {
      now: () => {
        const value = ticks[Math.min(tick, 1)] as number;
        tick += 1;
        return value;
      },
    },
    newRunId: () => "run-redaction",
    secrets,
    program,
  };
  const exitCode = await runCli(["--json", "synthetic.ok"], { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value };
};

const makeUnredactedSerializer = async (): Promise<{
  serializeEnvelope: (envelope: unknown, secrets: readonly string[]) => string;
}> => {
  const directory = mkdtempSync(join(tmpdir(), "unredacted-serializer-"));
  const target = join(directory, "mutant.ts");
  writeFileSync(
    target,
    "export const serializeEnvelope = (envelope: unknown, _secrets: readonly string[]): string =>\n" +
      "  `${JSON.stringify(envelope, null, 2)}\\n`;\n",
  );
  return import(`${pathToFileURL(target).href}?v=${Date.now()}`) as Promise<{
    serializeEnvelope: (envelope: unknown, secrets: readonly string[]) => string;
  }>;
};

describe("TC-REDACT-001 planted secret in a success payload", () => {
  test("the golden carries no marker on either stream", async () => {
    const run = await runCase(secretSuccess);
    expect(run.stdout).toBe(secretSuccess.stdout);
    expect(markerCount(run.stdout)).toBe(0);
    expect(markerCount(run.stderr)).toBe(0);
    expect(markerCount(decode(run.stdout))).toBe(0);
    expect(markerCount(decode(run.stderr))).toBe(0);
  });

  test("the payload shape survives with [redacted] at every planted position", async () => {
    const run = await runCase(secretSuccess);
    const envelope = JSON.parse(run.stdout) as { data: Record<string, unknown> };
    const data = envelope.data;
    expect(data.token).toBe("[redacted]");
    expect((data.nested as Record<string, unknown>).credential).toBe("[redacted]");
    expect(data.items).toEqual(["[redacted]", "safe-value"]);
    expect(data["[redacted]"]).toBe("as-object-key");
    expect(data.url).toBe("https://example.invalid/dsn?token=[redacted]");
    expect(Object.hasOwn(data, "planted-fake-secret-0004")).toBe(false);
    expect(isSingleJsonDocument(run.stdout)).toBe(true);
  });

  test("a redaction-disabled serializer leaks the marker", async () => {
    const mutant = await makeUnredactedSerializer();
    const envelope = {
      schemaVersion: "delivery.result.v1",
      runId: "run-redaction-vacuity",
      exitCode: 0,
      timing: { totalMs: 13 },
      data: loadProgram("secret-data").data,
    };
    const leaked = mutant.serializeEnvelope(envelope, []);
    expect(markerCount(leaked)).toBeGreaterThan(0);
  });
});

describe("TC-REDACT-002 planted secret in a failure error object", () => {
  test("the failure golden carries no marker on either stream", async () => {
    const run = await runCase(secretFailure);
    expect(run.stdout).toBe(secretFailure.stdout);
    expect(markerCount(run.stdout)).toBe(0);
    expect(markerCount(run.stderr)).toBe(0);
    expect(markerCount(decode(run.stdout))).toBe(0);
    expect(markerCount(decode(run.stderr))).toBe(0);
  });

  test("table-derived fields survive and the human channel is redacted", async () => {
    const run = await runCase(secretFailure);
    const envelope = JSON.parse(run.stdout) as {
      error: {
        code: string;
        category: string;
        retryable: boolean;
        consequence: string;
        remediationHint: string;
        summary: string;
      };
    };
    expect(envelope.error.code).toBe("input.value.rejected");
    expect(envelope.error.category).toBe("user");
    expect(envelope.error.retryable).toBe(false);
    expect(envelope.error.consequence).toBe("not_landed");
    expect(envelope.error.remediationHint.length).toBeGreaterThan(0);
    expect(envelope.error.summary).toBe("the value [redacted] was rejected");
    expect(run.stderr).toContain("summary: the value [redacted] was rejected");
  });
});

describe("TC-REDACT-003 no-partial-leak sweep", () => {
  for (const entry of corpus.cases) {
    test(`${entry.id} is redacted on both streams`, async () => {
      const redacted = redact(entry.payload, entry.secrets);
      expect(redacted).toEqual(entry.expected);
      const serialized = JSON.stringify(redacted);
      expect(markerCount(serialized)).toBe(0);
      for (const secret of entry.secrets) expect(serialized).not.toContain(secret);
      for (const fragment of entry.fragments ?? []) {
        expect(serialized).not.toContain(fragment);
      }

      for (const asFailure of [false, true]) {
        const run = await runPayload(entry.payload, entry.secrets, asFailure);
        expect(markerCount(run.stdout)).toBe(0);
        expect(markerCount(run.stderr)).toBe(0);
        expect(markerCount(decode(run.stdout))).toBe(0);
        expect(markerCount(decode(run.stderr))).toBe(0);
        for (const secret of entry.secrets) {
          expect(run.stdout).not.toContain(secret);
          expect(run.stderr).not.toContain(secret);
        }
        for (const fragment of entry.fragments ?? []) {
          expect(run.stdout).not.toContain(fragment);
          expect(run.stderr).not.toContain(fragment);
        }
      }
    });
  }

  test("the over-redaction control round-trips byte-identically", async () => {
    const control = corpus.cases.find((entry) => entry.id === "over-redaction-control");
    if (control === undefined) throw new Error("control case is missing");
    const redacted = redact(control.payload, control.secrets);
    expect(redacted).toEqual(control.expected);
    const run = await runPayload(control.payload, control.secrets);
    const envelope = JSON.parse(run.stdout) as { data: unknown };
    expect(envelope.data).toEqual(control.expected);
  });

  test("repeated runs produce identical redacted output", async () => {
    const entry = corpus.cases[0];
    if (entry === undefined) throw new Error("corpus case is missing");
    const first = await runPayload(entry.payload, entry.secrets);
    for (let index = 0; index < 3; index += 1) {
      expect(await runPayload(entry.payload, entry.secrets)).toEqual(first);
    }
  });
});
