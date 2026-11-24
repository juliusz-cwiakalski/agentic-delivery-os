/**
 * TC-HARN-029 — the non-vacuity meta-check. Each named mutant is a temporary
 * copy of one production module with one guard disabled; the corresponding
 * oracle must fail by name. A passing mutant fails this meta-check.
 */
import { afterEach, describe, expect, test } from "bun:test";
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
      // Re-pinned (GH-394 review iter-2 F-5) to the current single-line call:
      // the phase-4 rewording collapsed the statement onto one line and the
      // previous multiline anchor matched neither text, silently no-op'ing the
      // mutation and tripping this non-vacuity oracle.
      (text) =>
        text.replace(
          "return credentialFailure(entry.reference.referenceName, entry.name, projectionOf(resolution));",
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
        .extract({
          workItemRef: "GH-233",
          runId: "run",
          heldSessionIds: built.heldSessionIds,
        });
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
          .replace("WHERE id = ? LIMIT 1", "")
          .replace(
            "WHERE session_id = ? AND type = 'assistant' ORDER BY seq LIMIT ",
            "ORDER BY seq LIMIT ",
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
      .extract({
        workItemRef: "GH-233",
        runId: "run",
        heldSessionIds: built.heldSessionIds,
      });
    const scan = statements.find(
      (sql) => sql.includes("FROM session_v2") && !sql.includes("WHERE"),
    );
    if (scan === undefined) passed("full-scan");
  });

  test("cost-zero mutant fails naming cost", async () => {
    const mutant = await loadMutant(
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "cost-zero",
      (text) => text.replace("cost: group.cost,", "cost: group.cost ?? 0,"),
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
      .extract({
        workItemRef: "GH-233",
        runId: "run",
        heldSessionIds: built.heldSessionIds,
      });
    const fabricated = result.value?.records.find((record) => record.cost === 0);
    if (fabricated === undefined) passed("cost-zero");
  });

  test("drift hard-fail mutant fails naming the field", async () => {
    const mutant = await loadMutant(
      "packages/adapters/src/harness/telemetry-opencode.ts",
      "drift-hard-fail",
      (text) =>
        text.replace(
          'warnings.push({ reason: "duration-absent", field: "durations" });',
          'throw new Error("duration-absent");',
        ),
    );
    const store = await import("../fixtures/harness/opencode-store/build");
    const built = store.buildOpencodeStore({ variant: "inverted-timestamps" });
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
      .extract({
        workItemRef: "GH-233",
        runId: "run",
        heldSessionIds: built.heldSessionIds,
      });
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

/**
 * TC-HARNESS-038 — the GH-335 disabling-mutant set: each named honesty rule is
 * disabled in a temp copy and the prohibited observable must appear. A mutant
 * that produces nothing fails this meta-check (test plan §4.2 rule 7).
 */
type Gh335Mutant = {
  readonly name: string;
  readonly source: string;
  readonly transform: (text: string) => string;
  readonly prohibited: (url: string) => Promise<boolean>;
};

const load = async (mutant: Gh335Mutant) => {
  const loaded = await loadMutant(mutant.source, `gh335-${mutant.name}`, mutant.transform);
  return loaded.url;
};

const GH335_MUTANTS: readonly Gh335Mutant[] = [
  {
    name: "accept-outside-window",
    source: "packages/core/src/domain/harness-version-window.ts",
    transform: (text) =>
      text.replace("return window.includes(`${major}.${minor}`);", "return true;"),
    prohibited: async (url) => {
      const module = await import(url);
      return module.evaluateHarnessVersion("opencode v2.1.7").verdict === "inside";
    },
  },
  {
    name: "probe-substring-match",
    source: "packages/core/src/domain/harness-version-window.ts",
    transform: (text) =>
      text.replace(
        "if (match === null) return undefined;",
        'if (line.includes("2.3.2")) return "2.3.2";',
      ),
    prohibited: async (url) => {
      const module = await import(url);
      return module.normalizeHarnessVersion("garbage 2.3.2") !== undefined;
    },
  },
  {
    name: "stamp-raw-probe-line",
    source: "packages/core/src/domain/harness-version-window.ts",
    transform: (text) => text.replace("return `${major}.${minor}.${patch}`;", "return line;"),
    prohibited: async (url) => {
      const module = await import(url);
      return String(module.evaluateHarnessVersion("opencode v2.3.2").observedVersion).includes(
        "opencode",
      );
    },
  },
  {
    name: "ignore-probe-deadline",
    source: "packages/core/src/domain/harness-registry.ts",
    transform: (text) =>
      text.replace("deadlineMs: HARNESS_VERSION_PROBE_TIMEOUT_MS,", "deadlineMs: 0,"),
    prohibited: async (url) => {
      const module = await import(url);
      const seen: number[] = [];
      await module.resolveHarnessInstance({
        kind: "opencode",
        registrations: [
          {
            kind: "opencode",
            create: (input: unknown) => ({
              kind: "opencode",
              observedVersion: null,
              capabilities: {},
              ...(input as object),
            }),
          },
        ],
        versionProbe: async (input: { deadlineMs: number }) => {
          seen.push(input.deadlineMs);
          return { status: "answered", stdout: "opencode v2.3.2" };
        },
        now: () => 0,
      });
      return seen[0] !== 5000;
    },
  },
  {
    name: "fabricate-version-on-failure",
    source: "packages/core/src/domain/harness-registry.ts",
    transform: (text) =>
      text.replace(
        "  } catch {\n    evaluation = indeterminateHarnessVersion();\n  }",
        '  } catch {\n    evaluation = { verdict: "inside", observedVersion: "2.3.2", requirement: "proceed" };\n  }',
      ),
    prohibited: async (url) => {
      const module = await import(url);
      const result = await module.resolveHarnessInstance({
        kind: "opencode",
        registrations: [
          {
            kind: "opencode",
            create: (input: { observedVersion: string | null }) => ({
              kind: "opencode",
              observedVersion: input.observedVersion,
              capabilities: {},
            }),
          },
        ],
        versionProbe: async () => {
          throw new Error("probe failed");
        },
        now: () => 0,
      });
      return result.ok && result.value.observedVersion !== null;
    },
  },
  {
    name: "collapse-unknown-into-unsupported",
    source: "packages/cli/src/production.ts",
    transform: (text) =>
      text.replace('code: "harness.version.unknown",', 'code: "harness.version.unsupported",'),
    prohibited: async (url) => {
      const module = await import(url);
      const refusal = module.harnessFactsRefusal({
        kind: "opencode",
        observedVersion: null,
        versionVerdict: "indeterminate",
        mode: "per-invocation-private-server",
      });
      return refusal?.code !== "harness.version.unknown";
    },
  },
  {
    name: "config-window-widens",
    source: "packages/core/src/contracts/harness.ts",
    transform: (text) => text.replace('minors: ["2.3", "2.2"],', 'minors: ["2.3", "2.2", "2.1"],'),
    prohibited: async (url) => {
      const module = await import(url);
      return module.HARNESS_SUPPORTED_VERSION_WINDOW.minors.includes("2.1");
    },
  },
  {
    name: "fallback-to-default-mode",
    source: "packages/cli/src/production.ts",
    transform: (text) => text.replace("if (!availability.available) {", "if (false) {"),
    prohibited: async (url) => {
      const module = await import(url);
      return (
        module.harnessFactsRefusal({
          kind: "opencode",
          observedVersion: "2.3.2",
          versionVerdict: "inside",
          mode: "managed-background-service",
        }) === undefined
      );
    },
  },
  {
    name: "ambient-wins-over-record",
    source: "packages/core/src/domain/harness-spawn-env.ts",
    transform: (text) =>
      text.replace(
        "input.record?.[entry.name] ?? input.parentEnvironment[entry.name]",
        "input.parentEnvironment[entry.name] ?? input.record?.[entry.name]",
      ),
    prohibited: async (url) => {
      const module = await import(url);
      const built = module.buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: { ...fixtureParent, HARNESS_MODEL: "ambient-model" },
        credentials: credentialPort,
        record: { HARNESS_MODEL: "resolved-model" },
      });
      return built.ok && built.value.HARNESS_MODEL === "ambient-model";
    },
  },
  {
    name: "forward-undeclared-record",
    source: "packages/core/src/domain/harness-spawn-env.ts",
    transform: (text) =>
      text.replace(
        "  const environment: Record<string, string> = {};",
        "  const environment: Record<string, string> = { ...(input.record ?? {}) };",
      ),
    prohibited: async (url) => {
      const module = await import(url);
      const built = module.buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: fixtureParent,
        credentials: credentialPort,
        record: { UNDECLARED_RECORD: "leak" },
      });
      return built.ok && Object.hasOwn(built.value, "UNDECLARED_RECORD");
    },
  },
  {
    name: "per-seat-env-family",
    source: "packages/core/src/domain/harness-profile-propagation.ts",
    transform: (text) =>
      text.replace(
        "binding.envName === undefined ? {} : { [binding.envName]: binding.resolvedModel };",
        "({ OC_SEAT_MODEL: binding.resolvedModel } as Readonly<Record<string, string>>);",
      ),
    prohibited: async (url) => {
      const module = await import(url);
      const records = module.bindingEnvironmentRecords({
        agent: "coder",
        seat: "seat-judgment",
        resolvedModel: "zai/glm-5#judgment",
      });
      return Object.keys(records).some((key) => key.startsWith("OC_"));
    },
  },
  {
    name: "partial-profile",
    source: "packages/core/src/domain/harness-profile-propagation.ts",
    transform: (text) =>
      text.replace(
        "const resolvedModel = selection.seatModels[seatName] ?? seat.model;",
        'const resolvedModel = "";',
      ),
    prohibited: async (url) => {
      const module = await import(url);
      const resolution = module.resolveBinding(
        {
          seats: {
            sole: { model: "zai/glm-5", pacingClass: "execution", capability: "text-only" },
          },
          agentOverrides: { coder: "sole" },
        },
        { agentOverrides: { coder: "sole" }, seatModels: { sole: "zai/glm-5" } },
        "coder",
      );
      return resolution.outcome === "binding" && resolution.binding.resolvedModel === "";
    },
  },
  {
    name: "overwrite-observed-with-resolved",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        "model: group.model ?? HARNESS_OBSERVED_ABSENCE_PLACEHOLDER,",
        "model: bindsThisGroup ? (binding?.resolvedModel ?? '') : (group.model ?? ''),",
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore();
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({
          workItemRef: "GH-335",
          runId: "r",
          heldSessionIds: build.heldSessionIds,
          bindings: {
            [build.heldSessionIds[0]]: {
              agent: "agent-a",
              seat: "s",
              resolvedModel: "synthetic/other#v",
            },
          },
        });
      if (!captured.ok) return false;
      const row = captured.value.records.find(
        (entry: { sessionId: string; model: string }) => entry.sessionId === "ses_root",
      );
      return row !== undefined && row.model === "synthetic/other#v";
    },
  },
  {
    name: "zero-cost-as-absence",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace("cost: group.cost,", "cost: group.cost === 0 ? null : group.cost,"),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore({
        variant: "reported-zero-cost",
      });
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      if (!captured.ok) return false;
      return captured.value.records.some(
        (row: { sessionId: string; cost: number | null }) =>
          row.sessionId === "ses_root" && row.cost === null,
      );
    },
  },
  {
    name: "missing-cost-as-zero",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) => text.replace("cost: group.cost,", "cost: group.cost ?? 0,"),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore({
        variant: "missing-cost",
      });
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      if (!captured.ok) return false;
      return captured.value.records.some((row: { cost: number | null }) => row.cost === 0);
    },
  },
  {
    name: "derive-duration-from-capture",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        "const durations = durationsOf(entry.session);",
        'const durations = { status: "sourced" as const, start: options.now(), end: options.now(), elapsedMs: 0 };',
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore({
        variant: "inverted-timestamps",
      });
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      if (!captured.ok) return false;
      return captured.value.records.some(
        (row: { sessionId: string; durations?: { status: string } }) =>
          row.sessionId === "ses_root" && row.durations?.status === "sourced",
      );
    },
  },
  {
    name: "work-item-column-query",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace("WHERE id = ? LIMIT 1", "WHERE id = ? AND work_item_ref = ? LIMIT 1"),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore();
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      return !captured.ok;
    },
  },
  {
    name: "part-tool-query",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        "const generation = detectGeneration(handle);",
        'const generation = detectGeneration(handle);\n      handle.query("SELECT tool FROM part LIMIT 1");',
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore();
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      return !captured.ok;
    },
  },
  {
    name: "legacy-only-extractor",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        'if (tables.has("session_v2") && tables.has("session_message")) return "current";',
        'if (false && tables.has("session_v2")) return "current";',
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore();
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      return !captured.ok || captured.value.records.length === 0;
    },
  },
  {
    name: "current-only-extractor",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        'if (tables.has("session") && tables.has("message")) return "legacy";',
        'if (false && tables.has("session")) return "legacy";',
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore({
        generation: "legacy",
      });
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: build.heldSessionIds });
      return !captured.ok || captured.value.records.length === 0;
    },
  },
  {
    name: "zero-row-as-pass",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        'if (groups.length === 0) {\n            failedSessions.push({ sessionId: entry.session.id, reason: "no-usage-fact" });\n            continue;\n          }',
        "if (groups.length === 0) {\n            continue;\n          }",
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore({
        variant: "empty-session",
      });
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: ["ses_empty"] });
      return captured.ok && captured.value.failedSessions.length === 0;
    },
  },
  {
    name: "absence-as-capture-failure",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        'absences.push({ sessionId: heldId, reason: "session-not-in-store" });',
        'failedSessions.push({ sessionId: heldId, reason: "session-capture-failed" });',
      ),
    prohibited: async (url) => {
      const build = (await import("../fixtures/harness/opencode-store/build")).buildOpencodeStore();
      const module = await import(url);
      const adapters = await import("../../packages/adapters/src/harness/sqlite-loader");
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: (path: string) => adapters.createBunSqliteStoreOpener()(path),
          storePath: build.path,
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: ["ses_absent"] });
      return captured.ok && captured.value.failedSessions.length > 0;
    },
  },
  {
    name: "capture-failure-as-absence",
    source: "packages/adapters/src/harness/telemetry-opencode.ts",
    transform: (text) =>
      text.replace(
        'if (!opened.ok) return failure("the opencode session store could not be opened read-only");',
        "if (!opened.ok) return { ok: true, value: { workItemRef, runId, capturedAt: options.now(), records: [], agents: [], models: [], failedSessions: [], warnings: [], absences: [] } };",
      ),
    prohibited: async (url) => {
      const module = await import(url);
      const captured = module
        .createOpencodeTelemetryExtractor({
          opener: () => ({ ok: false }),
          storePath: "/synthetic/absent.db",
          now: () => "2026-11-18T00:00:00.000Z",
        })
        .extract({ workItemRef: "GH-335", runId: "r", heldSessionIds: ["ses"] });
      return captured.ok;
    },
  },
  {
    name: "ignore-missing-scenario",
    source: "packages/testkit/src/conformance/harness.ts",
    transform: (text) =>
      text.split("if (!registration.extensionScenarios.includes(scenario)) {").join("if (false) {"),
    prohibited: async (url) => {
      const module = await import(url);
      const mutantRegistry = module.HARNESS_CONFORMANCE_REGISTRY.map(
        (entry: { kind: string; extensionScenarios: readonly string[] }) => ({
          ...entry,
          extensionScenarios: [],
        }),
      );
      return module.harnessConformanceViolations(mutantRegistry).length === 0;
    },
  },
];

describe("TC-HARNESS-038 the GH-335 disabling-mutant set", () => {
  for (const mutant of GH335_MUTANTS) {
    test(`mutant ${mutant.name} produces its prohibited observable`, async () => {
      const url = await load(mutant);
      const prohibited = await mutant.prohibited(url);
      if (!prohibited) passed(mutant.name);
    });
  }

  test("the mutant set names every declared disabling rule", () => {
    expect(GH335_MUTANTS.map((mutant) => mutant.name).sort()).toEqual(
      [
        "accept-outside-window",
        "probe-substring-match",
        "stamp-raw-probe-line",
        "ignore-probe-deadline",
        "fabricate-version-on-failure",
        "collapse-unknown-into-unsupported",
        "config-window-widens",
        "fallback-to-default-mode",
        "ambient-wins-over-record",
        "forward-undeclared-record",
        "per-seat-env-family",
        "partial-profile",
        "overwrite-observed-with-resolved",
        "zero-cost-as-absence",
        "missing-cost-as-zero",
        "derive-duration-from-capture",
        "work-item-column-query",
        "part-tool-query",
        "legacy-only-extractor",
        "current-only-extractor",
        "zero-row-as-pass",
        "absence-as-capture-failure",
        "capture-failure-as-absence",
        "ignore-missing-scenario",
      ].sort(),
    );
  });
});
