#!/usr/bin/env bun
/**
 * The `jaiship` executable identity selector (GH-320 F-1, F-2, DEC-5).
 *
 * The bin is the declared process edge: it reads the environment, the working
 * directory, and the streams once, declares the decided public name as its
 * default identity and the pre-freeze working name as its prior identity, then
 * delegates to the one shared launcher composition. Every derived value comes
 * from the one resolver, so the prior paths are never a second literal.
 */
import { resolveReentryEntryPath, runBinLauncher } from "../src/bin-launcher.ts";
import { injectedBuildIdentity } from "../src/build-identity.ts";

/** The decided public identity, declared at the process edge. */
const DEFAULT_WORKING_NAME = "jaiship";

/** The pre-freeze identity whose artifacts a new-identity invocation may read. */
const PRIOR_WORKING_NAME = "delivery-os";

export const completion: Promise<void> = runBinLauncher({
  declaredWorkingName: DEFAULT_WORKING_NAME,
  priorWorkingName: PRIOR_WORKING_NAME,
  argv: process.argv.slice(2),
  environment: process.env,
  cwd: process.cwd(),
  streams: { stdout: process.stdout, stderr: process.stderr },
  processId: process.pid,
  signalHost: process,
  daemonEntry: resolveReentryEntryPath({
    argvEntry: process.argv[1],
    execPath: process.execPath,
  }),
  buildIdentity: injectedBuildIdentity(),
}).then((exitCode) => {
  if (exitCode !== 0) process.exitCode = exitCode;
});
