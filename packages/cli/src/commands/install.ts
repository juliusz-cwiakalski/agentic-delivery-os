/**
 * `install` — the composed install lifecycle family (GH-346 F-4..F-13; TDR-0036).
 *
 * Five entry points registered unconditionally in both composed programs:
 * `install`, `install status`, `install rollback`, `install uninstall`, and
 * `install purge`. The destination is never an input; every failure is a
 * registered identity; the family owns the artifact, its slot, its record, and
 * the managed PATH block while the shell installers own repository artifacts.
 *
 * The command maps grammar to handlers and handlers to data: the exit digit is
 * produced only by the delivered projection module.
 */

import {
  classifyInstallDestination,
  launcherTargetOf,
  symlinkTargetOf,
} from "@delivery-os/adapters/file";
import { evaluateInstallAdmission, installTargetStability } from "@delivery-os/core";
import type {
  InstallArtifactIdentity,
  InstallDaemonState,
  InstallDestinationDisposition,
  InstallOutcome,
  InstallRuntime,
  InstallStateFormatVerdict,
  InstallStateRootVerdict,
} from "@delivery-os/core/contracts";
import {
  INSTALL_DEV_BUILD_CODE,
  INSTALL_MAX_JUDGED_ROOTS,
  INSTALL_STATE_FORMAT_OUTCOMES,
} from "@delivery-os/core/contracts";
import type { CommandDefinition, CommandInvocation } from "../index.js";
import {
  renderInstallFailure,
  renderInstallOutcome,
  renderInstallPlan,
  renderInstallStatus,
} from "../output/install-text.js";

/** The subcommand vocabulary; every other token is the delivered grammar refusal. */
export const INSTALL_SUBCOMMANDS = ["status", "rollback", "uninstall", "purge"] as const;
export type InstallSubcommand = (typeof INSTALL_SUBCOMMANDS)[number];

/** The build entry the dev-build refusal names. */
const BUILD_ENTRY = "bun run build:binary";

/** The artifact path convention the dev-build refusal names. */
const ARTIFACT_CONVENTION = "dist/<binary-name>";

type InstallCommandInput = {
  readonly runtime: InstallRuntime;
  readonly invocation: CommandInvocation;
};

type Refusal = { readonly error: unknown };

const refusal = (code: string, summary: string, kind = "install"): Refusal => ({
  error: { kind, code, summary },
});

const internalFailure = (summary: string): Refusal =>
  refusal("fallback.internal", summary, "fallback");

const boolFlag = (command: InstallCommandInput, name: string): boolean =>
  command.invocation.flags[name] === true;

const stringFlag = (command: InstallCommandInput, name: string): string | undefined => {
  const value = command.invocation.flags[name];
  return typeof value === "string" ? value : undefined;
};

/** The one line the non-owning identity answers, carrying the three declared facts. */
export const notOwningRefusal = (runtime: InstallRuntime): Refusal =>
  refusal(
    "install.identity.not-owning",
    `refused: ${runtime.invokedIdentity} does not own installation; installation is owned by ` +
      "the primary identity — run the lifecycle through the installed product binary " +
      "(see `install --help` and the local install guide); nothing was written",
  );

/** A dev run and a linked worktree are the two admission refusals. */
export const admissionRefusal = (admission: {
  readonly code: "install.dev-build" | "install.target.worktree";
  readonly target?: string;
  readonly gitDir?: string;
  readonly commonDir?: string;
}): Refusal => {
  if (admission.code === INSTALL_DEV_BUILD_CODE) {
    return refusal(
      INSTALL_DEV_BUILD_CODE,
      `refused: this run carries no injected build identity; build the artifact with ` +
        `\`${BUILD_ENTRY}\` and run ${ARTIFACT_CONVENTION}; nothing was written`,
    );
  }
  return refusal(
    "install.target.worktree",
    `refused: the install target ${String(admission.target)} is a linked git worktree ` +
      `(git dir ${String(admission.gitDir)} differs from common dir ${String(admission.commonDir)}). ` +
      "Install from the primary checkout or a prepared directory holding a released artifact; " +
      "a lane worktree is deleted after merge. Nothing was written.",
  );
};

/** The daemon guard: one typed refusal naming the holder and the remedy. */
const daemonRefusal = (state: InstallDaemonState): Refusal =>
  refusal(
    "install.daemon.running",
    `refused: a live daemon holds this artifact (instance ${state.instanceId ?? "unknown"}` +
      `${state.pid === undefined ? "" : `, pid ${String(state.pid)}`}); stop it, or re-run with ` +
      "`--stop-daemon` so it stops through the delivered stop path before the swap; nothing was written",
  );

/**
 * The step-1 daemon gate: evaluate before any write, and stop through the
 * delivered path before the first rename when `--stop-daemon` is present.
 */
const daemonGate = async (
  runtime: InstallRuntime,
  stopDaemon: boolean,
): Promise<
  | { readonly ok: true; readonly state: "absent" | "stopped" }
  | { readonly ok: false; readonly refusal: Refusal }
> => {
  const state = await runtime.daemon.status();
  if (!state.running) return { ok: true, state: "absent" };
  if (!stopDaemon) return { ok: false, refusal: daemonRefusal(state) };
  const stopped = await runtime.daemon.stop();
  if (!stopped.ok) return { ok: false, refusal: daemonRefusal(state) };
  return { ok: true, state: "stopped" };
};

/**
 * The read-only compatibility pre-flight (F-7, advisory on the write paths).
 *
 * One line per not-accepted root; the exit code is never changed, and the check
 * writes nothing. The full verdict is the report path's.
 */
export const compatibilityAdvisories = (runtime: InstallRuntime): readonly string[] => {
  const advisories: string[] = [];
  const roots = runtime.stateRoots.slice(0, INSTALL_MAX_JUDGED_ROOTS);
  for (const root of roots) {
    const files = runtime.fs.list(root).filter((name) => name.startsWith("header."));
    if (files.length === 0) continue;
    for (const name of files) {
      const text = runtime.fs.readText(`${root}/${name}`);
      if (text === undefined) continue;
      let observed: string | undefined;
      try {
        const parsed = JSON.parse(text) as { readonly schemaVersion?: unknown };
        observed = typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : undefined;
      } catch {
        observed = undefined;
      }
      if (observed === undefined) {
        advisories.push(
          `advisory: ${root} declares no readable state format; the artifact accepts ` +
            `${runtime.acceptedStateSchemaVersion}; the check is read-only`,
        );
        continue;
      }
      if (observed !== runtime.acceptedStateSchemaVersion) {
        advisories.push(
          `advisory: ${root} declares state format ${observed}; this artifact accepts ` +
            `${runtime.acceptedStateSchemaVersion} — install the artifact that matches the root ` +
            "if the install is refused later (the install surface stays able to install it)",
        );
      }
    }
  }
  return advisories;
};

/** The state-format verdict behind `install status` (DM-4). */
export const stateFormatVerdict = (runtime: InstallRuntime): InstallStateFormatVerdict => {
  const truncated = runtime.stateRoots.length > INSTALL_MAX_JUDGED_ROOTS;
  const judged = runtime.stateRoots.slice(0, INSTALL_MAX_JUDGED_ROOTS);
  const roots: InstallStateRootVerdict[] = judged.map((root) => {
    if (!runtime.fs.exists(root)) {
      return {
        root,
        observed: null,
        outcome: INSTALL_STATE_FORMAT_OUTCOMES[3],
        reason: "the root is absent and is never collapsed into accepted",
      };
    }
    const headers = runtime.fs.list(root).filter((name) => name.startsWith("header."));
    if (headers.length === 0) {
      return {
        root,
        observed: null,
        outcome: INSTALL_STATE_FORMAT_OUTCOMES[3],
        reason: "no ledger header exists at this root",
      };
    }
    let observed: string | undefined;
    try {
      const parsed = JSON.parse(runtime.fs.readText(`${root}/${headers[0] as string}`) ?? "") as {
        readonly schemaVersion?: unknown;
      };
      observed = typeof parsed.schemaVersion === "string" ? parsed.schemaVersion : undefined;
    } catch {
      observed = undefined;
    }
    if (observed === undefined) {
      return {
        root,
        observed: null,
        outcome: INSTALL_STATE_FORMAT_OUTCOMES[2],
        reason: "the header exists but declares no readable format identifier",
      };
    }
    return observed === runtime.acceptedStateSchemaVersion
      ? {
          root,
          observed,
          outcome: INSTALL_STATE_FORMAT_OUTCOMES[0],
          reason: "the header declares the format this artifact accepts",
        }
      : {
          root,
          observed,
          outcome: INSTALL_STATE_FORMAT_OUTCOMES[1],
          reason: `the header declares ${observed}; this artifact accepts ${runtime.acceptedStateSchemaVersion}`,
        };
  });
  return { accepted: runtime.acceptedStateSchemaVersion, roots, judged: judged.length, truncated };
};

/** The running identity group of every outcome. */
const runningOf = (runtime: InstallRuntime) => ({
  version: runtime.runningIdentity?.version ?? "0.0.0",
  commit: runtime.runningIdentity?.commit ?? "dev",
  builtAt: runtime.runningIdentity?.builtAt ?? "",
  dirty: runtime.runningIdentity?.dirty ?? false,
  channel: runtime.runningIdentity?.channel ?? "dev",
  artifactPath: runtime.runningArtifactPath,
});

/** The slot condition, read without ever promoting or writing. */
const slotStateOf = (
  runtime: InstallRuntime,
): {
  readonly state: "present" | "absent" | "invalid";
  readonly identity?: InstallArtifactIdentity;
} => {
  const stat = runtime.fs.stat(runtime.slotPath);
  if (stat === undefined) return { state: "absent" };
  if (stat.kind === "file" && stat.size > 0) return { state: "present" };
  return { state: "invalid" };
};

/** The residual set: what `purge` would additionally delete (F-10, NFR-11). */
export const residualSetOf = (runtime: InstallRuntime): readonly string[] => {
  const paths: string[] = [];
  if (runtime.fs.exists(runtime.configRoot)) paths.push(runtime.configRoot);
  for (const root of runtime.stateRoots) {
    if (runtime.fs.exists(root)) paths.push(root);
  }
  return [...new Set(paths)].sort();
};

type InstallPlan = {
  readonly destination: string;
  readonly agreement: boolean;
  readonly disposition: InstallDestinationDisposition;
  readonly recordPath: string;
  readonly slotPath: string;
  readonly launcherTarget?: string;
  readonly profileFile?: string;
  readonly lines: readonly string[];
};

/** The declared install plan content (Appendix C.4, phase-2 depth). */
const installPlanOf = (
  runtime: InstallRuntime,
  planOptions: { readonly addToPath: boolean; readonly shellProfile?: string },
): InstallPlan => {
  const destinationClass = classifyInstallDestination(runtime.fs, runtime.destinationPath);
  const agreement =
    destinationClass === "compiled-artifact" &&
    runtime.fs.digest(runtime.destinationPath) === runtime.fs.digest(runtime.runningArtifactPath);
  const disposition: InstallDestinationDisposition =
    destinationClass === "absent"
      ? "created"
      : agreement
        ? "unchanged"
        : destinationClass === "launcher"
          ? "launcher-discarded"
          : destinationClass === "symlink"
            ? "symlink-replaced"
            : destinationClass === "compiled-artifact"
              ? "replaced"
              : "replaced";
  const launcherTarget =
    destinationClass === "launcher"
      ? launcherTargetOf(runtime.fs, runtime.destinationPath)
      : undefined;
  const linkTarget =
    destinationClass === "symlink" ? symlinkTargetOf(runtime.destinationPath) : undefined;
  const lines = [
    `running: ${runtime.runningIdentity?.version ?? "0.0.0"} (build ${runtime.runningIdentity?.commit ?? "dev"}) from ${runtime.runningArtifactPath}`,
    `destination: ${runtime.destinationPath}`,
    agreement
      ? "step 4: the destination's content is this artifact — the run would stop, with no staging file, no rename and no slot swap"
      : `disposition: ${disposition}${launcherTarget === undefined ? "" : ` (the launcher's recorded target ${launcherTarget} is discarded and is not preserved)`}${linkTarget === undefined ? "" : ` (the link to ${linkTarget} is replaced without writing through it)`}`,
    `record: ${runtime.recordPath}`,
    `slot: ${runtime.slotPath}`,
    ...(planOptions.addToPath
      ? [
          `profile: ${planOptions.shellProfile ?? "the declared shell mapping"}`,
          "block: one export line between the declared markers",
        ]
      : []),
  ];
  return {
    destination: runtime.destinationPath,
    agreement,
    disposition,
    recordPath: runtime.recordPath,
    slotPath: runtime.slotPath,
    ...(launcherTarget === undefined ? {} : { launcherTarget }),
    ...(planOptions.addToPath && planOptions.shellProfile !== undefined
      ? { profileFile: planOptions.shellProfile }
      : {}),
    lines,
  };
};

/**
 * The phase-2 write posture (D3): step 1 in full, then steps 2, 3 and 6, the
 * pre-staging agreement stop, and the slot-free dispositions. Steps 5 and 7
 * arrive with the record and the slot.
 */
const runInstall = async (
  command: InstallCommandInput,
  options: {
    readonly dryRun: boolean;
    readonly stopDaemon: boolean;
    readonly addToPath: boolean;
    readonly shellProfile?: string;
    readonly migrate: boolean;
  },
): Promise<unknown> => {
  const { runtime } = command;
  const advisories = compatibilityAdvisories(runtime);
  if (options.migrate) {
    return refusal(
      "install.migration.unavailable",
      "refused: migration is not available in this build; M4-S2 owns the namespace move — " +
        "perform the documented manual move of the prior-namespace artifacts; nothing was moved, " +
        "copied, or deleted",
    );
  }
  const artifactDirectory = runtime.runningArtifactPath.replace(/\/[^/]+$/u, "");
  const admission = evaluateInstallAdmission({
    artifactDirectory,
    ...(runtime.runningIdentity === undefined ? {} : { identity: runtime.runningIdentity }),
    git: runtime.git.readCheckout(artifactDirectory),
  });
  if (!admission.ok) return admissionRefusal(admission);
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;

  const plan = installPlanOf(runtime, {
    addToPath: options.addToPath,
    ...(options.shellProfile === undefined ? {} : { shellProfile: options.shellProfile }),
  });
  if (options.dryRun) {
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        disposition: plan.agreement ? "unchanged" : plan.disposition,
        slot: { path: runtime.slotPath, state: slotStateOf(runtime).state },
        recordPath: runtime.recordPath,
        recordState: "absent",
        daemon: gate.state,
        advisories,
        plan: plan.lines,
      } satisfies InstallOutcome,
    };
  }

  const disposition = plan.agreement ? "unchanged" : plan.disposition;
  if (disposition !== "unchanged") {
    if (!runtime.fs.mkdirp(runtime.installDirectory)) {
      return internalFailure(`the install directory ${runtime.installDirectory} cannot be created`);
    }
    if (runtime.fault?.failAt("stage") === true) {
      return internalFailure("the staging step was injected to fail; the destination is untouched");
    }
    const staged = runtime.fs.copyStaged(
      runtime.destinationPath,
      runtime.runningArtifactPath,
      0o755,
    );
    if (!staged.ok) return internalFailure(staged.reason);
    const stagedStat = runtime.fs.stat(staged.stagedPath);
    const verified =
      stagedStat !== undefined &&
      stagedStat.size > 0 &&
      stagedStat.executable &&
      runtime.fs.digest(staged.stagedPath) === runtime.fs.digest(runtime.runningArtifactPath);
    if (runtime.fault?.failAt("verify") === true || !verified) {
      runtime.fs.remove(staged.stagedPath);
      return internalFailure("the staged copy did not verify; the destination is untouched");
    }
    if (!runtime.fs.rename(staged.stagedPath, runtime.destinationPath)) {
      runtime.fs.remove(staged.stagedPath);
      return internalFailure("the staged artifact could not be renamed into place");
    }
  }

  return {
    data: {
      outcome: disposition === "unchanged" ? "unchanged" : "installed",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      disposition,
      slot: { path: runtime.slotPath, state: slotStateOf(runtime).state },
      recordPath: runtime.recordPath,
      recordState: "absent",
      daemon: gate.state,
      advisories,
      ...(plan.launcherTarget === undefined ? {} : { launcherTarget: plan.launcherTarget }),
    } satisfies InstallOutcome,
  };
};

/** `install status` — read-only, deterministic, never repairing (DM-4). */
const runStatus = async (runtime: InstallRuntime): Promise<unknown> => ({
  data: {
    schemaVersion: "install.status.v1",
    running: runningOf(runtime),
    installed: null,
    recordState: "absent",
    recordPath: runtime.recordPath,
    rollback: { path: runtime.slotPath, state: slotStateOf(runtime).state },
    targetStability: installTargetStability(
      runtime.git.readCheckout(runtime.runningArtifactPath.replace(/\/[^/]+$/u, "")),
    ),
    pathBlock: null,
  },
});

/** `install rollback` — the ordered refusals; the slot refusals come first. */
const runRollback = async (command: InstallCommandInput): Promise<unknown> => {
  const { runtime } = command;
  const slot = slotStateOf(runtime);
  if (slot.state === "absent") {
    return refusal(
      "install.slot.absent",
      `refused: no rollback slot exists at ${runtime.slotPath}; install a different compiled ` +
        "artifact first; nothing was written",
    );
  }
  if (slot.state === "invalid") {
    return refusal(
      "install.slot.invalid",
      `refused: the rollback slot at ${runtime.slotPath} is not a compiled artifact or is ` +
        "unreadable; nothing was written",
    );
  }
  return refusal(
    "install.record.unreadable",
    `refused: the install record at ${runtime.recordPath} does not name the pair the swap ` +
      "inverts; install the artifact held in the slot; nothing was written",
  );
};

/** `install uninstall` — removal matrix minus the roots; residual always printed. */
const runUninstall = async (
  command: InstallCommandInput,
  options: { readonly dryRun: boolean; readonly stopDaemon: boolean },
): Promise<unknown> => {
  const { runtime } = command;
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;
  const residual = residualSetOf(runtime);
  const present = runtime.fs.exists(runtime.destinationPath);
  const removals = present ? [runtime.destinationPath] : [];
  if (options.dryRun) {
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        slot: { path: runtime.slotPath, state: slotStateOf(runtime).state },
        recordPath: runtime.recordPath,
        recordState: "absent",
        daemon: gate.state,
        advisories: [],
        plan: removals,
        residual,
      } satisfies InstallOutcome,
    };
  }
  const removed: string[] = [];
  if (present && runtime.fs.remove(runtime.destinationPath)) removed.push(runtime.destinationPath);
  return {
    data: {
      outcome: "uninstalled",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      slot: { path: runtime.slotPath, state: slotStateOf(runtime).state },
      recordPath: runtime.recordPath,
      recordState: "absent",
      daemon: gate.state,
      advisories: [],
      removed,
      residual,
    } satisfies InstallOutcome,
  };
};

/** `install purge` — confirmation required, both roots removed. */
const runPurge = async (
  command: InstallCommandInput,
  options: { readonly dryRun: boolean; readonly stopDaemon: boolean; readonly confirmed: boolean },
): Promise<unknown> => {
  const { runtime } = command;
  if (!options.confirmed && !options.dryRun) {
    return refusal(
      "install.purge.unconfirmed",
      `refused: purge removes ${runtime.configRoot} and ${runtime.stateRoot}; re-run with ` +
        "`--yes` to confirm; nothing was removed",
    );
  }
  const gate = await daemonGate(runtime, options.stopDaemon);
  if (!gate.ok) return gate.refusal;
  const removal = [
    runtime.destinationPath,
    runtime.slotPath,
    runtime.recordPath,
    ...residualSetOf(runtime),
  ];
  if (options.dryRun) {
    return {
      data: {
        outcome: "plan",
        running: runningOf(runtime),
        destination: runtime.destinationPath,
        slot: { path: runtime.slotPath, state: slotStateOf(runtime).state },
        recordPath: runtime.recordPath,
        recordState: "absent",
        daemon: gate.state,
        advisories: [],
        plan: removal,
      } satisfies InstallOutcome,
    };
  }
  const removed: string[] = [];
  for (const path of removal) {
    if (!runtime.fs.exists(path)) continue;
    if (path === runtime.configRoot || path === runtime.stateRoot) {
      runtime.fs.removeTree(path);
    } else {
      runtime.fs.remove(path);
    }
    removed.push(path);
  }
  return {
    data: {
      outcome: "purged",
      running: runningOf(runtime),
      destination: runtime.destinationPath,
      slot: { path: runtime.slotPath, state: "absent" },
      recordPath: runtime.recordPath,
      recordState: "absent",
      daemon: gate.state,
      advisories: [],
      removed,
    } satisfies InstallOutcome,
  };
};

/** The family definition: one grammar, five handlers, the owning-role gate. */
export const createInstallCommandDefinition = (runtime: InstallRuntime): CommandDefinition => ({
  positionals: { max: 1 },
  flags: ["--add-to-path", "--migrate", "--dry-run", "--stop-daemon", "--yes"],
  requiresValue: ["--shell-profile"],
  humanSuccess: true,
  humanText: (data) => {
    if (typeof data !== "object" || data === null) return undefined;
    const record = data as Record<string, unknown>;
    if (record.schemaVersion === "install.status.v1") return renderInstallStatus(record);
    if (record.outcome === "plan") return renderInstallPlan(data as InstallOutcome);
    return renderInstallOutcome(data as InstallOutcome);
  },
  humanFailureText: (error, brand) => renderInstallFailure(error, brand),
  handler: async (invocation) => {
    if (!runtime.ownsInstallation) return notOwningRefusal(runtime);
    const command: InstallCommandInput = { runtime, invocation };
    const [subcommand] = invocation.positionals;
    if (subcommand !== undefined && subcommand !== "") {
      if (!(INSTALL_SUBCOMMANDS as readonly string[]).includes(subcommand)) {
        return refusal(
          "fallback.invocation",
          `unknown install subcommand "${subcommand}"; the declared entry points are ` +
            `install, ${INSTALL_SUBCOMMANDS.map((name) => `install ${name}`).join(", ")}`,
          "fallback",
        );
      }
      if (subcommand === "status") return runStatus(runtime);
      if (subcommand === "rollback") return runRollback(command);
      if (subcommand === "uninstall") {
        return runUninstall(command, {
          dryRun: boolFlag(command, "--dry-run"),
          stopDaemon: boolFlag(command, "--stop-daemon"),
        });
      }
      return runPurge(command, {
        dryRun: boolFlag(command, "--dry-run"),
        stopDaemon: boolFlag(command, "--stop-daemon"),
        confirmed: boolFlag(command, "--yes"),
      });
    }
    return runInstall(command, {
      dryRun: boolFlag(command, "--dry-run"),
      stopDaemon: boolFlag(command, "--stop-daemon"),
      addToPath: boolFlag(command, "--add-to-path"),
      ...(stringFlag(command, "--shell-profile") === undefined
        ? {}
        : { shellProfile: stringFlag(command, "--shell-profile") as string }),
      migrate: boolFlag(command, "--migrate"),
    });
  },
});
