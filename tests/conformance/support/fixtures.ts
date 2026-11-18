/**
 * Test-side conformance fixture loading (GH-189 F-4).
 *
 * Filesystem access, environment-independent fixture reads, and the reused
 * throwing-`fetch` guard live here, never in testkit source.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type ConformanceAdapterRegistration,
  type ConformanceCredentialPort,
  decodeMockTenant,
  type MockTenant,
  type ParityRegisterEntry,
  TRACKER_TRAP_FAMILIES,
} from "@delivery-os/testkit";
import {
  installChildProcessGuard,
  installThrowingFetchGuard,
} from "../../behaviour/providers/support";

export { installChildProcessGuard, installThrowingFetchGuard };

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

// --- DM-4 family accounting: the delivered validator, adapter-agnostic ------

export type FamilyPosture = "covered" | "recorded-difference" | "gap-backed";

/** One declared family cell; the shape is asserted, never re-declared as a type. */
export type FamilyCell = {
  readonly posture: FamilyPosture;
  readonly operation: string;
  readonly catalogEntries?: readonly string[];
  readonly fixture?: string;
  readonly registerId?: string;
  readonly recordedClass?: string;
  readonly gapReason?: string;
};

export type FamilyAccounting = {
  readonly provenance?: string;
  readonly providers: Readonly<Record<string, Readonly<Record<string, FamilyCell>>>>;
};

export type FamilyAccountingContext = {
  /** The registrations the accounting must cover (shipped list or one control). */
  readonly adapters: readonly ConformanceAdapterRegistration[];
  /** Each adapter's own catalog names, keyed by provider. */
  readonly catalogs: Readonly<
    Record<string, { readonly entries: readonly Record<string, unknown>[] }>
  >;
  /** The register entries a `recorded-difference` posture may reference. */
  readonly register: readonly ParityRegisterEntry[];
  /** The gate-local observation record supplying the pagination facts. */
  readonly observation?: Readonly<
    Record<string, Record<string, Record<string, { state?: string; value?: string } | undefined>>>
  >;
  /** Optional expected posture table; a posture move fails naming adapter/family. */
  readonly expectation?: Readonly<Record<string, Readonly<Record<string, FamilyPosture>>>>;
  /** Override the closed family vocabulary only for a deliberate mutation. */
  readonly families?: readonly string[];
};

/**
 * Validate one family accounting over ANY adapter list, including the
 * composition-injected control. Every failure names adapter and family.
 *
 * The rules are the delivered DM-4 rules: `covered` needs a supported operation,
 * an existing catalog entry and a resolving fixture; `gap-backed` needs the
 * adapter's own declared gap with the identical reason; `recorded-difference`
 * needs a register entry on that pair whose class set explains the family. A
 * vacuous `covered`, a dual posture and an unaccounted family are failures.
 */
export const familyAccountingViolations = (
  accounting: FamilyAccounting,
  context: FamilyAccountingContext,
): string[] => {
  const violations: string[] = [];
  const families = context.families ?? TRACKER_TRAP_FAMILIES;
  const providers = context.adapters.map((entry) => entry.provider);
  const catalogNames = (provider: string): readonly string[] =>
    context.catalogs[provider]?.entries.map((entry) => String(entry.trapName)) ?? [];
  for (const provider of providers) {
    const cellSet = accounting.providers[provider];
    if (cellSet === undefined) {
      violations.push(`${provider}: no accounting cells`);
      continue;
    }
    for (const family of families) {
      const cell = cellSet[family];
      const where = `${provider}/${family}`;
      if (cell === undefined) {
        violations.push(`${where}: family is unaccounted`);
        continue;
      }
      const adapter = context.adapters.find((entry) => entry.provider === provider);
      if (adapter === undefined) {
        violations.push(`${where}: no registration`);
        continue;
      }
      const supported = adapter.contract.capabilities.supportedOperations as readonly string[];
      const gaps = adapter.contract.capabilities.declaredGaps;
      const declaredGap = gaps.find((gap) => gap.operation === cell.operation);
      const expected = context.expectation?.[provider]?.[family];
      if (expected !== undefined && cell.posture !== expected) {
        violations.push(`${where}: expected ${expected}, observed ${cell.posture}`);
      }
      if (supported.includes(cell.operation) && declaredGap !== undefined) {
        violations.push(`${where}: ${cell.operation} is both supported and a declared gap`);
      }
      if (cell.posture === "covered") {
        if (!supported.includes(cell.operation)) {
          violations.push(`${where}: covered posture names unsupported ${cell.operation}`);
        }
        if (cell.gapReason !== undefined) violations.push(`${where}: dual posture`);
        const entries = cell.catalogEntries ?? [];
        if (entries.length === 0) {
          violations.push(`${where}: covered posture names no catalog entry`);
        }
        for (const name of entries) {
          if (!catalogNames(provider).includes(name)) {
            violations.push(`${where}: catalog entry ${name} does not exist`);
          }
        }
        if (cell.fixture === undefined || !existsSync(join(process.cwd(), cell.fixture))) {
          violations.push(`${where}: fixture reference does not resolve`);
        }
        if (family === "pagination-truncation") {
          const value = context.observation?.[provider]?.[cell.operation]?.["pagination-model"];
          const observed = value?.value ?? "";
          if (
            value?.state !== "observed" ||
            !observed.includes("bound=declared") ||
            !observed.includes("count=reported")
          ) {
            violations.push(`${where}: vacuous covered posture, no declared bound and page count`);
          }
        }
      } else if (cell.posture === "recorded-difference") {
        if (declaredGap !== undefined) {
          violations.push(`${where}: recorded-difference on a declared gap ${cell.operation}`);
        }
        const registerEntry = context.register.find(
          (entry) => entry.differenceId === cell.registerId,
        );
        if (registerEntry === undefined) {
          violations.push(`${where}: registerId ${String(cell.registerId)} does not resolve`);
        } else if (
          registerEntry.adapter !== provider ||
          registerEntry.operation !== cell.operation
        ) {
          violations.push(`${where}: register entry is keyed to another pair`);
        } else {
          const explaining =
            family === "pagination-truncation" ? "pagination-model" : "failure-classification";
          if (!registerEntry.differenceClasses.includes(explaining as never)) {
            violations.push(
              `${where}: class set ${registerEntry.differenceClasses.join(",")} does not explain the family`,
            );
          }
        }
        if (cell.recordedClass === undefined || cell.recordedClass.trim().length === 0) {
          violations.push(`${where}: recorded class is missing`);
        }
      } else if (cell.posture === "gap-backed") {
        if (cell.catalogEntries !== undefined || cell.fixture !== undefined) {
          violations.push(`${where}: dual posture (fixture and gap)`);
        }
        if (declaredGap === undefined) {
          violations.push(`${where}: ${cell.operation} is not a declared gap`);
        } else if (declaredGap.reason !== cell.gapReason) {
          violations.push(
            `${where}: gap reason ${String(cell.gapReason)} differs from ${declaredGap.reason}`,
          );
        }
      } else {
        violations.push(`${where}: unknown posture ${String(cell.posture)}`);
      }
    }
    for (const extra of Object.keys(cellSet).filter(
      (family) => !(families as readonly string[]).includes(family),
    )) {
      violations.push(`${provider}/${extra}: unknown family`);
    }
  }
  for (const extra of Object.keys(accounting.providers).filter(
    (provider) => !providers.includes(provider),
  )) {
    violations.push(`${extra}: unregistered adapter column`);
  }
  return violations;
};
