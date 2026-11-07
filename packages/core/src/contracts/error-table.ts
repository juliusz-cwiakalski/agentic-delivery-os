/**
 * The internal error table — the single source of failure identity (F-2, F-3).
 *
 * Runtime-neutral by construction: types and `as const` data only. Classification,
 * projection, serialization, and redaction live at the surface tiers.
 *
 * The table carries two containment entries and one row per declared failure
 * discriminant. `fallback` is the reserved two-segment namespace.
 */
import type { AppErrorCode, ErrorCategory, ErrorConsequence, ProjectionClass } from "./result.js";

/** The declared domain kinds: the first link of the classification chain. */
export const DOMAIN_KINDS = [
  "provider",
  "input",
  "config",
  "state",
  "lint",
  "verify",
  "db",
  "closeout",
  "plan",
  "watchdog",
  "commit",
  "status",
  "doctor",
  "merge",
  "harness",
  "retro",
  "spend",
] as const;

/**
 * The domain kinds whose single row is selectable by exact code only.
 *
 * A kind-only discriminant for these kinds is contained by `fallback.internal`
 * rather than resolved to the kind's only row, so a malformed failure object
 * can never masquerade as the declared identity.
 */
export const EXACT_CODE_DOMAIN_KINDS = ["spend"] as const;
export type ExactCodeDomainKind = (typeof EXACT_CODE_DOMAIN_KINDS)[number];

/** Reserved containment code for broken invocations and unknown commands. */
export const FALLBACK_INVOCATION_CODE = "fallback.invocation" as const;

/** Reserved containment code for errors no table entry classifies. */
export const FALLBACK_INTERNAL_CODE = "fallback.internal" as const;

/** A declared domain kind, or the reserved containment namespace. */
export type ErrorTableDomainKind = (typeof DOMAIN_KINDS)[number] | "fallback";

/** One row of the machine-readable table (DM-3, Appendix B). */
export type ErrorTableEntry = {
  readonly code: AppErrorCode;
  readonly domainKind: ErrorTableDomainKind;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly consequence: ErrorConsequence;
  readonly remediationHint: string;
  readonly projectionClass: ProjectionClass;
  readonly summary?: string;
};

/**
 * One declared family row (NFR-8, GAP-13).
 *
 * The family declares the shared class fields once; `template` is the
 * documented template code and `slotPrefix`/`slotSuffix` bound the open slot.
 * A family instance resolves to the family's declared fields with its own code
 * preserved. The slot is validated by the declared-gate-set recognizer, never
 * by a generic pattern widening.
 */
export type ErrorTableFamily = {
  readonly template: string;
  readonly domainKind: ErrorTableDomainKind;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly consequence: ErrorConsequence;
  readonly remediationHint: string;
  readonly projectionClass: ProjectionClass;
  readonly summary?: string;
  readonly slotPrefix: string;
  readonly slotSuffix: string;
};

/** The one declared open-slot family: `merge.gate.<gate-id>.failed` (DEC-7). */
export const ERROR_TABLE_FAMILIES = [
  {
    template: "merge.gate.<gate-id>.failed",
    domainKind: "merge",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Resolve the named merge-applicable gate evidence and re-run `verify gates`, then retry the merge.",
    projectionClass: "user-validation",
    summary: "A merge-applicable gate did not pass.",
    slotPrefix: "merge.gate.",
    slotSuffix: ".failed",
  },
] as const satisfies readonly ErrorTableFamily[];

/**
 * The single machine-readable declaration. Ordered fallback entries first, then
 * one seed entry per declared domain kind.
 */
export const ERROR_TABLE = [
  {
    code: FALLBACK_INVOCATION_CODE,
    domainKind: "fallback",
    category: "user",
    retryable: false,
    consequence: "unknown",
    remediationHint: "Check the command name and arguments, then retry the invocation.",
    projectionClass: "user-validation",
    summary: "The invocation could not be understood.",
  },
  {
    code: FALLBACK_INTERNAL_CODE,
    domainKind: "fallback",
    category: "platform",
    retryable: false,
    consequence: "unknown",
    remediationHint: "Inspect the diagnostics stream and report the failure if it persists.",
    projectionClass: "platform-provider",
    summary: "The failure could not be classified.",
  },
  {
    code: "provider.quota.exceeded",
    domainKind: "provider",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint: "Wait for the quota window to reset, then retry the operation.",
    projectionClass: "platform-provider",
    summary: "The provider quota was exceeded.",
  },
  {
    code: "provider.outage",
    domainKind: "provider",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Retry after the provider becomes reachable; consult the announcement and park for the resume time.",
    projectionClass: "platform-provider",
    summary: "The provider is unreachable.",
  },
  {
    code: "provider.auth.rejected",
    domainKind: "provider",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct or replace the declared credential and retry.",
    projectionClass: "user-validation",
    summary: "The provider rejected the credential.",
  },
  {
    code: "provider.chain.empty",
    domainKind: "provider",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Declare a non-empty provider chain (or select one) and retry.",
    projectionClass: "user-validation",
    summary: "No provider chain is declared.",
  },
  {
    code: "provider.chain.invalid",
    domainKind: "provider",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the named chain entries, ordering, or references and retry.",
    projectionClass: "user-validation",
    summary: "The provider chain is invalid.",
  },
  {
    code: "input.value.rejected",
    domainKind: "input",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the rejected value and retry the command.",
    projectionClass: "user-validation",
    summary: "The supplied value was rejected.",
  },
  {
    code: "config.file.malformed",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the named configuration source and retry.",
    projectionClass: "user-validation",
    summary: "A configuration source is malformed.",
  },
  {
    code: "config.key.unknown",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Remove or correct the unknown configuration key and retry.",
    projectionClass: "user-validation",
    summary: "A configuration key is unknown.",
  },
  {
    code: "config.environment.unmapped",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Remove or map the environment name and retry.",
    projectionClass: "user-validation",
    summary: "An environment configuration name is unmapped.",
  },
  {
    code: "config.value.invalid",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the value to match the configuration schema and retry.",
    projectionClass: "user-validation",
    summary: "A configuration value is invalid.",
  },
  {
    code: "config.interpolation.rejected",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Use a typed environment override instead and retry.",
    projectionClass: "user-validation",
    summary: "In-file interpolation is not supported.",
  },
  {
    code: "config.secret.forbidden",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Move the secret to a supported environment source and retry.",
    projectionClass: "user-validation",
    summary: "A secret was supplied from a forbidden source.",
  },
  {
    code: "config.path.forbidden",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Move the machine path to a system or user-global source and retry.",
    projectionClass: "user-validation",
    summary: "A machine path was supplied from a forbidden source.",
  },
  {
    code: "config.reset.invalid",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct the reset paths and retry.",
    projectionClass: "user-validation",
    summary: "A configuration reset is invalid.",
  },
  {
    code: "config.warning.strict",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Resolve the named warning and retry.",
    projectionClass: "user-validation",
    summary: "Strict configuration validation rejected a warning.",
  },
  {
    code: "config.credential.missing",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Supply the credential through its declared environment source and retry.",
    projectionClass: "user-validation",
    summary: "A required credential was not resolvable from its source.",
  },
  {
    code: "state.store.torn",
    domainKind: "state",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Inspect the named state store and use the explicit salvage operation as a separate step to truncate a torn tail; never treat the store as empty.",
    projectionClass: "platform-provider",
    summary: "The state store is torn.",
  },
  {
    code: "state.schema.mismatch",
    domainKind: "state",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Use a compatible tool version or migrate the store explicitly, then retry.",
    projectionClass: "platform-provider",
    summary: "The state store schema version is not supported.",
  },
  {
    code: "state.keys.missing",
    domainKind: "state",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Verify the writing operation completed and inspect the named store; never substitute defaults.",
    projectionClass: "platform-provider",
    summary: "A state read key-set assertion failed.",
  },
  {
    code: "state.lock.busy",
    domainKind: "state",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Wait for the current writer to release the state fence, then acquire and retry.",
    projectionClass: "platform-provider",
    summary: "The state store is locked by another writer.",
  },
  {
    code: "state.permission.denied",
    domainKind: "state",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Correct operating-system permissions on the named state path and retry.",
    projectionClass: "user-validation",
    summary: "A state path permission requirement was not met.",
  },
  {
    code: "state.write.failed",
    domainKind: "state",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Resolve the underlying storage error other than exhaustion and retry; the failed write or rebuild did not land, the ledger remains durable truth, and the index stays disposable.",
    projectionClass: "platform-provider",
    summary: "A state write or index rebuild did not land.",
  },
  {
    code: "state.storage.exhausted",
    domainKind: "state",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Free storage space on the named state path and retry; the write did not land and the ledger remains at its last valid frame.",
    projectionClass: "platform-provider",
    summary: "The storage backing the state store is exhausted.",
  },
  {
    code: "state.store.unknown",
    domainKind: "state",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Declare the record kind and payload schema at the validated boundary, or use a compatible tool version, then retry.",
    projectionClass: "platform-provider",
    summary: "A record kind or payload schema is not declared at the validated boundary.",
  },
  {
    code: "state.level.unsupported",
    domainKind: "state",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Use a state level with an implemented driver; shared levels arrive with later stories.",
    projectionClass: "user-validation",
    summary: "The requested state level has no implementation.",
  },
  {
    code: "lint.notes.malformed",
    domainKind: "lint",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Correct the document so it conforms to the pm-notes schema (syntax, structure, and value types) and retry.",
    projectionClass: "user-validation",
    summary: "The pm-notes document is malformed.",
  },
  {
    code: "lint.keys.missing",
    domainKind: "lint",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Add the named required key(s) with a conforming value and retry.",
    projectionClass: "user-validation",
    summary: "A required pm-notes key is missing.",
  },
  {
    code: "lint.variant.unknown",
    domainKind: "lint",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Set `variant` to `full` or `lite` and retry.",
    projectionClass: "user-validation",
    summary: "The pm-notes variant is unknown.",
  },
  {
    code: "lint.phases.incomplete",
    domainKind: "lint",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Add the named missing required phase(s) of the declared variant or correct the declared variant.",
    projectionClass: "user-validation",
    summary: "A required phase of the declared variant is missing.",
  },
  {
    code: "lint.target.missing",
    domainKind: "lint",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "pm-notes target only: initialize pm-notes for the named change ref or correct the reference (an absent registry target is a verified-empty pass, C-3).",
    projectionClass: "user-validation",
    summary: "The pm-notes target is missing.",
  },
  {
    code: "lint.document.unreadable",
    domainKind: "lint",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Restore the named document's readability and encoding, then re-run lint; the document was not evaluated.",
    projectionClass: "platform-provider",
    summary: "A lint target document could not be read or decoded.",
  },
  {
    code: "verify.ledger.incomplete",
    domainKind: "verify",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Complete the named required phases of the declared variant through the phase command, or correct the declaration, then re-run verify.",
    projectionClass: "user-validation",
    summary: "The declared variant's required phases are not all completed.",
  },
  {
    code: "db.opencode.unavailable",
    domainKind: "db",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Install or repair the opencode CLI so opencode db path resolves.",
    projectionClass: "platform-provider",
    summary: "The opencode session database is unavailable.",
  },
  {
    code: "db.query.failed",
    domainKind: "db",
    category: "platform",
    retryable: true,
    consequence: "not_landed",
    remediationHint: "Retry the failed query and verify the session store is readable.",
    projectionClass: "platform-provider",
    summary: "A session database query failed.",
  },
  {
    code: "db.delete.failed",
    domainKind: "db",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint: "Retry the prune; failed rows remain and are selected again.",
    projectionClass: "platform-provider",
    summary: "A session delete did not land.",
  },
  {
    code: "db.reboot.live",
    domainKind: "db",
    category: "transient",
    retryable: true,
    consequence: "not_landed",
    remediationHint: "Wait until the live window is empty or stop the opencode host, then retry.",
    projectionClass: "platform-provider",
    summary: "A live session is using the database.",
  },
  {
    code: "closeout.target.unobserved",
    domainKind: "closeout",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Verify the work item ref; a provider not-found means the item does not exist. A payload/parse failure is `provider.payload.invalid`, and access or credential failures keep their own identities.",
    projectionClass: "user-validation",
    summary: "The closeout target work item was not observed (provider not-found).",
  },
  {
    code: "closeout.target.ambiguous",
    domainKind: "closeout",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Disambiguate the delivery request or local branch for the work item, then retry.",
    projectionClass: "user-validation",
    summary: "More than one closeout target matched.",
  },
  {
    code: "closeout.write.failed",
    domainKind: "closeout",
    category: "transient",
    retryable: true,
    consequence: "unknown",
    remediationHint:
      "Inspect the failed operation evidence and retry; completed operations are persisted and idempotent.",
    projectionClass: "platform-provider",
    summary: "A closeout provider write did not land.",
  },
  {
    code: "closeout.branch.unsafe",
    domainKind: "closeout",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Resolve the named checkout, worktree, protected-ref, or merged-head condition, then retry.",
    projectionClass: "user-validation",
    summary: "Branch cleanup or checkout restore was refused for safety.",
  },
  {
    code: "verify.gates.failed",
    domainKind: "verify",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Resolve the named failing gate evidence (lifecycle, CI, push parity, owner gate, or squash preflight) and re-run the gates.",
    projectionClass: "user-validation",
    summary: "One or more merge gates did not pass.",
  },
  {
    code: "verify.gates.unavailable",
    domainKind: "verify",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Restore access to the named gate-evidence source and re-run the gates; the gates were not fully evaluated.",
    projectionClass: "platform-provider",
    summary: "Merge-gate evidence could not be read.",
  },
  {
    code: "plan.schema.invalid",
    domainKind: "plan",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Correct the named plan phase and field to match the declared plan schema, then re-run `plan validate`.",
    projectionClass: "user-validation",
    summary: "The plan document does not conform to the plan schema.",
  },
  {
    code: "plan.scope.undeclared-paths",
    domainKind: "plan",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Declare the named path in a phase scope or revert the out-of-scope change, then re-run `plan diff`.",
    projectionClass: "user-validation",
    summary: "Actual changes fall outside the declared plan scope.",
  },
  {
    code: "plan.tier.unknown",
    domainKind: "plan",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Declare a known ceremony tier or extend the known-tier vocabulary, then re-run `plan validate`.",
    projectionClass: "user-validation",
    summary: "The plan declares an unknown ceremony tier.",
  },
  {
    code: "plan.format.legacy-markdown",
    domainKind: "plan",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Rewrite the plan as `chg-<ref>-plan.yaml` to make it schema-valid; legacy markdown stays readable during the transition.",
    projectionClass: "user-validation",
    summary: "The plan is a legacy markdown document, not a schema-valid YAML plan.",
  },
  {
    code: "plan.artifact.missing",
    domainKind: "plan",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Author `chg-<ref>-plan.yaml` (or a legacy `chg-<ref>-plan.md`) for the named change ref, then re-run the command.",
    projectionClass: "user-validation",
    summary: "No plan artifact exists for the change ref.",
  },
  {
    code: "watchdog.checkout-dirty",
    domainKind: "watchdog",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Commit or discard the named uncommitted changes, then re-run the lane preflight.",
    projectionClass: "user-validation",
    summary: "The lane checkout is dirty.",
  },
  {
    code: "watchdog.checkout-non-base",
    domainKind: "watchdog",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Check out the lane's declared base (or correct the declaration), then re-run the lane preflight.",
    projectionClass: "user-validation",
    summary: "The lane checkout is not on its declared base.",
  },
  {
    code: "watchdog.signals-absent",
    domainKind: "watchdog",
    category: "platform",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Restore the declared progress-signal sources, then retry; without them the answer is unknown.",
    projectionClass: "platform-provider",
    summary: "No liveness signal sources are available; the answer is unknown.",
  },
  {
    code: "commit.staging-blocked-untracked",
    domainKind: "commit",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Stage or remove the pending material outside the declared scope, or expand the change scope, then retry the commit.",
    projectionClass: "user-validation",
    summary: "Nothing stageable remains for the requested commit.",
  },
  {
    code: "commit.commitlint-failed",
    domainKind: "commit",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Reconcile the repository commitlint configuration with the commit type table (or correct the message), then retry.",
    projectionClass: "user-validation",
    summary: "Neither the generated message nor the deterministic template satisfied commitlint.",
  },
  {
    code: "commit.safety.secret-suspected",
    domainKind: "commit",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Review the named finding class and path, remove or gitignore the suspected material, then retry; never blind-retry.",
    projectionClass: "user-validation",
    summary: "The secret scan flagged candidate content or a filename on suspicion.",
  },
  {
    code: "commit.safety.scan-unavailable",
    domainKind: "commit",
    category: "platform",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Restore the deterministic safety scanner and retry; nothing was staged or committed.",
    projectionClass: "platform-provider",
    summary: "The deterministic safety scan could not run.",
  },
  {
    code: "commit.atomic-abort",
    domainKind: "commit",
    category: "platform",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Retry the completion; the clean abort restored both the ledger and the commit to neither-landed, and a re-run converges.",
    projectionClass: "platform-provider",
    summary: "The atomic phase completion aborted and restored both sides.",
  },
  {
    code: "commit.session.context-refused",
    domainKind: "commit",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Invoke the commit primitive from outside the delivery session (agents invoke it from a plain shell or subagent boundary).",
    projectionClass: "user-validation",
    summary: "The commit primitive refused to run inside a delivery session.",
  },
  {
    code: "status.collector.tracker.unavailable",
    domainKind: "status",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Restore access to the named collector source and re-run the board; the board withheld its gates rather than display a partial picture.",
    projectionClass: "platform-provider",
    summary: "The named board collector is unavailable.",
  },
  {
    code: "merge.gates-stale",
    domainKind: "merge",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Re-run `verify gates` for the current head, then retry the merge; the recorded verification is no longer valid evidence.",
    projectionClass: "user-validation",
    summary: "The recorded gate verification is stale or voided.",
  },
  {
    code: "merge.waiver-unauthorized",
    domainKind: "merge",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Declare the override with an authorizer authorized for the gate class, then retry; no waiver was recorded.",
    projectionClass: "user-validation",
    summary: "The declared waiver authorizer is not authorized for the gate class.",
  },
  {
    code: "merge.owner-gate-override-without-waiver",
    domainKind: "merge",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Declare an authorized override naming the owner-gate and its authorizer, or resolve the owner-gated state, then retry.",
    projectionClass: "user-validation",
    summary: "The owner gate failed and no override declaration was supplied.",
  },
  {
    code: "merge.rebase-conflict",
    domainKind: "merge",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Resolve the named conflicting paths, re-run `verify gates`, then retry the merge; no force path exists.",
    projectionClass: "user-validation",
    summary: "The single rebase-refresh attempt conflicted.",
  },
  {
    code: "merge.state-unverified",
    domainKind: "merge",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Produce a gate verification with `verify gates` and retry; the verification state is absent, torn, or incompatible.",
    projectionClass: "platform-provider",
    summary: "No consumable gate-verification state exists for the change.",
  },
  {
    code: "merge.landing-unverified",
    domainKind: "merge",
    category: "platform",
    retryable: false,
    consequence: "unknown",
    remediationHint:
      "Re-run the merge to re-verify the landing; do not blind-retry or manually duplicate the merge.",
    projectionClass: "platform-provider",
    summary: "The landing mutation fired but its landed state is not established.",
  },
  {
    code: "merge.transaction-aborted",
    domainKind: "merge",
    category: "user",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Clear the named pre-mutation condition and retry; nothing landed and a re-run converges.",
    projectionClass: "user-validation",
    summary: "The transaction aborted cleanly before any landing mutation.",
  },
  {
    code: "verify.deploy.trace-missing",
    domainKind: "verify",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Produce a deploy trace whose declared steps executed and artifacts exist, then re-run `verify deploy`.",
    projectionClass: "user-validation",
    summary: "The deploy verdict is unknown because executed-step evidence is absent.",
  },
  {
    code: "verify.deploy.status-stale",
    domainKind: "verify",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Read the deploy job's execution trace; a status field alone is not evidence. Re-run when the trace is current.",
    projectionClass: "user-validation",
    summary: "The deploy status field is disqualified as evidence.",
  },
  {
    code: "verify.deploy.trace-failed",
    domainKind: "verify",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Resolve the named failing deploy step and re-run the deployment, then re-run `verify deploy`.",
    projectionClass: "user-validation",
    summary: "The deploy trace shows a failed step.",
  },
  {
    code: "doctor.check.failed",
    domainKind: "doctor",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint: "Resolve each named failing check using its fix hint, then re-run doctor.",
    projectionClass: "user-validation",
    summary: "One or more wiring checks failed.",
  },
  {
    code: "harness.spawn.invalid-output",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Inspect the harness machine-readable output for the named parse failure, correct the invocation, and retry.",
    projectionClass: "user-validation",
    summary: "The harness spawn output was not machine-readable.",
  },
  {
    code: "harness.spawn.refused",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Read the harness refusal reason, correct the invocation or declared environment, and retry.",
    projectionClass: "user-validation",
    summary: "The harness refused to start a session.",
  },
  {
    code: "harness.spawn.variable-missing",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Declare the named variable in the parent environment or remove it from the allowlist, then retry.",
    projectionClass: "user-validation",
    summary: "A declared spawn-environment variable is absent.",
  },
  {
    code: "harness.session.unknown",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Use the existing session identity from the original spawn; never resume a fabricated or stale id.",
    projectionClass: "user-validation",
    summary: "The named session does not exist.",
  },
  {
    code: "harness.capability.gap",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Select a harness that declares the capability or use the declared consumer-side fallback.",
    projectionClass: "user-validation",
    summary: "The selected harness declares the requested capability as a gap.",
  },
  {
    code: "harness.listing.invalid-output",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Inspect the harness listing output for the named parse failure and correct the invocation.",
    projectionClass: "user-validation",
    summary: "The harness session-listing output was not machine-readable.",
  },
  {
    code: "harness.telemetry.unattributable",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Map the session tree root to a work item before extraction, then re-run the capture.",
    projectionClass: "user-validation",
    summary: "A session tree root cannot be attributed to a work item.",
  },
  {
    code: "harness.telemetry.invalid-identity",
    domainKind: "harness",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Repair the malformed session identity in the harness store before extracting telemetry.",
    projectionClass: "user-validation",
    summary: "A session record carries no valid identity.",
  },
  {
    code: "harness.telemetry.extraction-failed",
    domainKind: "harness",
    category: "platform",
    retryable: true,
    consequence: "not_landed",
    remediationHint:
      "Verify the configured harness store location and read permissions, then re-run the closeout capture.",
    projectionClass: "platform-provider",
    summary: "The harness store could not be read for telemetry extraction.",
  },
  {
    code: "retro.evidence.malformed-entry",
    domainKind: "retro",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Inspect the named evidence position and repair or explicitly salvage the affected artifact, then re-run the retro command; valid entries were preserved.",
    projectionClass: "user-validation",
    summary: "An evidence entry is malformed and was classified in band.",
  },
  {
    code: "retro.evidence.tamper-flagged",
    domainKind: "retro",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Inspect the named domain and record positions; do not trust altered evidence. Restore the unaltered artifact or record an explicit salvage before re-running.",
    projectionClass: "user-validation",
    summary: "A keyed evidence chain failed verification.",
  },
  {
    code: "retro.truth.vacuous-run",
    domainKind: "retro",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Verify the declared collector sources and their windows, then re-run retro collect; a collection that executes must produce collector records.",
    projectionClass: "user-validation",
    summary: "A collection run executed and produced no collector records.",
  },
  {
    code: "retro.evidence.denied",
    domainKind: "retro",
    category: "platform",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Write evidence only through the collector seam; the sidecar is collector-owned and the attempted write did not land.",
    projectionClass: "platform-provider",
    summary: "A write outside the collector seam was refused.",
  },
  {
    code: "spend.telemetry-absent",
    domainKind: "spend",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    remediationHint:
      "Capture harness telemetry (session-group and capture-outcome records) for the selected work item at closeout, then re-run spend.",
    projectionClass: "user-validation",
    summary: "No captured harness telemetry exists for the selected work item.",
  },
] as const satisfies readonly ErrorTableEntry[];
