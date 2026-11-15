#!/usr/bin/env bun
/**
 * The `delivery-os` executable identity selector (GH-320 F-1, DEC-5).
 *
 * The bin is a thin process selector: it declares its own default working name
 * and no prior identity, then delegates to the one shared launcher composition.
 * It never composes the program itself and never calls the command runtime.
 */
import { runBinLauncher } from "../src/bin-launcher.ts";

/** The compatibility alias's declared identity; the one identity literal here. */
const DEFAULT_WORKING_NAME = "delivery-os";

export const completion: Promise<void> = runBinLauncher({
  declaredWorkingName: DEFAULT_WORKING_NAME,
}).then((exitCode) => {
  if (exitCode !== 0) process.exitCode = exitCode;
});
