/**
 * GH-365 P5 migration guards: the ordering recorder that stamps `stop` and
 * `move <n>` on one monotonic counter, the recording daemon port, and the
 * admission fixtures (a linked-worktree git read and the backup-dir rows).
 */
import type {
  InstallDaemonPort,
  InstallGitRead,
} from "../../../packages/core/src/contracts/install";

export type OrderingRecorder = {
  readonly events: readonly string[];
  readonly stop: () => void;
  readonly onMove: (ordinal: number) => void;
};

export const createOrderingRecorder = (): OrderingRecorder => {
  const events: string[] = [];
  return {
    events,
    stop: () => events.push("stop"),
    onMove: (ordinal) => events.push(`move ${String(ordinal)}`),
  };
};

export type RecordingDaemon = InstallDaemonPort & {
  readonly statusCalls: () => number;
  readonly stopCalls: () => number;
};

export const createRecordingDaemon = (
  options: { readonly running?: boolean; readonly ordering?: OrderingRecorder } = {},
): RecordingDaemon => {
  let statusCalls = 0;
  let stopCalls = 0;
  const running = options.running ?? false;
  return {
    statusCalls: () => statusCalls,
    stopCalls: () => stopCalls,
    status: async () => {
      statusCalls += 1;
      return running ? { running: true, instanceId: "fixture", pid: 1234 } : { running: false };
    },
    stop: async () => {
      stopCalls += 1;
      options.ordering?.stop();
      return { ok: true };
    },
  };
};

/** A linked-worktree topology read: the migration admission must refuse it. */
export const linkedWorktreeGit = (checkoutRoot: string): InstallGitRead => ({
  kind: "resolved",
  checkoutRoot,
  gitDir: `${checkoutRoot}/.git/worktrees/lane`,
  commonDir: `${checkoutRoot}/.git`,
});

/** The backup-dir admission rows (relative and in-source are both refused). */
export const backupDirRows = (
  source: string,
): readonly {
  readonly label: string;
  readonly value: string;
  readonly accepted: boolean;
}[] => [
  { label: "absolute", value: `${source}/../backups`, accepted: true },
  { label: "relative", value: "relative/backups", accepted: false },
  { label: "in-source", value: `${source}/backups`, accepted: false },
];
