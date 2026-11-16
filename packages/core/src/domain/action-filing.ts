/**
 * The five-field filing gate (GH-287 F-1, F-2, F-5; DEC-6, DEC-8).
 *
 * Pure validation: the filing contract is all-or-nothing, a missing member and a
 * present-but-non-conforming member share the one filing identity, and the
 * refusal always names the offending field. Dates and ids arrive from the caller
 * (the injected clock and id factory); nothing here reads time, randomness, or
 * the environment.
 */
import {
  ACTION_CONTRACT_FIELDS,
  ACTION_FREE_TEXT_BOUNDS,
  ACTION_MAX_OWNER_CHARS,
  ACTION_MAX_REF_CHARS,
  ACTION_MAX_WINDOW_CHARS,
  ACTION_OWNER_KINDS,
  ACTION_REFUSED_OWNER_KINDS,
  ACTION_REFUSED_VERBS,
  ACTION_TRACKER_CORROBORATION_STATES,
  ACTION_VERBS,
  type ActionOwnerKind,
  type ActionTrackerCorroboration,
  type ActionVerb,
  RETRO_ACTION_PAYLOAD_SCHEMA,
  RETRO_DEFAULT_LEVEL,
  type RetroActionCommandOutcome,
  type RetroActionDraft,
  type RetroActionFailure,
  type RetroActionRecord,
  type RetroActionRegistryPort,
  type RetroActionRegistrySnapshot,
} from "#contracts";
import { type ActionWindowEntry, windowAtLimit, windowDisclosure } from "./action-window.js";

/**
 * The declared placeholder tracker tokens the filing gate refuses (DEC-8): a
 * place or stand-in literal is not a real tracker entry.
 */
export const ACTION_PLACEHOLDER_TRACKER_TOKENS = [
  "none",
  "null",
  "n/a",
  "na",
  "tbd",
  "todo",
  "placeholder",
  "unknown",
  "-",
  "example",
] as const;

/** One filing validation outcome: the record, or the classified refusal. */
export type ActionFilingValidation =
  | { readonly ok: true; readonly value: RetroActionRecord }
  | { readonly ok: false; readonly error: RetroActionFailure };

const isFilled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const refusal = (field: string, detail: string): ActionFilingValidation => ({
  ok: false,
  error: {
    kind: "retro",
    code: "retro.action-incomplete",
    consequence: "not_landed",
    location: { field },
    summary: `retro.action-incomplete: ${detail}`,
  },
});

const tooLong = (value: string, bound: number): boolean => value.length > bound;

const isVerb = (value: string): value is ActionVerb =>
  (ACTION_VERBS as readonly string[]).includes(value);

const isOwnerKind = (value: string): value is ActionOwnerKind =>
  (ACTION_OWNER_KINDS as readonly string[]).includes(value);

const isCorroboration = (value: string): value is ActionTrackerCorroboration =>
  (ACTION_TRACKER_CORROBORATION_STATES as readonly string[]).includes(value);

const isPlaceholderTracker = (value: string): boolean =>
  (ACTION_PLACEHOLDER_TRACKER_TOKENS as readonly string[]).includes(value.trim().toLowerCase());

/**
 * Validate one filing against the contract and return the record that may land.
 *
 * `filedAt` is the injected clock instant and `actionId` the injected identity;
 * both are recorded verbatim so aging stays a pure function of recorded data.
 */
export const validateActionFiling = (
  draft: RetroActionDraft,
  context: { readonly actionId: string; readonly filedAt: number },
): ActionFilingValidation => {
  for (const field of ACTION_CONTRACT_FIELDS) {
    if (field === "outcomeVerifier") {
      const verifier = draft.outcomeVerifier;
      if (verifier === undefined) return refusal("outcomeVerifier", "missing outcomeVerifier");
      if (
        !isFilled(verifier.evidence) ||
        !isFilled(verifier.windowStart) ||
        !isFilled(verifier.windowEnd)
      ) {
        return refusal(
          "outcomeVerifier",
          "outcomeVerifier needs evidence and a non-null delayed metric window",
        );
      }
      continue;
    }
    const value = draft[field];
    if (!isFilled(value)) return refusal(field, `missing ${field}`);
  }

  const owner = draft.owner ?? "";
  if (tooLong(owner, ACTION_MAX_OWNER_CHARS)) {
    return refusal("owner", `owner exceeds ${String(ACTION_MAX_OWNER_CHARS)} characters`);
  }
  const ownerKind = draft.ownerKind ?? "";
  if ((ACTION_REFUSED_OWNER_KINDS as readonly string[]).includes(ownerKind)) {
    return refusal("owner", "a team-owned action is invalid; name one agent role or one human");
  }
  if (!isOwnerKind(ownerKind)) {
    return refusal("owner", "owner must be an agent-role or human owner");
  }

  const verb = draft.verb ?? "";
  if ((ACTION_REFUSED_VERBS as readonly string[]).includes(verb)) {
    return refusal("verb", `"${verb}" is unverifiable; use add/remove/change/test/deploy`);
  }
  if (!isVerb(verb)) {
    return refusal("verb", "verb is outside the closed vocabulary add/remove/change/test/deploy");
  }

  const outcome = draft.measurableOutcome ?? "";
  if (tooLong(outcome, ACTION_FREE_TEXT_BOUNDS.measurableOutcome)) {
    return refusal(
      "measurableOutcome",
      `measurableOutcome exceeds ${String(ACTION_FREE_TEXT_BOUNDS.measurableOutcome)} characters`,
    );
  }

  const trackerEntry = draft.trackerEntry ?? "";
  if (tooLong(trackerEntry, ACTION_MAX_REF_CHARS)) {
    return refusal(
      "trackerEntry",
      `trackerEntry exceeds ${String(ACTION_MAX_REF_CHARS)} characters`,
    );
  }
  if (isPlaceholderTracker(trackerEntry)) {
    return refusal("trackerEntry", "trackerEntry is a placeholder, not a real tracker entry");
  }

  const dueDate = draft.dueDate ?? "";
  if (tooLong(dueDate, ACTION_MAX_REF_CHARS)) {
    return refusal("dueDate", `dueDate exceeds ${String(ACTION_MAX_REF_CHARS)} characters`);
  }

  const artifact = draft.verificationArtifact ?? "";
  if (tooLong(artifact, ACTION_MAX_REF_CHARS)) {
    return refusal(
      "verificationArtifact",
      `verificationArtifact exceeds ${String(ACTION_MAX_REF_CHARS)} characters`,
    );
  }

  const rollback = draft.rollbackCondition ?? "";
  if (tooLong(rollback, ACTION_FREE_TEXT_BOUNDS.rollbackCondition)) {
    return refusal(
      "rollbackCondition",
      `rollbackCondition exceeds ${String(ACTION_FREE_TEXT_BOUNDS.rollbackCondition)} characters`,
    );
  }

  const window = draft.window ?? draft.level ?? RETRO_DEFAULT_LEVEL;
  if (window.length > ACTION_MAX_WINDOW_CHARS) {
    return refusal("window", `window exceeds ${String(ACTION_MAX_WINDOW_CHARS)} characters`);
  }

  const corroboration = draft.trackerCorroboration ?? "unverified";
  const lapses = draft.dueDateLapses ?? [];
  return {
    ok: true,
    value: {
      schemaId: RETRO_ACTION_PAYLOAD_SCHEMA,
      actionId: context.actionId,
      owner,
      ownerKind,
      verb,
      measurableOutcome: outcome,
      trackerEntry,
      trackerCorroboration: isCorroboration(corroboration) ? corroboration : "unverified",
      dueDate,
      dueDateLapses: [...lapses],
      verificationArtifact: artifact,
      outcomeVerifier: draft.outcomeVerifier as RetroActionRecord["outcomeVerifier"],
      rollbackCondition: rollback,
      level: draft.level ?? RETRO_DEFAULT_LEVEL,
      window,
      filedAt: context.filedAt,
    },
  };
};

/** Whether an action's artifact plane is still open (no closing decision recorded). */
export const actionArtifactPlaneOpen = (
  actionId: string,
  snapshot: RetroActionRegistrySnapshot,
): boolean =>
  !snapshot.closures.some(
    (closure) => closure.actionId === actionId && closure.artifactClosure === "closed",
  );

/** The recorded actions as window-membership entries, derived from the records. */
export const actionWindowEntries = (
  snapshot: RetroActionRegistrySnapshot,
): readonly ActionWindowEntry[] =>
  snapshot.actions.map((action) => ({
    window: action.window,
    open: actionArtifactPlaneOpen(action.actionId, snapshot),
  }));

/** The classified WIP refusal naming the window, its open count, and its limit. */
const wipRefusal = (
  window: string,
  openCount: number,
  limit: number,
): RetroActionCommandOutcome => ({
  ok: false,
  error: {
    kind: "retro",
    code: "retro.wip-limit-exceeded",
    consequence: "not_landed",
    location: { window, openCount, limit },
    summary: `retro.wip-limit-exceeded: window "${window}" holds ${String(openCount)} open action(s) at its limit of ${String(limit)}`,
  },
});

/**
 * File one action through the injected registry port:
 * validate all-or-nothing, refuse a full window, then append exactly one record.
 */
export const fileRetroAction = (
  port: RetroActionRegistryPort,
  input: {
    readonly draft: RetroActionDraft;
    readonly actionId: string;
    readonly filedAt: number;
    readonly fenceToken: string;
  },
): RetroActionCommandOutcome => {
  const validated = validateActionFiling(input.draft, {
    actionId: input.actionId,
    filedAt: input.filedAt,
  });
  if (!validated.ok) return { ok: false, error: validated.error };
  const record = validated.value;

  const read = port.read();
  if (!read.ok) return { ok: false, error: read.error };
  const entries = actionWindowEntries(read.value);
  if (windowAtLimit(entries, record.window)) {
    const disclosure = windowDisclosure(entries, record.window);
    return wipRefusal(disclosure.window, disclosure.openCount, disclosure.limit);
  }

  const appended = port.appendAction(record, input.fenceToken);
  if (!appended.ok) return { ok: false, error: appended.error };
  return { ok: true, data: { actionId: record.actionId, action: record } };
};
