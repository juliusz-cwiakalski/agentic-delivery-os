/**
 * The pure agent-to-seat resolution, the surface mapping, and the expressibility
 * predicate (GH-335 F-3; DEC-6, DEC-13, DEC-14, DEC-16, TDR-0040).
 *
 * One spawn binds exactly one seat. The agent identity is the caller-supplied
 * value carried on the spawn/resume input's own optional member; this module
 * invents none, reads no configuration key, environment variable, or ambient
 * state for one, and is called by the composition and by nobody else in
 * production. A present empty or whitespace-only identity is never the
 * `no-agent` state and never resolves a seat: the caller refuses it before
 * resolution (DEC-17).
 *
 * The expressibility predicate is an in-process grammar/bounds check. There is
 * no recognised-agent or recognised-model catalogue anywhere, and no second
 * pre-session child process (DEC-14).
 */
import {
  HARNESS_MODEL_EXPRESSION_MAX_CHARS,
  type HarnessSeatBinding,
  type ProfileSelectionDecision,
  type ProviderProfile,
  type ProviderProfileSeat,
} from "#contracts";

/** The closed resolution outcomes (TDR-0040 decision 2, A-1, A-2). */
export type HarnessBindingResolution =
  | { readonly outcome: "binding"; readonly binding: HarnessSeatBinding }
  | { readonly outcome: "no-agent" }
  | { readonly outcome: "unassigned"; readonly agent: string };

/** The resolved profile's seat and override view the resolution reads. */
export type HarnessProfileView = Pick<ProviderProfile, "seats" | "agentOverrides">;

/** The selection's override and seat-model view the resolution reads. */
export type HarnessSelectionView = Pick<ProfileSelectionDecision, "agentOverrides" | "seatModels">;

/** A classified invalid agent identity (DEC-17); refused before any resolution. */
export type HarnessAgentIdentityViolation = {
  readonly code: "config.value.invalid";
  readonly field: string;
  readonly summary: string;
};

/**
 * The present-but-not-a-name identity check.
 *
 * Absence is `no-agent`; a present empty or whitespace-only value is invalid
 * input. Only the member's ABSENCE is the role-less state.
 */
export const harnessAgentIdentityViolation = (
  agent?: string,
): HarnessAgentIdentityViolation | undefined => {
  if (agent === undefined) return undefined;
  if (agent.trim().length > 0) return undefined;
  return {
    code: "config.value.invalid",
    field: "agent",
    summary: "the agent identity is empty or whitespace-only",
  };
};

const singleSeatName = (
  seats: Readonly<Record<string, ProviderProfileSeat>>,
): string | undefined => {
  const names = Object.keys(seats);
  return names.length === 1 ? names[0] : undefined;
};

/**
 * Resolve exactly one seat for a caller-supplied agent identity.
 *
 * The chain is `agentOverrides[agent]`, else the seat whose name equals the
 * agent, else the profile's single declared seat. A named agent the profile
 * assigns no seat is `unassigned`. A spawn that names no agent binds nothing,
 * whatever the seat count.
 */
export const resolveBinding = (
  profile: HarnessProfileView,
  selection: HarnessSelectionView,
  agent?: string,
): HarnessBindingResolution => {
  if (agent === undefined) return { outcome: "no-agent" };
  if (agent.trim().length === 0) return { outcome: "unassigned", agent };
  const override = selection.agentOverrides[agent] ?? profile.agentOverrides[agent];
  const seatName =
    override ??
    (Object.hasOwn(profile.seats, agent) ? agent : undefined) ??
    singleSeatName(profile.seats);
  if (seatName === undefined || !Object.hasOwn(profile.seats, seatName)) {
    return { outcome: "unassigned", agent };
  }
  const seat = profile.seats[seatName];
  if (seat === undefined) return { outcome: "unassigned", agent };
  const resolvedModel = selection.seatModels[seatName] ?? seat.model;
  return {
    outcome: "binding",
    binding: {
      agent,
      seat: seatName,
      resolvedModel,
      ...(seat.envName === undefined ? {} : { envName: seat.envName }),
    },
  };
};

/** The declared model-expression grammar: `provider/model[#variant]`. */
const MODEL_EXPRESSION =
  /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*(?:#[A-Za-z0-9._-]+)?$/;

/** Whether a resolved model can be expressed on the honoured surface. */
export type HarnessModelExpressibility =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly code: "harness.profile.model-unrepresentable";
      readonly seat: string;
      readonly summary: string;
    };

/**
 * The expressibility predicate: a non-empty provider and model segment, at most
 * one variant separator, no whitespace or control characters, and within the
 * adapter's declared bound. In-process only; no catalogue, no child process.
 */
export const evaluateModelExpressibility = (
  binding: HarnessSeatBinding,
): HarnessModelExpressibility => {
  const model = binding.resolvedModel;
  const expressible =
    model.length > 0 &&
    model.length <= HARNESS_MODEL_EXPRESSION_MAX_CHARS &&
    MODEL_EXPRESSION.test(model);
  if (expressible) return { ok: true };
  return {
    ok: false,
    code: "harness.profile.model-unrepresentable",
    seat: binding.seat,
    summary: `seat ${binding.seat} declares a model the honoured surface cannot express`,
  };
};

/**
 * The per-invocation surface mapping: exactly one `--agent <agent identity>` and
 * exactly one `--model <provider>/<model>[#<variant>]`. The seat name is never
 * sent as `--agent` where the two differ, and the seat itself has no argv
 * carrier.
 */
export const bindingInvocationArgs = (binding: HarnessSeatBinding): readonly string[] => [
  "--agent",
  binding.agent,
  "--model",
  binding.resolvedModel,
];

/**
 * The variable-consuming surface mapping: the declared record entries for
 * declared names only. An undeclared name changes nothing and never widens the
 * allowlist.
 */
export const bindingEnvironmentRecords = (
  binding: HarnessSeatBinding,
): Readonly<Record<string, string>> =>
  binding.envName === undefined ? {} : { [binding.envName]: binding.resolvedModel };
