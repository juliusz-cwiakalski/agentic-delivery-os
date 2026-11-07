/**
 * Lifecycle and pacing fixtures (GH-234 F-6, F-7). Data only.
 */
import type {
  ProviderPacingConfiguration,
  ProviderPeakWindow,
  ProviderProfileConfiguration,
} from "../../../../../packages/core/src/contracts/index";
import { mixedChain } from "../selection/fixtures";

export const lifecycleChain = (): ProviderProfileConfiguration => mixedChain();

export const holdJudgmentPacing = (): ProviderPacingConfiguration => ({
  goalPriorities: ["hold-judgment", "utilize-subscription", "minimize-paid"],
  tailThresholdPercent: 80,
  rungs: {
    cruise: { name: "cruise", thresholdPercent: 0, executionModel: "claude-sonnet-cruise" },
    conserve: { name: "conserve", thresholdPercent: 70, executionModel: "claude-haiku" },
    emergency: { name: "emergency", thresholdPercent: 90, executionModel: "claude-haiku-mini" },
  },
});

export const utilizePacing = (): ProviderPacingConfiguration => ({
  ...holdJudgmentPacing(),
  goalPriorities: ["utilize-subscription", "hold-judgment", "minimize-paid"],
});

export const peakWindow = (): ProviderPeakWindow => ({
  timezone: "UTC",
  startSecondsOfDay: 6 * 3600,
  endSecondsOfDay: 10 * 3600,
  bufferSeconds: 0,
});
