/**
 * The read-only `doctor` command definition (GH-224 F-1, F-9, F-10, D4, D7).
 *
 * The handler owns no stream write and chooses no exit code. Every source is
 * injected through `DoctorCommandRuntime`; each check runs inside its own
 * containment boundary; shared sources are read once and reused.
 */
import {
  aggregateDoctorReport,
  formatDoctorFailureSummary,
  renderDoctorHuman,
  runIsolatedDoctorCheck,
} from "@delivery-os/core";
import {
  type BrandIdentity,
  type CredentialReference,
  DOCTOR_AREAS,
  DOCTOR_CI_READ_LIMIT,
  DOCTOR_TRACKER_READ_LIMIT,
  type DoctorArea,
  type DoctorCheckoutFacts,
  type DoctorCheckResult,
  type DoctorCiFacts,
  type DoctorCommitResolution,
  type DoctorCredentialPresence,
  type DoctorParkFoldRead,
  type DoctorProviderConfigRead,
  type DoctorProviderCredentialPresence,
  type DoctorReport,
  type DoctorRepositoryBinding,
  type DoctorStateStoresRead,
  type DoctorTrackerFacts,
  type DoctorWiringRead,
} from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";

/** Everything the doctor handler reads, injected at the edge. */
export type DoctorCommandRuntime = {
  readonly readRepository: () => DoctorCheckoutFacts;
  readonly resolveTrackerCredential: () => DoctorCredentialPresence;
  readonly readTrackerPage: (
    target: { readonly owner: string; readonly name: string },
    limit: number,
  ) => Promise<DoctorWiringRead>;
  readonly resolveHeadCommit: () => DoctorCommitResolution;
  readonly readCheckRuns: (sha: string, limit: number) => Promise<DoctorWiringRead>;
  readonly readProviderConfig: () => DoctorProviderConfigRead;
  readonly resolveProviderCredential: (input: {
    readonly providerName: string;
    readonly sourceKey: string;
    readonly reference: CredentialReference;
  }) => DoctorProviderCredentialPresence;
  readonly readParkFold: (nowMs: number) => DoctorParkFoldRead;
  readonly readStateStores: () => DoctorStateStoresRead;
  readonly nowIso: () => string;
  readonly nowMs: () => number;
};

const targetOf = (
  binding: DoctorRepositoryBinding,
): { readonly owner: string; readonly name: string } | undefined =>
  binding.state === "observed" ? { owner: binding.owner, name: binding.name } : undefined;

const sourceKeyDisplay = (reference: CredentialReference, environmentPrefix: string): string =>
  reference.sourceKey.style === "literal"
    ? reference.sourceKey.name
    : `${environmentPrefix}${reference.sourceKey.suffix}`;

/**
 * Build the `doctor` command definition over injected readers.
 *
 * Shared sources (checkout facts, credential presence, HEAD, provider config,
 * store truth) are memoized so one run reads them once.
 */
export const createDoctorCommandDefinition = (
  runtime: DoctorCommandRuntime,
  environmentPrefix = "",
): CommandDefinition => {
  let checkoutCache: DoctorCheckoutFacts | undefined;
  let credentialCache: DoctorCredentialPresence | undefined;
  let headCache: DoctorCommitResolution | undefined;
  let providerConfigCache: DoctorProviderConfigRead | undefined;
  let foldCache: DoctorParkFoldRead | undefined;
  let stateCache: DoctorStateStoresRead | undefined;

  const readCheckout = async (): Promise<DoctorCheckoutFacts> => {
    checkoutCache ??= await runtime.readRepository();
    return checkoutCache;
  };
  const readCredential = async (): Promise<DoctorCredentialPresence> => {
    credentialCache ??= await runtime.resolveTrackerCredential();
    return credentialCache;
  };
  const readHead = async (): Promise<DoctorCommitResolution> => {
    headCache ??= await runtime.resolveHeadCommit();
    return headCache;
  };
  const readProviderConfig = async (): Promise<DoctorProviderConfigRead> => {
    providerConfigCache ??= await runtime.readProviderConfig();
    return providerConfigCache;
  };
  const readFold = async (nowMs: number): Promise<DoctorParkFoldRead> => {
    foldCache ??= await runtime.readParkFold(nowMs);
    return foldCache;
  };
  const readState = async (): Promise<DoctorStateStoresRead> => {
    stateCache ??= await runtime.readStateStores();
    return stateCache;
  };

  const collectRepo = async (): Promise<DoctorCheckResult> => ({
    area: "repo",
    contained: false,
    facts: { area: "repo", checkout: await readCheckout() },
  });

  const collectTracker = async (): Promise<DoctorCheckResult> => {
    const checkout = await readCheckout();
    const credential = await readCredential();
    const target = targetOf(checkout.binding);
    const read =
      target === undefined || !credential.ok
        ? undefined
        : await runtime.readTrackerPage(target, DOCTOR_TRACKER_READ_LIMIT);
    const tracker: DoctorTrackerFacts = {
      credential,
      ...(read === undefined ? {} : { read }),
    };
    return { area: "tracker", contained: false, facts: { area: "tracker", tracker } };
  };

  const collectProvider = async (nowMs: number): Promise<DoctorCheckResult> => {
    const config = await readProviderConfig();
    const credentials: DoctorProviderCredentialPresence[] = [];
    if (config.ok) {
      const { entries, credentials: declaredCredentials } = config.config;
      for (const entry of Object.values(entries).sort((left, right) =>
        left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
      )) {
        if (!entry.enabled || entry.quota === undefined) continue;
        const declared = declaredCredentials[entry.quota.credentialRef];
        if (declared === undefined) continue;
        const reference: CredentialReference = {
          referenceName: entry.quota.credentialRef,
          sourceKey: declared.sourceKey,
        };
        credentials.push(
          runtime.resolveProviderCredential({
            providerName: entry.name,
            sourceKey: sourceKeyDisplay(reference, environmentPrefix),
            reference,
          }),
        );
      }
    }
    return {
      area: "provider",
      contained: false,
      facts: {
        area: "provider",
        provider: { config, credentials, fold: await readFold(nowMs) },
      },
    };
  };

  const collectState = async (): Promise<DoctorCheckResult> => ({
    area: "state",
    contained: false,
    facts: { area: "state", state: await readState() },
  });

  const collectCi = async (): Promise<DoctorCheckResult> => {
    const checkout = await readCheckout();
    const credential = await readCredential();
    const head = await readHead();
    const target = targetOf(checkout.binding);
    const read =
      target === undefined || !credential.ok || !head.resolved || head.sha === undefined
        ? undefined
        : await runtime.readCheckRuns(head.sha, DOCTOR_CI_READ_LIMIT);
    const ci: DoctorCiFacts = {
      credential,
      commit: head,
      ...(read === undefined ? {} : { read }),
    };
    return { area: "ci", contained: false, facts: { area: "ci", ci } };
  };

  const collect = async (area: DoctorArea, nowMs: number): Promise<DoctorCheckResult> => {
    switch (area) {
      case "repo":
        return collectRepo();
      case "tracker":
        return collectTracker();
      case "provider":
        return collectProvider(nowMs);
      case "state":
        return collectState();
      case "ci":
        return collectCi();
    }
  };

  return {
    flags: [],
    positionals: { max: 0 },
    humanText: (data: unknown, brand: BrandIdentity): string =>
      renderDoctorHuman(data as DoctorReport, brand),
    humanFailureText: (error: unknown, brand: BrandIdentity): string | undefined => {
      if (typeof error !== "object" || error === null || !("report" in error)) return undefined;
      const report = (error as { readonly report?: DoctorReport }).report;
      return report === undefined ? undefined : renderDoctorHuman(report, brand);
    },
    handler: async () => {
      const nowIso = runtime.nowIso();
      const nowMs = runtime.nowMs();
      const results: DoctorCheckResult[] = [];
      for (const area of DOCTOR_AREAS) {
        results.push(await runIsolatedDoctorCheck(area, () => collect(area, nowMs)));
      }
      const repository: DoctorRepositoryBinding = checkoutCache?.binding ?? {
        state: "unavailable",
        reason: "checkout-unreadable",
      };
      const report = aggregateDoctorReport({ nowIso, nowMs, repository, results });
      if (report.summary.ok === DOCTOR_AREAS.length) {
        return { data: report };
      }
      return {
        error: {
          kind: "doctor",
          code: "doctor.check.failed",
          summary: formatDoctorFailureSummary(report.checks),
          report,
        },
      };
    },
  };
};
