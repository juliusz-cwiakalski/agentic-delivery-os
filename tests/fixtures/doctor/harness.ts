/**
 * The in-process doctor fixture harness (test plan §4.1).
 *
 * Builds injected fact worlds and `DoctorCheckInputs` with a fixed clock, run
 * id, and synthetic brand. No process spawn, no ambient read, no network.
 */
import {
  type DoctorCheckInputs,
  type DoctorCheckoutFacts,
  type DoctorCheckResult,
  type DoctorCiFacts,
  type DoctorCredentialPresence,
  type DoctorParkFoldRead,
  type DoctorProviderConfigRead,
  type DoctorProviderCredentialPresence,
  type DoctorProviderFacts,
  type DoctorRepositoryBinding,
  type DoctorStateStoresRead,
  type DoctorTrackerFacts,
  type DoctorWiringRead,
  PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  PROVIDER_PARK_SCHEMA_ID,
  type ProviderAnnouncementRecord,
  type ProviderConfiguration,
  type ProviderParkRecord,
} from "../../../packages/core/src/contracts/index";

export const FIXED_NOW = "2026-11-18T10:20:00Z";
export const FIXED_NOW_MS = Date.parse(FIXED_NOW);
export const RUN_ID = "run-doctor-fixture";
export const FIXED_TICKS = [1000, 1004] as const;

export const BINDING: DoctorRepositoryBinding = {
  state: "observed",
  host: "github.com",
  owner: "example-owner",
  name: "example-repo",
};

export const UNRESOLVED_BINDING: DoctorRepositoryBinding = {
  state: "unavailable",
  reason: "remote-unresolvable",
};

export const CREDENTIAL_OK: DoctorCredentialPresence = { ok: true };
export const CREDENTIAL_MISSING: DoctorCredentialPresence = {
  ok: false,
  failureCode: "config.credential.missing",
  envVar: "EXAMPLE_PRODUCT_GITHUB_TOKEN",
};

export const READ_OK = (pageItemCount = 3): DoctorWiringRead => ({ ok: true, pageItemCount });
export const READ_EMPTY: DoctorWiringRead = { ok: true, pageItemCount: 0 };
export const READ_FAILED = (
  httpStatus?: number,
  detail?: { readonly failureClass?: string; readonly failureCode?: string },
): DoctorWiringRead => ({
  ok: false,
  reason: "read-failed",
  ...(detail?.failureClass === undefined ? {} : { failureClass: detail.failureClass }),
  ...(detail?.failureCode === undefined ? {} : { failureCode: detail.failureCode }),
  ...(httpStatus === undefined ? {} : { httpStatus }),
});

export const checkoutOk = (overrides: Partial<DoctorCheckoutFacts> = {}): DoctorCheckoutFacts => ({
  readable: true,
  clean: true,
  branch: "feat/GH-224/doctor-v1",
  sha: "1111111111111111111111111111111111111111",
  detached: false,
  binding: BINDING,
  ...overrides,
});

export const COMMIT_OK = {
  resolved: true,
  branch: "feat/GH-224/doctor-v1",
  sha: "1111111111111111111111111111111111111111",
  detached: false,
} as const;

export const providerConfigOk = (
  overrides: Partial<ProviderConfiguration> = {},
): DoctorProviderConfigRead => ({
  ok: true,
  config: {
    defaultChain: "primary",
    credentials: {
      "provider-a-cred": { sourceKey: { style: "literal", name: "FIXTURE_PROVIDER_A_TOKEN" } },
      "provider-b-cred": { sourceKey: { style: "literal", name: "FIXTURE_PROVIDER_B_TOKEN" } },
    },
    entries: {
      "provider-a": {
        name: "provider-a",
        class: "subscription",
        enabled: true,
        quota: {
          enabled: true,
          endpoint: "https://quota.example.com/a",
          credentialRef: "provider-a-cred",
          timeoutMs: 15000,
          thresholdPercent: 100,
          maxSleepLoops: 24,
          outageParkTtlSeconds: 300,
          credentialParkTtlSeconds: 900,
          capParkTtlSeconds: 300,
        },
      },
      "provider-b": {
        name: "provider-b",
        class: "pay-per-token",
        enabled: true,
        quota: {
          enabled: true,
          endpoint: "https://quota.example.com/b",
          credentialRef: "provider-b-cred",
          timeoutMs: 15000,
          thresholdPercent: 100,
          maxSleepLoops: 24,
          outageParkTtlSeconds: 300,
          credentialParkTtlSeconds: 900,
          capParkTtlSeconds: 300,
        },
      },
    },
    chains: {
      primary: { name: "primary", entries: ["provider-a", "provider-b"], allowPaidFallback: false },
    },
    ...overrides,
  },
});

export const PROVIDER_CREDENTIALS_OK: readonly DoctorProviderCredentialPresence[] = [
  { providerName: "provider-a", sourceKey: "EXAMPLE_PRODUCT_PROVIDER_A_TOKEN", ok: true },
  { providerName: "provider-b", sourceKey: "EXAMPLE_PRODUCT_PROVIDER_B_TOKEN", ok: true },
];

export const FOLD_OK: DoctorParkFoldRead = { ok: true, parks: [], announcements: [] };

export const STATE_OK: DoctorStateStoresRead = {
  ok: true,
  verifiedEmpty: false,
  recordCount: 4,
};

export const parkRecord = (
  overrides: Partial<ProviderParkRecord> & Pick<ProviderParkRecord, "subjectName" | "cause">,
): ProviderParkRecord => ({
  schemaVersion: PROVIDER_PARK_SCHEMA_ID,
  name: `park-${overrides.subjectName}`,
  subjectKind: "provider",
  conditions: [],
  state: "active",
  createdAt: "2026-11-18T09:00:00Z",
  createdAtMs: Date.parse("2026-11-18T09:00:00Z"),
  expiresAt: "2026-11-18T14:00:00Z",
  expiresAtMs: Date.parse("2026-11-18T14:00:00Z"),
  evidence: {},
  ...overrides,
});

export const announcementRecord = (
  overrides: Partial<ProviderAnnouncementRecord> = {},
): ProviderAnnouncementRecord => ({
  schemaVersion: PROVIDER_ANNOUNCEMENT_SCHEMA_ID,
  identity: "announcement-1",
  code: "provider.peak.parked",
  severity: "info",
  subjectKind: "provider",
  subjectName: "provider-a",
  createdAt: "2026-11-18T09:00:00Z",
  message: "provider provider-a is parked (provider.peak.parked)",
  evidence: {},
  ...overrides,
});

export type DoctorWorld = {
  readonly checkout?: Partial<DoctorCheckoutFacts>;
  readonly tracker?: Partial<DoctorTrackerFacts>;
  readonly provider?: {
    readonly config?: DoctorProviderConfigRead;
    readonly credentials?: readonly DoctorProviderCredentialPresence[];
    readonly fold?: DoctorParkFoldRead;
  };
  readonly state?: DoctorStateStoresRead;
  readonly ci?: Partial<DoctorCiFacts>;
  readonly contained?: readonly "repo" | "tracker" | "provider" | "state" | "ci"[];
};

const containedResult = (
  area: "repo" | "tracker" | "provider" | "state" | "ci",
): DoctorCheckResult => ({
  area,
  contained: true,
  detail: `the ${area} check was contained`,
  source:
    area === "repo"
      ? "checkout"
      : area === "tracker"
        ? "tracker-read"
        : area === "provider"
          ? "provider-config"
          : area === "state"
            ? "state-stores"
            : "ci-read",
});

export const doctorWorld = (world: DoctorWorld = {}): DoctorCheckInputs => {
  const checkout = checkoutOk(world.checkout);
  const tracker: DoctorTrackerFacts = {
    credential: CREDENTIAL_OK,
    read: READ_OK(),
    ...world.tracker,
  };
  const provider: DoctorProviderFacts = {
    config: providerConfigOk(),
    credentials: PROVIDER_CREDENTIALS_OK,
    fold: FOLD_OK,
    ...world.provider,
  };
  const state = world.state ?? STATE_OK;
  const ci: DoctorCiFacts = {
    credential: CREDENTIAL_OK,
    commit: COMMIT_OK,
    read: READ_OK(2),
    ...world.ci,
  };
  const results: DoctorCheckResult[] = [
    { area: "repo", contained: false, facts: { area: "repo", checkout } },
    { area: "tracker", contained: false, facts: { area: "tracker", tracker } },
    { area: "provider", contained: false, facts: { area: "provider", provider } },
    { area: "state", contained: false, facts: { area: "state", state } },
    { area: "ci", contained: false, facts: { area: "ci", ci } },
  ];
  const contained = new Set(world.contained ?? []);
  return {
    nowIso: FIXED_NOW,
    nowMs: FIXED_NOW_MS,
    repository: checkout.binding,
    results: results.map((result) =>
      contained.has(result.area) ? containedResult(result.area) : result,
    ),
  };
};
