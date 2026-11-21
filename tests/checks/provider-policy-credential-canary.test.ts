/**
 * GH-374 TC-POL-SEC-001, TC-POL-SEC-002, TC-POL-SEC-003 — credential safety.
 *
 * A canary value injected at the composition appears on no surface; every
 * credential node is exactly `{ sourceKey: { style, name } }` (with the
 * config-layer refusal and the raw-parser ignore arm both asserted); and no
 * committed file in this change's declared set carries a REAL
 * credential-shaped value, with documentation placeholders carved out by a
 * closed exact-token rule.
 *
 * The credential-shaped positive controls are assembled IN MEMORY at run time
 * and never written into any scanned artifact (N4): this suite is itself in the
 * scanned set.
 */
import { describe, expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { nodeFileSystemFacts } from "../../packages/adapters/src/file/index";
import { readLocalPmContext } from "../../packages/adapters/src/file/pm-context";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { parseAndValidateProviderConfiguration } from "../../packages/core/src/provider/validate";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const ROOT = process.cwd();
const CHANGE_FOLDER = "doc/changes/2026-11/2026-11-20--GH-374--provider-policy-adoption";
const REAL_CONFIG_TEXT = readFileSync(join(ROOT, ".delivery-os/config.yaml"), "utf8");
const FIXTURE_DIRECTORY = "tests/fixtures/provider/policy-adoption/simulate";
const FIXTURE_NAMES = [
  "peak-park",
  "quota-park",
  "budget-park",
  "subscription-first",
  "paid-fallback",
  "ticket-ceiling",
] as const;

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("expected an object");
  }
  return value as Record<string, unknown>;
};

const readDocuments = (): Record<string, unknown> =>
  parseYaml(REAL_CONFIG_TEXT) as Record<string, unknown>;

/* -------------------------------- SEC-001 -------------------------------- */

const clearQuota =
  '{"code":200,"success":true,"data":{"limits":[{"type":"TOKENS_LIMIT","percentage":0}]}}';

type RunResult = {
  readonly exitCode: number;
  readonly data?: Record<string, unknown>;
  readonly error?: Record<string, unknown>;
  readonly stdout: string;
  readonly stderr: string;
};

const composedCanary = (canary: string) => {
  const root = makeTempRoot("gh374-canary");
  const checkout = join(root, "checkout");
  const home = join(root, "home");
  const state = join(root, "state");
  mkdirSync(join(checkout, ".delivery-os"), { recursive: true });
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(join(checkout, ".ai/local"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(checkout, ".delivery-os/config.yaml"), REAL_CONFIG_TEXT);
  writeFileSync(
    join(checkout, ".ai/local/pm-context.yaml"),
    "active_change:\n  workItemRef: GH-374\nparked_changes: []\n",
  );
  const calls = { credential: 0, transport: 0 };
  const store = openStore(makeIdentity(state)).store;
  const program = createConfigProgram({
    workingName: "jaiship",
    environment: { HOME: home, PATH: "/usr/bin" },
    cwd: checkout,
    homeDirectory: home,
    platform: "linux",
    priorConfigurationDirectoryName: ".delivery-os",
    fs: nodeFileSystemFacts(),
    repositoryIo: {
      exists: (path) => path === join(checkout, ".git"),
      isFile: () => false,
      readText: () => "",
    },
    provider: {
      clock: { nowMs: () => Date.UTC(2026, 10, 20, 12, 0, 0) },
      credentialPort: {
        resolve: () => {
          calls.credential += 1;
          // The canary is supplied as the resolved material value.
          return { ok: true, material: { value: canary } };
        },
      },
      transport: {
        send: async () => {
          calls.transport += 1;
          return { status: 200, bodyText: clearQuota };
        },
      },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => "fence-gh374-canary",
      spendTotals: { read: async () => ({ status: "empty" }) as never },
      resolveWorkItemRef: () => {
        const read = readLocalPmContext({
          path: join(checkout, ".ai/local/pm-context.yaml"),
          fs: nodeFileSystemFacts(),
        });
        const ref = read.ok ? read.context.activeChange?.workItemRef : undefined;
        return ref === undefined
          ? { status: "unresolved" }
          : { status: "resolved", workItemRef: ref };
      },
      workItemContextPath: join(checkout, ".ai/local/pm-context.yaml"),
    },
  });
  if (!program.ok) throw new Error("the composed program did not resolve its brand");
  return {
    root,
    calls,
    cleanup: () => removeRoot(root),
    run: async (argv: readonly string[]): Promise<RunResult> => {
      let stdout = "";
      let stderr = "";
      const deps: CliDependencies = {
        brand: program.brand,
        clock: { now: () => Date.UTC(2026, 10, 20, 12, 0, 0) },
        newRunId: () => "run-gh374-canary",
        secrets: program.secrets,
        program: program.program,
      };
      const exitCode = await runCli(
        argv,
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: (chunk: string) => (stderr += chunk) },
        },
        deps,
      );
      const envelope =
        stdout.trim().length === 0 ? undefined : (JSON.parse(stdout) as Record<string, unknown>);
      return {
        exitCode,
        ...(envelope?.data === undefined ? {} : { data: asRecord(envelope.data) }),
        ...(envelope?.error === undefined ? {} : { error: asRecord(envelope.error) }),
        stdout,
        stderr,
      };
    },
  };
};

/** The canary scanner: a pure substring test, so a non-credential name still reports. */
export const scanForCanary = (text: string, canary: string): boolean => text.includes(canary);

describe("GH-374 TC-POL-SEC-001 a canary credential appears on no surface, and the scanner fires", () => {
  test("the canary is absent from every surface while the scanner reports a planted occurrence", async () => {
    const canary = ["gh374", "canary", randomBytes(8).toString("hex")].join("-");
    const composed = composedCanary(canary);
    try {
      const profile = await composed.run([
        "provider",
        "profile",
        "resolve",
        "--agent",
        "pm",
        "--for-spawn",
        "--json",
      ]);
      expect(profile.exitCode).toBe(0);
      const resolve = await composed.run(["provider", "resolve", "--json"]);
      expect(resolve.exitCode).toBe(0);
      const replay = await composed.run([
        "provider",
        "simulate",
        "--fixture",
        join(ROOT, FIXTURE_DIRECTORY, "subscription-first.json"),
        "--json",
      ]);
      expect(replay.exitCode).toBe(0);
      expect(composed.calls.credential).toBeGreaterThan(0);

      const envRecord = String(asRecord(asRecord(profile.data).envRecord).serialized);
      const surfaces: readonly (readonly [string, string])[] = [
        ["the document text", REAL_CONFIG_TEXT],
        ...FIXTURE_NAMES.map(
          (name) =>
            [
              `the ${name} fixture`,
              readFileSync(join(ROOT, FIXTURE_DIRECTORY, `${name}.json`), "utf8"),
            ] as const,
        ),
        ["the env-record text", envRecord],
        ["the resolve data", JSON.stringify(resolve.data)],
        ["the replay data", JSON.stringify(replay.data)],
        [
          "the evidence artifact",
          readFileSync(join(ROOT, CHANGE_FOLDER, "migration-output.md"), "utf8"),
        ],
        ["the resolve stdout", resolve.stdout],
        ["the resolve stderr", resolve.stderr],
        ["the replay stdout", replay.stdout],
        ["the replay stderr", replay.stderr],
      ];
      for (const [label, text] of surfaces) {
        expect([label, scanForCanary(text, canary)]).toEqual([label, false]);
      }

      // Non-vacuity: the same scanner reports a planted occurrence, including
      // one carried by a non-credential name (no blanket redaction).
      expect(scanForCanary(`X_NOTE=${canary}`, canary)).toBe(true);
      expect(scanForCanary(`unrelated variable: ${canary}`, canary)).toBe(true);
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- SEC-002 -------------------------------- */

const HOSTILE_KEYS = ["value", "secret", "token", "key", "raw"] as const;

const composedWithDocument = (text: string) => {
  const root = makeTempRoot("gh374-sec002");
  const checkout = join(root, "checkout");
  const home = join(root, "home");
  mkdirSync(join(checkout, ".delivery-os"), { recursive: true });
  mkdirSync(join(checkout, ".git"), { recursive: true });
  mkdirSync(home, { recursive: true });
  writeFileSync(join(checkout, ".delivery-os/config.yaml"), text);
  const program = createConfigProgram({
    workingName: "jaiship",
    environment: { HOME: home, PATH: "/usr/bin" },
    cwd: checkout,
    homeDirectory: home,
    platform: "linux",
    priorConfigurationDirectoryName: ".delivery-os",
    fs: nodeFileSystemFacts(),
    repositoryIo: {
      exists: (path) => path === join(checkout, ".git"),
      isFile: () => false,
      readText: () => "",
    },
  });
  if (!program.ok) throw new Error("the composed program did not resolve its brand");
  return {
    checkout,
    cleanup: () => removeRoot(root),
    run: async (argv: readonly string[]): Promise<RunResult> => {
      let stdout = "";
      let stderr = "";
      const deps: CliDependencies = {
        brand: program.brand,
        clock: { now: () => 1 },
        newRunId: () => "run-gh374-sec002",
        secrets: program.secrets,
        program: program.program,
      };
      const exitCode = await runCli(
        argv,
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: (chunk: string) => (stderr += chunk) },
        },
        deps,
      );
      const envelope =
        stdout.trim().length === 0 ? undefined : (JSON.parse(stdout) as Record<string, unknown>);
      return {
        exitCode,
        ...(envelope?.data === undefined ? {} : { data: asRecord(envelope.data) }),
        ...(envelope?.error === undefined ? {} : { error: asRecord(envelope.error) }),
        stdout,
        stderr,
      };
    },
  };
};

describe("GH-374 TC-POL-SEC-002 every credential node is exactly a sourceKey reference", () => {
  test("two children, each { sourceKey }, and sourceKey's only keys are style and name", () => {
    const parsed = parseAndValidateProviderConfiguration(readDocuments());
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const credentials = parsed.config.credentials;
    expect(Object.keys(credentials).sort()).toEqual(["deepseek", "zai"]);
    for (const [name, child] of Object.entries(credentials)) {
      expect([name, Object.keys(child)]).toEqual([name, ["sourceKey"]]);
      const sourceKey = child.sourceKey;
      expect([name, Object.keys(sourceKey).sort()]).toEqual([name, ["name", "style"]]);
      expect([name, sourceKey.style]).toEqual([name, "literal"]);
      if (sourceKey.style !== "literal") continue;
      expect([name, sourceKey.name.length > 0]).toEqual([name, true]);
    }
  });

  test("a hostile key beside or inside sourceKey is refused by the config layer and ignored by the raw parser", async () => {
    for (const position of ["beside", "inside"] as const) {
      for (const hostile of HOSTILE_KEYS) {
        const document = readDocuments();
        const credentials = asRecord(asRecord(document.provider).credentials);
        const child = asRecord(credentials.zai);
        const sourceKey = asRecord(child.sourceKey);
        // Place THIS hostile key at the chosen position.
        for (const key of HOSTILE_KEYS) {
          delete child[key];
          delete sourceKey[key];
        }
        if (position === "beside") child[hostile] = "synthetic-not-a-credential";
        else sourceKey[hostile] = "synthetic-not-a-credential";

        const composed = composedWithDocument(`${JSON.stringify(document, null, 2)}\n`);
        try {
          const result = await composed.run([
            "config",
            "debug",
            "--json",
            "--project-root",
            composed.checkout,
          ]);
          expect([position, hostile, result.exitCode]).toEqual([position, hostile, 1]);
          expect(result.data).toBeUndefined();
          expect(result.error?.code).toBe("config.key.unknown");
          // The delivered failure carries no key member, so the case asserts the
          // code plus the differential oracle below rather than inventing a
          // path string.
          expect(result.error?.key).toBeUndefined();
          expect(result.error?.layer).toBeUndefined();
        } finally {
          composed.cleanup();
        }

        // Raw parser arm: the hostile key is IGNORED, never a refusal.
        const raw = parseAndValidateProviderConfiguration(
          JSON.parse(JSON.stringify(document)) as Record<string, unknown>,
        );
        expect([position, hostile, raw.ok]).toEqual([position, hostile, true]);
        if (!raw.ok) continue;
        const parsedChild = raw.config.credentials.zai;
        expect([position, hostile, Object.keys(asRecord(parsedChild)).sort()]).toEqual([
          position,
          hostile,
          ["sourceKey"],
        ]);
        expect([
          position,
          hostile,
          Object.keys(asRecord(asRecord(parsedChild).sourceKey)).sort(),
        ]).toEqual([position, hostile, ["name", "style"]]);
      }
    }
  });

  test("the differential oracle: the identical document without the hostile key resolves ok", async () => {
    const composed = composedWithDocument(REAL_CONFIG_TEXT);
    try {
      const result = await composed.run([
        "config",
        "debug",
        "--json",
        "--project-root",
        composed.checkout,
      ]);
      expect(result.exitCode).toBe(0);
      expect(asRecord(result.data).config).toBeDefined();
    } finally {
      composed.cleanup();
    }
  });
});

/* -------------------------------- SEC-003 -------------------------------- */

/**
 * The closed placeholder token set, compared literally after quote-trimming.
 * This is a CLOSED list of documented forms, never an "ends with an ellipsis"
 * heuristic: a long value that merely ends in an ellipsis is still reported.
 */
export const PLACEHOLDER_TOKENS = [
  "...",
  "<YOUR_KEY>",
  "$OPENAI_API_KEY",
  "$" + "{OPENAI_API_KEY}",
  "sk-ant-...",
  "sk-...",
  "zai-...",
  "sk-ant-…",
] as const;

/** A value shorter than this is carved out only when it is placeholder-only. */
export const PLACEHOLDER_MIN_LENGTH = 16;

const CREDENTIAL_SHAPED_KEY =
  /([A-Za-z0-9_]*(?:API_KEY|API_TOKEN|ACCESS_TOKEN|SECRET|PASSWORD|PRIVATE_KEY|CLIENT_SECRET))["']?\s*[:=]\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))/g;

export type CredentialFinding = {
  readonly path: string;
  readonly line: number;
  readonly keyName: string;
};

const isAngleBracket = (value: string): boolean => /^<[A-Z0-9_]+>$/.test(value);
const isDollarVar = (value: string): boolean => /^\$\{?[A-Z_][A-Z0-9_]*\}?$/.test(value);
const isPlaceholderOnly = (value: string): boolean => /^[.<>{}$_\-…]+$/.test(value);

const isCarvedOut = (value: string): boolean => {
  if ((PLACEHOLDER_TOKENS as readonly string[]).includes(value)) return true;
  if (isAngleBracket(value)) return true;
  if (isDollarVar(value)) return true;
  if (value.length < PLACEHOLDER_MIN_LENGTH && isPlaceholderOnly(value)) return true;
  return false;
};

/** The pure `(path, text)` credential-shaped scanner. */
export const scanCredentialShapedText = (
  path: string,
  text: string,
): readonly CredentialFinding[] => {
  const findings: CredentialFinding[] = [];
  for (const [index, line] of text.split("\n").entries()) {
    for (const match of line.matchAll(CREDENTIAL_SHAPED_KEY)) {
      const keyName = match[1] ?? "";
      // Trailing markdown punctuation belongs to the surrounding prose, not to
      // the documented value (`...` in backticks is still the exact token).
      const value = (match[2] ?? match[3] ?? match[4] ?? "").trim().replace(/[`"',;:)\]}]+$/u, "");
      if (value.length === 0) continue;
      if (isCarvedOut(value)) continue;
      findings.push({ path, line: index + 1, keyName });
    }
  }
  return findings;
};

/** This change's declared changed/added file set (spec NFR-7; test plan §7.2). */
export const DECLARED_CREDENTIAL_SCAN_SET = [
  ".delivery-os/config.yaml",
  ...FIXTURE_NAMES.map((name) => `${FIXTURE_DIRECTORY}/${name}.json`),
  "tests/structure/provider-policy-adoption-reference.test.ts",
  "tests/behaviour/provider-policy-adoption.test.ts",
  "tests/checks/provider-legacy-source-scan.test.ts",
  "tests/checks/provider-policy-adoption-prompt-scan.test.ts",
  "tests/checks/provider-policy-credential-canary.test.ts",
  "tests/checks/doc-conformance.test.ts",
  "doc/guides/provider-conditions-and-parks.md",
  "doc/guides/opencode-model-configuration.md",
  "doc/guides/zai-peak-hours-hook.md",
  "doc/spec/features/feature-provider-profiles.md",
  ".opencode/agent/toolsmith.md",
  ".ados-claude/agents/toolsmith.md",
  `${CHANGE_FOLDER}/migration-output.md`,
  `${CHANGE_FOLDER}/chg-GH-374-plan.yaml`,
  `${CHANGE_FOLDER}/chg-GH-374-spec.md`,
] as const;

describe("GH-374 TC-POL-SEC-003 no committed file carries a real credential-shaped value", () => {
  test("the declared set contains no real value; its placeholders are the closed forms", () => {
    const existing = DECLARED_CREDENTIAL_SCAN_SET.filter((path) => existsSync(join(ROOT, path)));
    // The phase-6 documentation and the extended conformance suite join the set
    // as they land; the scan is exact over every declared path that exists.
    expect(existing.length).toBeGreaterThanOrEqual(12);
    const findings = existing.flatMap((path) =>
      scanCredentialShapedText(path, readFileSync(join(ROOT, path), "utf8")),
    );
    expect(findings).toEqual([]);
    // Set equality: nothing declared is skipped, nothing else is scanned.
    expect(new Set(existing)).toEqual(
      new Set(DECLARED_CREDENTIAL_SCAN_SET.filter((path) => existsSync(join(ROOT, path)))),
    );
  });

  test("the in-memory corpus is reported for real values and carved out for the exact placeholders", () => {
    // (A) and (B) are assembled at run time; no scanned file carries them.
    const keyName = ["DEEPSEEK", "API", "KEY"].join("_");
    const value = ["sk", "live", randomBytes(12).toString("hex")].join("-");
    const longRandom = randomBytes(20).toString("hex");
    const ellipsisTail = `${randomBytes(16).toString("hex")}…`;

    const a = scanCredentialShapedText("memory:a", `${keyName}=${value}`);
    expect(a).toHaveLength(1);
    expect(a[0]?.keyName).toBe(keyName);
    const b = scanCredentialShapedText("memory:b", `${keyName}=${longRandom}`);
    expect(b).toHaveLength(1);

    // (C) the exact placeholder forms are carved out.
    for (const placeholder of PLACEHOLDER_TOKENS) {
      expect([
        placeholder,
        scanCredentialShapedText("memory:c", `${keyName}=${placeholder}`),
      ]).toEqual([placeholder, []]);
    }
    for (const placeholder of ["<YOUR_TOKEN>", "$" + "{MY_SECRET}", "$MY_ACCESS_TOKEN"]) {
      expect([
        placeholder,
        scanCredentialShapedText("memory:c", `${keyName}=${placeholder}`),
      ]).toEqual([placeholder, []]);
    }

    // (D) a long value ending in an ellipsis is NOT a placeholder.
    expect(scanCredentialShapedText("memory:d", `${keyName}=${ellipsisTail}`)).toHaveLength(1);

    // The control corpus never enters the tree: the assembled fragments are not
    // contiguous in any scanned document.
    const fragment = ["sk", "live"].join("-");
    for (const path of DECLARED_CREDENTIAL_SCAN_SET.filter((entry) =>
      existsSync(join(ROOT, entry)),
    )) {
      expect([path, readFileSync(join(ROOT, path), "utf8").includes(fragment)]).toEqual([
        path,
        false,
      ]);
    }
  });
});
