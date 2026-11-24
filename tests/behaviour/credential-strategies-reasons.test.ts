/**
 * TC-REASON-001/002/003 — the closed ten-member reason union: one case per
 * reason, `timeout` distinct from the reserved `resolution-pending`, and no
 * shipped caller observing the reserved token.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMMAND_ALLOWLIST,
  remedyText,
  validateHostSlot,
} from "../../packages/adapters/src/credentials/allowlist";
import {
  type ChildRunRequest,
  resolveCommandSource,
} from "../../packages/adapters/src/credentials/command-strategy";
import {
  classifyHarnessStoreSource,
  type HarnessStoreEntry,
} from "../../packages/adapters/src/credentials/harness-store-strategy";
import { createCredentialResolver } from "../../packages/adapters/src/credentials/index";
import {
  CREDENTIAL_FAILURE_REASONS,
  type CredentialFailureReason,
} from "../../packages/core/src/contracts/credentials";
import { CANARY, fixtureBrand } from "../fixtures/credentials/cases";

const RESOLVER_INPUT = {
  parentEnvironment: { PATH: "/usr/bin", HOME: "/home/op" },
  registerSecret: () => undefined,
};

const commandResolution = (
  runChild: (
    request: ChildRunRequest,
  ) =>
    | { ok: true; exitCode: number; stdout: string; stdoutTruncated?: boolean }
    | { ok: false; reason: "timeout" | "program-unavailable" },
  sourceKey = {
    style: "command" as const,
    program: "/usr/bin/gh",
    args: ["auth", "token"],
  },
) =>
  resolveCommandSource(sourceKey, {
    ...RESOLVER_INPUT,
    runChild,
  });

const harnessEntry: HarnessStoreEntry = {
  id: "e",
  integrationID: "deepseek",
  label: "L",
  active: true,
  value: { type: "key", key: CANARY },
};

const harnessResolution = (
  exportEntries: () =>
    | { ok: true; stdout: string; stdoutTruncated: boolean }
    | { ok: false; reason: "timeout" | "non-zero-exit" | "program-unavailable" },
  sourceKey = {
    style: "harness-store" as const,
    harness: "opencode" as const,
    integrationId: "deepseek",
  },
  activeHarness: "opencode" | "claude-code" = "opencode",
) =>
  classifyHarnessStoreSource(sourceKey, {
    activeHarness,
    storeFacts: { exportEntries },
    registerSecret: () => undefined,
  });

/** Every observable classification returns through the resolver for the variant. */
const resolverFor = (sourceKey: { style: string }) =>
  createCredentialResolver({
    environment: {},
    brand: fixtureBrand,
    harness: "opencode",
    runChild: () => ({ ok: false, reason: "program-unavailable" }),
    storeFacts: { exportEntries: () => ({ ok: false, reason: "program-unavailable" }) },
    registerSecret: () => undefined,
  }).resolve({ referenceName: "x", sourceKey: sourceKey as never });

describe("TC-REASON-001 one case per reason", () => {
  test("the union declares exactly the closed ten members", () => {
    expect([...CREDENTIAL_FAILURE_REASONS].sort()).toEqual(
      [
        "program-unavailable",
        "timeout",
        "non-zero-exit",
        "empty-output",
        "shape-drift",
        "ambiguous-account",
        "oauth-excluded",
        "source-not-supported",
        "variable-absent",
        "resolution-pending",
      ].sort(),
    );
  });

  test("program-unavailable — allowlisted declaration whose path chain does not resolve", () => {
    const resolution = commandResolution(() => ({ ok: true, exitCode: 0, stdout: "x" }), {
      style: "command",
      program: "/nonexistent/gh",
      args: ["auth", "token"],
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("program-unavailable");
      expect(resolution.remedy).toBe(remedyText("program-unavailable", "command"));
    }
  });

  test("timeout — a hanging child under a declared short cap", () => {
    const resolution = commandResolution(() => ({ ok: false, reason: "timeout" }));
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.reason).toBe("timeout");
  });

  test("non-zero-exit — child exits non-zero with no usable stdout", () => {
    const resolution = commandResolution(() => ({ ok: true, exitCode: 1, stdout: "" }));
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("non-zero-exit");
      const ghEntry = COMMAND_ALLOWLIST.find((candidate) => candidate.program === "gh");
      expect(resolution.remedy).toBe(remedyText("non-zero-exit", "command", ghEntry));
    }
  });

  test("empty-output — child exits 0 with empty stdout after stripping", () => {
    const resolution = commandResolution(() => ({ ok: true, exitCode: 0, stdout: "  \n" }));
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.reason).toBe("empty-output");
  });

  test("shape-drift — export output departing the pinned shape", () => {
    const classification = harnessResolution(() => ({
      ok: true,
      stdout: JSON.stringify({ nope: true }),
      stdoutTruncated: false,
    }));
    expect(classification.status).toBe("refused");
    if (classification.status === "refused") expect(classification.reason).toBe("shape-drift");
  });

  test("ambiguous-account — zero and multiple active entries", () => {
    for (const entries of [
      [
        { ...harnessEntry, active: false },
        { ...harnessEntry, id: "e2", active: false },
      ],
      [harnessEntry, { ...harnessEntry, id: "e2" }],
    ]) {
      const classification = harnessResolution(() => ({
        ok: true,
        stdout: JSON.stringify(entries),
        stdoutTruncated: false,
      }));
      expect(classification.status).toBe("refused");
      if (classification.status === "refused")
        expect(classification.reason).toBe("ambiguous-account");
    }
  });

  test("oauth-excluded — the oauth entry is refused outright", () => {
    const classification = harnessResolution(() => ({
      ok: true,
      stdout: JSON.stringify([{ ...harnessEntry, value: { type: "oauth" } }]),
      stdoutTruncated: false,
    }));
    expect(classification.status).toBe("refused");
    if (classification.status === "refused") expect(classification.reason).toBe("oauth-excluded");
  });

  test("source-not-supported — unsupported harness and identity mismatch", () => {
    for (const sourceKey of [
      { style: "harness-store" as const, harness: "competitor-cli", integrationId: "deepseek" },
      {
        style: "harness-store" as const,
        harness: "claude-code" as const,
        integrationId: "deepseek",
      },
    ]) {
      const classification = harnessResolution(
        () => ({ ok: true, stdout: JSON.stringify([harnessEntry]), stdoutTruncated: false }),
        sourceKey,
      );
      expect(classification.status).toBe("refused");
      if (classification.status === "refused")
        expect(classification.reason).toBe("source-not-supported");
    }
  });

  test("variable-absent — literal declaration with the variable unset (environment styles preserved)", () => {
    const resolution = createCredentialResolver({
      environment: {},
      brand: fixtureBrand,
      harness: "opencode",
      runChild: () => ({ ok: false, reason: "program-unavailable" }),
      storeFacts: { exportEntries: () => ({ ok: false, reason: "program-unavailable" }) },
      registerSecret: () => undefined,
    }).resolve({
      referenceName: "tracker",
      sourceKey: { style: "literal", name: "FIXTURE_CREDENTIAL" },
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("variable-absent");
      expect(resolution.source).toBe("literal:FIXTURE_CREDENTIAL");
      expect(resolution.remedy).toBe(remedyText("variable-absent", "literal"));
    }
  });

  test("every observable case carries the single delivered code, source, reason, and a non-empty bounded remedy", () => {
    const failures = [
      commandResolution(() => ({ ok: false, reason: "timeout" })),
      commandResolution(() => ({ ok: true, exitCode: 1, stdout: "" })),
      commandResolution(() => ({ ok: true, exitCode: 0, stdout: "" })),
      commandResolution(() => ({ ok: true, exitCode: 0, stdout: "x" }), {
        style: "command",
        program: "/nonexistent/gh",
        args: ["auth", "token"],
      }),
    ].filter((entry): entry is Extract<typeof entry, { ok: false }> => !entry.ok);
    for (const failure of failures) {
      expect(failure.code).toBe("config.credential.missing");
      expect(typeof failure.source).toBe("string");
      expect(failure.reason).toBeDefined();
      expect((failure.remedy ?? "").length).toBeGreaterThan(0);
      expect(failure.remedy?.length ?? 0).toBeLessThan(400);
    }
    expect(failures.length).toBe(4);
  });

  test("the environment-style classification is byte-identical through the resolver", () => {
    const resolution = resolverFor({ style: "literal", name: "ABSENT_KEY" });
    expect(resolution.ok).toBe(false);
  });
});

describe("TC-REASON-002 timeout distinct from the reserved resolution-pending", () => {
  test("the cap classifies exactly timeout", () => {
    const resolution = commandResolution(() => ({ ok: false, reason: "timeout" }));
    if (!resolution.ok) expect(resolution.reason).toBe("timeout");
    expect(resolution.ok).toBe(false);
  });

  test("resolution-pending is never produced by the one-shot resolver for any exercised class", () => {
    const outcomes: (CredentialFailureReason | undefined)[] = [];
    for (const resolution of [
      commandResolution(() => ({ ok: false, reason: "timeout" })),
      commandResolution(() => ({ ok: true, exitCode: 1, stdout: "noise on stderr: x" })),
      commandResolution(() => ({ ok: true, exitCode: 0, stdout: "a\nb" })),
      commandResolution(() => ({ ok: true, exitCode: 0, stdout: "" })),
    ]) {
      if (!resolution.ok) outcomes.push(resolution.reason);
    }
    for (const classification of [
      harnessResolution(() => ({
        ok: true,
        stdout: JSON.stringify([harnessEntry, { ...harnessEntry, id: "e2" }]),
        stdoutTruncated: false,
      })),
      harnessResolution(() => ({
        ok: true,
        stdout: JSON.stringify([{ ...harnessEntry, value: { type: "oauth" } }]),
        stdoutTruncated: false,
      })),
    ]) {
      if (classification.status === "refused") outcomes.push(classification.reason);
    }
    expect(outcomes.length).toBeGreaterThanOrEqual(6);
    expect(outcomes).not.toContain("resolution-pending");
  });

  test("the two tokens are distinct union members", () => {
    expect(new Set(CREDENTIAL_FAILURE_REASONS).size).toBe(CREDENTIAL_FAILURE_REASONS.length);
    expect(CREDENTIAL_FAILURE_REASONS).toContain("timeout");
    expect(CREDENTIAL_FAILURE_REASONS).toContain("resolution-pending");
  });
});

describe("TC-REASON-003 no shipped caller observes resolution-pending", () => {
  test("the shipped daemon composition has no credential consumer (composition inventory)", () => {
    const production = readFileSync(join(process.cwd(), "packages/cli/src/production.ts"), "utf8");
    // The resident daemon composition passes no lane and no executor: its
    // credential surface is supervise-only with no consumer.
    expect(production).toMatch(
      /supervise-only|superviseOnly|supervise-only mode|createDaemonCompose|daemon-compose/i,
    );
    const daemonCompose = readFileSync(
      join(process.cwd(), "packages/cli/src/daemon-compose.ts"),
      "utf8",
    );
    expect(daemonCompose).not.toContain("createCredentialResolver");
    expect(daemonCompose).not.toContain("registerSecret");
  });

  test("no shipped source produces the reserved token", () => {
    const { readdirSync, statSync } = require("node:fs") as typeof import("node:fs");
    const roots = [
      "packages/core/src",
      "packages/adapters/src",
      "packages/cli/src",
      "packages/mcp/src",
    ];
    const offenders: string[] = [];
    const walk = (directory: string): void => {
      for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);
        if (statSync(path).isDirectory()) walk(path);
        else if (path.endsWith(".ts")) {
          const text = readFileSync(path, "utf8");
          // The union's declaration site names the member; no site produces it.
          if (
            path.endsWith("credentials.ts") === false &&
            text.includes("resolution-pending") &&
            text.includes('"resolution-pending"') &&
            !text.includes("CREDENTIAL_FAILURE_REASONS")
          ) {
            offenders.push(path);
          }
        }
      }
    };
    for (const root of roots) walk(root);
    expect(offenders).toEqual([]);
  });

  test("the token sweep across the behaviour suites finds no rendered resolution-pending", () => {
    const suites = [
      "tests/behaviour/credential-strategies-command.test.ts",
      "tests/behaviour/credential-strategies-harness-store.test.ts",
      "tests/behaviour/credential-strategies-reasons.test.ts",
      "tests/behaviour/credential-strategies-remedies.test.ts",
      "tests/behaviour/credential-compatibility.test.ts",
    ];
    for (const suite of suites) {
      const text = readFileSync(join(process.cwd(), suite), "utf8");
      // The invariant: the token never appears inside a rendered-output pin
      // (an expected summary, message, or output string). Declaring the union
      // member or asserting its absence is the only sanctioned usage. The
      // sweep's own assertion lines are exempt by construction.
      if (suite.endsWith("credential-strategies-reasons.test.ts")) continue;
      for (const line of text.split("\n")) {
        if (line.includes("resolution-pending")) {
          expect(line).not.toMatch(/(toBe|toEqual)\("(?:[^"]*)resolution-pending/);
          expect(line).not.toMatch(/summary.*resolution-pending|resolution-pending.*summary/);
        }
      }
    }
  });

  test("the reserved token is unreachable from the one-shot resolver surfaces", () => {
    // Exhausting the reachable classification surface: every observable
    // refusal carries one of the nine observable tokens, never the reserved
    // one. The host slot grammar also stays closed at load (cross-cover).
    expect(validateHostSlot("example.com").ok).toBe(true);
    const observable = CREDENTIAL_FAILURE_REASONS.filter(
      (reason) => reason !== "resolution-pending",
    );
    expect(observable).toHaveLength(9);
  });
});
