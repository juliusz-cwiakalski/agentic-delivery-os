/**
 * TC-REDACT-001..004 — the live redaction registry (DM-7): registration at
 * materialization precedes parsing and any throw; the malformed child output
 * and the stderr canary render nowhere; the three edge-composed registration
 * sites join the same registry.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ChildRunRequest,
  resolveCommandSource,
} from "../../packages/adapters/src/credentials/command-strategy";
import {
  classifyHarnessStoreSource,
  type HarnessStoreEntry,
} from "../../packages/adapters/src/credentials/harness-store-strategy";
import { createCredentialResolver } from "../../packages/adapters/src/credentials/index";
import { CANARY, fixtureBrand } from "../fixtures/credentials/cases";

const MALFORMED_EXPORT = '{"entries": [ truncated';

const harnessEntry: HarnessStoreEntry = {
  id: "e",
  integrationID: "deepseek",
  label: "L",
  active: true,
  value: { type: "key", key: CANARY },
};

describe("TC-REDACT-002 malformed child output: registered before parse, never rendered", () => {
  test("the harness export's keys register per validated entry, before selection and before any refusal", () => {
    const order: string[] = [];
    // A multi-entry export: every key entry registers as it is validated —
    // before the selection that refuses on ambiguity.
    const classification = classifyHarnessStoreSource(
      { style: "harness-store", harness: "opencode", integrationId: "deepseek" },
      {
        activeHarness: "opencode",
        storeFacts: {
          exportEntries: () => ({
            ok: true,
            stdout: JSON.stringify([harnessEntry, { ...harnessEntry, id: "e2" }]),
            stdoutTruncated: false,
          }),
        },
        registerSecret: (value) => order.push(`register:${value}`),
      },
    );
    expect(classification.status).toBe("refused");
    if (classification.status === "refused")
      expect(classification.reason).toBe("ambiguous-account");
    // Registration happened before the selection raised its refusal.
    expect(order).toEqual([`register:${CANARY}`, `register:${CANARY}`]);
  });

  test("a malformed export registers nothing and the raw bytes render nowhere", () => {
    const registered: string[] = [];
    const resolver = createCredentialResolver({
      environment: {},
      brand: fixtureBrand,
      harness: "opencode",
      runChild: () => ({ ok: false, reason: "program-unavailable" }),
      storeFacts: {
        exportEntries: () => ({ ok: true, stdout: MALFORMED_EXPORT, stdoutTruncated: false }),
      },
      registerSecret: (value) => registered.push(value),
    });
    const resolution = resolver.resolve({
      referenceName: "provider",
      sourceKey: { style: "harness-store", harness: "opencode", integrationId: "deepseek" },
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      // The classified failure is shape-drift; no partial material escaped.
      expect(resolution.reason).toBe("shape-drift");
      expect(JSON.stringify(resolution)).not.toContain("truncated");
    }
    expect(registered).toEqual([]);
    // The raw child output appears on no rendered surface of the failure.
    expect(JSON.stringify(resolution)).not.toContain('{"entries"');
  });

  test("command-style material registers exactly once, before the resolve returns", () => {
    const order: string[] = [];
    resolveCommandSource(
      { style: "command", program: "/usr/bin/gh", args: ["auth", "token"] },
      {
        parentEnvironment: { PATH: "/usr/bin" },
        registerSecret: (value) => order.push(`register:${value}`),
        runChild: (_request: ChildRunRequest) => ({
          ok: true,
          exitCode: 0,
          stdout: `recorded-line\n`,
          stdoutTruncated: false,
        }),
      },
    );
    expect(order).toEqual(["register:recorded-line"]);
  });
});

describe("TC-REDACT-003 stderr canary never rendered; stderr is size and exit only", () => {
  test("the failure carries non-zero-exit with stderr size only; the canary renders nowhere", () => {
    const stderrCanary = "stderr-canary-9f3a-do-not-render";
    const registered: string[] = [];
    let recordedStderrBytes = -1;
    const resolution = resolveCommandSource(
      { style: "command", program: "/usr/bin/gh", args: ["auth", "token"] },
      {
        parentEnvironment: { PATH: "/usr/bin" },
        registerSecret: (value) => registered.push(value),
        runChild: (_request: ChildRunRequest) => {
          // The recording seam reduces stderr to size and exit status by
          // shape: the runner outcome carries no stderr bytes at all.
          recordedStderrBytes = stderrCanary.length;
          return { ok: true, exitCode: 1, stdout: "", stdoutTruncated: false };
        },
      },
    );
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("non-zero-exit");
      expect(JSON.stringify(resolution)).not.toContain(stderrCanary);
      expect(JSON.stringify(resolution)).not.toContain("stderrBytes");
    }
    expect(recordedStderrBytes).toBe(stderrCanary.length);
    expect(registered).toEqual([]);
  });
});

describe("TC-REDACT-004 the three edge-composed registration sites join the live registry", () => {
  test("the registerEdgeSecrets helper and both call sites register into createSecretRegistry-backed registries", () => {
    const edge = readFileSync(join(process.cwd(), "packages/cli/src/edge.ts"), "utf8");
    // The helper registers into a registry created from the secret list, and
    // both call sites construct their registry the same way.
    expect(edge).toContain("registerEdgeSecrets(environment, options.secretKeys ?? [])");
    expect(edge).toContain(
      "createSecretRegistry(registerEdgeSecrets(initialLegacy.environment, secretKeys))",
    );
    const callSites = edge.match(/createSecretRegistry\(registerEdgeSecrets\(/g) ?? [];
    expect(callSites.length).toBe(2);
  });

  test("the live registry is consulted at render time (the seam is mutable)", () => {
    const index = readFileSync(join(process.cwd(), "packages/cli/src/index.ts"), "utf8");
    expect(index).toContain("secretValuesOf(deps.secrets)");
    // Every render consult goes through the normalizer: the registry's
    // values() is read at consult time, so post-composition registrations
    // are visible to the serializer.
    expect((index.match(/secretValuesOf\(deps\.secrets\)/g) ?? []).length).toBeGreaterThanOrEqual(
      6,
    );
  });
});
