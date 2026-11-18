/**
 * The pure `doctor` aggregation tier (GH-224 F-2, F-8, F-9, F-10).
 *
 * Appendix A verdict derivation with left-to-right precedence, evidence
 * construction (dedupe, first-occurrence order, 4/4 caps), bounded detail and
 * hint rendering from the closed condition catalog, the DM-7 failure summary,
 * the bounded human report, and the per-check containment container.
 *
 * Pure by construction: imports `#contracts` only; every clock fact arrives
 * through the inputs; no I/O, randomness, environment, or status-cap import.
 */
import {
  type BrandIdentity,
  DOCTOR_AREAS,
  DOCTOR_CONDITION_CATALOG,
  DOCTOR_CREDENTIAL_REJECTION_STATUSES,
  DOCTOR_EVIDENCE_SOURCES,
  DOCTOR_MAX_DETAIL_CHARS,
  DOCTOR_MAX_EVIDENCE_REASONS,
  DOCTOR_MAX_EVIDENCE_SOURCES,
  DOCTOR_MAX_HINT_CHARS,
  DOCTOR_MAX_HUMAN_BYTES,
  DOCTOR_MAX_HUMAN_LINES,
  DOCTOR_SCHEMA_VERSION,
  DOCTOR_SUMMARY_PREFIX,
  DOCTOR_SUMMARY_SEPARATOR,
  DOCTOR_WIRING_NEUTRAL_CONDITIONS,
  OWNER_HOLD_MAX_REASON_CHARS,
  type DoctorArea,
  type DoctorAreaFacts,
  type DoctorCheck,
  type DoctorCheckInputs,
  type DoctorCheckResult,
  type DoctorCiFacts,
  type DoctorConditionId,
  type DoctorCredentialPresence,
  type DoctorEvidence,
  type DoctorEvidenceOutcome,
  type DoctorEvidenceReason,
  type DoctorEvidenceSource,
  type DoctorParkFoldRead,
  type DoctorProviderConfigRead,
  type DoctorProviderFacts,
  type DoctorReport,
  type DoctorRepositoryBinding,
  type DoctorStateStoresRead,
  type DoctorSummaryCounts,
  type DoctorTrackerFacts,
  type DoctorVerdict,
  type DoctorWiringRead,
  type ProviderAnnouncementRecord,
  type ProviderConfiguration,
  type ProviderParkRecord,
  type OwnerHoldFact,
} from "#contracts";

/* ------------------------------- primitives ------------------------------- */

/** Truncate by Unicode code points so a multi-byte sequence is never split. */
const clampText = (value: string, max: number): string => {
  const points = Array.from(value);
  return points.length <= max ? value : points.slice(0, max).join("");
};

const collapseWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

/**
 * Append the hold segment to the existing bounded detail. When the combined
 * value would exceed the detail bound, the EXISTING detail yields and the whole
 * hold segment is kept; it is never cut mid-word or dropped (GH-280 D18).
 */
const appendOwnerHoldDetail = (
  baseDetail: string,
  hold: Extract<OwnerHoldFact, { active: true }>,
): string => {
  const reason =
    hold.reason === undefined ? undefined : clampText(hold.reason, OWNER_HOLD_MAX_REASON_CHARS);
  const segment =
    reason === undefined
      ? `owner hold active (${hold.source})`
      : `owner hold active (${hold.source}): ${reason}`;
  const suffix = `; ${segment}`;
  const combined = `${baseDetail}${suffix}`;
  if (Array.from(combined).length <= DOCTOR_MAX_DETAIL_CHARS) return combined;
  const available = DOCTOR_MAX_DETAIL_CHARS - Array.from(suffix).length;
  if (available <= 0) return segment;
  return `${clampText(baseDetail, available)}${suffix}`;
};

const catalogEntry = (condition: DoctorConditionId): (typeof DOCTOR_CONDITION_CATALOG)[number] => {
  const entry = DOCTOR_CONDITION_CATALOG.find((candidate) => candidate.condition === condition);
  if (entry === undefined) throw new Error(`undeclared doctor condition: ${condition}`);
  return entry;
};

type Substitutions = {
  readonly envVar?: string;
  readonly providerName?: string;
  readonly sourceKey?: string;
  readonly failureCode?: string;
  readonly area?: DoctorArea;
};

const substitute = (template: string, values: Substitutions): string => {
  const text = template
    .replaceAll("{envVar}", values.envVar ?? "the declared environment variable")
    .replaceAll("{providerName}", values.providerName ?? "the provider")
    .replaceAll("{sourceKey}", values.sourceKey ?? "its declared source key")
    .replaceAll("{failureCode}", values.failureCode ?? "config.value.invalid")
    .replaceAll("{area}", values.area ?? "the");
  return clampText(collapseWhitespace(text), DOCTOR_MAX_HINT_CHARS);
};

const hintFor = (condition: DoctorConditionId, values: Substitutions = {}): string =>
  substitute(catalogEntry(condition).hintTemplate, values);

/** The primary source per area, used by the containment detail. */
const PRIMARY_SOURCE: Readonly<Record<DoctorArea, DoctorEvidenceSource>> = {
  repo: "checkout",
  tracker: "tracker-read",
  provider: "provider-config",
  state: "state-stores",
  ci: "ci-read",
};

type SourceDraft = {
  readonly source: DoctorEvidenceSource;
  readonly outcome: DoctorEvidenceOutcome;
};

const buildEvidence = (
  sources: readonly SourceDraft[],
  reasons: readonly DoctorEvidenceReason[],
  extra: {
    readonly failureCode?: string;
    readonly failureClass?: string;
    readonly httpStatus?: number;
  } = {},
): DoctorEvidence => {
  const uniqueSources: SourceDraft[] = [];
  const seenSources = new Set<DoctorEvidenceSource>();
  for (const source of sources) {
    if (seenSources.has(source.source)) continue;
    seenSources.add(source.source);
    uniqueSources.push(source);
    if (uniqueSources.length >= DOCTOR_MAX_EVIDENCE_SOURCES) break;
  }
  const uniqueReasons: DoctorEvidenceReason[] = [];
  for (const reason of reasons) {
    if (uniqueReasons.includes(reason)) continue;
    uniqueReasons.push(reason);
    if (uniqueReasons.length >= DOCTOR_MAX_EVIDENCE_REASONS) break;
  }
  return {
    sources: uniqueSources,
    reasons: uniqueReasons,
    ...(extra.failureCode === undefined ? {} : { failureCode: extra.failureCode }),
    ...(extra.failureClass === undefined ? {} : { failureClass: extra.failureClass }),
    ...(extra.httpStatus === undefined ? {} : { httpStatus: extra.httpStatus }),
  };
};

const check = (
  area: DoctorArea,
  verdict: DoctorVerdict,
  detail: string,
  evidence: DoctorEvidence,
  hintCondition?: DoctorConditionId,
  substitutions: Substitutions = {},
): DoctorCheck => {
  const boundedDetail = clampText(collapseWhitespace(detail), DOCTOR_MAX_DETAIL_CHARS);
  if (verdict === "ok") {
    return { area, verdict, detail: boundedDetail, evidence };
  }
  if (hintCondition === undefined) throw new Error(`non-ok ${area} check has no hint condition`);
  return {
    area,
    verdict,
    detail: boundedDetail,
    fixHint: hintFor(hintCondition, { ...substitutions, area }),
    evidence,
  };
};

const containedCheck = (
  area: DoctorArea,
  detail: string,
  source: DoctorEvidenceSource = PRIMARY_SOURCE[area],
): DoctorCheck =>
  check(
    area,
    "unreachable",
    detail,
    buildEvidence([{ source, outcome: "failed" }], ["check-unreachable"]),
    `doctor.check.${area}.unreachable` as DoctorConditionId,
    { area },
  );

/* --------------------------------- repo ---------------------------------- */

const repoCheck = (
  checkout: Extract<DoctorAreaFacts, { readonly area: "repo" }>["checkout"],
): DoctorCheck => {
  const bindingRead: SourceDraft = {
    source: "remote-binding",
    outcome: checkout.binding.state === "observed" ? "read" : "failed",
  };
  if (!checkout.readable) {
    return check(
      "repo",
      "unreachable",
      "checkout facts are unreadable for this work tree",
      buildEvidence(
        [{ source: "checkout", outcome: "failed" }, bindingRead],
        ["checkout-unreadable"],
      ),
      "repo.checkout-unreadable",
    );
  }
  if (!checkout.clean) {
    const facts = checkout.branch === undefined ? "detached HEAD" : `on ${checkout.branch}`;
    return check(
      "repo",
      "fail",
      `working tree has uncommitted changes ${facts}`,
      buildEvidence([{ source: "checkout", outcome: "read" }, bindingRead], ["checkout-dirty"]),
      "repo.checkout-dirty",
    );
  }
  if (checkout.binding.state !== "observed") {
    return check(
      "repo",
      "fail",
      "the origin remote does not resolve to a GitHub repository binding",
      buildEvidence(
        [
          { source: "checkout", outcome: "read" },
          { source: "remote-binding", outcome: "failed" },
        ],
        ["remote-unresolvable"],
      ),
      "repo.remote-unresolvable",
    );
  }
  const shortSha = checkout.sha === undefined ? "unknown" : checkout.sha.slice(0, 7);
  const facts =
    checkout.detached || checkout.branch === undefined
      ? `detached HEAD at ${shortSha}`
      : `clean work tree on ${checkout.branch} at ${shortSha}`;
  return check(
    "repo",
    "ok",
    facts,
    buildEvidence(
      [
        { source: "checkout", outcome: "read" },
        { source: "remote-binding", outcome: "read" },
      ],
      ["observed"],
    ),
  );
};

/* ------------------------------- credential ------------------------------- */

const isCredentialRejection = (read: DoctorWiringRead): boolean => {
  if (read.ok) return false;
  return (
    read.httpStatus !== undefined &&
    DOCTOR_CREDENTIAL_REJECTION_STATUSES.some((status) => status === read.httpStatus)
  );
};

const credentialFailureCode = (credential: DoctorCredentialPresence): string | undefined =>
  credential.ok ? undefined : credential.failureCode;

/* -------------------------------- tracker -------------------------------- */

const trackerCheck = (
  tracker: DoctorTrackerFacts,
  repository: DoctorRepositoryBinding,
): DoctorCheck => {
  const bindingOf = (outcome: DoctorEvidenceOutcome): SourceDraft => ({
    source: "remote-binding",
    outcome,
  });
  const bindingObserved = repository.state === "observed";
  if (!tracker.credential.ok) {
    const failureCode = credentialFailureCode(tracker.credential);
    return check(
      "tracker",
      "fail",
      "the tracker credential is not resolvable from its declared source",
      buildEvidence(
        [
          bindingOf(bindingObserved ? "read" : "failed"),
          { source: "credential", outcome: "failed" },
          { source: "tracker-read", outcome: "not-configured" },
        ],
        ["credential-unavailable"],
        failureCode === undefined ? {} : { failureCode },
      ),
      "tracker.credential-unavailable",
      {
        ...(tracker.credential.envVar === undefined ? {} : { envVar: tracker.credential.envVar }),
      },
    );
  }
  if (!bindingObserved) {
    return check(
      "tracker",
      "unreachable",
      "repository binding is unresolved, so the tracker read was not attempted",
      buildEvidence(
        [
          { source: "remote-binding", outcome: "failed" },
          { source: "credential", outcome: "read" },
          { source: "tracker-read", outcome: "not-configured" },
        ],
        ["not-attempted"],
      ),
      "tracker.not-attempted",
    );
  }
  const read = tracker.read;
  if (read === undefined) {
    return containedCheck("tracker", "the tracker check produced no read result");
  }
  if (!read.ok) {
    const sources: SourceDraft[] = [
      { source: "remote-binding", outcome: "read" },
      { source: "credential", outcome: "read" },
      { source: "tracker-read", outcome: "failed" },
    ];
    if (isCredentialRejection(read)) {
      return check(
        "tracker",
        "fail",
        `the tracker read was rejected with HTTP ${String(read.httpStatus)}`,
        buildEvidence(sources, ["credential-rejected"], {
          ...(read.failureClass === undefined ? {} : { failureClass: read.failureClass }),
          ...(read.httpStatus === undefined ? {} : { httpStatus: read.httpStatus }),
        }),
        "tracker.credential-rejected",
      );
    }
    return check(
      "tracker",
      "unreachable",
      "the tracker read failed before it could prove wiring",
      buildEvidence(sources, ["read-failed"], {
        ...(read.failureCode === undefined ? {} : { failureCode: read.failureCode }),
        ...(read.failureClass === undefined ? {} : { failureClass: read.failureClass }),
        ...(read.httpStatus === undefined ? {} : { httpStatus: read.httpStatus }),
      }),
      "tracker.read-failed",
    );
  }
  const empty = read.pageItemCount === 0;
  return check(
    "tracker",
    "ok",
    empty
      ? "tracker read succeeded with an empty page"
      : `tracker read succeeded (${String(read.pageItemCount)} items)`,
    buildEvidence(
      [
        { source: "remote-binding", outcome: "read" },
        { source: "credential", outcome: "read" },
        { source: "tracker-read", outcome: empty ? "observed-empty" : "read" },
      ],
      [empty ? "observed-empty" : "observed"],
    ),
  );
};

/* ---------------------------------- ci ----------------------------------- */

const ciCheck = (ci: DoctorCiFacts, repository: DoctorRepositoryBinding): DoctorCheck => {
  const bindingObserved = repository.state === "observed";
  const bindingOf = (outcome: DoctorEvidenceOutcome): SourceDraft => ({
    source: "remote-binding",
    outcome,
  });
  if (!ci.credential.ok) {
    const failureCode = credentialFailureCode(ci.credential);
    return check(
      "ci",
      "fail",
      "the tracker credential is not resolvable from its declared source",
      buildEvidence(
        [
          bindingOf(bindingObserved ? "read" : "failed"),
          { source: "credential", outcome: "failed" },
          { source: "commit", outcome: ci.commit.resolved ? "read" : "not-configured" },
          { source: "ci-read", outcome: "not-configured" },
        ],
        ["credential-unavailable"],
        failureCode === undefined ? {} : { failureCode },
      ),
      "ci.credential-unavailable",
      { ...(ci.credential.envVar === undefined ? {} : { envVar: ci.credential.envVar }) },
    );
  }
  if (!ci.commit.resolved) {
    return check(
      "ci",
      "fail",
      "the checkout HEAD commit is unresolved (detached or absent)",
      buildEvidence(
        [
          bindingOf(bindingObserved ? "read" : "failed"),
          { source: "credential", outcome: "read" },
          { source: "commit", outcome: "failed" },
          { source: "ci-read", outcome: "not-configured" },
        ],
        ["commit-unresolved"],
      ),
      "ci.commit-unresolved",
    );
  }
  if (!bindingObserved) {
    return check(
      "ci",
      "unreachable",
      "repository binding is unresolved, so the CI read was not attempted",
      buildEvidence(
        [
          { source: "remote-binding", outcome: "failed" },
          { source: "credential", outcome: "read" },
          { source: "commit", outcome: "read" },
          { source: "ci-read", outcome: "not-configured" },
        ],
        ["not-attempted"],
      ),
      "ci.not-attempted",
    );
  }
  const read = ci.read;
  if (read === undefined) {
    return containedCheck("ci", "the ci check produced no read result");
  }
  if (!read.ok) {
    const sources: SourceDraft[] = [
      { source: "remote-binding", outcome: "read" },
      { source: "credential", outcome: "read" },
      { source: "commit", outcome: "read" },
      { source: "ci-read", outcome: "failed" },
    ];
    if (isCredentialRejection(read)) {
      return check(
        "ci",
        "fail",
        `the CI read was rejected with HTTP ${String(read.httpStatus)}`,
        buildEvidence(sources, ["credential-rejected"], {
          ...(read.failureClass === undefined ? {} : { failureClass: read.failureClass }),
          ...(read.httpStatus === undefined ? {} : { httpStatus: read.httpStatus }),
        }),
        "ci.credential-rejected",
      );
    }
    return check(
      "ci",
      "unreachable",
      "the CI read failed before it could prove wiring",
      buildEvidence(sources, ["read-failed"], {
        ...(read.failureCode === undefined ? {} : { failureCode: read.failureCode }),
        ...(read.failureClass === undefined ? {} : { failureClass: read.failureClass }),
        ...(read.httpStatus === undefined ? {} : { httpStatus: read.httpStatus }),
      }),
      "ci.read-failed",
    );
  }
  const empty = read.pageItemCount === 0;
  return check(
    "ci",
    "ok",
    empty
      ? "CI read succeeded with an empty check-runs page"
      : `CI read succeeded (${String(read.pageItemCount)} check runs)`,
    buildEvidence(
      [
        { source: "remote-binding", outcome: "read" },
        { source: "credential", outcome: "read" },
        { source: "commit", outcome: "read" },
        { source: "ci-read", outcome: empty ? "observed-empty" : "read" },
      ],
      [empty ? "observed-empty" : "observed"],
    ),
  );
};

/* -------------------------------- provider -------------------------------- */

const chainResolvable = (
  config: ProviderConfiguration,
  chainName: string,
): readonly string[] | undefined => {
  const chain = config.chains[chainName];
  if (chain === undefined) return undefined;
  for (const entry of chain.entries) {
    if (config.entries[entry] === undefined) return undefined;
  }
  return chain.entries;
};

const expiryMsOf = (park: ProviderParkRecord): number | undefined => {
  const parsed = Date.parse(park.expiresAt);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const isActivePark = (park: ProviderParkRecord, nowMs: number): boolean => {
  if (park.state !== "active") return false;
  const expiry = expiryMsOf(park);
  return expiry === undefined ? true : expiry > nowMs;
};

const compareParkOrder = (left: ProviderParkRecord, right: ProviderParkRecord): number => {
  const leftExpiry = expiryMsOf(left) ?? Number.MAX_SAFE_INTEGER;
  const rightExpiry = expiryMsOf(right) ?? Number.MAX_SAFE_INTEGER;
  if (leftExpiry !== rightExpiry) return leftExpiry < rightExpiry ? -1 : 1;
  return left.name < right.name ? -1 : left.name > right.name ? 1 : 0;
};

const parkDirective = (subjectName: string): string => `provider quota --provider ${subjectName}`;

const announcementCode = (announcement: ProviderAnnouncementRecord): string => {
  const code = (announcement as { readonly code?: unknown }).code;
  return typeof code === "string" ? code : "provider announcement";
};

const foldCheckBase = (
  fold: DoctorParkFoldRead,
  nowMs: number,
):
  | { readonly ok: true; readonly active: readonly ProviderParkRecord[] }
  | { readonly ok: false } => {
  if (!fold.ok) return { ok: false };
  return { ok: true, active: fold.parks.filter((park) => isActivePark(park, nowMs)) };
};

const providerCheck = (provider: DoctorProviderFacts, nowMs: number): DoctorCheck => {
  const configSources: SourceDraft[] = [];
  const decide = (config: DoctorProviderConfigRead): DoctorCheck | undefined => {
    if (!config.ok) {
      if (config.reason === "config-invalid") {
        return check(
          "provider",
          "fail",
          `the provider configuration source is invalid${
            config.failureCode === undefined ? "" : ` (${config.failureCode})`
          }`,
          buildEvidence([{ source: "provider-config", outcome: "failed" }], ["config-invalid"], {
            ...(config.failureCode === undefined ? {} : { failureCode: config.failureCode }),
          }),
          "provider.config-invalid",
          { ...(config.failureCode === undefined ? {} : { failureCode: config.failureCode }) },
        );
      }
      return check(
        "provider",
        "fail",
        "the provider configuration branch does not validate",
        buildEvidence(
          [{ source: "provider-config", outcome: "failed" }],
          ["provider-chain-unresolved"],
          { failureCode: "config.value.invalid" },
        ),
        "provider.provider-chain-unresolved",
        { failureCode: "config.value.invalid" },
      );
    }
    const resolved = config.config;
    const defaultChain = resolved.defaultChain;
    if (defaultChain === undefined) {
      return check(
        "provider",
        "fail",
        "no default provider chain is declared",
        buildEvidence(
          [{ source: "provider-config", outcome: "read" }],
          ["provider-chain-not-declared"],
        ),
        "provider.provider-chain-not-declared",
      );
    }
    const entries = chainResolvable(resolved, defaultChain);
    if (entries === undefined) {
      return check(
        "provider",
        "fail",
        `the declared default chain ${defaultChain} does not resolve to declared entries`,
        buildEvidence(
          [{ source: "provider-config", outcome: "read" }],
          ["provider-chain-unresolved"],
          { failureCode: "config.value.invalid" },
        ),
        "provider.provider-chain-unresolved",
        { failureCode: "config.value.invalid" },
      );
    }
    return undefined;
  };

  const configFailure = decide(provider.config);
  if (provider.config.ok) {
    configSources.push({ source: "provider-config", outcome: "read" });
  }
  if (configFailure !== undefined) return configFailure;

  const credentialDefects = provider.credentials.filter((credential) => !credential.ok);
  if (credentialDefects.length > 0) {
    const first = credentialDefects[0];
    if (first === undefined) throw new Error("credential defect disappeared");
    return check(
      "provider",
      "fail",
      `the credential for ${first.providerName} does not resolve through its declared source key`,
      buildEvidence(
        [...configSources, { source: "provider-credential", outcome: "failed" }],
        ["credential-unavailable"],
      ),
      "provider.credential-unavailable",
      { providerName: first.providerName, sourceKey: first.sourceKey },
    );
  }

  const fold = foldCheckBase(provider.fold, nowMs);
  if (!fold.ok) {
    return check(
      "provider",
      "unreachable",
      "the provider park and announcement fold could not be read",
      buildEvidence(
        [...configSources, { source: "provider-parks", outcome: "failed" }],
        ["state-unreadable"],
      ),
      "provider.state-unreadable",
    );
  }
  const credentialParks = fold.active
    .filter((park) => park.cause === "credential-missing" || park.cause === "credential-rejected")
    .slice()
    .sort(compareParkOrder);
  if (credentialParks.length > 0) {
    const first = credentialParks[0];
    if (first === undefined) throw new Error("credential park disappeared");
    return check(
      "provider",
      "fail",
      `an active park records a credential defect for ${first.subjectName} (${first.cause}) until ${first.expiresAt}`,
      buildEvidence(
        [
          ...configSources,
          { source: "provider-credential", outcome: "read" },
          { source: "provider-parks", outcome: "read" },
        ],
        ["park-credential-cause"],
      ),
      "provider.park-credential-cause",
      { providerName: first.subjectName },
    );
  }

  const neutralParks = fold.active
    .filter((park) => (DOCTOR_WIRING_NEUTRAL_CONDITIONS as readonly string[]).includes(park.cause))
    .slice()
    .sort(compareParkOrder);
  const announcements = provider.fold.ok ? provider.fold.announcements : [];
  const details: string[] = [];
  const reasons: DoctorEvidenceReason[] = ["observed"];
  if (neutralParks.length > 0) {
    reasons.push("park-active");
    const rendered = neutralParks.map(
      (park) =>
        `${park.subjectName} ${park.cause} until ${park.expiresAt} (${parkDirective(park.subjectName)})`,
    );
    details.push(`${String(neutralParks.length)} active park(s): ${rendered.join("; ")}`);
  }
  if (announcements.length > 0) {
    reasons.push("announcement-recorded");
    const rendered = announcements.slice(0, 3).map(announcementCode);
    details.push(`announcements recorded: ${rendered.join(", ")}`);
  }
  const sources: SourceDraft[] = [
    ...configSources,
    { source: "provider-credential", outcome: "read" },
    { source: "provider-parks", outcome: "read" },
    {
      source: "provider-announcements",
      outcome: announcements.length === 0 ? "observed-empty" : "read",
    },
  ];
  const baseDetail =
    details.length === 0
      ? "provider chain and credentials resolve; no active park"
      : details.join("; ");
  const hold = provider.ownerHold;
  if (hold?.active === true) {
    return check(
      "provider",
      "ok",
      appendOwnerHoldDetail(baseDetail, hold),
      buildEvidence(sources, [...reasons, "owner-hold"]),
    );
  }
  return check("provider", "ok", baseDetail, buildEvidence(sources, reasons));
};

/* --------------------------------- state --------------------------------- */

const stateCheck = (state: DoctorStateStoresRead): DoctorCheck => {
  if (state.ok) {
    const stores = state.stores ?? [];
    const names = stores.map((store) => `${store.name}:${store.verdict}`).join(", ");
    return check(
      "state",
      "ok",
      `${state.verifiedEmpty ? "state stores verified empty" : `state stores verified (${String(state.recordCount)} records)`}${names.length === 0 ? "" : ` [${names}]`}`,
      buildEvidence(
        [{ source: "state-stores", outcome: state.verifiedEmpty ? "observed-empty" : "read" }],
        [state.verifiedEmpty ? "observed-empty" : "observed"],
      ),
    );
  }
  switch (state.reason) {
    case "store-torn":
      return check(
        "state",
        "fail",
        "a state store is torn and cannot be treated as empty",
        buildEvidence([{ source: "state-stores", outcome: "failed" }], ["store-torn"], {
          ...(state.failureCode === undefined ? {} : { failureCode: state.failureCode }),
        }),
        "state.store-torn",
      );
    case "store-schema-mismatch":
      return check(
        "state",
        "fail",
        "a state store schema version is not supported",
        buildEvidence([{ source: "state-stores", outcome: "failed" }], ["store-schema-mismatch"], {
          ...(state.failureCode === undefined ? {} : { failureCode: state.failureCode }),
        }),
        "state.store-schema-mismatch",
      );
    case "store-unreadable":
      return check(
        "state",
        "fail",
        "a state store could not be read because of a permission failure",
        buildEvidence([{ source: "state-stores", outcome: "failed" }], ["store-unreadable"], {
          ...(state.failureCode === undefined ? {} : { failureCode: state.failureCode }),
        }),
        "state.store-unreadable",
      );
    case "store-unknown":
      return check(
        "state",
        "fail",
        "a state store carries an undeclared record kind or payload schema",
        buildEvidence([{ source: "state-stores", outcome: "failed" }], ["store-unknown"], {
          ...(state.failureCode === undefined ? {} : { failureCode: state.failureCode }),
        }),
        "state.store-unknown",
      );
    case "unreadable":
      return check(
        "state",
        "unreachable",
        "state store facts are unreadable beyond classified conditions",
        buildEvidence([{ source: "state-stores", outcome: "failed" }], ["check-unreachable"], {
          ...(state.failureCode === undefined ? {} : { failureCode: state.failureCode }),
        }),
        "doctor.check.state.unreachable",
        { area: "state" },
      );
  }
};

/* ------------------------------- derivation ------------------------------- */

const deriveCheck = (facts: DoctorAreaFacts, inputs: DoctorCheckInputs): DoctorCheck => {
  switch (facts.area) {
    case "repo":
      return repoCheck(facts.checkout);
    case "tracker":
      return trackerCheck(facts.tracker, inputs.repository);
    case "provider":
      return providerCheck(facts.provider, inputs.nowMs);
    case "state":
      return stateCheck(facts.state);
    case "ci":
      return ciCheck(facts.ci, inputs.repository);
  }
};

/* ------------------------------- public API ------------------------------- */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isReadFacts = (value: unknown): boolean => {
  if (!isObject(value) || typeof value.ok !== "boolean") return false;
  if (value.ok) return typeof value.pageItemCount === "number";
  return typeof value.reason === "string";
};

const isCredentialFacts = (value: unknown): boolean =>
  isObject(value) && typeof value.ok === "boolean";

const isAreaFactsShape = (facts: unknown, area: DoctorArea): boolean => {
  if (!isObject(facts) || facts.area !== area) return false;
  switch (area) {
    case "repo": {
      const checkout = facts.checkout;
      return (
        isObject(checkout) &&
        typeof checkout.readable === "boolean" &&
        typeof checkout.clean === "boolean" &&
        typeof checkout.detached === "boolean" &&
        isObject(checkout.binding) &&
        typeof checkout.binding.state === "string"
      );
    }
    case "tracker": {
      const tracker = facts.tracker;
      if (!isObject(tracker) || !isCredentialFacts(tracker.credential)) return false;
      return tracker.read === undefined || isReadFacts(tracker.read);
    }
    case "provider": {
      const provider = facts.provider;
      if (!isObject(provider)) return false;
      if (!isObject(provider.config) || typeof provider.config.ok !== "boolean") return false;
      if (!Array.isArray(provider.credentials)) return false;
      return isObject(provider.fold) && typeof provider.fold.ok === "boolean";
    }
    case "state": {
      const state = facts.state;
      if (!isObject(state) || typeof state.ok !== "boolean") return false;
      if (state.ok) {
        return typeof state.verifiedEmpty === "boolean" && typeof state.recordCount === "number";
      }
      return typeof state.reason === "string";
    }
    case "ci": {
      const ci = facts.ci;
      if (!isObject(ci) || !isCredentialFacts(ci.credential)) return false;
      if (!isObject(ci.commit) || typeof ci.commit.resolved !== "boolean") return false;
      return ci.read === undefined || isReadFacts(ci.read);
    }
  }
};

const isMalformedResult = (value: unknown, area: DoctorArea): boolean => {
  if (!isRecord(value)) return true;
  if (value.area !== area) return true;
  if (value.contained === true) {
    return (
      typeof value.detail !== "string" ||
      !(DOCTOR_EVIDENCE_SOURCES as readonly string[]).includes(value.source as string)
    );
  }
  if (value.contained !== false) return true;
  return !isAreaFactsShape(value.facts, area);
};

/**
 * Run one check's collection inside its own containment boundary (F-8).
 *
 * Any thrown value, rejected promise, or malformed intermediate result becomes
 * the area's `unreachable` verdict with `doctor.check.<area>.unreachable`; it
 * never rethrows, never aborts a sibling, and never resolves through
 * `fallback.internal`.
 */
export const runIsolatedDoctorCheck = async (
  area: DoctorArea,
  execute: () => Promise<DoctorCheckResult>,
): Promise<DoctorCheckResult> => {
  let result: unknown;
  try {
    result = await execute();
  } catch {
    return {
      area,
      contained: true,
      detail: `the ${area} check execution failed inside its containment boundary`,
      source: PRIMARY_SOURCE[area],
    };
  }
  if (isMalformedResult(result, area)) {
    return {
      area,
      contained: true,
      detail: `the ${area} check returned a malformed intermediate result`,
      source: PRIMARY_SOURCE[area],
    };
  }
  return result as DoctorCheckResult;
};

/** Aggregate the collected per-check results into the bounded report. */
export const aggregateDoctorReport = (inputs: DoctorCheckInputs): DoctorReport => {
  const byArea = new Map<DoctorArea, DoctorCheckResult>();
  for (const result of inputs.results) {
    if (!byArea.has(result.area)) byArea.set(result.area, result);
  }
  const checks: DoctorCheck[] = DOCTOR_AREAS.map((area): DoctorCheck => {
    const result = byArea.get(area);
    if (result === undefined) {
      return containedCheck(area, `the ${area} check produced no result`, PRIMARY_SOURCE[area]);
    }
    if (result.contained) {
      return containedCheck(area, result.detail, result.source);
    }
    if (result.facts.area !== area) {
      return containedCheck(
        area,
        `the ${area} check produced mismatched facts`,
        PRIMARY_SOURCE[area],
      );
    }
    return deriveCheck(result.facts, inputs);
  });
  const summary: DoctorSummaryCounts = {
    total: DOCTOR_AREAS.length,
    ok: checks.filter((item) => item.verdict === "ok").length,
    fail: checks.filter((item) => item.verdict === "fail").length,
    unreachable: checks.filter((item) => item.verdict === "unreachable").length,
  };
  return {
    schemaVersion: DOCTOR_SCHEMA_VERSION,
    generatedAt: inputs.nowIso,
    repository: inputs.repository,
    checks,
    summary,
  };
};

/** The deterministic DM-7 failure summary naming every failing check (F-9). */
export const formatDoctorFailureSummary = (checks: readonly DoctorCheck[]): string => {
  const failing = DOCTOR_AREAS.flatMap((area) => {
    const found = checks.find((entry) => entry.area === area);
    return found === undefined || found.verdict === "ok" ? [] : [found];
  });
  const rendered = failing.map(
    (entry) =>
      `${entry.area} (${entry.verdict}): ${clampText(
        collapseWhitespace(entry.fixHint ?? ""),
        DOCTOR_MAX_HINT_CHARS,
      )}`,
  );
  return `${DOCTOR_SUMMARY_PREFIX}${String(failing.length)}/5) — ${rendered.join(DOCTOR_SUMMARY_SEPARATOR)}`;
};

/** Render the deterministic human report bounded at 24 lines / 4096 bytes. */
export const renderDoctorHuman = (report: DoctorReport, brand: BrandIdentity): string => {
  const lines: string[] = [];
  if (report.repository.state === "observed") {
    lines.push(`${brand.binaryName} doctor ${report.repository.owner}/${report.repository.name}`);
  }
  for (const area of DOCTOR_AREAS) {
    const entry = report.checks.find((candidate) => candidate.area === area);
    if (entry === undefined) continue;
    lines.push(`${area.padEnd(8)} ${entry.verdict.padEnd(11)} ${entry.detail}`);
  }
  for (const area of DOCTOR_AREAS) {
    const entry = report.checks.find((candidate) => candidate.area === area);
    if (entry === undefined || entry.verdict === "ok" || entry.fixHint === undefined) continue;
    lines.push(`  hint: ${entry.fixHint}`);
  }
  const bounded: string[] = [];
  let bytes = 0;
  for (const line of lines.slice(0, DOCTOR_MAX_HUMAN_LINES - 1)) {
    const lineBytes = new TextEncoder().encode(`${line}\n`).length;
    if (bytes + lineBytes > DOCTOR_MAX_HUMAN_BYTES) break;
    bounded.push(line);
    bytes += lineBytes;
  }
  return `${bounded.join("\n")}\n`;
};
