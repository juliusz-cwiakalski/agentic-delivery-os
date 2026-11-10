/**
 * The Appendix A verdict-derivation matrix fixtures (TC-DOCTOR-004).
 *
 * One case per declared condition plus the within-check precedence cases. Each
 * case names the affected area, the declared verdict, and the reasons the
 * check's evidence must contain. Fixtures are read-only data; the harness
 * materializes them.
 */
import type { DoctorCheckInputs } from "../../../../packages/core/src/contracts/index";
import {
  announcementRecord,
  CREDENTIAL_MISSING,
  type DoctorWorld,
  doctorWorld,
  FOLD_OK,
  PROVIDER_CREDENTIALS_OK,
  parkRecord,
  providerConfigOk,
  READ_FAILED,
  UNRESOLVED_BINDING,
} from "../harness";

export type MatrixExpectation = {
  readonly verdict: "ok" | "fail" | "unreachable";
  readonly reasons: readonly string[];
  readonly detailIncludes?: string;
};

export type MatrixCase = {
  readonly id: string;
  readonly area: "repo" | "tracker" | "provider" | "state" | "ci";
  readonly world: DoctorWorld;
  readonly expected: MatrixExpectation;
};

const OWNER_HOLD = {
  active: true,
  source: "marker",
  reason: "peak-hour cost pause",
} as const;

const OWNER_HOLD_NO_REASON = { active: true, source: "env" } as const;

export const MATRIX_CASES: readonly MatrixCase[] = [
  {
    id: "repo-ok",
    area: "repo",
    world: {},
    expected: { verdict: "ok", reasons: ["observed"], detailIncludes: "clean work tree" },
  },
  {
    id: "repo-ok-ssh-detached",
    area: "repo",
    world: { checkout: { branch: undefined, detached: true } },
    expected: { verdict: "ok", reasons: ["observed"], detailIncludes: "detached HEAD" },
  },
  {
    id: "repo-dirty",
    area: "repo",
    world: { checkout: { clean: false } },
    expected: { verdict: "fail", reasons: ["checkout-dirty"] },
  },
  {
    id: "repo-origin-unresolvable",
    area: "repo",
    world: { checkout: { binding: UNRESOLVED_BINDING } },
    expected: { verdict: "fail", reasons: ["remote-unresolvable"] },
  },
  {
    id: "repo-unreadable",
    area: "repo",
    world: { checkout: { readable: false } },
    expected: { verdict: "unreachable", reasons: ["checkout-unreadable"] },
  },
  {
    id: "repo-contained",
    area: "repo",
    world: { contained: ["repo"] },
    expected: { verdict: "unreachable", reasons: ["check-unreachable"] },
  },
  {
    id: "tracker-ok",
    area: "tracker",
    world: {},
    expected: { verdict: "ok", reasons: ["observed"] },
  },
  {
    id: "tracker-verified-empty",
    area: "tracker",
    world: { tracker: { read: { ok: true, pageItemCount: 0 } } },
    expected: { verdict: "ok", reasons: ["observed-empty"] },
  },
  {
    id: "tracker-credential-unavailable",
    area: "tracker",
    world: { tracker: { credential: CREDENTIAL_MISSING } },
    expected: { verdict: "fail", reasons: ["credential-unavailable"] },
  },
  {
    id: "tracker-401",
    area: "tracker",
    world: { tracker: { read: READ_FAILED(401) } },
    expected: { verdict: "fail", reasons: ["credential-rejected"] },
  },
  {
    id: "tracker-403",
    area: "tracker",
    world: { tracker: { read: READ_FAILED(403) } },
    expected: { verdict: "fail", reasons: ["credential-rejected"] },
  },
  {
    id: "tracker-404",
    area: "tracker",
    world: { tracker: { read: READ_FAILED(404) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "tracker-500",
    area: "tracker",
    world: { tracker: { read: READ_FAILED(500) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "tracker-503",
    area: "tracker",
    world: { tracker: { read: READ_FAILED(503) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "tracker-timeout",
    area: "tracker",
    world: { tracker: { read: READ_FAILED(undefined, { failureClass: "TimeoutError" }) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "tracker-absent-status",
    area: "tracker",
    world: { tracker: { read: READ_FAILED() } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "tracker-not-attempted",
    area: "tracker",
    world: { checkout: { binding: UNRESOLVED_BINDING }, tracker: { read: undefined } },
    expected: { verdict: "unreachable", reasons: ["not-attempted"] },
  },
  {
    id: "tracker-precedence-credential-over-binding",
    area: "tracker",
    world: {
      checkout: { binding: UNRESOLVED_BINDING },
      tracker: { credential: CREDENTIAL_MISSING, read: undefined },
    },
    expected: { verdict: "fail", reasons: ["credential-unavailable"] },
  },
  {
    id: "tracker-contained",
    area: "tracker",
    world: { contained: ["tracker"] },
    expected: { verdict: "unreachable", reasons: ["check-unreachable"] },
  },
  {
    id: "provider-ok",
    area: "provider",
    world: {},
    expected: { verdict: "ok", reasons: ["observed"] },
  },
  {
    id: "provider-ok-owner-hold",
    area: "provider",
    world: { provider: { ownerHold: OWNER_HOLD } },
    expected: {
      verdict: "ok",
      reasons: ["observed", "owner-hold"],
      detailIncludes: "owner hold active (marker): peak-hour cost pause",
    },
  },
  {
    id: "provider-ok-owner-hold-no-reason",
    area: "provider",
    world: { provider: { ownerHold: OWNER_HOLD_NO_REASON } },
    expected: {
      verdict: "ok",
      reasons: ["observed", "owner-hold"],
      detailIncludes: "owner hold active (env)",
    },
  },
  {
    id: "provider-empty-fold",
    area: "provider",
    world: { provider: { fold: FOLD_OK } },
    expected: { verdict: "ok", reasons: ["observed"] },
  },
  ...[
    "peak-window",
    "quota-exhausted",
    "provider-outage",
    "chain-exhausted",
    "reevaluation-cap",
  ].map(
    (cause): MatrixCase => ({
      id: `provider-neutral-${cause}`,
      area: "provider",
      world: {
        provider: {
          fold: {
            ok: true,
            parks: [
              parkRecord({
                subjectName: "provider-a",
                cause: cause as "peak-window",
                conditions: [],
                expiresAt: "2026-11-18T14:00:00Z",
                expiresAtMs: Date.parse("2026-11-18T14:00:00Z"),
              }),
            ],
            announcements: [],
          },
        },
      },
      expected: {
        verdict: "ok",
        reasons: ["observed", "park-active"],
        detailIncludes: "provider quota --provider provider-a",
      },
    }),
  ),
  {
    id: "provider-announcement",
    area: "provider",
    world: {
      provider: {
        fold: { ok: true, parks: [], announcements: [announcementRecord()] },
      },
    },
    expected: {
      verdict: "ok",
      reasons: ["observed", "announcement-recorded"],
      detailIncludes: "announcements recorded",
    },
  },
  {
    id: "provider-config-invalid",
    area: "provider",
    world: {
      provider: {
        config: { ok: false, reason: "config-invalid", failureCode: "config.file.malformed" },
      },
    },
    expected: {
      verdict: "fail",
      reasons: ["config-invalid"],
      detailIncludes: "config.file.malformed",
    },
  },
  {
    id: "provider-config-branch-unresolved",
    area: "provider",
    world: {
      provider: {
        config: {
          ok: false,
          reason: "provider-chain-unresolved",
          failureCode: "config.value.invalid",
        },
      },
    },
    expected: { verdict: "fail", reasons: ["provider-chain-unresolved"] },
  },
  {
    id: "provider-chain-not-declared",
    area: "provider",
    world: { provider: { config: providerConfigOk({ defaultChain: undefined }) } },
    expected: { verdict: "fail", reasons: ["provider-chain-not-declared"] },
  },
  {
    id: "provider-chain-unresolved",
    area: "provider",
    world: {
      provider: {
        config: providerConfigOk({
          chains: {
            primary: { name: "primary", entries: ["provider-ghost"], allowPaidFallback: false },
          },
        }),
      },
    },
    expected: { verdict: "fail", reasons: ["provider-chain-unresolved"] },
  },
  {
    id: "provider-credential-unavailable",
    area: "provider",
    world: {
      provider: {
        credentials: [
          { providerName: "provider-a", sourceKey: "EXAMPLE_PRODUCT_PROVIDER_A_TOKEN", ok: false },
          ...PROVIDER_CREDENTIALS_OK.slice(1),
        ],
      },
    },
    expected: {
      verdict: "fail",
      reasons: ["credential-unavailable"],
      detailIncludes: "provider-a",
    },
  },
  {
    id: "provider-credential-unavailable-with-hold",
    area: "provider",
    world: {
      provider: {
        credentials: [
          { providerName: "provider-a", sourceKey: "EXAMPLE_PRODUCT_PROVIDER_A_TOKEN", ok: false },
          ...PROVIDER_CREDENTIALS_OK.slice(1),
        ],
        ownerHold: OWNER_HOLD,
      },
    },
    expected: {
      verdict: "fail",
      reasons: ["credential-unavailable"],
      detailIncludes: "provider-a",
    },
  },
  {
    id: "provider-near-bound-owner-hold",
    area: "provider",
    world: {
      provider: {
        fold: {
          ok: true,
          parks: [
            parkRecord({
              subjectName: `provider-${"x".repeat(140)}`,
              cause: "quota-exhausted",
              conditions: [],
            }),
          ],
          announcements: [],
        },
        ownerHold: OWNER_HOLD,
      },
    },
    expected: {
      verdict: "ok",
      reasons: ["observed", "park-active", "owner-hold"],
      detailIncludes: "owner hold active (marker): peak-hour cost pause",
    },
  },
  {
    id: "provider-credential-park",
    area: "provider",
    world: {
      provider: {
        fold: {
          ok: true,
          parks: [
            parkRecord({
              subjectName: "provider-a",
              cause: "credential-rejected",
              conditions: ["credential-rejected"],
            }),
          ],
          announcements: [],
        },
      },
    },
    expected: {
      verdict: "fail",
      reasons: ["park-credential-cause"],
      detailIncludes: "provider-a",
    },
  },
  {
    id: "provider-fold-unreadable",
    area: "provider",
    world: {
      provider: {
        fold: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
      },
    },
    expected: { verdict: "unreachable", reasons: ["state-unreadable"] },
  },
  {
    id: "provider-contained",
    area: "provider",
    world: { contained: ["provider"] },
    expected: { verdict: "unreachable", reasons: ["check-unreachable"] },
  },
  {
    id: "state-ok",
    area: "state",
    world: {},
    expected: { verdict: "ok", reasons: ["observed"] },
  },
  {
    id: "state-verified-empty",
    area: "state",
    world: { state: { ok: true, verifiedEmpty: true, recordCount: 0 } },
    expected: { verdict: "ok", reasons: ["observed-empty"] },
  },
  {
    id: "state-torn",
    area: "state",
    world: { state: { ok: false, reason: "store-torn", failureCode: "state.store.torn" } },
    expected: { verdict: "fail", reasons: ["store-torn"] },
  },
  {
    id: "state-schema-mismatch",
    area: "state",
    world: {
      state: { ok: false, reason: "store-schema-mismatch", failureCode: "state.schema.mismatch" },
    },
    expected: { verdict: "fail", reasons: ["store-schema-mismatch"] },
  },
  {
    id: "state-permission",
    area: "state",
    world: {
      state: { ok: false, reason: "store-unreadable", failureCode: "state.permission.denied" },
    },
    expected: { verdict: "fail", reasons: ["store-unreadable"] },
  },
  {
    id: "state-unknown-kind",
    area: "state",
    world: { state: { ok: false, reason: "store-unknown", failureCode: "state.store.unknown" } },
    expected: { verdict: "fail", reasons: ["store-unknown"] },
  },
  {
    id: "state-unreadable",
    area: "state",
    world: { state: { ok: false, reason: "unreadable" } },
    expected: { verdict: "unreachable", reasons: ["check-unreachable"] },
  },
  {
    id: "state-contained",
    area: "state",
    world: { contained: ["state"] },
    expected: { verdict: "unreachable", reasons: ["check-unreachable"] },
  },
  {
    id: "ci-ok",
    area: "ci",
    world: {},
    expected: { verdict: "ok", reasons: ["observed"] },
  },
  {
    id: "ci-zero-runs",
    area: "ci",
    world: { ci: { read: { ok: true, pageItemCount: 0 } } },
    expected: { verdict: "ok", reasons: ["observed-empty"] },
  },
  {
    id: "ci-credential-unavailable",
    area: "ci",
    world: { ci: { credential: CREDENTIAL_MISSING } },
    expected: { verdict: "fail", reasons: ["credential-unavailable"] },
  },
  {
    id: "ci-401",
    area: "ci",
    world: { ci: { read: READ_FAILED(401) } },
    expected: { verdict: "fail", reasons: ["credential-rejected"] },
  },
  {
    id: "ci-403",
    area: "ci",
    world: { ci: { read: READ_FAILED(403) } },
    expected: { verdict: "fail", reasons: ["credential-rejected"] },
  },
  {
    id: "ci-404",
    area: "ci",
    world: { ci: { read: READ_FAILED(404) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "ci-500",
    area: "ci",
    world: { ci: { read: READ_FAILED(500) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "ci-503",
    area: "ci",
    world: { ci: { read: READ_FAILED(503) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "ci-timeout",
    area: "ci",
    world: { ci: { read: READ_FAILED(undefined, { failureClass: "TimeoutError" }) } },
    expected: { verdict: "unreachable", reasons: ["read-failed"] },
  },
  {
    id: "ci-commit-unresolved",
    area: "ci",
    world: { ci: { commit: { resolved: false, detached: true } } },
    expected: { verdict: "fail", reasons: ["commit-unresolved"] },
  },
  {
    id: "ci-not-attempted",
    area: "ci",
    world: { checkout: { binding: UNRESOLVED_BINDING }, ci: { read: undefined } },
    expected: { verdict: "unreachable", reasons: ["not-attempted"] },
  },
  {
    id: "ci-precedence-credential-over-commit",
    area: "ci",
    world: {
      ci: { credential: CREDENTIAL_MISSING, commit: { resolved: false, detached: true } },
    },
    expected: { verdict: "fail", reasons: ["credential-unavailable"] },
  },
  {
    id: "ci-contained",
    area: "ci",
    world: { contained: ["ci"] },
    expected: { verdict: "unreachable", reasons: ["check-unreachable"] },
  },
];

export const CASES_BY_ID: ReadonlyMap<string, MatrixCase> = new Map(
  MATRIX_CASES.map((entry) => [entry.id, entry]),
);

export const inputsFor = (entry: MatrixCase): DoctorCheckInputs => doctorWorld(entry.world);
