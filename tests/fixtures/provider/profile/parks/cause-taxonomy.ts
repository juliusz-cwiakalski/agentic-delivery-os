/**
 * GH-377 TC-PROFILE-080/083 — the data-only classification of every declared
 * park cause (spec Appendix A). Counters and machinery live in the test; this
 * module is the independent expectation the structure suite compares.
 */
import type { ParkCause } from "../../../../../packages/core/src/contracts/index";

export type ParkCauseSubject = "provider" | "chain" | "provider-loop";

export type ParkCauseClassification = {
  readonly subject: ParkCauseSubject;
  readonly attributable: boolean;
  /** The eligibility effect, in one sentence. */
  readonly effect: string;
  /** `budget-exhausted` exposes two representations; other causes carry none. */
  readonly scopeEffects?: Readonly<Record<"window" | "ticket", string>>;
  /** A cause never clears a provider park; this flag must stay false. */
  readonly clearsProvider?: boolean;
};

export const PARK_CAUSE_TAXONOMY: Readonly<Record<ParkCause, ParkCauseClassification>> = {
  "peak-window": {
    subject: "provider",
    attributable: true,
    effect: "provider unavailable while active; blocker value peak-window",
  },
  "quota-exhausted": {
    subject: "provider",
    attributable: true,
    effect: "provider unavailable while active; blocker value quota-exhausted",
  },
  "budget-exhausted": {
    subject: "provider",
    attributable: true,
    effect:
      "window scope: park with a durable expiry, consumed as an eligibility input; " +
      "ticket scope: entry failure with no park, not readable by a read-only resolution",
    scopeEffects: {
      window: "consumed-as-eligibility-input",
      ticket: "no-park-not-readable",
    },
  },
  "provider-outage": {
    subject: "provider",
    attributable: true,
    effect: "provider unavailable while active; blocker value provider-outage",
  },
  "credential-missing": {
    subject: "provider",
    attributable: true,
    effect: "provider unavailable while active; blocker value credential-missing",
  },
  "credential-rejected": {
    subject: "provider",
    attributable: true,
    effect: "provider unavailable while active; blocker value credential-rejected",
  },
  "chain-exhausted": {
    subject: "chain",
    attributable: false,
    effect: "no individual provider becomes unavailable; never silently clears a provider park",
  },
  "reevaluation-cap": {
    subject: "provider-loop",
    attributable: false,
    effect: "no individual provider becomes unavailable; never silently clears a provider park",
  },
};
