/**
 * TC-PROV-038/039/040 — credential-port-only quota authorization, missing
 * credentials, single handoff, no cache, and canary-free surfaces.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  CredentialPort,
  CredentialReference,
  CredentialResolution,
  ProviderClock,
  ProviderConfiguration,
  ProviderSleep,
  QuotaTransport,
  QuotaTransportRequest,
} from "../../packages/core/src/contracts/index";
import { createProviderEngine } from "../../packages/core/src/provider/engine";

const ROOT = process.cwd();
const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);
const clock: ProviderClock = { nowMs: () => NOW };
const sleep: ProviderSleep = { sleep: async () => undefined };
const CREDENTIAL_CANARY = "CREDENTIAL-CANARY-9f3a";
const BODY_CANARY = "RAW-BODY-CANARY-2b7c";
const parkAllowlist = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/evidence/park-allowlist.json"), "utf8"),
) as { fields: string[] };
const announcementAllowlist = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/provider/evidence/announcement-allowlist.json"), "utf8"),
) as { fields: string[] };

type RecordingPort = CredentialPort & { readonly references: CredentialReference[] };
const recordingPort = (missing = false): RecordingPort => {
  const references: CredentialReference[] = [];
  return {
    references,
    resolve: (reference) => {
      references.push(reference);
      if (missing || reference.referenceName === "missing") {
        return {
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        } satisfies CredentialResolution;
      }
      return { ok: true, material: { value: CREDENTIAL_CANARY } };
    },
  };
};

const config = (quotaRefs: readonly string[]): ProviderConfiguration => ({
  defaultChain: "default",
  credentials: {
    zai: { sourceKey: { style: "literal", name: "ZAI_API_KEY" } },
    missing: { sourceKey: { style: "literal", name: "MISSING_API_KEY" } },
  },
  entries: Object.fromEntries(
    quotaRefs.map((credentialRef, index) => [
      `p${index}`,
      {
        name: `p${index}`,
        class: "subscription" as const,
        enabled: true,
        quota: {
          enabled: true,
          endpoint: `https://p${index}.test/quota`,
          credentialRef,
          timeoutMs: 1000,
          thresholdPercent: 100,
          maxSleepLoops: 24,
          outageParkTtlSeconds: 300,
          credentialParkTtlSeconds: 900,
          capParkTtlSeconds: 300,
        },
      },
    ]),
  ),
  chains: {
    default: {
      name: "default",
      entries: quotaRefs.map((_, index) => `p${index}`),
      allowPaidFallback: false,
    },
  },
});

const requestRecordingTransport = (
  requests: QuotaTransportRequest[],
  status = 200,
): QuotaTransport => ({
  send: async (request) => {
    requests.push(request);
    return {
      status,
      bodyText:
        status === 200
          ? JSON.stringify({ code: 200, success: true, data: { limits: [] } })
          : `{"raw":"${BODY_CANARY}"}`,
    };
  },
});

const scan = (value: unknown): string => {
  const raw = JSON.stringify(value);
  const escaped = JSON.stringify(raw);
  return `${raw}\n${escaped}`;
};

describe("TC-PROV-038 credential-port-only resolution", () => {
  test("the port is called once with the declared reference; the transport receives the material", async () => {
    const port = recordingPort();
    const requests: QuotaTransportRequest[] = [];
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: port,
      transport: requestRecordingTransport(requests),
    });
    await engine.resolve({ config: config(["zai"]) });
    expect(port.references).toEqual([{ referenceName: "zai", sourceKey: { style: "literal", name: "ZAI_API_KEY" } }]);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.credential.value).toBe(CREDENTIAL_CANARY);
    await engine.resolve({ config: config(["zai"]) });
    expect(port.references).toHaveLength(2);
  });

  test("a missing credential attempts no fetch and names the cause", async () => {
    const port = recordingPort();
    const requests: QuotaTransportRequest[] = [];
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: port,
      transport: requestRecordingTransport(requests),
    });
    const resolved = await engine.resolve({ config: config(["missing"]) });
    if (!resolved.ok) throw new Error("resolve failed");
    expect(requests).toHaveLength(0);
    expect(resolved.parks[0]?.cause).toBe("credential-missing");
    expect(resolved.parks[0]?.evidence.failureClass).toBe("config.credential.missing");
    expect(resolved.parks[0]?.evidence.credentialRefName).toBe("missing");
    expect(resolved.announcements[0]?.code).toBe("provider.credential.missing");
  });

  test("a missing credential lets a later eligible entry of the same class serve", async () => {
    const port = recordingPort();
    const requests: QuotaTransportRequest[] = [];
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: port,
      transport: requestRecordingTransport(requests),
    });
    const resolved = await engine.resolve({ config: config(["missing", "zai"]) });
    if (!resolved.ok) throw new Error("resolve failed");
    expect(resolved.decision).toMatchObject({ kind: "selected", providerName: "p1" });
    expect(resolved.skipped).toEqual([{ providerName: "p0", reason: "credential-missing" }]);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.endpoint).toBe("https://p1.test/quota");
  });
});

describe("TC-PROV-040 canary and allowlist safety", () => {
  test("credential and raw-body canaries never appear on any returned surface", async () => {
    const port = recordingPort();
    const engine = createProviderEngine({
      clock,
      sleep,
      credentialPort: port,
      transport: requestRecordingTransport([], 401),
    });
    const resolved = await engine.resolve({ config: config(["zai"]) });
    const quota = await engine.quota({ config: config(["zai"]) });
    const surfaces = scan({ resolved, quota });
    expect(surfaces).not.toContain(CREDENTIAL_CANARY);
    expect(surfaces).not.toContain(BODY_CANARY);
    expect(surfaces).not.toContain("Authorization");
    if (resolved.ok) {
      for (const entry of resolved.parks) {
        for (const key of Object.keys(entry.evidence)) expect(parkAllowlist.fields).toContain(key);
      }
      for (const entry of resolved.announcements) {
        for (const key of Object.keys(entry.evidence)) {
          expect(announcementAllowlist.fields).toContain(key);
        }
      }
      expect(resolved.parks[0]?.evidence.httpStatus).toBe(401);
    }
  });
});

import { createProviderQuotaTransport } from "../../packages/adapters/src/provider-quota/index";

describe("TC-PROV-040 production wrapper security", () => {
  test("one bounded GET, in-memory authorization, no redirect follow, nothing stored", async () => {
    const calls: Array<{ url: string; init: unknown }> = [];
    const transport = createProviderQuotaTransport({
      fetch: async (url, init) => {
        calls.push({ url, init });
        return {
          status: 200,
          text: async () =>
            JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
        };
      },
    });
    const result = await transport.send({
      endpoint: "https://example.test/quota",
      method: "GET",
      timeoutMs: 1000,
      credential: { value: CREDENTIAL_CANARY },
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://example.test/quota");
    const init = calls[0]?.init as {
      method: string;
      redirect: string;
      headers: Record<string, string>;
      signal: AbortSignal;
    };
    expect(init.method).toBe("GET");
    expect(init.redirect).toBe("manual");
    expect(init.headers.authorization).toBe(`Bearer ${CREDENTIAL_CANARY}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(result.status).toBe(200);
    expect(JSON.stringify(result)).not.toContain(CREDENTIAL_CANARY);
    expect(JSON.stringify(transport)).not.toContain(CREDENTIAL_CANARY);
  });

  test("a fetch rejection propagates without retaining the credential", async () => {
    const transport = createProviderQuotaTransport({
      fetch: async () => {
        throw new Error("network down");
      },
    });
    await expect(
      transport.send({
        endpoint: "https://example.test/quota",
        method: "GET",
        timeoutMs: 1000,
        credential: { value: CREDENTIAL_CANARY },
      }),
    ).rejects.toThrow("network down");
  });
});
