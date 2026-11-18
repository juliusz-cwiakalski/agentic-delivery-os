/**
 * Deterministic CLI runner for the provider profile/watch golden suites.
 * Data only: no process streams, clock, or filesystem.
 */
import type { ProfileSelectionResult } from "../../../../../packages/core/src/contracts/index";
import {
  createProviderCommandDefinition,
  type ProviderCommandRuntime,
} from "../../../../../packages/cli/src/commands/provider";
import { type CliDependencies, runCli } from "../../../../../packages/cli/src/index";
import { SYNTHETIC_BRAND } from "../../../../golden/helpers";
import { envRecord, selectedResult, watchProviders } from "./data";

const NOW = 1_700_000_000_000;

export const goldenRuntime = (): ProviderCommandRuntime => ({
  resolve: async () => ({
    ok: true,
    chainName: "default",
    decision: {
      kind: "selected",
      chainName: "default",
      providerName: "coding-plan",
      costClass: "subscription",
    },
    skipped: [],
    parks: [],
    announcements: [],
  }),
  quota: async () => ({ ok: false, code: "provider.chain.empty", summary: "no chain" }),
  parks: () => ({ ok: true, value: [] }),
  profileResolve: async (input: {
    readonly forSpawn?: boolean;
  }): Promise<ProfileSelectionResult> =>
    input.forSpawn
      ? {
          ...selectedResult(),
          decision: { ...selectedResult().decision, envRecord },
        }
      : selectedResult(),
  watchStatus: async () => ({ ok: true, providers: watchProviders }),
});

export const runGolden = async (
  args: readonly string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
  let stdout = "";
  let stderr = "";
  const deps: CliDependencies = {
    brand: SYNTHETIC_BRAND,
    clock: { now: () => NOW },
    newRunId: () => "run-provider-profile-golden",
    secrets: [],
    program: { commands: { provider: createProviderCommandDefinition(goldenRuntime()) } },
  };
  const exitCode = await runCli(
    ["provider", ...args],
    {
      stdout: { write: (chunk) => (stdout += chunk) },
      stderr: { write: (chunk) => (stderr += chunk) },
    },
    deps,
  );
  return { exitCode, stdout, stderr };
};
