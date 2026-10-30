/**
 * No-spawn / no-exit / no-real-stream guard for runCli contract tests.
 *
 * Installed only around a `runCli` invocation. The guard is self-tested by the
 * suite: any forbidden call records a violation and throws.
 */
export type NoSpawnGuard = {
  readonly violations: readonly string[];
  install: () => void;
  restore: () => void;
  exerciseForbiddenCall: () => boolean;
};

const deny = (violations: string[], label: string) => {
  return (..._args: unknown[]): never => {
    violations.push(label);
    throw new Error(`forbidden call: ${label}`);
  };
};

export const createNoSpawnGuard = (): NoSpawnGuard => {
  const violations: string[] = [];
  const original = {
    spawn: Reflect.get(Bun, "spawn") as unknown,
    spawnSync: Reflect.get(Bun, "spawnSync") as unknown,
    exit: Reflect.get(process, "exit") as unknown,
    stdoutWrite: Reflect.get(process.stdout, "write") as unknown,
    stderrWrite: Reflect.get(process.stderr, "write") as unknown,
  };

  return {
    violations,
    install: (): void => {
      Reflect.set(Bun, "spawn", deny(violations, "Bun.spawn"));
      Reflect.set(Bun, "spawnSync", deny(violations, "Bun.spawnSync"));
      Reflect.set(process, "exit", deny(violations, "process.exit"));
      Reflect.set(process.stdout, "write", deny(violations, "process.stdout.write"));
      Reflect.set(process.stderr, "write", deny(violations, "process.stderr.write"));
    },
    restore: (): void => {
      Reflect.set(Bun, "spawn", original.spawn);
      Reflect.set(Bun, "spawnSync", original.spawnSync);
      Reflect.set(process, "exit", original.exit);
      Reflect.set(process.stdout, "write", original.stdoutWrite);
      Reflect.set(process.stderr, "write", original.stderrWrite);
    },
    exerciseForbiddenCall: (): boolean => {
      try {
        const spawn = Reflect.get(Bun, "spawn") as (...args: unknown[]) => unknown;
        spawn(["true"]);
        return false;
      } catch {
        return true;
      }
    },
  };
};
