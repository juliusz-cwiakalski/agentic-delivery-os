/**
 * TC-HARN-029 — the non-vacuity meta-check. Each named mutant is a temporary
 * copy of one production module with one guard disabled; the corresponding
 * oracle must fail by name. A passing mutant fails this meta-check.
 */
import { afterEach, describe, test } from "bun:test";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  adapterNormalizationViolations,
  ambientReadViolations,
  harnessLiteralViolations,
  listTypeScriptFiles,
} from "../fixtures/harness/neutrality-scans";

const ROOT = process.cwd();
const temporary: string[] = [];

const mutantPath = (source: string, name: string): string =>
  source.replace(/\.ts$/, `.__mutant_${name}.ts`);

const loadMutant = async (
  source: string,
  name: string,
  transform: (text: string) => string,
): Promise<{ readonly url: string; readonly text: string; readonly path: string }> => {
  const path = mutantPath(source, name);
  const text = transform(readFileSync(join(ROOT, source), "utf8"));
  writeFileSync(join(ROOT, path), text);
  temporary.push(path);
  return { url: pathToFileURL(join(ROOT, path)).href, text, path };
};

const passed = (name: string): never => {
  throw new Error(`mutant ${name} passed`);
};

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(join(ROOT, path), { force: true });
});

const fixtureParent = {
  HARNESS_MODEL: "synthetic/model-large",
  HARNESS_SMALL_MODEL: "synthetic/model-small",
  DELIVERY_WORK_PATH: "/synthetic/work/GH-233",
  PATH: "/synthetic/bin",
  HARNESS_CREDENTIAL_KEY: "credential-source",
  HARNESS_AUTH: "decoy",
  SYNTHETIC_UNDECLARED_TOKEN: "leak",
};
const descriptor = {
  kind: "host" as const,
  workDirectory: "/synthetic/work/GH-233",
  environment: [
    { kind: "variable" as const, name: "HARNESS_MODEL" },
    { kind: "variable" as const, name: "HARNESS_SMALL_MODEL" },
    { kind: "variable" as const, name: "DELIVERY_WORK_PATH" },
    { kind: "variable" as const, name: "PATH" },
  ],
};
const credentialPort = {
  resolve: () => ({
    ok: false as const,
    code: "config.credential.missing" as const,
    domainKind: "config" as const,
    category: "user" as const,
    retryable: false as const,
    consequence: "not_landed" as const,
    projectionClass: "user-validation" as const,
  }),
};

describe("TC-HARN-029 named guard mutants", () => {
  test("spawn-env spread mutant fails naming the leaked key", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-spawn-env.ts",
      "spawn-env-spread",
      (text) =>
        text.replace(
          "const environment: Record<string, string> = {};",
          "const environment: Record<string, string> = { ...input.parentEnvironment as Record<string, string> };",
        ),
    );
    const module = (await import(mutant.url)) as {
      buildHarnessSpawnEnvironment: (input: unknown) => {
        ok: boolean;
        value?: Record<string, string>;
      };
    };
    const built = module.buildHarnessSpawnEnvironment({
      descriptor,
      parentEnvironment: fixtureParent,
      credentials: { resolve: () => ({ ok: true, material: { value: "x" } }) },
    });
    const leaked = Object.keys(built.value ?? {}).find(
      (key) => !descriptor.environment.some((entry) => entry.name === key),
    );
    if (leaked === undefined) passed("spawn-env-spread");
  });

  test("credential fallback mutant fails naming the reference", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-spawn-env.ts",
      "credential-fallback",
      (text) =>
        text.replace(
          "return credentialFailure(entry.reference.referenceName, entry.name);",
          'environment[entry.name] = "parent-fallback"; continue;',
        ),
    );
    const module = (await import(mutant.url)) as {
      buildHarnessSpawnEnvironment: (input: unknown) => { ok: boolean };
    };
    const built = module.buildHarnessSpawnEnvironment({
      descriptor: {
        ...descriptor,
        environment: [
          ...descriptor.environment,
          {
            kind: "credential",
            name: "HARNESS_AUTH",
            reference: {
              referenceName: "harness-auth",
              sourceKey: { style: "literal", name: "HARNESS_CREDENTIAL_KEY" },
            },
          },
        ],
      },
      parentEnvironment: fixtureParent,
      credentials: credentialPort,
    });
    if (!built.ok) passed("credential-fallback");
  });

  test("ambient read mutant fails naming file and line", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-spawn-env.ts",
      "ambient-read",
      (text) => `${text}\nconst ambient = process.env.EXAMPLE;\n`,
    );
    const files = listTypeScriptFiles("packages/core/src/domain").filter((file) =>
      file.startsWith("packages/core/src/domain/harness-spawn-env"),
    );
    const violation = ambientReadViolations(files).find((entry) => entry.file === mutant.path);
    if (violation === undefined || !violation.message.includes("process.env")) {
      passed("ambient-read");
    }
  });

  test("adapter classify mutant fails naming the adapter token", async () => {
    const mutant = await loadMutant(
      "packages/adapters/src/harness/opencode.ts",
      "adapter-classify",
      (text) => `${text}\nexport const divergentToken = "finished";\n`,
    );
    const files = listTypeScriptFiles("packages/adapters/src/harness");
    const violation = adapterNormalizationViolations(files).find(
      (entry) => entry.file === mutant.path && entry.message.includes("finished"),
    );
    if (violation === undefined) passed("adapter-classify");
  });

  test("liveness zero mutant fails naming the kind", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-liveness.ts",
      "liveness-zero",
      (text) =>
        text.replace(
          'reason: input.absenceReasons?.[kind] ?? "harness-unsupported",',
          'reason: input.absenceReasons?.[kind] ?? "harness-unsupported", value: 0,',
        ),
    );
    const module = (await import(mutant.url)) as {
      assembleHarnessLiveness: (input: unknown) => {
        readings: Array<{ kind: string; value?: unknown }>;
      };
    };
    const report = module.assembleHarnessLiveness({ sourced: [] });
    const guessed = report.readings.find((reading) => reading.value === 0);
    if (guessed === undefined) passed("liveness-zero");
  });

  test("extractor write mutant fails naming the statement", async () => {
    const store = await import("../fixtures/harness/opencode-store/build");
    const built = store.buildOpencodeStore();
    temporary.push(`${built.directory}/opencode.db`);
    const mutant = await loadMutant(
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "extractor-write",
      (text) =>
        text.replace(
          "const handle = opened.handle;",
          "const handle = opened.handle;\n      handle.execute(\"INSERT INTO part (id) VALUES ('mutant')\");",
        ),
    );
    const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
    const module = (await import(mutant.url)) as {
      createOpencodeTelemetryExtractor: (options: unknown) => {
        extract: (input: unknown) => { ok: boolean };
      };
    };
    const statements: string[] = [];
    try {
      module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: built.path,
          now: () => "2026-11-06T00:00:00Z",
          onStatement: (sql: string) => statements.push(sql),
        })
        .extract({ workItemRef: "GH-233", runId: "run" });
    } catch {
      // The mutant write is rejected by the read-only seam; the statement log
      // still names it.
    }
    const write = statements.find((sql) => sql.startsWith("INSERT"));
    if (write === undefined) passed("extractor-write");
  });

  test("full-scan mutant fails naming the query", async () => {
    const mutant = await loadMutant(
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "full-scan",
      (text) =>
        text
          .replace(
            "FROM part JOIN message ON message.id = part.message_id WHERE part.session_id = ? AND message.agent = ? AND message.model = ?",
            "FROM part JOIN message ON message.id = part.message_id WHERE 1 = 1",
          )
          .replace(
            "GROUP BY part.tool ORDER BY calls DESC, part.tool ASC LIMIT ?",
            "GROUP BY part.tool ORDER BY calls DESC, part.tool ASC",
          ),
    );
    const store = await import("../fixtures/harness/opencode-store/build");
    const built = store.buildOpencodeStore();
    temporary.push(`${built.directory}/opencode.db`);
    const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
    const module = (await import(mutant.url)) as {
      createOpencodeTelemetryExtractor: (options: unknown) => {
        extract: (input: unknown) => unknown;
      };
    };
    const statements: string[] = [];
    module
      .createOpencodeTelemetryExtractor({
        opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
        storePath: built.path,
        now: () => "2026-11-06T00:00:00Z",
        onStatement: (sql: string) => statements.push(sql),
      })
      .extract({ workItemRef: "GH-233", runId: "run" });
    const scan = statements.find(
      (sql) =>
        sql.includes("FROM part") && (!sql.includes("LIMIT") || !sql.includes("session_id = ?")),
    );
    if (scan === undefined) passed("full-scan");
  });

  test("cost-zero mutant fails naming cost", async () => {
    const mutant = await loadMutant(
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "cost-zero",
      (text) =>
        text.replace(
          '} else if (recordCost === null) {\n            warnings.push({ reason: "cost-missing", field: "cost" });\n          }',
          '} else if (recordCost === null) {\n            warnings.push({ reason: "cost-missing", field: "cost" });\n            recordCost = 0;\n          }',
        ),
    );
    const store = await import("../fixtures/harness/opencode-store/build");
    const built = store.buildOpencodeStore({ variant: "missing-cost" });
    temporary.push(`${built.directory}/opencode.db`);
    const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
    const module = (await import(mutant.url)) as {
      createOpencodeTelemetryExtractor: (options: unknown) => {
        extract: (input: unknown) => {
          ok: boolean;
          value?: { records: Array<{ cost: number | null; sessionId: string }> };
        };
      };
    };
    const result = module
      .createOpencodeTelemetryExtractor({
        opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
        storePath: built.path,
        now: () => "2026-11-06T00:00:00Z",
      })
      .extract({ workItemRef: "GH-233", runId: "run" });
    const fabricated = result.value?.records.find((record) => record.cost === 0);
    if (fabricated === undefined) passed("cost-zero");
  });

  test("drift hard-fail mutant fails naming the field", async () => {
    const mutant = await loadMutant(
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "drift-hard-fail",
      (text) =>
        text.replace(
          'warnings.push({ reason: "optional-field-absent", field });\n              return null;',
          'throw new Error("optional-field-absent");',
        ),
    );
    const store = await import("../fixtures/harness/opencode-store/build");
    const built = store.buildOpencodeStore({ variant: "no-optional-column" });
    temporary.push(`${built.directory}/opencode.db`);
    const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
    const module = (await import(mutant.url)) as {
      createOpencodeTelemetryExtractor: (options: unknown) => {
        extract: (input: unknown) => { ok: boolean };
      };
    };
    const result = module
      .createOpencodeTelemetryExtractor({
        opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
        storePath: built.path,
        now: () => "2026-11-06T00:00:00Z",
      })
      .extract({ workItemRef: "GH-233", runId: "run" });
    if (result.ok) passed("drift-hard-fail");
  });

  test("duplicate-capture mutant fails naming the duplicated session", async () => {
    const mutant = await loadMutant(
      "packages/core/src/state/harness-telemetry.ts",
      "duplicate-capture",
      (text) =>
        text.replace(
          "return ok({ record, report: { appended: 0, skipped: 1 } });",
          "// idempotency guard removed by mutant",
        ),
    );
    const state = await import("../fixtures/state/harness");
    const root = state.makeTempRoot("gh233-mutant");
    temporary.push(root);
    const { store } = state.openStore(state.makeIdentity(root));
    const module = (await import(mutant.url)) as {
      appendHarnessTelemetry: (store: unknown, fence: string, record: unknown) => { ok: boolean };
      readHarnessTelemetry: (
        store: unknown,
        workItemRef: string,
      ) => {
        ok: boolean;
        value?: { records: unknown[] };
      };
    };
    const record = {
      schemaId: "delivery.harness.telemetry.v1",
      workItemRef: "GH-233",
      runId: "run",
      sessionId: "ses_dup",
      harnessKind: "opencode",
      harnessVersion: "1.0.0",
      agent: "agent-a",
      model: "model-a",
      treeRoot: "ses_dup",
      parentChain: [],
      tokens: { input: 1, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      calls: 1,
      toolCounts: [],
      cost: null,
      capturedAt: "2026-11-06T00:00:00Z",
      warnings: [],
    };
    let caught = false;
    try {
      module.appendHarnessTelemetry(store, "f1", record);
      module.appendHarnessTelemetry(store, "f2", record);
      const read = module.readHarnessTelemetry(store, "GH-233");
      caught = (read.value?.records.length ?? 0) > 1;
    } catch {
      caught = true;
    }
    if (!caught) passed("duplicate-capture");
  });

  test("gating mutant fails naming the changed step", async () => {
    const mutant = await loadMutant("packages/core/src/domain/closeout.ts", "gating", (text) =>
      text
        .replace("return failed(captured.error.code);", 'throw new Error("gating");')
        .replace(
          '} catch {\n    return failed("capture-runtime");\n  }',
          "} catch (error) {\n    throw error;\n  }",
        ),
    );
    const module = (await import(mutant.url)) as {
      runCloseout: (input: unknown) => Promise<{ ok: boolean }>;
    };
    const harness = await import("../fixtures/closeout/harness");
    let gated = false;
    try {
      const result = await module.runCloseout({
        plan: (await import("../../packages/core/src/domain/closeout")).buildCloseoutPlan(
          harness.makeFacts(),
        ),
        provider: harness.makeProvider().runtime,
        git: harness.makeGit().runtime,
        state: harness.makeState().runtime,
        timestamp: harness.CLOSEOUT_TIMESTAMP,
        fenceToken: "fence",
        apply: true,
        telemetry: {
          capture: async () => ({
            ok: false,
            error: { kind: "harness", code: "harness.telemetry.extraction-failed" },
          }),
          append: () => ({ ok: true, value: { appended: 0, skipped: 0 } }),
        },
      });
      gated = result.ok === false;
    } catch {
      gated = true;
    }
    if (!gated) passed("gating");
  });

  test("silent-default mutant fails naming the configuration path", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-registry.ts",
      "silent-default",
      (text) =>
        text.replace(
          "const registration = input.registrations.find((entry) => entry.kind === input.kind);",
          "const registration = input.registrations.find((entry) => entry.kind === input.kind) ?? input.registrations[0];",
        ),
    );
    const module = (await import(mutant.url)) as {
      resolveHarnessInstance: (input: unknown) => Promise<{ ok: boolean }>;
    };
    const result = await module.resolveHarnessInstance({
      kind: "pi-dev",
      registrations: [
        {
          kind: "opencode",
          create: () => ({
            kind: "opencode",
            observedVersion: null,
            capabilities: {
              supportedOperations: [],
              lifecycleCapabilities: [],
              livenessSources: [],
              declaredGaps: [],
            },
          }),
        },
      ],
      versionProbe: async () => "1.0.0",
    });
    if (!result.ok) passed("silent-default");
  });

  test("truncation mutant fails naming the omitted count", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-telemetry.ts",
      "truncation",
      (text) => text.replace("omittedSessions += 1;", "void omittedSessions;"),
    );
    const module = (await import(mutant.url)) as {
      boundHarnessTelemetryCapture: (capture: unknown) => {
        records: unknown[];
        sessionTruncation?: { omitted: number };
      };
    };
    const record = (index: number) => ({
      schemaId: "delivery.harness.telemetry.v1",
      workItemRef: "GH-233",
      runId: "run",
      sessionId: `ses_${index}`,
      harnessKind: "opencode",
      harnessVersion: "1.0.0",
      agent: "agent-a",
      model: "model-a",
      treeRoot: `ses_${index}`,
      parentChain: [],
      tokens: { input: 1, output: 1, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      calls: 1,
      toolCounts: [],
      cost: 1,
      capturedAt: "2026-11-06T00:00:00Z",
      warnings: Array.from({ length: 60 }, () => ({
        reason: "non-numeric-value",
        field: "x".repeat(200),
      })),
    });
    const bounded = module.boundHarnessTelemetryCapture({
      workItemRef: "GH-233",
      runId: "run",
      capturedAt: "2026-11-06T00:00:00Z",
      records: Array.from({ length: 64 }, (_, index) => record(index)),
      agents: [],
      models: [],
      failedSessions: [],
      warnings: [],
    });
    const detected = bounded.records.length < 64 && (bounded.sessionTruncation?.omitted ?? 0) === 0;
    if (bounded.records.length === 64 || !detected) passed("truncation");
  });

  test("harness literal mutant fails naming the file", async () => {
    const mutant = await loadMutant(
      "packages/core/src/domain/harness-classify.ts",
      "harness-literal",
      (text) => `const seededHarness = "opencode";\n${text}`,
    );
    const violations = harnessLiteralViolations(listTypeScriptFiles("packages/core/src"));
    const violation = violations.find(
      (entry) => entry.file === mutant.path && entry.message.includes("opencode"),
    );
    if (violation === undefined) passed("harness-literal");
  });
});
