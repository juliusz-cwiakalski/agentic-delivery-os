/**
 * The `daemon` command family (GH-238 F-1; Appendix C).
 *
 * Grammar: `daemon start [--foreground]`, `daemon stop [--mode drain|immediate]`,
 * `daemon status [--live]`, `daemon install`, `daemon uninstall`. Handlers never
 * write streams or choose an exit code; the envelope and exit projection are the
 * command surface's.
 */

import { renderDaemonStatusHuman } from "@delivery-os/core";
import {
  DAEMON_STOP_MODES,
  type DaemonInstallData,
  type DaemonStartData,
  type DaemonStatusEnvelopeData,
  type DaemonStopData,
  type DaemonStopMode,
  type DaemonUninstallData,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";

type Failure = {
  readonly error: { readonly kind: string; readonly code: string; readonly summary?: string };
};

type Result<T> = { readonly data: T } | Failure;

export type DaemonCommandRuntime = {
  readonly start: (input: { readonly foreground: boolean }) => Promise<Result<DaemonStartData>>;
  readonly stop: (input: { readonly mode: DaemonStopMode }) => Promise<Result<DaemonStopData>>;
  readonly status: (input: { readonly live: boolean }) => Promise<Result<DaemonStatusEnvelopeData>>;
  readonly install: () => Promise<Result<DaemonInstallData>>;
  readonly uninstall: () => Promise<Result<DaemonUninstallData>>;
  /** The foreground resident loop (the process entry awaits stop then closes it). */
  readonly loop?: () => Promise<void>;
};

const refused = (summary: string): Failure => ({
  error: { kind: "fallback", code: "fallback.invocation", summary },
});

const renderStart = (data: DaemonStartData): string =>
  [
    "result=started",
    `instance=${data.instance.instanceId}`,
    `pid=${data.instance.pid}`,
    `mode=${data.instance.mode}`,
    `heartbeat=${data.heartbeat.intervalMs}ms`,
    `degraded=${data.degraded.length === 0 ? "none" : data.degraded.join(",")}`,
  ].join("\n");

const renderStop = (data: DaemonStopData): string =>
  [
    `result=${data.result}`,
    `instance=${data.instance?.instanceId ?? "none"}`,
    `detached_lanes=${data.detachedLanes.length}`,
    `degraded=${data.degraded.length === 0 ? "none" : data.degraded.join(",")}`,
  ].join("\n");

const renderInstall = (data: DaemonInstallData | DaemonUninstallData): string =>
  [
    `result=${data.result}`,
    `supervisor=${data.supervisor.kind}`,
    `unit=${data.supervisor.unit}`,
    `installed=${String(data.supervisor.installed)}`,
    `linger=${String(data.supervisor.linger)}`,
  ].join("\n");

const parseStart = (invocation: CommandInvocation): { foreground: boolean } | undefined => {
  if (invocation.positionals.length !== 0) return undefined;
  return { foreground: invocation.flags["--foreground"] === true };
};

const parseStop = (invocation: CommandInvocation): { mode: DaemonStopMode } | undefined => {
  if (invocation.positionals.length !== 0) return undefined;
  const raw = invocation.flags["--mode"];
  if (raw === undefined) return { mode: "drain" };
  if (typeof raw !== "string") return undefined;
  return (DAEMON_STOP_MODES as readonly string[]).includes(raw)
    ? { mode: raw as DaemonStopMode }
    : undefined;
};

export const createDaemonCommandDefinition = (
  runtime: DaemonCommandRuntime,
): CommandDefinition => ({
  flags: ["--foreground", "--live", "--mode"],
  requiresValue: ["--mode"],
  positionals: { max: 1 },
  humanSuccess: true,
  humanText: (data: unknown): string => {
    if (typeof data !== "object" || data === null) return "";
    const value = data as Record<string, unknown>;
    if ("mergeCodePath" in value) return renderDaemonStatusHuman(data as DaemonStatusEnvelopeData);
    if ("reconciliation" in value) return renderStart(data as DaemonStartData);
    if ("detachedLanes" in value) return renderStop(data as DaemonStopData);
    if ("supervisor" in value) return renderInstall(data as DaemonInstallData);
    return "";
  },
  handler: async (invocation) => {
    const [subcommand, ...rest] = invocation.positionals;
    if (subcommand === undefined) return refused("result=refused; reason=grammar");
    if (subcommand === "start") {
      if (rest.length > 0) return refused("result=refused; reason=grammar");
      const parsed = parseStart({ ...invocation, positionals: rest });
      if (parsed === undefined) return refused("result=refused; reason=grammar");
      return runtime.start(parsed);
    }
    if (subcommand === "stop") {
      if (rest.length > 0) return refused("result=refused; reason=grammar");
      const parsed = parseStop({ ...invocation, positionals: rest });
      if (parsed === undefined) return refused("result=refused; reason=grammar");
      return runtime.stop(parsed);
    }
    if (subcommand === "status") {
      if (rest.length > 0) return refused("result=refused; reason=grammar");
      return runtime.status({ live: invocation.flags["--live"] === true });
    }
    if (subcommand === "install") {
      if (rest.length > 0) return refused("result=refused; reason=grammar");
      return runtime.install();
    }
    if (subcommand === "uninstall") {
      if (rest.length > 0) return refused("result=refused; reason=grammar");
      return runtime.uninstall();
    }
    return refused("result=refused; reason=grammar");
  },
});
