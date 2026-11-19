/**
 * GH-349's own milestone attached set at this change's boundary (TC-F4-012).
 *
 * Synthetic and offline: M4 has the change's own ticket done and at least one
 * other attached ticket still open, so the verified outcome is attachment plus
 * a recorded exit-review verdict and never a closed record (AC-F4-7, DEC-8).
 */
import type { MilestoneRecord } from "../../../packages/core/src/contracts/index";
import {
  attachedItem,
  MILESTONE_DECLARATION,
  MILESTONE_NUMBER,
  MILESTONE_TITLE,
  milestoneIdentity,
} from "./milestone";

export { MILESTONE_DECLARATION };

/** The change's own ticket, done. */
export const GH_349_TICKET = "349";

/** Another ticket attached to M4 that is still open at the boundary. */
export const M4_OPEN_TICKET = "352";

export const m4AttachedSet = (openTicket: "open" | "canceled" = "open"): MilestoneRecord => ({
  identity: milestoneIdentity(MILESTONE_NUMBER),
  title: MILESTONE_TITLE,
  state: "open",
  attachedItems: [
    attachedItem(GH_349_TICKET, "done"),
    attachedItem(M4_OPEN_TICKET, openTicket === "open" ? "in-progress" : "canceled"),
  ],
});
