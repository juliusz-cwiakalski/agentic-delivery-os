/**
 * Explicit closure on the two planes (GH-287 F-4, DM-3; DEC-4, DEC-5, DEC-11).
 *
 * Closure is explicit only: `done` closes the artifact plane and leaves the
 * outcome plane open with its verification window; `deprioritized` and
 * `superseded` close both planes in the one decision (the reason or the
 * superseding reference is each plane's justification, and the window is mooted
 * by the decision); an explicit outcome decision citing in-window verifier
 * evidence is the only other closer. A closure decision targeting an
 * already-closed plane is a state conflict refusing under the same identity and
 * naming the plane plus its existing closure.
 */
import {
  ACTION_CLOSURE_DECISION_FIELD,
  ACTION_CLOSURE_JUSTIFICATION_FIELDS,
  ACTION_CLOSURE_PLANE_FIELDS,
  ACTION_CLOSURE_PLANES,
  ACTION_CLOSURE_ROUTES,
  ACTION_FREE_TEXT_BOUNDS,
  ACTION_LIST_MAX_ROWS,
  ACTION_MAX_MACHINE_BYTES,
  ACTION_OUTCOME_EVIDENCE_FIELD,
  type ActionClosurePlane,
  type ActionClosureRoute,
  RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
  type RetroActionCloseData,
  type RetroActionCloseRequest,
  type RetroActionClosureRecord,
  type RetroActionCommandOutcome,
  type RetroActionFailure,
  type RetroActionListData,
  type RetroActionListEntry,
  type RetroActionPlanes,
  type RetroActionRecord,
  type RetroActionRegistryPort,
  type RetroActionRegistrySnapshot,
} from "#contracts";
import { evaluateActionAging } from "./action-aging.js";
import { actionWindowEntries } from "./action-filing.js";
import { windowDisclosures } from "./action-window.js";

/** The UTF-8 byte length of one serialized value (NFR-2's measured bound). */
const listUtf8Bytes = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const point = character.codePointAt(0) ?? 0;
    if (point <= 0x7f) bytes += 1;
    else if (point <= 0x7ff) bytes += 2;
    else if (point <= 0xffff) bytes += 3;
    else bytes += 4;
  }
  return bytes;
};

const isFilled = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

/** The classified closure refusal (the one closure identity, detail-disjoint). */
const closureRefusal = (
  field: string,
  detail: string,
  extra: { readonly plane?: string; readonly existingClosure?: string } = {},
): { readonly ok: false; readonly error: RetroActionFailure } => ({
  ok: false,
  error: {
    kind: "retro",
    code: "retro.closure-incomplete",
    consequence: "not_landed",
    location: { field, ...extra },
    summary: `retro.closure-incomplete: ${detail}`,
  },
});

/** One closure evaluation: the record an explicit decision would append. */
export type ActionClosureEvaluation =
  | { readonly ok: true; readonly closure: RetroActionClosureRecord }
  | { readonly ok: false; readonly error: RetroActionFailure };

const isRoute = (value: string): value is ActionClosureRoute =>
  (ACTION_CLOSURE_ROUTES as readonly string[]).includes(value);

const isPlane = (value: string): value is ActionClosurePlane =>
  (ACTION_CLOSURE_PLANES as readonly string[]).includes(value);

/** The recorded closures of one action, in append order. */
export const actionClosures = (
  actionId: string,
  snapshot: RetroActionRegistrySnapshot,
): readonly RetroActionClosureRecord[] =>
  snapshot.closures.filter((closure) => closure.actionId === actionId);

/** The verification-window state at the injected instant (open or elapsed). */
export const verificationWindowState = (
  record: RetroActionRecord,
  nowMs: number,
): "open" | "elapsed" => {
  const end = Date.parse(record.outcomeVerifier.windowEnd);
  if (Number.isNaN(end)) return "open";
  return nowMs > end ? "elapsed" : "open";
};

/** The two closure planes plus the window state of one action. */
export const actionPlanes = (
  record: RetroActionRecord,
  snapshot: RetroActionRegistrySnapshot,
  nowMs: number,
): RetroActionPlanes => {
  const closures = actionClosures(record.actionId, snapshot);
  const artifactClosed = closures.some((closure) => closure.artifactClosure === "closed");
  const outcomeClosed = closures.some((closure) => closure.outcomeClosure === "closed");
  const latest = closures[closures.length - 1];
  const windowState =
    latest !== undefined && latest.windowState !== "open"
      ? latest.windowState
      : verificationWindowState(record, nowMs);
  return {
    artifactClosure: artifactClosed ? "closed" : "open",
    outcomeClosure: outcomeClosed ? "closed" : "open",
    windowState,
    closures,
  };
};

/** The closure record an explicit decision would append, or its refusal. */
export const evaluateActionClosure = (
  record: RetroActionRecord,
  snapshot: RetroActionRegistrySnapshot,
  request: RetroActionCloseRequest,
  context: {
    readonly closureId: string;
    readonly decidedAt: number;
    readonly nowMs: number;
  },
): ActionClosureEvaluation => {
  if (!isFilled(request.decision)) {
    return closureRefusal(
      ACTION_CLOSURE_DECISION_FIELD,
      "an explicit decision reference is required",
    );
  }
  const routeToken = request.route ?? "done";
  if (!isRoute(routeToken)) {
    return closureRefusal("route", `unknown closure route "${routeToken}"`);
  }
  const planeToken = request.plane ?? "artifact";
  if (!isPlane(planeToken)) {
    return closureRefusal("plane", `unknown closure plane "${planeToken}"`);
  }
  const route: ActionClosureRoute = routeToken;
  const planes = actionPlanes(record, snapshot, context.nowMs);
  const targetState = planeToken === "artifact" ? planes.artifactClosure : planes.outcomeClosure;
  if (targetState === "closed") {
    const existing = actionClosures(record.actionId, snapshot).find((closure) =>
      planeToken === "artifact"
        ? closure.artifactClosure === "closed"
        : closure.outcomeClosure === "closed",
    );
    const planeField = ACTION_CLOSURE_PLANE_FIELDS[planeToken];
    return closureRefusal(
      planeField,
      `the ${planeToken} plane is already closed by ${existing?.closureId ?? "an earlier decision"}`,
      { plane: planeField, existingClosure: existing?.closureId ?? "" },
    );
  }

  if (planeToken === "outcome") {
    if (planes.artifactClosure === "open") {
      return closureRefusal(
        ACTION_CLOSURE_PLANE_FIELDS.outcome,
        "the outcome plane closes only after the artifact plane",
      );
    }
    if (!isFilled(request.evidence)) {
      return closureRefusal(
        ACTION_OUTCOME_EVIDENCE_FIELD,
        "an outcome decision must cite in-window verifier evidence",
      );
    }
    if (planes.windowState !== "open") {
      return closureRefusal(
        ACTION_OUTCOME_EVIDENCE_FIELD,
        "the cited verifier evidence falls outside the declared verification window",
      );
    }
    const artifactClosure = actionClosures(record.actionId, snapshot).find(
      (closure) => closure.artifactClosure === "closed",
    );
    return {
      ok: true,
      closure: {
        schemaId: RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
        closureId: context.closureId,
        actionId: record.actionId,
        route: artifactClosure?.route ?? "done",
        plane: "outcome",
        decision: request.decision,
        justification: { artifact: request.evidence },
        artifactClosure: "closed",
        outcomeClosure: "closed",
        windowState: "open",
        decidedAt: context.decidedAt,
      },
    };
  }

  const justificationField = ACTION_CLOSURE_JUSTIFICATION_FIELDS[route];
  const justification = request[justificationField];
  if (
    justificationField === "reason" &&
    justification !== undefined &&
    justification.length > ACTION_FREE_TEXT_BOUNDS.closureReason
  ) {
    return closureRefusal(
      "reason",
      `the closure reason exceeds ${String(ACTION_FREE_TEXT_BOUNDS.closureReason)} characters`,
    );
  }
  if (!isFilled(justification)) {
    return closureRefusal(
      justificationField,
      `the ${route} route requires its ${justificationField} as the closure justification`,
    );
  }
  if (
    route === "superseded" &&
    !snapshot.actions.some((action) => action.actionId === justification)
  ) {
    return closureRefusal(
      ACTION_CLOSURE_JUSTIFICATION_FIELDS.superseded,
      `the superseding action "${justification}" is not a recorded action`,
    );
  }
  const bothPlanes = route !== "done";
  const recordedJustification =
    justificationField === "artifact"
      ? { artifact: justification }
      : justificationField === "reason"
        ? { reason: justification }
        : { successor: justification };
  return {
    ok: true,
    closure: {
      schemaId: RETRO_ACTION_CLOSURE_PAYLOAD_SCHEMA,
      closureId: context.closureId,
      actionId: record.actionId,
      route,
      plane: "artifact",
      decision: request.decision,
      justification: recordedJustification,
      artifactClosure: "closed",
      outcomeClosure: bothPlanes ? "closed" : "open",
      windowState: bothPlanes ? "mooted" : verificationWindowState(record, context.nowMs),
      decidedAt: context.decidedAt,
    },
  };
};

/** The bounded `data` payload of one landed closure decision. */
const closeData = (
  record: RetroActionRecord,
  closure: RetroActionClosureRecord,
): RetroActionCloseData => ({
  actionId: record.actionId,
  route: closure.route,
  plane: closure.plane,
  decision: closure.decision,
  artifactClosure: closure.artifactClosure,
  outcomeClosure: closure.outcomeClosure,
  windowState: closure.windowState,
  verificationWindow: record.outcomeVerifier,
});

/**
 * Close one action through the injected registry port: exactly one explicit
 * decision, one appended closure record, and a refusal that transitions nothing
 * when the decision or its justification is missing.
 */
export const closeRetroAction = (
  port: RetroActionRegistryPort,
  request: RetroActionCloseRequest,
  context: {
    readonly closureId: string;
    readonly decidedAt: number;
    readonly nowMs: number;
    readonly fenceToken: string;
  },
): RetroActionCommandOutcome => {
  const read = port.read();
  if (!read.ok) return { ok: false, error: read.error };
  const record = read.value.actions.find((action) => action.actionId === request.actionId);
  if (record === undefined) {
    return closureRefusal("actionId", "no recorded action matches the requested action reference");
  }
  const evaluated = evaluateActionClosure(record, read.value, request, context);
  if (!evaluated.ok) return evaluated;
  const appended = port.appendClosure(evaluated.closure, context.fenceToken);
  if (!appended.ok) return { ok: false, error: appended.error };
  return { ok: true, data: closeData(record, evaluated.closure) };
};

/** One recorded action as a list-surface row. */
export const actionListEntry = (
  record: RetroActionRecord,
  snapshot: RetroActionRegistrySnapshot,
  nowMs: number,
): RetroActionListEntry => {
  const planes = actionPlanes(record, snapshot, nowMs);
  const aging = evaluateActionAging(record, nowMs);
  return {
    actionId: record.actionId,
    owner: record.owner,
    ownerKind: record.ownerKind,
    verb: record.verb,
    level: record.level,
    window: record.window,
    measurableOutcome: record.measurableOutcome,
    trackerEntry: record.trackerEntry,
    trackerCorroboration: record.trackerCorroboration,
    dueDate: record.dueDate,
    dueDateLapses: record.dueDateLapses.length,
    verificationArtifact: record.verificationArtifact,
    outcomeVerifier: record.outcomeVerifier,
    rollbackCondition: record.rollbackCondition,
    filedAt: record.filedAt,
    age: aging.ageMs,
    agingState: aging.state,
    artifactClosure: planes.artifactClosure,
    outcomeClosure: planes.outcomeClosure,
    verificationWindowState: planes.windowState,
  };
};

/**
 * List the recorded actions and every window's count/limit disclosure. An empty
 * registry is an explicit success with `actions: []` and no windows.
 */
export const listRetroActions = (
  port: RetroActionRegistryPort,
  input: { readonly nowMs: number; readonly window?: string },
): RetroActionCommandOutcome => {
  const read = port.read();
  if (!read.ok) return { ok: false, error: read.error };
  const entries = actionWindowEntries(read.value);
  const rows = read.value.actions
    .filter((action) => input.window === undefined || action.window === input.window)
    .slice()
    .sort((left, right) =>
      left.actionId < right.actionId ? -1 : left.actionId > right.actionId ? 1 : 0,
    )
    .map((action) => actionListEntry(action, read.value, input.nowMs));
  const windows = windowDisclosures(
    input.window === undefined ? entries : entries.filter((entry) => entry.window === input.window),
  );
  let kept = rows.slice(0, ACTION_LIST_MAX_ROWS);
  let omitted = rows.length - kept.length;
  const bytesOf = (value: unknown): number => listUtf8Bytes(JSON.stringify(value));
  while (kept.length > 0 && bytesOf({ actions: kept, windows }) > ACTION_MAX_MACHINE_BYTES) {
    kept = kept.slice(0, -1);
    omitted += 1;
  }
  const data: RetroActionListData = {
    actions: kept,
    windows,
    truncated: omitted > 0,
    omitted,
  };
  return { ok: true, data };
};
