/**
 * Synthetic entrypoint programs and the §8.1 invocation inventory (GH-242).
 *
 * The fixture composes the exact prompt-required program shape used by the
 * phase-1 suites: every command exists, no handler performs I/O, and every
 * help tuple is derived from the shipped help model so the two cannot drift.
 */

import { PROMPT_REQUIRED_COMMANDS } from "../../../packages/cli/src/entrypoint";
import { allHelpEntries } from "../../../packages/cli/src/help";
import type { CommandProgram } from "../../../packages/cli/src/index";
import type { BrandIdentity } from "../../../packages/core/src/contracts/index";

/** A synthetic brand used to render identity-bearing help and version output. */
export const SYNTHETIC_ENTRYPOINT_BRAND: BrandIdentity = {
  productName: "example-product",
  binaryName: "example-product",
  packageScope: "@example-scope",
  environmentPrefix: "EXAMPLE_PRODUCT_",
  configDirectoryName: ".example-product",
  stateDirectoryName: ".example-product-state",
  mcpToolPrefix: "example-product_",
  telemetryNamespace: "delivery",
  docsBaseUrl: "https://example-scope.github.io/example-product/",
  repositoryUrl: "https://github.com/example-scope/example-product",
  releaseAssetPrefix: "example-product-",
  installPath: "~/.example-product/bin/example-product",
};

/** A program with exactly the prompt-required commands and inert handlers. */
export const syntheticPromptProgram = (): CommandProgram => {
  const commands: Record<string, { handler: () => { data: Record<string, never> } }> = {};
  for (const name of PROMPT_REQUIRED_COMMANDS) {
    commands[name] = { handler: () => ({ data: {} }) };
  }
  return { commands };
};

/** A counting composer so isolation suites can prove it is never invoked. */
export const countingComposer = (): {
  readonly composeProgram: () => CommandProgram;
  readonly calls: () => number;
} => {
  let calls = 0;
  return {
    composeProgram: () => {
      calls += 1;
      return syntheticPromptProgram();
    },
    calls: () => calls,
  };
};

export type HelpTuple = {
  readonly args: readonly string[];
  readonly path: readonly string[];
  readonly referencePages: readonly string[];
};

/** Every root and command help tuple, derived from the shipped help model. */
export const HELP_TUPLES: readonly HelpTuple[] = [
  { args: ["--help"], path: [], referencePages: [] },
  ...allHelpEntries()
    .filter((entry) => entry.path.length > 0)
    .map((entry) => ({
      args: [...entry.path, "--help"],
      path: entry.path,
      referencePages: entry.seeAlso,
    })),
];
