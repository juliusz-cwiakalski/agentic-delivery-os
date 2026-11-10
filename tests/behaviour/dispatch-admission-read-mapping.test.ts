/**
 * GH-279 admission read mapping (TC-READMAP-001..010): the production preflight
 * classifies the bounded work-item read from its status, never by forwarding the
 * adapter identity, and every mapped pair carries its own kind and exit.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import { createGitHubClient } from "../../packages/adapters/src/github/client";
import { classifyThrown } from "../../packages/cli/src/classify";
import {
  DOMAIN_KINDS,
  ERROR_TABLE,
  type ExternalSystemInstance,
} from "../../packages/core/src/contracts/index";
import {
  ADMISSION_CANARY,
  runAdmission,
  scriptedIssueTransport,
  type AdmissionObservation,
} from "../fixtures/dispatch/admission";
import { fixtureBrand } from "../fixtures/credentials/cases";

const GOLDENS = "tests/fixtures/dispatch/golden/errors";

type Golden = {
  readonly code: string;
  readonly category: string;
  readonly retryable: boolean;
  readonly consequence: string;
  readonly exitCode: number;
};

const golden = (name: string): Golden =>
  JSON.parse(readFileSync(join(process.cwd(), GOLDENS, `${name}.json`), "utf8")) as Golden;

const refusal = async (response: () => Promise<{ status: number; body: unknown }>) =>
  runAdmission({
    credential: "resolved",
    transport: scriptedIssueTransport({ issueNumber: 301, response }),
  });

const assertGolden = (observed: AdmissionObservation, name: string): void => {
  const expected = golden(name);
  expect(observed.envelope?.error).toMatchObject({
    code: expected.code,
    category: expected.category,
    retryable: expected.retryable,
    consequence: expected.consequence,
  });
  expect(observed.exit).toBe(expected.exitCode);
  expect(observed.envelope?.exitCode).toBe(expected.exitCode);
};

const assertPreSession = (observed: AdmissionObservation): void => {
  expect(observed.spawns).toBe(0);
  expect(observed.resumes).toBe(0);
  expect(observed.attempts).toEqual([]);
  expect(observed.divergences).toBe(0);
  expect(observed.leaseRecords).toBe(0);
};

describe("TC-READMAP-001 401 and 403 classify provider.auth.rejected", () => {
  test("the credential identity is never forwarded and the tuple is exact", async () => {
    for (const status of [401, 403]) {
      const observed = await refusal(async () => ({ status, body: {} }));
      assertGolden(observed, "provider-auth-rejected");
      expect(observed.envelope?.error?.code).not.toBe("provider.payload.invalid");
      assertPreSession(observed);
    }
  });
});

describe("TC-READMAP-002 5xx classifies provider.outage", () => {
  test("500 and 503 are transient outages at exit 2", async () => {
    for (const status of [500, 503]) {
      const observed = await refusal(async () => ({ status, body: {} }));
      assertGolden(observed, "provider-outage");
      assertPreSession(observed);
    }
  });
});

describe("TC-READMAP-003 404 maps to input.value.rejected and names the ref honestly", () => {
  test("the summary names the ref and the scope check, never calling it wrong", async () => {
    const observed = await refusal(async () => ({ status: 404, body: {} }));
    assertGolden(observed, "input-value-rejected");
    const summary = observed.envelope?.error?.summary ?? "";
    expect(summary).toContain("GH-301");
    expect(summary.toLowerCase()).toContain("absent");
    expect(summary.toLowerCase()).toContain("scope");
    expect(summary.toLowerCase()).not.toContain("is wrong");
    expect(observed.envelope?.error?.code).not.toBe("provider.not-found");
    assertPreSession(observed);
  });
});

describe("TC-READMAP-004 a malformed 2xx maps to provider.payload.invalid", () => {
  test("the received 2xx is status-present and never becomes provider.outage", async () => {
    const observed = await refusal(async () => ({ status: 200, body: { number: 301 } }));
    assertGolden(observed, "provider-payload-invalid");
    expect(observed.envelope?.error?.code).not.toBe("provider.outage");
    assertPreSession(observed);
  });
});

describe("TC-READMAP-005 other status-bearing non-2xx classifies provider.outage", () => {
  test("429, 422, and 400 are outages", async () => {
    for (const status of [429, 422, 400]) {
      const observed = await refusal(async () => ({ status, body: {} }));
      assertGolden(observed, "provider-outage");
      assertPreSession(observed);
    }
  });
});

describe("TC-READMAP-006 a status-absent transport throw classifies provider.outage", () => {
  test("the adapter identity is not forwarded", async () => {
    const observed = await refusal(async () => {
      throw new TypeError("synthetic transport failure");
    });
    assertGolden(observed, "provider-outage");
    expect(observed.envelope?.error?.code).not.toBe("provider.payload.invalid");
    assertPreSession(observed);
  });
});

describe("TC-READMAP-007 malformed 2xx and transport throw stay distinguishable", () => {
  test("status presence is the discriminator, asserted in one block", async () => {
    const instance: ExternalSystemInstance = {
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
    const credentials = createEnvironmentCredentialPort({
      environment: { FIXTURE_GITHUB_TOKEN: ADMISSION_CANARY },
      brand: fixtureBrand,
    });
    const malformedTransport = scriptedIssueTransport({
      issueNumber: 301,
      response: async () => ({ status: 200, body: { number: 301 } }),
    });
    const malformedRead = await createGitHubClient({
      instance,
      credentials,
      repository: { owner: "owner", name: "repo" },
      transport: malformedTransport,
    }).readWorkItem(301);
    const throwingTransport = scriptedIssueTransport({
      issueNumber: 301,
      response: async () => {
        throw new TypeError("synthetic transport failure");
      },
    });
    const throwingRead = await createGitHubClient({
      instance,
      credentials,
      repository: { owner: "owner", name: "repo" },
      transport: throwingTransport,
    }).readWorkItem(301);

    expect(malformedRead.ok).toBe(false);
    expect(throwingRead.ok).toBe(false);
    const malformedStatus = malformedRead.ok
      ? undefined
      : (malformedRead as { readonly httpStatus?: number }).httpStatus;
    const throwingStatus = throwingRead.ok
      ? undefined
      : (throwingRead as { readonly httpStatus?: number }).httpStatus;
    expect(malformedStatus).toBe(200);
    expect(throwingStatus).toBeUndefined();

    const malformed = await refusal(async () => ({ status: 200, body: { number: 301 } }));
    const throwing = await refusal(async () => {
      throw new TypeError("synthetic transport failure");
    });
    expect(malformed.envelope?.error?.code).toBe("provider.payload.invalid");
    expect(throwing.envelope?.error?.code).toBe("provider.outage");
  });
});

describe("TC-READMAP-008 every mapped pair carries its own kind", () => {
  test("no pair classifies as fallback.internal and the vocabulary is unchanged", () => {
    const pairs = [
      { kind: "provider", code: "provider.auth.rejected" },
      { kind: "provider", code: "provider.outage" },
      { kind: "provider", code: "provider.payload.invalid" },
      { kind: "input", code: "input.value.rejected" },
      { kind: "config", code: "config.credential.missing" },
    ] as const;
    for (const pair of pairs) {
      expect(classifyThrown(pair).code).toBe(pair.code);
      expect(classifyThrown(pair).domainKind).toBe(pair.kind);
    }
    expect(classifyThrown({ kind: "provider", code: "state.lock.busy" }).code).toBe(
      "fallback.internal",
    );
    expect(DOMAIN_KINDS).toContain("provider");
    expect(DOMAIN_KINDS).toContain("config");
    expect(ERROR_TABLE.filter((entry) => entry.code === "provider.auth.rejected")).toHaveLength(1);
  });
});

describe("TC-READMAP-009 refusal envelopes are bounded and secret-free", () => {
  test("goldens pin shape only; key and reference survive; the canary never appears", async () => {
    for (const [status, name] of [
      [401, "provider-auth-rejected"],
      [500, "provider-outage"],
      [404, "input-value-rejected"],
      [200, "provider-payload-invalid"],
    ] as const) {
      const observed = await refusal(async () => ({ status, body: {} }));
      assertGolden(observed, name);
      const summary = observed.envelope?.error?.summary ?? "";
      expect(summary.length).toBeLessThanOrEqual(240);
      expect(summary).not.toContain("\n");
      expect(observed.stdout).not.toContain(ADMISSION_CANARY);
      expect(observed.stderr).not.toContain(ADMISSION_CANARY);
    }
    const missing = await runAdmission({ credential: "missing" });
    assertGolden(missing, "config-credential-missing");
    expect(missing.envelope?.error?.summary).toContain("GITHUB_TOKEN");
    expect(missing.envelope?.error?.summary).toContain("github-read");
    expect(missing.stdout).not.toContain(ADMISSION_CANARY);
  });
});

describe("TC-ADMIT-006 a failing admission read refuses with zero sessions and records", () => {
  test("401 and 500 leave no session, lease, attempt, or divergence", async () => {
    for (const status of [401, 500]) {
      const observed = await refusal(async () => ({ status, body: {} }));
      expect([1, 2]).toContain(observed.exit);
      assertPreSession(observed);
    }
  });
});

describe("TC-ADMIT-010 admission read budget", () => {
  test("one credential resolution and one bounded read, no pagination or retry", async () => {
    const observed = await refusal(async () => ({ status: 500, body: {} }));
    expect(observed.credentialResolutions).toBe(1);
    expect(observed.requests).toHaveLength(1);
    expect(observed.requests[0]).toContain("/issues/301");
    expect(observed.requests[0]).not.toContain("per_page");
  });
});
