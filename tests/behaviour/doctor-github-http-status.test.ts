/**
 * TC-DOCTOR-031 steps 1–3 and 6–7 — the additive optional structured
 * `httpStatus` on the adapter-local read-failure types, supplied by the GitHub
 * read slice on every non-2xx and omitted on transport failures. Secret-free,
 * identity-preserving, and never derived from prose.
 */
import { describe, expect, test } from "bun:test";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import type { ProviderPayloadFailure } from "../../packages/adapters/src/io/provider-transport";
import type { ExternalSystemInstance } from "../../packages/core/src/contracts/index";
import { ERROR_TABLE } from "../../packages/core/src/contracts/index";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { createFixtureTransport, installThrowingFetchGuard } from "./providers/support";

const INSTANCE: ExternalSystemInstance = {
  instanceName: "vcs-github",
  systemKind: "vcs",
  baseUrl: "https://api.github.example.com",
  authMethod: {
    mechanism: "credential-reference",
    reference: {
      referenceName: "github-read",
      sourceKey: { style: "literal", name: "FIXTURE_GITHUB_TOKEN" },
    },
  },
};

const CREDENTIALS = createEnvironmentCredentialPort({
  environment: { FIXTURE_GITHUB_TOKEN: "canary-github-read-token" },
  brand: fixtureBrand,
});

const REPOSITORY = { owner: "group-placeholder", name: "project-placeholder" } as const;
const ISSUES_URL = `${INSTANCE.baseUrl}/repos/${REPOSITORY.owner}/${REPOSITORY.name}/issues?state=open&per_page=50&sort=updated&direction=desc`;
const CHECK_RUNS_URL = `${INSTANCE.baseUrl}/repos/${REPOSITORY.owner}/${REPOSITORY.name}/commits/${"1".repeat(40)}/check-runs?per_page=20`;

const clientFor = (routes: Parameters<typeof createFixtureTransport>[0]) =>
  createGitHubClient({
    instance: INSTANCE,
    credentials: CREDENTIALS,
    repository: REPOSITORY,
    transport: createFixtureTransport(routes),
  });

const throwingClient = () =>
  createGitHubClient({
    instance: INSTANCE,
    credentials: CREDENTIALS,
    repository: REPOSITORY,
    transport: {
      send: async () => {
        throw new TypeError("synthetic transport failure");
      },
    },
  });

describe("TC-DOCTOR-031 additive structured httpStatus", () => {
  test("a failure built without the field stays assignable (type-additive)", () => {
    const legacyShape: ProviderPayloadFailure = {
      ok: false,
      code: "provider.payload.invalid",
      detail: "GitHub request failed (TimeoutError)",
    };
    expect(legacyShape.httpStatus).toBeUndefined();
  });

  test("401 and 403 carry their structured numeric status and no prose", async () => {
    for (const status of [401, 403]) {
      const client = clientFor([{ url: ISSUES_URL, body: {}, status }]);
      const result = await client.listWorkItems(50);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect((result as { readonly httpStatus?: number }).httpStatus).toBe(status);
        expect((result as { readonly httpStatus?: unknown }).httpStatus).not.toBe(String(status));
        expect(JSON.stringify(result)).not.toContain("canary-github-read-token");
        expect(JSON.stringify(result)).not.toContain("Authorization");
      }
    }
  });

  test("404 stays provider.not-found with the structured status", async () => {
    const client = clientFor([{ url: ISSUES_URL, body: {}, status: 404 }]);
    const result = await client.listWorkItems(50);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.not-found");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBe(404);
    }
  });

  test("500 and 503 carry their structured status as payload failures", async () => {
    for (const status of [500, 503]) {
      const client = clientFor([{ url: CHECK_RUNS_URL, body: {}, status }]);
      const result = await client.readPipelineRun("1".repeat(40), 20);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("provider.payload.invalid");
        expect((result as { readonly httpStatus?: number }).httpStatus).toBe(status);
      }
    }
  });

  test("transport and timeout failures omit the field (no fabricated status)", async () => {
    const result = await throwingClient().listWorkItems(50);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("provider.payload.invalid");
      expect((result as { readonly httpStatus?: number }).httpStatus).toBeUndefined();
    }
    const guard = installThrowingFetchGuard();
    try {
      const live = await throwingClient().listWorkItems(50);
      expect(live.ok).toBe(false);
      expect(guard.calls).toEqual([]);
    } finally {
      guard.restore();
    }
  });

  test("the enrichment adds no error identity or table row", () => {
    const identities = new Set(ERROR_TABLE.map((row) => row.code));
    expect(identities.has("provider.payload.invalid")).toBe(false);
    expect(identities.has("provider.not-found")).toBe(false);
    expect(identities.has("provider.http.status")).toBe(false);
    expect(
      (ERROR_TABLE as readonly { domainKind: string }[]).filter(
        (row) => row.domainKind === "doctor",
      ),
    ).toHaveLength(1);
  });

  test("a string status is never produced by the read slice", async () => {
    for (const status of [401, 403, 500]) {
      const client = clientFor([{ url: ISSUES_URL, body: {}, status }]);
      const result = await client.listWorkItems(50);
      if (!result.ok) {
        const field = (result as { readonly httpStatus?: unknown }).httpStatus;
        expect(field === undefined || typeof field === "number").toBe(true);
      }
    }
  });

  test("a 200 response is a successful read, never a failure carrying a status", async () => {
    const client = clientFor([{ url: ISSUES_URL, body: [], status: 200 }]);
    const result = await client.listWorkItems(50);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.pageItemCount).toBe(0);
  });
});
