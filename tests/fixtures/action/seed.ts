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
import {
  closeRetroAction,
  listRetroActions,
} from "../../../packages/core/src/domain/action-closure";
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

/** Close one action through the production closure engine. */
export const closeAction = (
  store: StateStorePort,
  request: import("../../../packages/core/src/contracts/index").RetroActionCloseRequest,
  options: {
    readonly closureId?: string;
    readonly nowMs?: number;
    readonly decidedAt?: number;
  } = {},
): ReturnType<
  typeof import("../../../packages/core/src/domain/action-closure").closeRetroAction
> => {
  fenceCounter += 1;
  return closeRetroAction(createRetroActionRegistryPort(store), request, {
    closureId: options.closureId ?? `closure-${String(fenceCounter).padStart(3, "0")}`,
    decidedAt: options.decidedAt ?? options.nowMs ?? FILING_MS,
    nowMs: options.nowMs ?? FILING_MS,
    fenceToken: `fence-action-${String(fenceCounter)}`,
  });
};

/** List the recorded actions and window disclosures through the production engine. */
export const listActions = (
  store: StateStorePort,
  nowMs: number,
  window?: string,
): ReturnType<typeof import("../../../packages/core/src/domain/action-closure").listRetroActions> =>
  listRetroActions(createRetroActionRegistryPort(store), {
    nowMs,
    ...(window === undefined ? {} : { window }),
  });
