/**
 * The install family's operator-facing text (GH-346 F-4, F-9..F-13).
 *
 * Every line is derived from the handler data, so the human and machine forms
 * never disagree. Absolute paths are printed one per line, and the residual set
 * is always labelled as what `purge` would additionally delete.
 */
import type {
  BrandIdentity,
  InstallOutcome,
  InstallStatusPayload,
} from "@delivery-os/core/contracts";

const pathLines = (label: string, paths: readonly string[]): readonly string[] =>
  paths.length === 0 ? [`${label}: none`] : paths.map((path) => `${label}: ${path}`);

/** Render the `install status` report in its declared deterministic order. */
export const renderInstallStatus = (payload: Record<string, unknown>): string => {
  const report = payload as unknown as InstallStatusPayload;
  const running = report.running;
  const lines = [
    `running: ${running.version} (build ${running.commit}) from ${running.artifactPath}`,
    `builtAt: ${running.builtAt}`,
    `dirty: ${String(running.dirty)}`,
    `channel: ${running.channel}`,
    `installed: ${report.installed === null ? "absent" : `${report.installed.version} (build ${report.installed.commit})`}`,
    `record: ${report.recordState} (${report.recordPath})`,
    `rollback: ${report.rollback.state} (${report.rollback.path})`,
    `target-stability: ${report.targetStability}`,
    `path-block: ${
      report.pathBlock === null ? "none" : `${report.pathBlock.file} (${report.pathBlock.marker})`
    }`,
  ];
  if (report.stateFormat !== undefined) {
    lines.push(`state-format: accepted ${report.stateFormat.accepted}`);
    for (const root of report.stateFormat.roots) {
      lines.push(
        `state-root: ${root.root} observed=${root.observed ?? "none"} outcome=${root.outcome} (${root.reason})`,
      );
    }
    lines.push(
      `state-format-judged: ${String(report.stateFormat.judged)}${report.stateFormat.truncated ? " (truncated)" : ""}`,
    );
  }
  return `${lines.join("\n")}\n`;
};

/** Render one completed lifecycle outcome. */
export const renderInstallOutcome = (outcome: InstallOutcome): string => {
  const lines = [
    `result=${outcome.outcome}`,
    `running: ${outcome.running.version} (build ${outcome.running.commit}) from ${outcome.running.artifactPath}`,
    `destination: ${outcome.destination}`,
    ...(outcome.disposition === undefined ? [] : [`disposition: ${outcome.disposition}`]),
    ...(outcome.launcherTarget === undefined
      ? []
      : [`launcher-target: ${outcome.launcherTarget} (discarded, never promoted)`]),
    ...(outcome.previous === undefined
      ? []
      : [`previous: ${outcome.previous.version} (build ${outcome.previous.commit})`]),
    `slot: ${outcome.slot.state} (${outcome.slot.path})`,
    `record: ${outcome.recordState} (${outcome.recordPath})`,
    ...(outcome.reconciliation === undefined
      ? []
      : [
          `reconciled: ${outcome.reconciliation.from} -> current (previous ${
            outcome.reconciliation.previous === "unknown"
              ? "unknown"
              : `${outcome.reconciliation.previous.commit}`
          })`,
        ]),
    `daemon: ${outcome.daemon}`,
    ...outcome.advisories,
    ...(outcome.pathBlock === undefined
      ? []
      : [`path-block: ${outcome.pathBlock.file} (${outcome.pathBlock.marker})`]),
    ...pathLines("removed", outcome.removed ?? []),
    ...(outcome.residual === undefined
      ? []
      : pathLines("purge would additionally delete", outcome.residual)),
  ];
  return `${lines.join("\n")}\n`;
};

/** Render one dry-run plan; nothing here has happened. */
export const renderInstallPlan = (outcome: InstallOutcome): string => {
  const lines = [
    "result=plan (nothing was written)",
    `destination: ${outcome.destination}`,
    `slot: ${outcome.slot.state} (${outcome.slot.path})`,
    `record: ${outcome.recordState} (${outcome.recordPath})`,
    ...(outcome.plan ?? []),
    ...pathLines("would remove", outcome.removed ?? []),
    ...(outcome.residual === undefined
      ? []
      : pathLines("residual set (what purge would additionally delete)", outcome.residual)),
  ];
  return `${lines.join("\n")}\n`;
};

/** Render a refusal's operator sentence; the standard diagnostic still prints. */
export const renderInstallFailure = (error: unknown, brand: BrandIdentity): string | undefined => {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as { readonly code?: unknown; readonly summary?: unknown };
  if (typeof record.code !== "string" || !record.code.startsWith("install.")) return undefined;
  const summary = typeof record.summary === "string" ? record.summary : record.code;
  return `${brand.binaryName}: ${record.code}\n${summary}\n`;
};
