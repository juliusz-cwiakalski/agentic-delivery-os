/**
 * Probe fixtures (GH-234 F-4, NFR-5): a recording probe port that logs every
 * provider probed in a resolution pass. Data/behaviour only, never a test file.
 */
import type {
  ProfileProbePort,
  ProfileProviderAvailability,
} from "../../../../../packages/core/src/contracts/index";
import { available, exhausted } from "../selection/fixtures";

export type RecordingProbe = ProfileProbePort & {
  readonly calls: string[];
  readonly counts: Record<string, number>;
};

export const recordingProbe = (
  decide: (providerName: string) => ProfileProviderAvailability | "throw" = () => available(),
): RecordingProbe => {
  const calls: string[] = [];
  const counts: Record<string, number> = {};
  return {
    calls,
    counts,
    probe: (providerName: string) => {
      calls.push(providerName);
      counts[providerName] = (counts[providerName] ?? 0) + 1;
      const verdict = decide(providerName);
      if (verdict === "throw") throw new Error(`probe failure for ${providerName}`);
      return verdict;
    },
  };
};

export { available, exhausted };
