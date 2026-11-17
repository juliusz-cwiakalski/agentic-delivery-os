/**
 * GH-300 contract layer: the suite-map constants and closed vocabulary, the
 * `verify.narrowed-scope` error identity and its documented mirror, the `verify`
 * configuration branch, and the report/detail field declarations.
 *
 * TC-SCTR-003 owns the error-table two-way sync; TC-SCITE-003 and TC-SCTR-001's
 * runtime halves are extended by the runtime phase (phase 4) in the same home.
 */
import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_CATALOG } from "../../packages/core/src/config/catalog";
import {
  ERROR_TABLE,
  type ErrorTableEntry,
  VERIFY_SUITE_BREADTH_OUTCOMES,
  VERIFY_SUITE_ID_PATTERN,
  VERIFY_SUITE_MAP_DOCUMENT_STATES,
  VERIFY_SUITE_MAP_SCHEMA_VERSION,
} from "../../packages/core/src/contracts/index";
import {
  isCrossRepositoryVerifyGatesReport,
  resolveVerifySuiteBreadth,
  resolveVerifySuiteMap,
  suiteBreadthCitationOf,
} from "../../packages/core/src/domain/index";
import { runSyncCheck } from "../../scripts/checks/error-table-sync";

const ROOT = process.cwd();
const CONTRACTS = "packages/core/src/contracts";
const DOMAIN = "packages/core/src/domain/verify-gates-suite-map.ts";
const DOC = "doc/spec/features/feature-result-contract.md";
const NARROWED_HINT =
  "Run the local gate over the declared full suite breadth, or update the declared suite map so the local suite set matches the mirrored CI job, then re-run the gates.";
const NARROWED_SUMMARY = "The local gate breadth is narrower than the CI job it mirrors.";
const NARROWED_ROW = `| verify.narrowed-scope | verify | user | false | not_landed | ${NARROWED_HINT} | user-validation | ${NARROWED_SUMMARY} |`;

const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const source = (): string => read(`${CONTRACTS}/verify-gates.ts`);

describe("TC-SMAP-001 the suite constants are declared exactly once", () => {
  test("each constant literal occurs once in the contracts file", () => {
    const text = source();
    for (const literal of [
      'VERIFY_SUITE_MAP_SCHEMA_VERSION = "delivery.verify.suite-map.v1"',
      'VERIFY_SUITE_MAP_CONFIG_KEY = "verify.suite-map"',
      "VERIFY_SUITE_MAP_MAX_JOBS = 64",
      "VERIFY_SUITE_MAP_MAX_SUITES_PER_JOB = 32",
      "VERIFY_SUITE_MAX_BREADTH = 32",
      "VERIFY_SUITE_MAX_ID_CHARS = 64",
      'VERIFY_SUITE_ID_PATTERN = "^[a-z][a-z0-9-]*$"',
    ]) {
      expect(text.split(literal).length - 1, literal).toBe(1);
    }
  });

  test("the pattern literal lives only in the contracts module", () => {
    const text = source();
    expect(text.split("^[a-z][a-z0-9-]*$").length - 1).toBe(1);
  });

  test("the production catalog declares the verify branch exactly once", () => {
    expect(Object.keys(PRODUCTION_CATALOG)).toContain("verify");
    const verify = PRODUCTION_CATALOG.verify;
    expect(verify.type).toBe("object");
    if (verify.type !== "object") return;
    expect(Object.keys(verify.fields)).toEqual(["suite-map"]);
    const mapField = verify.fields["suite-map"];
    expect(mapField?.type).toBe("object");
    expect(mapField?.default).toBeUndefined();
    const text = read("packages/core/src/config/catalog.ts");
    expect(text.split("verify: VERIFY_BRANCH").length - 1).toBe(1);
  });
});

describe("TC-SMAP-001 the read vocabulary is closed and total", () => {
  test("the four breadth outcomes and the document states are closed lists", () => {
    expect([...VERIFY_SUITE_BREADTH_OUTCOMES]).toEqual([
      "equal",
      "narrower",
      "unmirrored",
      "uncorroborated",
    ]);
    expect([...VERIFY_SUITE_MAP_DOCUMENT_STATES]).toEqual([
      "absent",
      "selected-but-missing-or-unreadable",
      "parsed-no-node",
      "parsed-valid",
      "defective-node",
      "unreadable",
      "unparseable",
      "defect-elsewhere",
    ]);
  });

  test("a resolved equality projects exactly the two report fields", () => {
    const declared = resolveVerifySuiteMap(validEqualityMap());
    if (!declared.ok || !declared.declared) throw new Error("expected a declared map");
    const outcome = resolveVerifySuiteBreadth({
      map: declared.value,
      workflow: { outcome: "read", names: ["job-01"] },
    });
    expect(suiteBreadthCitationOf(outcome)).toEqual({
      suiteBreadth: [...(declared.value.jobs[0]?.suites ?? [])],
      mirrorsJob: "job-01",
    });
  });

  test("the report union is still discriminated by definitionOfDone", () => {
    expect(
      isCrossRepositoryVerifyGatesReport({
        target: "gates",
        definitionOfDone: { status: "green" },
      }),
    ).toBe(true);
    expect(isCrossRepositoryVerifyGatesReport({ target: "gates", overall: "pass" })).toBe(false);
  });
});

describe("TC-SCTR-003 the error table and its documented mirror are two-way synced", () => {
  test("exactly one row carries the pinned fields", () => {
    const text = read(`${CONTRACTS}/error-table.ts`);
    const occurrences = text.split('code: "verify.narrowed-scope"').length - 1;
    expect(occurrences).toBe(1);
    expect(text).toContain(NARROWED_SUMMARY);
    expect(text).toContain(NARROWED_HINT);
  });

  test("the live table resolves the row through the same fields the documented row states", () => {
    const entries = ERROR_TABLE as readonly ErrorTableEntry[];
    const row = entries.find((entry) => entry.code === "verify.narrowed-scope");
    expect(row).toEqual({
      code: "verify.narrowed-scope",
      domainKind: "verify",
      category: "user",
      retryable: false,
      consequence: "not_landed",
      remediationHint: NARROWED_HINT,
      projectionClass: "user-validation",
      summary: NARROWED_SUMMARY,
    });
    expect(entries.filter((entry) => entry.domainKind === "verify")).toHaveLength(7);
    expect(read(DOC).split(NARROWED_ROW).length - 1).toBe(1);
  });

  test("the live sync check is green in both directions", async () => {
    const result = await runSyncCheck({ root: ROOT });
    expect(result.failures).toEqual([]);
    expect(result.counts.sourceEntries).toBe(149);
    expect(result.counts.documentedRows).toBe(149);
  });

  test("no delivered row is reworded", () => {
    const entries = ERROR_TABLE as readonly ErrorTableEntry[];
    for (const code of [
      "verify.ledger.incomplete",
      "verify.gates.failed",
      "verify.gates.unavailable",
      "verify.deploy.trace-missing",
      "verify.deploy.status-stale",
      "verify.deploy.trace-failed",
    ]) {
      expect(entries.some((entry) => entry.code === code && entry.domainKind === "verify")).toBe(
        true,
      );
    }
    const narrowed = entries.find((entry) => entry.code === "verify.narrowed-scope");
    expect(entries.filter((entry) => entry.code === "verify.narrowed-scope")).toHaveLength(1);
    expect(narrowed?.category).toBe("user");
  });

  test("the true-positive corpus recognizes the new identity", () => {
    const corpus = JSON.parse(read("tests/fixtures/result/code-corpora/true-positives.json")) as {
      readonly rows: readonly { readonly text: string; readonly recognized: boolean }[];
    };
    expect(corpus.rows.some((row) => row.text === "verify.narrowed-scope" && row.recognized)).toBe(
      true,
    );
  });

  test("the pure resolver module stays runtime-neutral", () => {
    expect(VERIFY_SUITE_MAP_SCHEMA_VERSION).toBe("delivery.verify.suite-map.v1");
    const text = read(DOMAIN);
    expect(text).toContain('"config.value.invalid"');
    const specifiers = [...text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(specifiers)).toEqual(new Set(["#contracts", "./verify-gates.js"]));
  });
});

import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import {
  baseFacts,
  clone,
  EXPECTED_JOBS,
  run as pipelineRun,
} from "../fixtures/verify-gates/cases/facts";
import {
  combinedRuntime,
  runVerify,
  SYNTHETIC_BRAND,
} from "../fixtures/verify-gates/cases/harness";
import {
  invalidRead,
  maxNarrowingReferenceMap,
  mirrorAbsentMap,
  narrowedMap,
  REFERENCE_JOB,
  REFERENCE_SUITES,
  validEqualityMap,
  widerMap,
} from "../fixtures/verify-gates/suite-map/cases";
import { bufferSink } from "../golden/helpers";

const suiteFacts = () => {
  const facts = clone(baseFacts());
  const names = [...EXPECTED_JOBS, REFERENCE_JOB];
  facts.workflow = { outcome: "read", names };
  facts.checkRuns = {
    ok: true,
    value: {
      items: names.map((name) => pipelineRun(name, "succeeded")),
      pageItemCount: names.length,
    },
  };
  return facts;
};

const reportOf = async (read: () => ReturnType<typeof resolveVerifySuiteMap>) => {
  const result = await runVerify(combinedRuntime({ facts: suiteFacts(), suiteMap: read }), [
    "gates",
    "GH-300",
  ]);
  return { result, data: result.envelope?.data as Record<string, unknown> | undefined };
};

describe("TC-SCITE-003 the report fields pair and are bounded", () => {
  test("an emitted equality report carries both fields with the declared shape", async () => {
    const { data } = await reportOf(() => resolveVerifySuiteMap(validEqualityMap()));
    expect(data?.suiteBreadth).toEqual([...REFERENCE_SUITES]);
    expect(data?.mirrorsJob).toBe("job-01");
    const breadth = data?.suiteBreadth as readonly string[];
    expect(breadth.length).toBeGreaterThanOrEqual(1);
    expect(breadth.length).toBeLessThanOrEqual(32);
    expect(new Set(breadth).size).toBe(breadth.length);
    for (const id of breadth) {
      expect(id.length).toBeLessThanOrEqual(64);
      expect(new RegExp(VERIFY_SUITE_ID_PATTERN).test(id)).toBe(true);
    }
    expect(String(data?.mirrorsJob).length).toBeGreaterThanOrEqual(1);
    expect(String(data?.mirrorsJob).length).toBeLessThanOrEqual(120);
  });

  test("no report exists for the undeclared or unusable outcomes", async () => {
    for (const read of [
      () => resolveVerifySuiteMap(narrowedMap()),
      () => resolveVerifySuiteMap(widerMap()),
      () => resolveVerifySuiteMap(mirrorAbsentMap()),
      () => resolveVerifySuiteMap({ schemaVersion: "x" }),
      () => invalidRead("unreadable"),
    ]) {
      const { result, data } = await reportOf(read);
      expect(data).toBeUndefined();
      expect(result.envelope?.error).toBeDefined();
    }
  });

  test("neither field appears anywhere on the undeclared path", async () => {
    const result = await runVerify(combinedRuntime({ facts: suiteFacts() }), ["gates", "GH-300"]);
    expect(JSON.stringify(result.envelope)).not.toContain("suiteBreadth");
    expect(JSON.stringify(result.envelope)).not.toContain("mirrorsJob");
  });
});

describe("TC-SCTR-001/TC-SCTR-002 the envelope and the detail projection", () => {
  test("the narrowed envelope keeps the closed top-level and detail key sets", async () => {
    const { result } = await reportOf(() => resolveVerifySuiteMap(narrowedMap()));
    const envelope = result.envelope as Record<string, unknown>;
    for (const key of Object.keys(envelope)) {
      expect(["schemaVersion", "runId", "exitCode", "timing", "data", "error", "detail"]).toContain(
        key,
      );
    }
    expect(envelope.schemaVersion).toBe("delivery.result.v1");
    expect(envelope.exitCode).toBe(1);
    expect([0, 1, 2]).toContain(envelope.exitCode);
    expect(Object.keys((envelope.detail as object) ?? {})).toEqual(["suiteBreadth"]);
    expect(Object.keys((envelope.error as object) ?? {}).sort()).toEqual(
      ["category", "code", "consequence", "remediationHint", "retryable", "summary"].sort(),
    );
  });

  test("a config-shaped refusal carries no detail and the table's prose", async () => {
    const { result } = await reportOf(() => resolveVerifySuiteMap(widerMap()));
    expect(result.envelope?.detail).toBeUndefined();
    expect(result.envelope?.error?.summary).toBe("A configuration value is invalid.");
  });

  test("the complete 31-identifier local list is never truncated", async () => {
    const map = maxNarrowingReferenceMap();
    const { result } = await reportOf(() => resolveVerifySuiteMap(map));
    const detail = result.envelope?.detail as { readonly suiteBreadth: readonly string[] };
    expect(detail.suiteBreadth).toEqual(map.local);
    expect(detail.suiteBreadth).toHaveLength(31);
  });

  test("a malformed, over-bound, or undeclared detail member is never projected", async () => {
    const cases: readonly unknown[] = [
      { suiteBreadth: "tests" },
      { suiteBreadth: [1] },
      { suiteBreadth: [""] },
      { suiteBreadth: ["a".repeat(65)] },
      { suiteBreadth: Array.from({ length: 33 }, (_, index) => `s-${index}`) },
      { suiteBreadth: ["te\nsts"] },
      { suiteBreadth: ["tests\u2028"] },
      { suiteBreadth: ["tests\u2029"] },
      { suiteBreadth: ["tests\u202e"] },
      { suiteBreadth: ["tests\t"] },
      { suiteBreadth: ["tests", "tests"] },
      { open: { value: "x" } },
      "detail-as-string",
    ];
    for (const detail of cases) {
      const stdout = bufferSink();
      const stderr = bufferSink();
      const deps: CliDependencies = {
        brand: SYNTHETIC_BRAND,
        clock: { now: () => 1 },
        newRunId: () => "run-detail-projection",
        secrets: [],
        program: {
          commands: {
            probe: {
              handler: () => ({
                error: { kind: "verify", code: "verify.narrowed-scope", summary: "x", detail },
              }),
            },
          },
        },
      };
      await runCli(["--json", "probe"], { stdout, stderr }, deps);
      const envelope = JSON.parse(stdout.value) as Record<string, unknown>;
      expect(envelope.detail, JSON.stringify(detail)).toBeUndefined();
    }
  });

  test("holder keeps the delivered CR/LF/C1 predicate while a TAB or DEL still projects", async () => {
    const projected = async (holder: string): Promise<unknown> => {
      const stdout = bufferSink();
      const stderr = bufferSink();
      await runCli(
        ["--json", "probe"],
        { stdout, stderr },
        {
          brand: SYNTHETIC_BRAND,
          clock: { now: () => 1 },
          newRunId: () => "run-holder-projection",
          secrets: [],
          program: {
            commands: {
              probe: {
                handler: () => ({
                  error: {
                    kind: "verify",
                    code: "verify.narrowed-scope",
                    summary: "x",
                    detail: { holder },
                  },
                }),
              },
            },
          },
        },
      );
      return (JSON.parse(stdout.value) as Record<string, unknown>).detail;
    };
    for (const holder of ["a\tb", "a\u0007b", "a\u007fb"]) {
      expect(await projected(holder), JSON.stringify(holder)).toEqual({ holder });
    }
    for (const holder of ["a\nb", "a\rb", "a\u0085b", "a\u009fb"]) {
      expect(await projected(holder), JSON.stringify(holder)).toBeUndefined();
    }
  });

  test("a cause payload carrying a control, U+2028, U+2029, or a format control is never projected", async () => {
    const rendered = async (cause: string): Promise<string> => {
      const stdout = bufferSink();
      const stderr = bufferSink();
      await runCli(
        ["probe"],
        { stdout, stderr },
        {
          brand: SYNTHETIC_BRAND,
          clock: { now: () => 1 },
          newRunId: () => "run-cause-projection",
          secrets: [],
          program: {
            commands: {
              probe: {
                handler: () => ({
                  error: { kind: "config", code: "config.value.invalid", cause },
                }),
              },
            },
          },
        },
      );
      return stderr.value;
    };
    for (const cause of [
      "mirror=TS\u2028aggregate check",
      "mirror=TS\u2029aggregate check",
      "mirror=TS\u202eaggregate check",
      "mirror=TS\taggregate check",
    ]) {
      expect(await rendered(cause), JSON.stringify(cause)).not.toContain("cause:");
    }
    expect(await rendered("mirror=TS aggregate check")).toContain(
      "cause: mirror=TS aggregate check",
    );
  });

  test("no other command projects the suiteBreadth member", () => {
    const files = readdirSync(join(ROOT, "packages/cli/src/commands")).filter((name) =>
      name.endsWith(".ts"),
    );
    for (const file of files) {
      if (file === "verify-gates.ts") continue;
      expect(readFileSync(join(ROOT, "packages/cli/src/commands", file), "utf8")).not.toContain(
        "suiteBreadth",
      );
    }
  });
});
