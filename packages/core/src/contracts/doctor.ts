/**
 * The `delivery.doctor.v1` vocabulary (GH-224 F-2, DM-1..DM-8).
 *
 * Runtime-neutral by construction: types and `as const` data only. Every area,
 * verdict, evidence source, outcome, reason, condition, bound, read limit, and
 * the schema version is declared once here; the pure aggregation and the
 * command consume it. No clock, randomness, environment, filesystem, network,
 * or status-cap import exists in this module (DEC-10).
 */

import type {
  ProviderAnnouncementRecord,
  ProviderConfiguration,
  ProviderParkRecord,
} from "./provider.js";
import type { OwnerHoldFact } from "./owner-hold.js";

/** The five fixed check areas in their declared order (DM-2, Appendix A). */
export const DOCTOR_AREAS = ["repo", "tracker", "provider", "state", "ci"] as const;
export type DoctorArea = (typeof DOCTOR_AREAS)[number];

/** The closed three-value verdict vocabulary (DM-3). */
export const DOCTOR_VERDICTS = ["ok", "fail", "unreachable"] as const;
export type DoctorVerdict = (typeof DOCTOR_VERDICTS)[number];

/** The eleven evidence source ids (DM-5). */
export const DOCTOR_EVIDENCE_SOURCES = [
  "checkout",
  "remote-binding",
  "credential",
  "tracker-read",
  "provider-config",
  "provider-credential",
  "provider-parks",
  "provider-announcements",
  "state-stores",
  "commit",
  "ci-read",
] as const;
export type DoctorEvidenceSource = (typeof DOCTOR_EVIDENCE_SOURCES)[number];

/** The four evidence outcomes (DM-4). */
export const DOCTOR_EVIDENCE_OUTCOMES = [
  "read",
  "observed-empty",
  "failed",
  "not-configured",
] as const;
export type DoctorEvidenceOutcome = (typeof DOCTOR_EVIDENCE_OUTCOMES)[number];

/** The closed twenty-three-value reason set in declared order (DM-6). */
export const DOCTOR_EVIDENCE_REASONS = [
  "observed",
  "observed-empty",
  "checkout-dirty",
  "checkout-unreadable",
  "remote-unresolvable",
  "credential-unavailable",
  "credential-rejected",
  "read-failed",
  "not-attempted",
  "config-invalid",
  "provider-chain-not-declared",
  "provider-chain-unresolved",
  "park-active",
  "park-credential-cause",
  "owner-hold",
  "announcement-recorded",
  "store-torn",
  "store-schema-mismatch",
  "store-unreadable",
  "store-unknown",
  "commit-unresolved",
  "state-unreadable",
  "check-unreachable",
] as const;
export type DoctorEvidenceReason = (typeof DOCTOR_EVIDENCE_REASONS)[number];

/** The fixed area → source mapping (DM-5). */
export const DOCTOR_AREA_SOURCES: Readonly<Record<DoctorArea, readonly DoctorEvidenceSource[]>> = {
  repo: ["checkout", "remote-binding"],
  tracker: ["remote-binding", "credential", "tracker-read"],
  provider: ["provider-config", "provider-credential", "provider-parks", "provider-announcements"],
  state: ["state-stores"],
  ci: ["remote-binding", "credential", "commit", "ci-read"],
};

/** One closed condition: exactly one verdict and one hint template. */
export type DoctorCondition = {
  readonly condition: string;
  readonly area: DoctorArea;
  readonly verdict: DoctorVerdict;
  readonly hintTemplate: string;
};

/**
 * The closed condition catalog (D6). One entry per non-ok condition; the three
 * Appendix B strings are reproduced verbatim. `{envVar}`, `{providerName}`,
 * `{sourceKey}`, `{area}`, and `{failureCode}` are identifier substitutions
 * only.
 */
export const DOCTOR_CONDITION_CATALOG = [
  {
    condition: "repo.checkout-dirty",
    area: "repo",
    verdict: "fail",
    hintTemplate: "commit or discard the uncommitted changes, then re-run doctor",
  },
  {
    condition: "repo.remote-unresolvable",
    area: "repo",
    verdict: "fail",
    hintTemplate:
      "point the origin remote at a GitHub repository over https or ssh, then re-run doctor",
  },
  {
    condition: "repo.checkout-unreadable",
    area: "repo",
    verdict: "unreachable",
    hintTemplate: "restore readable checkout facts for the work tree, then re-run doctor",
  },
  {
    condition: "doctor.check.repo.unreachable",
    area: "repo",
    verdict: "unreachable",
    hintTemplate: "resolve the repo check failure described in its detail, then re-run doctor",
  },
  {
    condition: "tracker.credential-unavailable",
    area: "tracker",
    verdict: "fail",
    hintTemplate:
      "provide the tracker credential in the {envVar} environment variable, then re-run doctor",
  },
  {
    condition: "tracker.credential-rejected",
    area: "tracker",
    verdict: "fail",
    hintTemplate:
      "replace or broaden the rejected credential through its declared environment source, then re-run doctor",
  },
  {
    condition: "tracker.read-failed",
    area: "tracker",
    verdict: "unreachable",
    hintTemplate: "restore tracker reachability, then re-run doctor",
  },
  {
    condition: "tracker.not-attempted",
    area: "tracker",
    verdict: "unreachable",
    hintTemplate:
      "resolve the repository remote binding first (see the repo check finding), then re-run doctor",
  },
  {
    condition: "doctor.check.tracker.unreachable",
    area: "tracker",
    verdict: "unreachable",
    hintTemplate: "resolve the tracker check failure described in its detail, then re-run doctor",
  },
  {
    condition: "provider.config-invalid",
    area: "provider",
    verdict: "fail",
    hintTemplate: "correct the named configuration source ({failureCode}), then re-run doctor",
  },
  {
    condition: "provider.provider-chain-unresolved",
    area: "provider",
    verdict: "fail",
    hintTemplate:
      "correct the provider configuration so the declared default chain resolves, then re-run doctor",
  },
  {
    condition: "provider.provider-chain-not-declared",
    area: "provider",
    verdict: "fail",
    hintTemplate:
      "declare a default provider chain in the provider configuration, then re-run doctor",
  },
  {
    condition: "provider.credential-unavailable",
    area: "provider",
    verdict: "fail",
    hintTemplate:
      "supply the credential for {providerName} through its declared source key {sourceKey}, then re-run doctor",
  },
  {
    condition: "provider.park-credential-cause",
    area: "provider",
    verdict: "fail",
    hintTemplate:
      "refresh the credential for {providerName}, then run provider quota --provider {providerName}",
  },
  {
    condition: "provider.state-unreadable",
    area: "provider",
    verdict: "unreachable",
    hintTemplate:
      "repair the provider state store so parks and announcements read, then re-run doctor",
  },
  {
    condition: "doctor.check.provider.unreachable",
    area: "provider",
    verdict: "unreachable",
    hintTemplate: "resolve the provider check failure described in its detail, then re-run doctor",
  },
  {
    condition: "state.store-torn",
    area: "state",
    verdict: "fail",
    hintTemplate: "run the store salvage as a separate step, then re-run doctor",
  },
  {
    condition: "state.store-schema-mismatch",
    area: "state",
    verdict: "fail",
    hintTemplate: "use a compatible version or migrate the store, then re-run doctor",
  },
  {
    condition: "state.store-unreadable",
    area: "state",
    verdict: "fail",
    hintTemplate: "fix the state store file permissions, then re-run doctor",
  },
  {
    condition: "state.store-unknown",
    area: "state",
    verdict: "fail",
    hintTemplate: "declare the record kind or use a compatible store version, then re-run doctor",
  },
  {
    condition: "doctor.check.state.unreachable",
    area: "state",
    verdict: "unreachable",
    hintTemplate: "resolve the state check failure described in its detail, then re-run doctor",
  },
  {
    condition: "ci.credential-unavailable",
    area: "ci",
    verdict: "fail",
    hintTemplate:
      "provide the tracker credential in the {envVar} environment variable, then re-run doctor",
  },
  {
    condition: "ci.credential-rejected",
    area: "ci",
    verdict: "fail",
    hintTemplate:
      "replace or broaden the rejected credential through its declared environment source, then re-run doctor",
  },
  {
    condition: "ci.commit-unresolved",
    area: "ci",
    verdict: "fail",
    hintTemplate: "run from a branch with a resolved HEAD commit, then re-run doctor",
  },
  {
    condition: "ci.read-failed",
    area: "ci",
    verdict: "unreachable",
    hintTemplate: "restore CI read reachability, then re-run doctor",
  },
  {
    condition: "ci.not-attempted",
    area: "ci",
    verdict: "unreachable",
    hintTemplate:
      "resolve the repository remote binding first (see the repo check finding), then re-run doctor",
  },
  {
    condition: "doctor.check.ci.unreachable",
    area: "ci",
    verdict: "unreachable",
    hintTemplate: "resolve the ci check failure described in its detail, then re-run doctor",
  },
] as const satisfies readonly DoctorCondition[];

export type DoctorConditionId = (typeof DOCTOR_CONDITION_CATALOG)[number]["condition"];

/**
 * The wiring-neutral provider park causes (DEC-6): reported as bounded detail
 * with a `provider quota` directive and never a verdict flip.
 */
export const DOCTOR_WIRING_NEUTRAL_CONDITIONS = [
  "peak-window",
  "quota-exhausted",
  "provider-outage",
  "chain-exhausted",
  "reevaluation-cap",
] as const;

/** The only statuses that classify a credential rejection (DEC-11). */
export const DOCTOR_CREDENTIAL_REJECTION_STATUSES = [401, 403] as const;

/** One bounded tracker list page (D5, OQ-T4). */
export const DOCTOR_TRACKER_READ_LIMIT = 50 as const;
/** One bounded check-runs page (D5, OQ-T4). */
export const DOCTOR_CI_READ_LIMIT = 20 as const;

/** Detail text cap (DM-8). */
export const DOCTOR_MAX_DETAIL_CHARS = 200 as const;
/** Fix-hint text cap (DM-8). */
export const DOCTOR_MAX_HINT_CHARS = 200 as const;
/** Serialized `data` report byte cap (DM-8). */
export const DOCTOR_MAX_MACHINE_BYTES = 65536 as const;
/** Human report line cap (DM-8). */
export const DOCTOR_MAX_HUMAN_LINES = 24 as const;
/** Human report byte cap (DM-8). */
export const DOCTOR_MAX_HUMAN_BYTES = 4096 as const;
/** Evidence source cap (DM-4). */
export const DOCTOR_MAX_EVIDENCE_SOURCES = 4 as const;
/** Unique reason cap (DM-4). */
export const DOCTOR_MAX_EVIDENCE_REASONS = 4 as const;

/** The report schema version (DM-1). */
export const DOCTOR_SCHEMA_VERSION = "delivery.doctor.v1" as const;

/** The failure-summary prefix (DM-7). */
export const DOCTOR_SUMMARY_PREFIX = "doctor check failures (" as const;
/** The failure-summary entry separator (DM-7). */
export const DOCTOR_SUMMARY_SEPARATOR = "; " as const;

/** The bounded evidence record; prose is never copied or parsed. */
export type DoctorEvidence = {
  readonly sources: readonly {
    readonly source: DoctorEvidenceSource;
    readonly outcome: DoctorEvidenceOutcome;
  }[];
  readonly reasons: readonly DoctorEvidenceReason[];
  readonly failureCode?: string;
  readonly failureClass?: string;
  readonly httpStatus?: number;
};

/** One check's completed verdict (DM-2). */
export type DoctorCheck = {
  readonly area: DoctorArea;
  readonly verdict: DoctorVerdict;
  readonly detail: string;
  readonly fixHint?: string;
  readonly evidence: DoctorEvidence;
};

/** The summary counts (DM-1). */
export type DoctorSummaryCounts = {
  readonly total: number;
  readonly ok: number;
  readonly fail: number;
  readonly unreachable: number;
};

/** The shared repository binding, observed or unavailable (DM-1). */
export type DoctorRepositoryBinding =
  | {
      readonly state: "observed";
      readonly host: "github.com";
      readonly owner: string;
      readonly name: string;
    }
  | {
      readonly state: "unavailable";
      readonly reason: "remote-unresolvable" | "checkout-unreadable";
    };

/** The success `data` payload (DM-1). */
export type DoctorReport = {
  readonly schemaVersion: typeof DOCTOR_SCHEMA_VERSION;
  readonly generatedAt: string;
  readonly repository: DoctorRepositoryBinding;
  readonly checks: readonly DoctorCheck[];
  readonly summary: DoctorSummaryCounts;
};

/** The credential-port presence fact; the value never enters evidence. */
export type DoctorCredentialPresence =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly failureCode?: "config.credential.missing";
      readonly envVar?: string;
    };

/** One performed wiring read result (DM-4). */
export type DoctorWiringRead =
  | { readonly ok: true; readonly pageItemCount: number }
  | {
      readonly ok: false;
      readonly reason: "credential-unavailable" | "read-failed";
      readonly failureCode?: string;
      readonly failureClass?: string;
      readonly httpStatus?: number;
    };

/** The local checkout facts consumed by the repo check (F-3). */
export type DoctorCheckoutFacts = {
  readonly readable: boolean;
  readonly clean: boolean;
  readonly branch?: string;
  readonly sha?: string;
  readonly detached: boolean;
  readonly binding: DoctorRepositoryBinding;
};

/** The tracker check facts (F-4). */
export type DoctorTrackerFacts = {
  readonly credential: DoctorCredentialPresence;
  readonly read?: DoctorWiringRead;
};

/** The tolerant provider-configuration read (DEC-12). */
export type DoctorProviderConfigRead =
  | { readonly ok: true; readonly config: ProviderConfiguration }
  | {
      readonly ok: false;
      readonly reason: "config-invalid" | "provider-chain-unresolved";
      readonly failureCode?: string;
    };

/** One enabled provider entry's credential presence (F-5). */
export type DoctorProviderCredentialPresence = {
  readonly providerName: string;
  readonly sourceKey: string;
  readonly ok: boolean;
};

/** The verified park/announcement fold (F-5). */
export type DoctorParkFoldRead =
  | {
      readonly ok: true;
      readonly parks: readonly ProviderParkRecord[];
      readonly announcements: readonly ProviderAnnouncementRecord[];
    }
  | {
      readonly ok: false;
      readonly reason: "state-unreadable";
      readonly failureCode?: string;
    };

/** The provider check facts (F-5). */
export type DoctorProviderFacts = {
  readonly config: DoctorProviderConfigRead;
  readonly credentials: readonly DoctorProviderCredentialPresence[];
  readonly fold: DoctorParkFoldRead;
  /** The injected owner hold; active only annotates an otherwise-ok check. */
  readonly ownerHold?: OwnerHoldFact;
};

/** One additive per-store fact in the state check (GH-232 F-8). */
export type DoctorStateStoreFact = {
  readonly name: string;
  readonly verdict: "valid" | "verified-empty";
};

/** The verified state-store read (F-6). */
export type DoctorStateStoresRead =
  | {
      readonly ok: true;
      readonly verifiedEmpty: boolean;
      readonly recordCount: number;
      readonly stores?: readonly DoctorStateStoreFact[];
    }
  | {
      readonly ok: false;
      readonly reason:
        | "store-torn"
        | "store-schema-mismatch"
        | "store-unreadable"
        | "store-unknown"
        | "unreadable";
      readonly failureCode?: string;
    };

/** The resolved HEAD commit fact (F-7). */
export type DoctorCommitResolution = {
  readonly resolved: boolean;
  readonly branch?: string;
  readonly sha?: string;
  readonly detached: boolean;
};

/** The CI check facts (F-7). */
export type DoctorCiFacts = {
  readonly credential: DoctorCredentialPresence;
  readonly commit: DoctorCommitResolution;
  readonly read?: DoctorWiringRead;
};

/** One area's collected facts (the successful per-check collection). */
export type DoctorAreaFacts =
  | { readonly area: "repo"; readonly checkout: DoctorCheckoutFacts }
  | { readonly area: "tracker"; readonly tracker: DoctorTrackerFacts }
  | { readonly area: "provider"; readonly provider: DoctorProviderFacts }
  | { readonly area: "state"; readonly state: DoctorStateStoresRead }
  | { readonly area: "ci"; readonly ci: DoctorCiFacts };

/** One contained-or-collected per-check result (F-8). */
export type DoctorCheckResult =
  | { readonly area: DoctorArea; readonly contained: false; readonly facts: DoctorAreaFacts }
  | {
      readonly area: DoctorArea;
      readonly contained: true;
      readonly detail: string;
      readonly source: DoctorEvidenceSource;
    };

/** The complete injected fact set the pure aggregator consumes (F-2). */
export type DoctorCheckInputs = {
  readonly nowIso: string;
  readonly nowMs: number;
  readonly repository: DoctorRepositoryBinding;
  readonly results: readonly DoctorCheckResult[];
};
