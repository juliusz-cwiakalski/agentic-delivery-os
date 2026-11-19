#!/usr/bin/env bun
/**
 * The `delivery-os` executable identity selector (GH-320 F-1, DEC-5).
 *
 * The bin is the declared process edge: it reads the environment, the working
 * directory, and the streams once, declares its own default working name and no
 * prior identity, and delegates to the one shared launcher composition. It never
 * composes the program itself and never calls the command runtime.
 */
import { resolveReentryEntryPath, runBinLauncher } from "../src/bin-launcher.ts";
import { injectedBuildIdentity } from "../src/build-identity.ts";

/** The compatibility alias's declared identity; the one identity literal here. */
const DEFAULT_WORKING_NAME = "delivery-os";

export const completion: Promise<void> = runBinLauncher({
  declaredWorkingName: DEFAULT_WORKING_NAME,
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
