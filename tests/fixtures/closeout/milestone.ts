/**
 * Synthetic milestone shapes shared by the milestone suites (GH-349 F-4).
 *
 * Pure data plus small builders. No I/O, no clock, no provider process: the
 * suites drive the pure planner and the injected provider runtime only.
 */
import type {
  DeliveryStateAlias,
  MilestoneAttachedItem,
  MilestoneReadObservation,
  MilestoneRecord,
  ProviderQualifiedIdentity,
} from "../../../packages/core/src/contracts/index";

export const MILESTONE_DECLARATION = "M4: Jaiship-native delivery";
export const MILESTONE_TITLE = "Jaiship-native delivery";
export const MILESTONE_NUMBER = 4;
export const OTHER_MILESTONE_TITLE = "M5: A different commitment";

export const milestoneIdentity = (
  entityId: string | number = MILESTONE_NUMBER,
): ProviderQualifiedIdentity => ({ systemName: "github", entityId: String(entityId) });

export const attachedItem = (
  entityId: string,
  deliveryState: DeliveryStateAlias,
): MilestoneAttachedItem => ({ identity: milestoneIdentity(entityId), deliveryState });

/** A GitHub-shaped attached page whose items are all done unless overridden. */
export const attachedSet = (
  count = 3,
  override?: { readonly index: number; readonly deliveryState: DeliveryStateAlias },
): readonly MilestoneAttachedItem[] =>
  Array.from({ length: count }, (_unused, position) =>
    attachedItem(
      `90${position + 1}`,
      override !== undefined && override.index === position ? override.deliveryState : "done",
    ),
  );

export const milestoneRecord = (overrides: Partial<MilestoneRecord> = {}): MilestoneRecord => ({
  identity: milestoneIdentity(),
  title: MILESTONE_TITLE,
  state: "open",
  attachedItems: attachedSet(),
  ...overrides,
});

export const observedMilestone = (record: MilestoneRecord): MilestoneReadObservation => ({
  observation: "observed",
  value: record,
});

export const unavailableMilestone = (): MilestoneReadObservation => ({
  observation: "unavailable",
});

export const invalidMilestone = (
  detail = "malformed provider payload",
): MilestoneReadObservation => ({
  observation: "invalid",
  detail,
});

/** A record whose title matches the declaration and whose items are all terminal. */
export const satisfyingMilestone = (): MilestoneReadObservation =>
  observedMilestone(milestoneRecord());

export const alreadyClosedMilestone = (): MilestoneReadObservation =>
  observedMilestone(milestoneRecord({ state: "closed" }));

export const openItemMilestone = (): MilestoneReadObservation =>
  observedMilestone(
    milestoneRecord({ attachedItems: attachedSet(3, { index: 1, deliveryState: "in-progress" }) }),
  );

export const canceledItemMilestone = (): MilestoneReadObservation =>
  observedMilestone(
    milestoneRecord({ attachedItems: attachedSet(3, { index: 1, deliveryState: "canceled" }) }),
  );

export const unknownStateMilestone = (): MilestoneReadObservation =>
  observedMilestone(milestoneRecord({ state: "unknown" }));

export const truncatedMilestone = (): MilestoneReadObservation =>
  observedMilestone(
    milestoneRecord({
      attachedItems: attachedSet(2),
      truncation: { truncated: true, omitted: 1, cap: 100 },
    }),
  );
