/** Scripted discriminated read observations (DM-11). */
import type { CloseoutReadObservation, WorkItem } from "../../../packages/core/src/contracts/index";
import { makeWorkItem, observed } from "./harness";

export const fakeObserved = (): CloseoutReadObservation<WorkItem> => observed(makeWorkItem());
export const fakeNotFound = (): CloseoutReadObservation<WorkItem> => ({ observation: "not-found" });
export const fakeUnavailableSurface = (): CloseoutReadObservation<WorkItem> => ({
  observation: "unavailable",
});
export const fakeInvalidPayload = (): CloseoutReadObservation<WorkItem> => ({
  observation: "invalid",
  detail: "unparsable payload",
});
export const fakeUnavailableRelation = (): CloseoutReadObservation<readonly WorkItem[]> => ({
  observation: "unavailable",
});
export const fakeUnknownRelation = (): CloseoutReadObservation<readonly WorkItem[]> => ({
  observation: "observed",
  value: [],
  signals: { relations: "unknown" },
});
