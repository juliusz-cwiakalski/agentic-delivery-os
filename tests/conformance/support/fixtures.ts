/**
 * Test-side conformance fixture loading (GH-189 F-4).
 *
 * Filesystem access, environment-independent fixture reads, and the reused
 * throwing-`fetch` guard live here, never in testkit source.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ConformanceCredentialPort,
  decodeMockTenant,
  type MockTenant,
} from "@delivery-os/testkit";
import { installThrowingFetchGuard } from "../../behaviour/providers/support";

export { installThrowingFetchGuard };

const TENANT_ROOT = "tests/fixtures/providers/conformance";
const PROVIDERS = ["github", "gitlab", "jira"] as const;

/** A non-secret canary value used by the mock credential port. */
export const CANARY_CREDENTIAL_VALUE = "conformance-canary-credential-value";

/** A credential port that resolves every declared reference to one canary. */
export const createCanaryCredentialPort = (
  value: string = CANARY_CREDENTIAL_VALUE,
): ConformanceCredentialPort => ({
  resolve: () => ({ ok: true, material: { value } }),
});

/** Read one committed tenant JSON document as untrusted data. */
export const readTenantJson = (provider: string): unknown => {
  const path = join(process.cwd(), TENANT_ROOT, provider, "tenant.json");
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
  return parsed;
};

/** Decode one committed tenant, throwing on a malformed shape. */
export const loadMockTenant = (provider: string): MockTenant => {
  const decoded = decodeMockTenant(readTenantJson(provider));
  if (!decoded.ok) throw new Error(`${provider} tenant: ${decoded.detail}`);
  return decoded.value;
};

/** Decode every committed conformance tenant. */
export const loadMockTenants = (): Record<(typeof PROVIDERS)[number], MockTenant> => ({
  github: loadMockTenant("github"),
  gitlab: loadMockTenant("gitlab"),
  jira: loadMockTenant("jira"),
});
