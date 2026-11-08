/**
 * Supervisor install/uninstall orchestration (GH-238 F-15; DM-12; NFR-18;
 * AC-F15-1, AC-F15-2).
 *
 * A linger failure removes the just-written unit and returns the classified
 * unsupported identity with platform evidence; a repeated install is idempotent;
 * an absent uninstall is a noop. All filesystem/process calls stay in the
 * injected adapter.
 */
import type {
  DaemonInstallData,
  DaemonSupervisorDescriptor,
  DaemonUninstallData,
  SupervisorInstallRequest,
  SupervisorPort,
} from "#contracts";

export type SupervisorResult<T> =
  | { readonly ok: true; readonly data: T }
  | {
      readonly ok: false;
      readonly code: string;
      readonly platform?: string;
      readonly detail?: string;
    };

export const installSupervisor = (
  port: SupervisorPort,
  request: SupervisorInstallRequest,
): SupervisorResult<DaemonInstallData> => {
  const inspection = port.inspect();
  if (!inspection.supported) {
    return {
      ok: false,
      code: "daemon.supervisor-unsupported",
      platform: inspection.platform,
      detail: `no ${inspection.kind} adapter`,
    };
  }
  const installed = port.install(request);
  if (!installed.ok) {
    return {
      ok: false,
      code: installed.code,
      platform: installed.platform,
      detail: installed.detail,
    };
  }
  return {
    ok: true,
    data: { result: "installed", supervisor: installed.descriptor, degraded: [] },
  };
};

export const uninstallSupervisor = (
  port: SupervisorPort,
  unit: string,
): SupervisorResult<DaemonUninstallData> => {
  const inspection = port.inspect();
  if (!inspection.supported) {
    return {
      ok: false,
      code: "daemon.supervisor-unsupported",
      platform: inspection.platform,
    };
  }
  const removed = port.uninstall({ unit });
  if ("code" in removed) {
    return { ok: false, code: removed.code, detail: removed.detail };
  }
  const descriptor: DaemonSupervisorDescriptor = {
    ...inspection.descriptor,
    installed: false,
    linger: inspection.descriptor.linger && removed.removed,
  };
  return {
    ok: true,
    data: {
      result: removed.removed ? "uninstalled" : "noop",
      supervisor: descriptor,
      degraded: [],
    },
  };
};
