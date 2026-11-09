/**
 * The synthetic default-spawn fixture (GH-277 test-plan §6.1): a controlled
 * parent environment, a fake `opencode` executable on a temp `PATH`, the
 * repaired shipped default descriptor, and a real opencode session port over the
 * real host starter.
 *
 * The only real child is the synthetic script. It never contacts a model, a
 * network, or a store; it dumps its inherited environment and argv and prints
 * the pinned two-line JSONL before exiting 0.
 */
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createOpencodeSession } from "@delivery-os/adapters/harness";
import { createHostSpawnRunner, createHostSpawnStarter } from "@delivery-os/adapters/host";
import { resolveHarnessSettings } from "../../../packages/core/src/config/harness";
import { PRODUCTION_DEFAULTS } from "../../../packages/core/src/config/index";
import type {
  CredentialPort,
  HarnessEnvironmentEntry,
  HarnessExecutionEnvironmentDescriptor,
  HarnessSessionPort,
  HarnessSpawnStarter,
} from "../../../packages/core/src/contracts/index";
import { classifyHarnessEvidence } from "../../../packages/core/src/domain/harness-classify";
import { assembleHarnessLiveness } from "../../../packages/core/src/domain/harness-liveness";
import { buildHarnessSpawnEnvironment } from "../../../packages/core/src/domain/harness-spawn-env";
import { DISPATCH_NOW } from "../dispatch/harness";

/** A synthetic parent environment: only fabricated values, no live variables. */
export type ControlledParent = {
  readonly root: string;
  readonly binDirectory: string;
  readonly homeDirectory: string;
  readonly workDirectory: string;
  readonly scriptPath: string;
  readonly environmentDumpPath: string;
  readonly argvDumpPath: string;
  readonly markerPath: string;
  readonly pathValue: string;
  readonly canaries: Readonly<Record<string, string>>;
  readonly parentEnvironment: Readonly<Record<string, string>>;
  readonly dispose: () => void;
};

export const CANARY_UNDECLARED_TOKEN = "canary-undeclared-token-gh277";
export const CANARY_OC_ADOS_MAIN_MODEL = "canary-oc-ados-main-model-gh277";
export const CANARY_OC_ADOS_SMALL_MODEL = "canary-oc-ados-small-model-gh277";
export const CANARY_DECOY_MODEL = "canary-harness-model-decoy-gh277";
export const CANARY_PARENT_WORK_PATH = "canary-parent-work-path-gh277";

const RUNTIME_PATH = "/usr/bin:/bin";

/** The repo-local temp root every filesystem-touching suite roots under (test plan §6.2). */
const TEMP_ROOT = join(process.cwd(), "tmp", "tmpdir");

/** The synthetic script: dump environment and argv, print the acquired JSONL. */
const scriptSource = (paths: {
  readonly environmentDumpPath: string;
  readonly argvDumpPath: string;
  readonly markerPath: string;
}): string =>
  `#!${process.execPath}
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(paths.environmentDumpPath)}, JSON.stringify({ ...process.env }));
writeFileSync(${JSON.stringify(paths.argvDumpPath)}, JSON.stringify(process.argv));
writeFileSync(${JSON.stringify(paths.markerPath)}, "invoked");
console.log(JSON.stringify({ type: "step_start", sessionID: "ses_synthetic_1" }));
console.log(JSON.stringify({ type: "step_finish", part: { reason: "stop" } }));
process.exit(0);
`;

export type ControlledParentOptions = {
  /** Supply TMPDIR with this value; absent means the optional entry is absent. */
  readonly tmpdirValue?: string;
  /** Omit HOME to exercise the absent-required case. */
  readonly omitHome?: boolean;
  /** Omit PATH entirely (the builder then reports the required entry). */
  readonly omitPath?: boolean;
};

/** Build one controlled parent environment and the synthetic executable. */
export const createControlledParent = (options: ControlledParentOptions = {}): ControlledParent => {
  mkdirSync(TEMP_ROOT, { recursive: true });
  const root = mkdtempSync(join(TEMP_ROOT, "gh277-default-spawn-"));
  const binDirectory = join(root, "bin");
  const homeDirectory = join(root, "home");
  const workDirectory = join(root, "work");
  mkdirSync(binDirectory, { recursive: true });
  mkdirSync(homeDirectory, { recursive: true });
  mkdirSync(workDirectory, { recursive: true });
  const scriptPath = join(binDirectory, "opencode");
  const environmentDumpPath = join(root, "environment.json");
  const argvDumpPath = join(root, "argv.json");
  const markerPath = join(root, "marker.txt");
  writeFileSync(
    scriptPath,
    scriptSource({ environmentDumpPath, argvDumpPath, markerPath }),
    "utf8",
  );
  chmodSync(scriptPath, 0o755);

  const pathValue = `${binDirectory}:${RUNTIME_PATH}`;
  const canaries: Record<string, string> = {
    SYNTHETIC_UNDECLARED_TOKEN: CANARY_UNDECLARED_TOKEN,
    OC_ADOS_MAIN_MODEL: CANARY_OC_ADOS_MAIN_MODEL,
    OC_ADOS_SMALL_MODEL: CANARY_OC_ADOS_SMALL_MODEL,
    HARNESS_MODEL_ALT: CANARY_DECOY_MODEL,
  };
  const parentEnvironment: Record<string, string> = {
    ...canaries,
    DELIVERY_WORK_PATH: CANARY_PARENT_WORK_PATH,
    ...(options.omitPath === true ? {} : { PATH: pathValue }),
    ...(options.omitHome === true ? {} : { HOME: homeDirectory }),
    ...(options.tmpdirValue === undefined ? {} : { TMPDIR: options.tmpdirValue }),
  };

  return {
    root,
    binDirectory,
    homeDirectory,
    workDirectory,
    scriptPath,
    environmentDumpPath,
    argvDumpPath,
    markerPath,
    pathValue,
    canaries,
    parentEnvironment,
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** Read the fake CLI's inherited environment dump. */
export const readEnvironmentDump = (
  controlled: ControlledParent,
): Readonly<Record<string, string>> =>
  JSON.parse(readFileSync(controlled.environmentDumpPath, "utf8")) as Record<string, string>;

/** Read the fake CLI's argv dump. */
export const readArgvDump = (controlled: ControlledParent): readonly string[] =>
  JSON.parse(readFileSync(controlled.argvDumpPath, "utf8")) as string[];

/** The repaired shipped default descriptor, resolved from the production defaults. */
export const repairedDefaultDescriptor = (
  workDirectory: string,
): HarnessExecutionEnvironmentDescriptor => {
  const resolved = resolveHarnessSettings(
    PRODUCTION_DEFAULTS as unknown as Readonly<Record<string, unknown>>,
  );
  if (!resolved.ok) throw new Error("the shipped default harness settings did not resolve");
  const environment: HarnessEnvironmentEntry[] = resolved.value.environment.map((entry) =>
    "credentialRef" in entry
      ? {
          kind: "credential" as const,
          name: entry.name,
          reference: {
            referenceName: entry.credentialRef,
            sourceKey: { style: "literal" as const, name: entry.credentialRef },
          },
        }
      : {
          kind: "variable" as const,
          name: entry.name,
          ...(entry.optional === true ? { optional: true } : {}),
        },
  );
  return { kind: "host", workDirectory, environment };
};

/** The pre-change descriptor from the spec Appendix A: the non-vacuity control. */
export const legacyDefaultDescriptor = (
  workDirectory: string,
): HarnessExecutionEnvironmentDescriptor => ({
  kind: "host",
  workDirectory,
  environment: [
    { kind: "variable", name: "HARNESS_MODEL" },
    { kind: "variable", name: "HARNESS_SMALL_MODEL" },
    { kind: "variable", name: "DELIVERY_WORK_PATH" },
  ],
});

const unusedCredentials: CredentialPort = {
  resolve: () => {
    throw new Error("the default allowlist declares no credential entry");
  },
};

export type SyntheticOpencode = {
  readonly port: HarnessSessionPort;
  readonly starterCalls: readonly {
    readonly file: string;
    readonly args: readonly string[];
  }[];
};

/** Compose the real opencode session over the real host starter. */
export const createSyntheticOpencode = (input: {
  readonly parentEnvironment: Readonly<Record<string, string | undefined>>;
  readonly record?: Readonly<Record<string, string>>;
}): SyntheticOpencode => {
  const starterCalls: { file: string; args: readonly string[] }[] = [];
  const hostStarter = createHostSpawnStarter();
  const starter: HarnessSpawnStarter = (file, args, options) => {
    starterCalls.push({ file, args: [...args] });
    return hostStarter(file, args, options);
  };
  const port = createOpencodeSession({
    command: "opencode",
    runner: createHostSpawnRunner(),
    starter,
    spawnArgs: ["run", "--format", "json"],
    resumeArgs: ["run", "--format", "json", "--session"],
    listArgs: ["session", "list", "--format", "json"],
    buildEnvironment: (descriptor) =>
      buildHarnessSpawnEnvironment({
        descriptor,
        parentEnvironment: input.parentEnvironment,
        credentials: unusedCredentials,
        record: input.record ?? { DELIVERY_WORK_PATH: descriptor.workDirectory },
      }),
    classify: classifyHarnessEvidence,
    assembleLiveness: assembleHarnessLiveness,
    now: () => DISPATCH_NOW,
  });
  return { port, starterCalls };
};

/** The expected child key set for the repaired default and a present TMPDIR. */
export const expectedChildKeys = (input: {
  readonly tmpdirPresent: boolean;
}): readonly string[] => [
  "DELIVERY_WORK_PATH",
  "HOME",
  "PATH",
  ...(input.tmpdirPresent ? ["TMPDIR"] : []),
];

/** The basename of the fake executable, for the bare-command assertion. */
export const syntheticCommandName = "opencode" as const;

/** The synthetic script path basename (a bare-name check helper). */
export const syntheticBasename = (): string => basename("opencode");
