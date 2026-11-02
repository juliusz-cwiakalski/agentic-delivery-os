/** Owed-flip dependent fixtures: eligible, open-blocker, and unknown-signal. */
import type { CloseoutDependentFact } from "../../../packages/core/src/contracts/index";
import { makeDependent, observed, testDependent } from "./harness";

export const eligibleDependent = (entityId = "200"): CloseoutDependentFact =>
  testDependent(makeDependent(entityId), observed([]));

export const blockedDependent = (entityId = "201"): CloseoutDependentFact =>
  testDependent(
    makeDependent(entityId),
    observed([
      makeDependent("202", { status: { nativeStatus: "open", deliveryState: "in-progress" } }),
    ]),
  );

export const unavailableRelationDependent = (entityId = "203"): CloseoutDependentFact =>
  testDependent(makeDependent(entityId), { observation: "unavailable" });

export const alreadyHandBackDependent = (entityId = "204"): CloseoutDependentFact =>
  testDependent(makeDependent(entityId, { labels: ["change", "hand-back"] }), observed([]));
