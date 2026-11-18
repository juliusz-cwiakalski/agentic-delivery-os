/**
 * The GitHub Issues transition map (GH-338 F-6, DM-6, TDR-0035).
 *
 * One injected, seeded `WorkflowMap` drives BOTH read normalization and the
 * mechanism-scoped transition write, so the two directions can never disagree.
 * Nothing here is exported from the `./github` subpath except the seed the
 * reference-behavior drift check compares against; the validator and the
 * resolvers are adapter-internal.
 *
 * Tokens are either a native issue state (`open`, `closed`) or a lifecycle
 * label name exactly as the provider spells it. Rows are declared in
 * precedence order; the order is load-bearing for read resolution.
 */
import type {
  DeliveryStateAlias,
  WorkflowMap,
  WorkflowStateMapping,
  WorkflowTransitionMechanism,
} from "@delivery-os/core/contracts";

/** The closed delivery-alias set a row may declare. */
const DELIVERY_ALIASES: readonly DeliveryStateAlias[] = [
  "backlog",
  "ready",
  "in-progress",
  "in-review",
  "done",
  "canceled",
] as const;

/** The core mechanism set; GitHub can perform only `field-update` and `label-swap`. */
const TRANSITION_MECHANISMS: readonly WorkflowTransitionMechanism[] = [
  "api-transition",
  "field-update",
  "label-swap",
  "manual",
] as const;

/**
 * The declared four-row seed (this repository's lifecycle label conventions).
 *
 * Precedence: `closed` -> `done` (field update), `review` -> `in-review` (label
 * swap), `in-progress` -> `in-progress` (label swap), `open` -> `ready` (field
 * update). A project supplies its own map through construction data.
 */
export const GITHUB_WORKFLOW_MAP_SEED: WorkflowMap = {
  systemName: "github",
  states: [
    { nativeStatus: "closed", deliveryState: "done", transitionMechanism: "field-update" },
    { nativeStatus: "review", deliveryState: "in-review", transitionMechanism: "label-swap" },
    {
      nativeStatus: "in-progress",
      deliveryState: "in-progress",
      transitionMechanism: "label-swap",
    },
    { nativeStatus: "open", deliveryState: "ready", transitionMechanism: "field-update" },
  ],
};

/** The validation outcome; a failure names the failed check and the offending row. */
export type GithubWorkflowMapValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly detail: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

const isDeliveryAlias = (value: unknown): value is DeliveryStateAlias =>
  typeof value === "string" && (DELIVERY_ALIASES as readonly string[]).includes(value);

const isMechanism = (value: unknown): value is WorkflowTransitionMechanism =>
  typeof value === "string" && (TRANSITION_MECHANISMS as readonly string[]).includes(value);

/**
 * Validate a resolved map against TDR-0035 §1's seven-rule rejection set.
 *
 * Never throws: the construction call captures the returned failure and every
 * operation then refuses with zero provider requests. The seed is held to
 * exactly the same checks as an injected map.
 */
export const validateGithubWorkflowMap = (value: unknown): GithubWorkflowMapValidation => {
  if (!isRecord(value)) {
    return { ok: false, detail: "workflow map is not an object" };
  }
  if (!nonEmptyString(value.systemName)) {
    return { ok: false, detail: "workflow map systemName is not a non-empty string" };
  }
  if (!Array.isArray(value.states) || value.states.length === 0) {
    return { ok: false, detail: "workflow map states is not a non-empty array" };
  }

  const tokens = new Set<string>();
  const aliases = new Set<string>();
  let doneRow: WorkflowStateMapping | undefined;

  for (const [index, raw] of value.states.entries()) {
    const label = `workflow map row ${index}`;
    if (!isRecord(raw)) {
      return { ok: false, detail: `${label}: row is not an object` };
    }
    if (!nonEmptyString(raw.nativeStatus)) {
      return { ok: false, detail: `${label}: nativeStatus is not a non-empty string` };
    }
    if (tokens.has(raw.nativeStatus)) {
      return {
        ok: false,
        detail: `${label}: duplicate native status token "${raw.nativeStatus}"`,
      };
    }
    tokens.add(raw.nativeStatus);
    if (!isDeliveryAlias(raw.deliveryState)) {
      return {
        ok: false,
        detail: `${label}: deliveryState "${String(raw.deliveryState)}" is outside the closed set`,
      };
    }
    if (!isMechanism(raw.transitionMechanism)) {
      return {
        ok: false,
        detail: `${label}: transitionMechanism "${String(raw.transitionMechanism)}" is outside the closed set`,
      };
    }
    if (aliases.has(raw.deliveryState)) {
      return {
        ok: false,
        detail: `${label}: duplicate delivery alias "${raw.deliveryState}"`,
      };
    }
    aliases.add(raw.deliveryState);
    if (raw.deliveryState === "done") {
      doneRow = {
        nativeStatus: raw.nativeStatus,
        deliveryState: raw.deliveryState,
        transitionMechanism: raw.transitionMechanism,
      };
    }
  }

  if (doneRow === undefined) {
    return { ok: false, detail: "workflow map declares no row resolving to done" };
  }
  if (doneRow.transitionMechanism !== "field-update" || doneRow.nativeStatus !== "closed") {
    return {
      ok: false,
      detail:
        'workflow map done row must be the "field-update" row on the native issue state "closed"',
    };
  }
  return { ok: true };
};

/** The declared `label-swap` tokens; the only labels a label write may touch. */
export const githubLabelSwapTokens = (map: WorkflowMap): readonly string[] =>
  map.states
    .filter((row) => row.transitionMechanism === "label-swap")
    .map((row) => row.nativeStatus);

/** The writable aliases: `done` plus each declared `label-swap` row's alias. */
export const githubWritableAliases = (map: WorkflowMap): readonly DeliveryStateAlias[] => {
  const writable = new Set<DeliveryStateAlias>();
  for (const row of map.states) {
    if (row.deliveryState === "done" || row.transitionMechanism === "label-swap") {
      writable.add(row.deliveryState);
    }
  }
  return [...writable];
};

/** A successful resolution names the winning row; a failure names the cause. */
export type GithubWorkflowResolution =
  | { readonly ok: true; readonly row: WorkflowStateMapping }
  | { readonly ok: false; readonly detail: string };

/**
 * Resolve one issue read: one refusal class, four declared outcomes (§3.1).
 *
 * `labels` absent means the label container was not observed. A read never
 * refuses on an unavailable signal, an unknown label, or a labelless issue;
 * only the absence of a native-state row refuses.
 */
export const resolveGithubReadStatus = (input: {
  readonly map: WorkflowMap;
  readonly nativeStatus: string;
  readonly labels?: readonly string[];
}): GithubWorkflowResolution => {
  const { map, nativeStatus, labels } = input;
  const doneRow = map.states.find((row) => row.deliveryState === "done");

  // Rule 1 — terminal native state first; terminal truth never hides behind a label.
  if (nativeStatus === "closed") {
    if (doneRow === undefined) {
      return { ok: false, detail: `GitHub issue state "closed" has no workflow-map row` };
    }
    return { ok: true, row: doneRow };
  }

  if (labels !== undefined) {
    // Rule 2 — first declared-precedence row whose token matches a label exactly.
    for (const row of map.states) {
      if (labels.includes(row.nativeStatus)) return { ok: true, row };
    }
    // Rule 3 — a case collision with a declared `label-swap` token is visible.
    for (const label of labels) {
      for (const row of map.states) {
        if (row.transitionMechanism !== "label-swap") continue;
        if (label === row.nativeStatus) continue;
        if (label.toLowerCase() === row.nativeStatus.toLowerCase()) {
          return {
            ok: false,
            detail: `GitHub issue label "${label}" collides by case with the declared label-swap token "${row.nativeStatus}"`,
          };
        }
      }
    }
  }

  // Rule 4 — the native-state row (the delivered mapping).
  const nativeRow = map.states.find((row) => row.nativeStatus === nativeStatus);
  if (nativeRow !== undefined) return { ok: true, row: nativeRow };

  // Rule 5 — only a missing native-state row refuses a read.
  return { ok: false, detail: `GitHub issue state "${nativeStatus}" has no workflow-map row` };
};

/** The current-read facts a `label-swap` transition must be resolved against. */
export type GithubTransitionCurrentRead = {
  readonly deliveryState: DeliveryStateAlias;
  /** Absent means the label container was not observed (an unavailable signal). */
  readonly labels?: readonly string[];
};

/** The planned write: provider state only, or exactly one label array. */
export type GithubTransitionPlan =
  | {
      readonly ok: true;
      readonly write:
        | { readonly kind: "field-update"; readonly nativeStatus: string }
        | { readonly kind: "label-swap"; readonly labels: readonly string[] };
    }
  | { readonly ok: false; readonly detail: string };

/**
 * Plan one transition through the single map (§3.2), with zero provider I/O.
 *
 * `field-update` rows write provider state only and admit ONLY the terminal
 * `done` row, so the delivered closeout write keeps its one state-only PATCH
 * and gains no label access or refusal. `label-swap` rows require the caller's
 * current-read facts; the terminal-read refusal and the unavailable-signal
 * refusal are distinct, both issue zero requests, and neither can be satisfied
 * by the other.
 */
export const planGithubTransition = (input: {
  readonly map: WorkflowMap;
  readonly deliveryState: DeliveryStateAlias;
  readonly current?: GithubTransitionCurrentRead;
}): GithubTransitionPlan => {
  const { map, deliveryState, current } = input;
  const row = map.states.find((candidate) => candidate.deliveryState === deliveryState);
  if (row === undefined) {
    return {
      ok: false,
      detail: `GitHub transition alias "${deliveryState}" is not declared by the workflow map`,
    };
  }

  if (row.transitionMechanism === "field-update") {
    if (row.deliveryState !== "done") {
      return {
        ok: false,
        detail: `GitHub transition alias "${deliveryState}" is read-only: its "field-update" row targets the non-terminal native state "${row.nativeStatus}"`,
      };
    }
    return { ok: true, write: { kind: "field-update", nativeStatus: row.nativeStatus } };
  }

  if (row.transitionMechanism !== "label-swap") {
    return {
      ok: false,
      detail: `GitHub transition alias "${deliveryState}" uses the unsupported "${row.transitionMechanism}" mechanism`,
    };
  }

  if (current === undefined) {
    return {
      ok: false,
      detail: `GitHub label-swap transition to "${deliveryState}" requires the issue's current read`,
    };
  }
  if (current.deliveryState === "done") {
    return {
      ok: false,
      detail: `GitHub label-swap transition to "${deliveryState}" is refused: the issue's current read resolves to done`,
    };
  }
  if (current.labels === undefined) {
    return {
      ok: false,
      detail: `GitHub label-swap transition to "${deliveryState}" is refused: the current label signal is unavailable`,
    };
  }

  const declared = new Set(githubLabelSwapTokens(map));
  const kept = current.labels.filter((label) => !declared.has(label));
  const labels = kept.includes(row.nativeStatus) ? kept : [...kept, row.nativeStatus];
  return { ok: true, write: { kind: "label-swap", labels } };
};
