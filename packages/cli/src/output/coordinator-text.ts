/**
 * Deterministic, ANSI-free coordinator human text (GH-241 Appendix G).
 *
 * Every renderer is bounded: the status view is at most thirty-two lines and the
 * single-line start/stop/tick receipts carry the declared fields only. No clock,
 * environment, or model call participates.
 */
import {
  COORDINATOR_MAX_HUMAN_LINES,
  type CoordinatorObservation,
} from "@delivery-os/core/contracts";
import type { CoordinatorStopData } from "../commands/coordinator-loop.js";

const idOr = (value: string | null | undefined, fallback = "none"): string => value ?? fallback;

/** The one-line `start` receipt. */
export const renderCoordinatorStarted = (data: CoordinatorObservation): string =>
  `coordinator started  scope=${data.regime.scope}  instance=${idOr(data.instance?.instanceId)}  pid=${data.instance?.pid ?? "-"}  supervisor=${data.regime.supervisorMode}  external-unit=${data.regime.externalUnit}`;

/** The one-line `stop` receipt. */
export const renderCoordinatorStopHuman = (data: CoordinatorStopData): string =>
  `coordinator stopped  instance=${idOr(data.instance?.instanceId)}  requested=${String(data.requested)}  released=${String(data.released)}  state=${data.state}`;

/** The one-line `tick` receipt. */
export const renderCoordinatorTick = (data: CoordinatorObservation): string =>
  [
    "coordinator tick",
    `decision=${data.decision?.kind ?? "none"}`,
    `wake=${data.wake?.outcome ?? "none"}`,
    `stuck=${data.stuck?.verdict ?? "none"}`,
    `tick=${data.tickVerdict?.verdict ?? "none"}`,
    `restarts=${data.restarts.count}/${data.restarts.bound}`,
    `escalation=${data.escalation.state}`,
  ].join("  ");

/**
 * The bounded status block. Lines are emitted in the declared order and the
 * whole block never exceeds the declared line ceiling.
 */
export const renderCoordinatorStatus = (data: CoordinatorObservation): string => {
  const state =
    data.escalation.state === "exhausted-escalation-failed"
      ? "exhausted-escalation-failed"
      : data.escalation.state === "exhausted-escalated"
        ? "exhausted-escalated"
        : data.instance === null
          ? "stopped"
          : data.degradation.length > 0
            ? "degraded"
            : "running";
  const lines = [
    `coordinator ${data.coordinatorId}  state=${state}`,
    `instance   ${idOr(data.instance?.instanceId)}  pid=${data.instance?.pid ?? "-"}  holder=${idOr(data.instance?.holder)}  started=${data.instance?.startedAt ?? "-"}  supervisor=${data.regime.supervisorMode}  external-unit=${data.instance?.externalUnit ?? "none"}`,
    `session    ${idOr(data.session.sessionId)}  liveness=${data.session.liveness}  contextTokens=${data.session.contextTokens ?? "?"}`,
    `decision   ${data.decision?.kind ?? "none"}  reason=${data.decision?.reason ?? "-"}  at=${data.decision?.recordedAt ?? "-"}`,
    `restarts   ${data.restarts.count}/${data.restarts.bound}  epoch=${data.restarts.budgetEpochId}  history=${data.restarts.historyRef}`,
    `stuck      ${data.stuck?.verdict ?? "none"}  phase=${data.stuck?.phase ?? "-"}  reason=${data.stuck?.reason ?? "-"}  evidence=${data.stuck?.evidence ?? "-"}`,
    `tick       verdict=${data.tickVerdict?.verdict ?? "none"}  phase=${data.tickVerdict?.phase ?? "-"}`,
    `wake       ${data.wake?.outcome ?? "none"}  question=${idOr(data.wake?.questionId ?? null)}  askedAt=${data.wake?.askedAt ?? "none"}`,
    `escalation ${data.escalation.state}  question=${idOr(data.escalation.questionId)}`,
    `fence      ${idOr(data.fence?.holder ?? null)}  action=${data.fence?.action ?? "none"}  previous=${idOr(data.fence?.previousHolder ?? null)}  ageMs=${data.fence?.fenceAgeMs ?? "-"}  scope=${data.regime.scope}  supervisor=${data.regime.supervisorMode}  external-unit=${data.regime.externalUnit}`,
  ];
  if (data.degradation.length > 0) lines.push(`degraded   ${data.degradation.join(",")}`);
  return lines.slice(0, COORDINATOR_MAX_HUMAN_LINES).join("\n");
};

/**
 * The renderer the command definition uses: the stop receipt, the tick receipt
 * when a tick verdict is present, or the bounded status block.
 */
export const renderCoordinatorHuman = (data: CoordinatorObservation): string => {
  if (data.tickVerdict !== null) return renderCoordinatorTick(data);
  // A `start` result declares the loop-stopped marker; `status` never does.
  if (data.degradation.includes("supervisor-loop-stopped")) return renderCoordinatorStarted(data);
  return renderCoordinatorStatus(data);
};
