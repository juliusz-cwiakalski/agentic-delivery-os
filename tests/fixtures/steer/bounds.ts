/**
 * The read-bounds fixtures: 1/20/21/25-due note sets whose landing side is
 * uncapped while the payload lists at most 20 notes.
 */

import type { SteerMessageRecord } from "../../../packages/core/src/contracts/index";
import { makeMessage } from "./cases";

const BASE = Date.parse("2026-11-16T08:00:00.000Z");

/** `count` due notes ranked by a deliberate priority/created/id matrix. */
export const dueNotes = (count: number): readonly SteerMessageRecord[] =>
  Array.from({ length: count }, (_, index) => {
    const priority =
      index % 4 === 0 ? "urgent" : index % 4 === 1 ? "high" : index % 4 === 2 ? "normal" : "low";
    return makeMessage({
      id: `msg-due-${String(index + 1).padStart(2, "0")}`,
      priority,
      created: new Date(BASE + index * 1_000).toISOString(),
      subject: `due note ${String(index + 1)}`,
    });
  });
