/**
 * Provider engine composition (GH-182 PD-G).
 *
 * Pure policy plus injected clock, credential port, quota transport, and sleep
 * seams. The CLI edge wires production implementations; tests wire fakes. No
 * module-level singleton, cache, or side effect exists here.
 */
import {
  type AnnouncementCode,
  type CombinedProviderCondition,
  type CredentialPort,
  type CredentialReference,
  type ProviderAnnouncementRecord,
  type ProviderChain,
  type ProviderClock,
  type ProviderConditionKind,
  type ProviderConditionResult,
  type ProviderConfiguration,
  type ProviderDecision,
  type ProviderDescriptor,
  type ProviderEngineResult,
  type ProviderErrorCode,
  type ProviderParkEvidence,
  type ProviderParkRecord,
  type ProviderQuotaView,
  type ProviderResolveResult,
  type ProviderSleep,
  type QuotaTransport,
} from "#contracts";
import { createParkAnnouncement } from "./announcements.js";
import { resolveProviderChain, type ChainEntryState } from "./chain.js";
import { combineProviderConditions } from "./conditions.js";
import { createParkRecord } from "./parks.js";
import { evaluatePeakWindow } from "./peak.js";
import { evaluateQuotaResponse } from "./quota.js";
import { selectProviderChain, validateProviderConfiguration } from "./validate.js";

export type ProviderEngineDependencies = {
  readonly clock: ProviderClock;
  readonly credentialPort: CredentialPort;
  readonly transport: QuotaTransport;
  readonly sleep: ProviderSleep;
};

export type ProviderEngine = {
  readonly resolve: (input: ProviderResolveInput) => Promise<ProviderResolveResult>;
  readonly quota: (input: ProviderQuotaInput) => Promise<ProviderEngineResult>;
};

export type ProviderResolveInput = {
  readonly config: ProviderConfiguration;
  readonly chainName?: string;
  readonly persist?: boolean;
};

export type ProviderQuotaInput = {
  readonly config: ProviderConfiguration;
  readonly providerName?: string;
};

type EntryEvaluation = {
  readonly descriptor: ProviderDescriptor;
  readonly condition: CombinedProviderCondition;
  readonly park?: ProviderParkRecord;
  readonly announcement?: ProviderAnnouncementRecord;
};

const credentialReference = (
  config: ProviderConfiguration,
  credentialRef: string,
): CredentialReference | undefined => {
  const declared = config.credentials[credentialRef];
  if (declared === undefined) return undefined;
  return { referenceName: credentialRef, sourceKey: declared.sourceKey };
};

const parkedCondition = (
  kind: ProviderConditionKind,
  waitSeconds: number,
  nowMs: number,
  announcementCode: AnnouncementCode,
  evidence: ProviderParkEvidence,
): ProviderConditionResult => ({
  status: "parked",
  kind,
  waitSeconds,
  expiresAtMs: nowMs + waitSeconds * 1_000,
  announcementCode,
  evidence,
});

const evaluateQuotaCondition = async (
  deps: ProviderEngineDependencies,
  config: ProviderConfiguration,
  descriptor: ProviderDescriptor,
  nowMs: number,
): Promise<ProviderConditionResult | undefined> => {
  const quota = descriptor.quota;
  if (quota === undefined || !quota.enabled) return undefined;
  const reference = credentialReference(config, quota.credentialRef);
  if (reference === undefined) {
    return parkedCondition("credential-missing", quota.credentialParkTtlSeconds, nowMs, "provider.credential.missing", {
      conditionKinds: ["credential-missing"],
      waitSeconds: quota.credentialParkTtlSeconds,
      failureClass: "config.credential.missing",
      credentialRefName: quota.credentialRef,
    });
  }
  const resolved = deps.credentialPort.resolve(reference);
  if (!resolved.ok) {
    return parkedCondition("credential-missing", quota.credentialParkTtlSeconds, nowMs, "provider.credential.missing", {
      conditionKinds: ["credential-missing"],
      waitSeconds: quota.credentialParkTtlSeconds,
      failureClass: "config.credential.missing",
      credentialRefName: quota.credentialRef,
    });
  }
  let result;
  try {
    result = await deps.transport.send({
      endpoint: quota.endpoint,
      method: "GET",
      timeoutMs: quota.timeoutMs,
      credential: resolved.material,
    });
  } catch {
    return parkedCondition(
      "provider-outage",
      quota.outageParkTtlSeconds,
      nowMs,
      "provider.quota.unreachable",
      {
        conditionKinds: ["provider-outage"],
        waitSeconds: quota.outageParkTtlSeconds,
        failureClass: "transport",
      },
    );
  }
  const evaluation = evaluateQuotaResponse(result, quota.thresholdPercent, nowMs);
  if (evaluation.status === "clear") return undefined;
  if (evaluation.status === "parked") {
    return {
      status: "parked",
      kind: "quota-exhausted",
      waitSeconds: evaluation.waitSeconds,
      expiresAtMs: evaluation.expiresAtMs,
      announcementCode: "provider.quota.parked",
      evidence: evaluation.evidence,
    };
  }
  if (evaluation.errorCode === "provider.quota.exceeded") {
    return {
      status: "failed",
      kind: "quota-exhausted",
      errorCode: evaluation.errorCode,
      announcementCode: evaluation.announcementCode,
      evidence: { failureClass: evaluation.failureClass, httpStatus: evaluation.httpStatus },
    };
  }
  if (evaluation.errorCode === "provider.auth.rejected") {
    return parkedCondition(
      "credential-rejected",
      quota.credentialParkTtlSeconds,
      nowMs,
      evaluation.announcementCode,
      {
        conditionKinds: ["credential-rejected"],
        waitSeconds: quota.credentialParkTtlSeconds,
        failureClass: evaluation.failureClass,
        httpStatus: evaluation.httpStatus,
      },
    );
  }
  return parkedCondition(
    "provider-outage",
    quota.outageParkTtlSeconds,
    nowMs,
    evaluation.announcementCode,
    {
      conditionKinds: ["provider-outage"],
      waitSeconds: quota.outageParkTtlSeconds,
      failureClass: evaluation.failureClass,
      httpStatus: evaluation.httpStatus,
    },
  );
};

const evaluateEntry = async (
  deps: ProviderEngineDependencies,
  config: ProviderConfiguration,
  descriptor: ProviderDescriptor,
  nowMs: number,
): Promise<EntryEvaluation> => {
  if (!descriptor.enabled) {
    return { descriptor, condition: { status: "clear" } };
  }
  const results: ProviderConditionResult[] = [];
  if (descriptor.peak !== undefined) {
    results.push(evaluatePeakWindow(descriptor.peak, nowMs));
  }
  const quota = await evaluateQuotaCondition(deps, config, descriptor, nowMs);
  if (quota !== undefined) results.push(quota);
  const condition = combineProviderConditions(results);
  if (condition.status !== "parked") return { descriptor, condition };
  const park = createParkRecord({
    subjectKind: "provider",
    subjectName: descriptor.name,
    cause: condition.cause,
    conditions: condition.conditions,
    createdAtMs: nowMs,
    expiresAtMs: condition.expiresAtMs,
    evidence: condition.evidence,
  });
  return {
    descriptor,
    condition,
    park,
    announcement: createParkAnnouncement(park, nowMs),
  };
};

const failure = (
  errorCode: ProviderErrorCode,
  summary: string,
  announcementCode?: AnnouncementCode,
): {
  readonly ok: false;
  readonly errorCode: ProviderErrorCode;
  readonly summary: string;
  readonly announcementCode?: AnnouncementCode;
} => ({
  ok: false,
  errorCode,
  summary,
  ...(announcementCode === undefined ? {} : { announcementCode }),
});

/** Build the pure engine over injected seams. */
export const createProviderEngine = (deps: ProviderEngineDependencies): ProviderEngine => {
  const evaluateAll = async (
    config: ProviderConfiguration,
    names: readonly string[],
    nowMs: number,
  ): Promise<EntryEvaluation[]> => {
    const evaluations: EntryEvaluation[] = [];
    for (const name of names) {
      const descriptor = config.entries[name];
      if (descriptor === undefined) continue;
      evaluations.push(await evaluateEntry(deps, config, descriptor, nowMs));
    }
    return evaluations;
  };

  return {
    async resolve(input: ProviderResolveInput): Promise<ProviderResolveResult> {
      const validation = validateProviderConfiguration(input.config);
      if (validation !== undefined) {
        return failure(validation.code, validation.detail);
      }
      const selection = selectProviderChain(input.config, input.chainName);
      if (!selection.ok) return failure(selection.error.code, selection.error.detail);
      const chain: ProviderChain = selection.chain;
      const nowMs = deps.clock.nowMs();
      const evaluations = await evaluateAll(input.config, chain.entries, nowMs);
      const states: Record<string, ChainEntryState> = {};
      const parks: ProviderParkRecord[] = [];
      const announcements: ProviderAnnouncementRecord[] = [];
      for (const evaluation of evaluations) {
        states[evaluation.descriptor.name] = {
          descriptor: evaluation.descriptor,
          condition: evaluation.condition,
        };
        if (evaluation.condition.status === "failed") {
          return failure(
            evaluation.condition.errorCode,
            `${evaluation.descriptor.name}: ${evaluation.condition.announcementCode}`,
            evaluation.condition.announcementCode,
          );
        }
        if (evaluation.park !== undefined) parks.push(evaluation.park);
        if (evaluation.announcement !== undefined) announcements.push(evaluation.announcement);
      }
      const outcome = resolveProviderChain({ chain, states, nowMs });
      if (!outcome.ok) return failure(outcome.errorCode, outcome.detail, outcome.announcementCode);
      const decision: ProviderDecision = outcome.decision;
      if (decision.kind === "parked") {
        parks.push(decision.park);
        announcements.push(createParkAnnouncement(decision.park, nowMs));
      }
      return {
        ok: true,
        chainName: chain.name,
        decision,
        skipped: outcome.skipped,
        parks,
        announcements,
      };
    },

    async quota(input: ProviderQuotaInput): Promise<ProviderEngineResult> {
      const validation = validateProviderConfiguration(input.config);
      if (validation !== undefined) {
        return failure(validation.code, validation.detail);
      }
      const names =
        input.providerName === undefined
          ? input.config.defaultChain === undefined
            ? Object.keys(input.config.entries)
            : (input.config.chains[input.config.defaultChain]?.entries ?? [])
          : [input.providerName];
      for (const name of names) {
        if (input.config.entries[name] === undefined) {
          return failure("provider.chain.empty", `provider ${name} is not declared`);
        }
      }
      const nowMs = deps.clock.nowMs();
      const evaluations = await evaluateAll(input.config, names, nowMs);
      const views: ProviderQuotaView[] = [];
      const announcements: ProviderAnnouncementRecord[] = [];
      for (const evaluation of evaluations) {
        const condition = evaluation.condition;
        if (condition.status === "failed") {
          return failure(condition.errorCode, `${evaluation.descriptor.name}: ${condition.announcementCode}`, condition.announcementCode);
        }
        if (condition.status === "parked") {
          if (
            condition.cause === "provider-outage" ||
            condition.cause === "credential-missing" ||
            condition.cause === "credential-rejected"
          ) {
            const errorCode =
              condition.cause === "provider-outage"
                ? "provider.outage"
                : condition.cause === "credential-missing"
                  ? "config.credential.missing"
                  : "provider.auth.rejected";
            return failure(
              errorCode,
              `${evaluation.descriptor.name}: ${condition.announcementCode}`,
              condition.announcementCode,
            );
          }
        }
        if (evaluation.park !== undefined) parksPush(views, evaluation, nowMs);
        if (evaluation.announcement !== undefined) announcements.push(evaluation.announcement);
      }
      return { ok: true, providers: views, announcements };
    },
  };
};

const parksPush = (
  views: ProviderQuotaView[],
  evaluation: EntryEvaluation,
  _nowMs: number,
): void => {
  const condition = evaluation.condition;
  if (condition.status === "parked" && evaluation.park !== undefined) {
    views.push({
      providerName: evaluation.descriptor.name,
      status: "parked",
      cause: condition.cause,
      conditions: condition.conditions,
      resumeAt: evaluation.park.expiresAt,
      evidence: condition.evidence,
    });
    return;
  }
  views.push({
    providerName: evaluation.descriptor.name,
    status: "clear",
    conditions: [],
    evidence: {},
  });
};
