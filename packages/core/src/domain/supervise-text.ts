/**
 * The human render of the supervision report (GH-295 F-1, DM-1).
 *
 * The text is produced from exactly the same report object the machine payload
 * carries: no second fold, no second read, and the binary name arrives through
 * the branding seam only. An empty population states the empty population. The
 * render is bounded only by the delivered lane cap (200 lanes and the claims
 * that ride the same scope); it declares no separate byte or line bound
 * (TC-SUP-082).
 */
import type {
  BrandIdentity,
  SupervisionActionEntry,
  SupervisionLaneEntry,
  SupervisionReport,
  SupervisionSupervisorEntry,
} from "#contracts";

const asRecord = (value: unknown): Readonly<Record<string, unknown>> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;

const isReport = (value: unknown): value is SupervisionReport => {
  const record = asRecord(value);
  return (
    record !== undefined &&
    record.schemaVersion === "delivery.supervision.v1" &&
    typeof record.repo === "string" &&
    Array.isArray(record.lanes) &&
    Array.isArray(record.supervisors) &&
    Array.isArray(record.actions) &&
    asRecord(record.counts) !== undefined
  );
};

const evidenceCodes = (entry: {
  readonly evidence: readonly { readonly code: string }[];
}): string => entry.evidence.map((item) => item.code).join(",");

const laneLine = (lane: SupervisionLaneEntry): string =>
  `lane ${lane.ref} ${lane.classification}${
    lane.holder === undefined ? "" : ` holder ${lane.holder}`
  }${lane.heartbeat === undefined ? "" : ` heartbeat ${lane.heartbeat}`} — ${evidenceCodes(lane)}`;

const supervisorLine = (claim: SupervisionSupervisorEntry): string =>
  `supervisor ${claim.claimKind} ${claim.identity} ${claim.classification}${
    claim.holder === undefined ? "" : ` holder ${claim.holder}`
  }${claim.heartbeat === undefined ? "" : ` heartbeat ${claim.heartbeat}`} — ${evidenceCodes(claim)}`;

const actionLine = (action: SupervisionActionEntry): string =>
  `action ${action.kind}${action.ref === undefined ? "" : ` ${action.ref}`} — ${evidenceCodes(action)}`;

/** Render the report as bounded human text; `undefined` for a non-report value. */
export const renderSupervisionHuman = (data: unknown, brand: BrandIdentity): string | undefined => {
  if (!isReport(data)) return undefined;
  const lines = [
    `${brand.binaryName} supervise — ${data.repo}`,
    data.lanes.length === 0 && data.supervisors.length === 0
      ? "scope observed: no lanes and no supervision claims"
      : `lanes ${String(data.counts.lanes)} (progressing ${String(data.counts.progressing)}, stalled ${String(
          data.counts.stalled,
        )}, unknown ${String(data.counts.unknown)})`,
    ...(data.lanes.length === 0 ? [] : data.lanes.map(laneLine)),
    `supervisors ${String(data.counts.supervisors)}`,
    ...data.supervisors.map(supervisorLine),
    `actions ${String(data.counts.actions)}`,
    ...data.actions.map(actionLine),
    `parked ${String(data.counts.parked)}`,
    `degraded ${data.degraded.length === 0 ? "none" : data.degraded.join(",")}`,
    data.truncated ? `truncated ${data.truncationReason ?? "lane-cap"}` : "truncated false",
    `observedAt ${data.observedAt}`,
  ];
  return `${lines.join("\n")}\n`;
};
