#!/usr/bin/env bun
/**
 * The non-installed executable entry (GH-242 F-1, DEC-14).
 *
 * The bin is a thin process adapter: it reads the environment once, composes
 * the prompt-required program through the production composer, and delegates
 * every decision to `runEntrypoint`. It is not added to the installer.
 */
import { runEntrypoint } from "../src/entrypoint.ts";
import { createProductionComposer } from "../src/production.ts";

const invoke = async (): Promise<number> => {
  const environment: Readonly<Record<string, string | undefined>> = { ...process.env };
  const cwd = process.cwd();
  const homeDirectory = environment.HOME ?? environment.USERPROFILE ?? "";
  const configured =
    environment.DELIVERY_OS_WORKING_NAME === undefined ||
    environment.DELIVERY_OS_WORKING_NAME === ""
      ? "delivery-os"
      : environment.DELIVERY_OS_WORKING_NAME;
  return runEntrypoint(process.argv.slice(2), {
    streams: { stdout: process.stdout, stderr: process.stderr },
    environment,
    configuredWorkingName: configured,
    composeProgram: createProductionComposer({
      environment,
      cwd,
      homeDirectory,
      workingName: configured,
      processId: process.pid,
      signalHost: process,
    }),
  });
};

export const completion: Promise<void> = invoke().then((exitCode) => {
  if (exitCode !== 0) process.exitCode = exitCode;
});
