/**
 * TC-PROFILE-020/021/045 (engine half) / 057 — read-only watch status,
 * credential-port-only authorization with one-time handoff, filtering, and
 * deterministic zero-write reads.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CredentialPort,
  CredentialReference,
  ProviderConfiguration,
  ProviderWatchTarget,
  QuotaTransport,
  QuotaTransportRequest,
  QuotaTransportResult,
} from "../../packages/core/src/contracts/index";
import { createProviderWatchStatus } from "../../packages/core/src/provider/index";
import { createProviderWatchMappings } from "../../packages/adapters/src/provider-quota/index";

const ROOT = process.cwd();
const NOW = 1_700_000_000_000;
const CANARY = "CANARY-WATCH-SECRET";

const fixture = (relative: string): string =>
  readFileSync(join(ROOT, "tests/fixtures/provider/watch", relative), "utf8");

const targets: Readonly<Record<string, ProviderWatchTarget>> = {
  "coding-plan": {
    mapping: "coding-plan-windows",
    endpoint: "https://coding-plan.example/quota",
    credentialRef: "cp",
    thresholdPercent: 100,
  },
  deepseek: {
    mapping: "deepseek-balance",
    endpoint: "https://deepseek.example/balance",
    credentialRef: "ds",
    floor: 5,
  },
  openai: {
    mapping: "openai-usage-windows",
    endpoint: "https://openai.example/usage",
    credentialRef: "oa",
    thresholdPercent: 100,
  },
};

const credentials: ProviderConfiguration["credentials"] = {
  cp: { sourceKey: { style: "literal", name: "CP_KEY" } },
  ds: { sourceKey: { style: "literal", name: "DS_KEY" } },
  oa: { sourceKey: { style: "literal", name: "OA_KEY" } },
};

const bodies: Readonly<Record<string, string>> = {
  "https://coding-plan.example/quota": fixture("coding-plan/nominal.json"),
  "https://deepseek.example/balance": fixture("deepseek/above.json"),
  "https://openai.example/usage": fixture("openai/nominal.json"),
};

const recordingCredentialPort = (resolvable = true) => {
  const references: CredentialReference[] = [];
  const port: CredentialPort = {
    resolve: (reference) => {
      references.push(reference);
      return resolvable
        ? { ok: true, material: { value: CANARY } }
        : {
            ok: false,
            code: "config.credential.missing",
            domainKind: "config",
            category: "user",
            retryable: false,
            consequence: "not_landed",
            projectionClass: "user-validation",
          };
    },
  };
  return { port, references };
};

const recordingTransport = (handlers?: (endpoint: string) => QuotaTransportResult | "throw") => {
  const requests: QuotaTransportRequest[] = [];
  const transport: QuotaTransport = {
    send: async (request) => {
      requests.push(request);
      const custom = handlers?.(request.endpoint);
      if (custom === "throw") throw new Error("transport failure");
      if (custom !== undefined) return custom;
      return { status: 200, bodyText: bodies[request.endpoint] ?? "" };
    },
  };
  return { transport, requests };
};

const reader = (
  options: {
    readonly credentialPort?: CredentialPort;
    readonly transport?: QuotaTransport;
  } = {},
) =>
  createProviderWatchStatus({
    clock: { nowMs: () => NOW },
    credentialPort: options.credentialPort ?? recordingCredentialPort().port,
    transport: options.transport ?? recordingTransport().transport,
    mappings: createProviderWatchMappings(),
  });

describe("TC-PROFILE-020/045 read-only watch status", () => {
  test("each provider reports name, condition, source, and checkedAt", async () => {
    const result = await reader().status({ targets, credentials });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers.map((entry) => entry.name)).toEqual([
      "coding-plan",
      "deepseek",
      "openai",
    ]);
    expect(result.providers.map((entry) => entry.condition)).toEqual([
      "clear",
      "clear",
      "clear",
    ]);
    expect(result.providers[0]?.source).toBe("weekly 61%, rolling 12%");
    expect(result.providers[1]?.source).toBe("balance 12.50 vs floor 5.00");
    expect(result.providers[2]?.source).toBe("5h 12%, weekly 61%");
    for (const entry of result.providers) expect(entry.checkedAt).toBe("2023-11-14T22:13:20.000Z");
  });

  test("--provider filters to exactly the named provider", async () => {
    const result = await reader().status({ targets, credentials, providerName: "openai" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers.map((entry) => entry.name)).toEqual(["openai"]);
  });

  test("an unknown provider name is a classified error", async () => {
    const result = await reader().status({ targets, credentials, providerName: "ghost" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("input.value.rejected");
  });

  test("repeated runs are identical and the read path has no store to write", async () => {
    const first = await reader().status({ targets, credentials });
    const second = await reader().status({ targets, credentials });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });
});

describe("TC-PROFILE-021 credential-port-only authorization", () => {
  test("the credential port is called once per target and the transport gets the material", async () => {
    const { port, references } = recordingCredentialPort();
    const { transport, requests } = recordingTransport();
    const result = await reader({ credentialPort: port, transport }).status({ targets, credentials });
    expect(result.ok).toBe(true);
    expect(references).toHaveLength(3);
    expect(requests).toHaveLength(3);
    expect(requests.every((request) => request.credential.value === CANARY)).toBe(true);
  });

  test("no canary or authorization header appears in the output", async () => {
    const result = await reader({
      credentialPort: recordingCredentialPort().port,
      transport: recordingTransport().transport,
    }).status({ targets, credentials });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(CANARY);
    expect(serialized).not.toContain("authorization");
    expect(serialized).not.toContain("Bearer");
  });

  test("an unresolvable credential is a credential condition, not an ambient fallback", async () => {
    const result = await reader({ credentialPort: recordingCredentialPort(false).port }).status({
      targets,
      credentials,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers.map((entry) => entry.condition)).toEqual([
      "credential-missing",
      "credential-missing",
      "credential-missing",
    ]);
  });

  test("a transport failure is an outage condition, never clear", async () => {
    const { transport } = recordingTransport(() => "throw");
    const result = await reader({ transport }).status({ targets, credentials });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers.map((entry) => entry.condition)).toEqual([
      "provider-outage",
      "provider-outage",
      "provider-outage",
    ]);
  });

  test("a 401 response is a credential-rejected condition", async () => {
    const { transport } = recordingTransport(() => ({ status: 401, bodyText: "" }));
    const result = await reader({ transport }).status({ targets, credentials });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.providers[0]?.condition).toBe("credential-rejected");
  });
});
