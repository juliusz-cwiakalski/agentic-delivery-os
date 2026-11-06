/**
 * The read-only `brief` command definition (GH-228 F-1, D6).
 *
 * The handler owns no stream writes and chooses no exit code. It reuses
 * `collectStatusFacts` so one invocation performs exactly the same read set as
 * one status invocation; every source is injected through the same runtime.
 */
import { projectBrief, renderBriefHuman } from "@delivery-os/core";
import type { BrandIdentity, BriefPayload } from "@delivery-os/core/contracts";
import type { CommandDefinition } from "../index.js";
import { collectStatusFacts, type StatusCommandRuntime } from "./status.js";

/** The brief runtime is the status runtime: the same injected reader set. */
export type BriefCommandRuntime = StatusCommandRuntime;

/** Build the `brief` command definition over the injected status readers. */
export const createBriefCommandDefinition = (runtime: BriefCommandRuntime): CommandDefinition => ({
  flags: [],
  positionals: { max: 0 },
  humanText: (data: unknown, brand: BrandIdentity): string =>
    renderBriefHuman(data as BriefPayload, brand),
  handler: async () => ({ data: projectBrief(await collectStatusFacts(runtime)) }),
});
