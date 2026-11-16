/**
 * The registry seeder (GH-287 test-plan §4.1 item 3): rows are appended through
 * the same validated port the production filing and closure writers use.
 */
import type {
  RetroActionClosureRecord,
  RetroActionCommandOutcome,
  RetroActionDraft,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import { fileRetroAction } from "../../../packages/core/src/domain/action-filing";
import {
  createRetroActionRegistryPort,
  readActionRegistry,
} from "../../../packages/core/src/state/action-registry";
import { FILING_MS } from "./clock";

let fenceCounter = 0;

/** File one action through the production engine; returns the outcome. */
export const fileAction = (
  store: StateStorePort,
  draft: RetroActionDraft,
  options: {
    readonly actionId?: string;
    readonly filedAt?: number;
    readonly fenceToken?: string;
  } = {},
): RetroActionCommandOutcome => {
  fenceCounter += 1;
  return fileRetroAction(createRetroActionRegistryPort(store), {
    draft,
    actionId: options.actionId ?? `action-${String(fenceCounter).padStart(3, "0")}`,
    filedAt: options.filedAt ?? FILING_MS,
    fenceToken: options.fenceToken ?? `fence-action-${String(fenceCounter)}`,
  });
};

/** Append one closure record through the validated port. */
export const appendClosure = (
  store: StateStorePort,
  record: RetroActionClosureRecord,
): ReturnType<ReturnType<typeof createRetroActionRegistryPort>["appendClosure"]> => {
  fenceCounter += 1;
  return createRetroActionRegistryPort(store).appendClosure(
    record,
    `fence-action-${String(fenceCounter)}`,
  );
};

/** The verified snapshot of the temp store. */
export const actionSnapshot = (store: StateStorePort) => {
  const read = readActionRegistry(store);
  if (!read.ok) throw new Error(`fixture read failed: ${read.error.code}`);
  return read.value;
};
