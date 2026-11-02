import type { DeliveryRequest } from "../../packages/core/src/contracts/index";

const base: DeliveryRequest = {
  identity: { systemName: "github", entityId: "178" },
  sourceRef: "feat/GH-178/x",
  targetRef: "main-tools",
  reviewState: "open",
  threads: [],
};

const full: DeliveryRequest = {
  ...base,
  sourceHeadSha: "1".repeat(40),
  mergeableState: "conflicting",
  commitCount: 1,
  changedFileCount: 1,
};

export const absent = base;
export const present = full;

// @ts-expect-error mergeableState is a closed union
const invalid: DeliveryRequest = { ...base, mergeableState: "WRONG" };
export const rejected = invalid;
