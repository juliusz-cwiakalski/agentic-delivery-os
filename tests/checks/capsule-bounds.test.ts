/** TC-CAP-005/026 — declared caps and closed vocabularies are single-sourced. */
import { describe, expect, test } from "bun:test";
import {
  CAPSULE_MAX_BYTES,
  CAPSULE_MAX_CANDIDATES,
  CAPSULE_MAX_CANDIDATE_BYTES,
  CAPSULE_MAX_DIFF_BYTES,
  CAPSULE_MAX_DIFF_FILES,
  CAPSULE_MAX_DIFF_HITS,
  CAPSULE_MAX_EVENTS,
  CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
  CAPSULE_MAX_HUMAN_THREADS,
  CAPSULE_MAX_INDEX_LINES,
  CAPSULE_MAX_RESIDUE_ITEMS,
  CAPSULE_MAX_SESSIONS,
  CAPSULE_DIFF_ACTIONS,
  CAPSULE_DIFF_MARKER_KINDS,
  CAPSULE_RESIDUE_KINDS,
} from "../../packages/core/src/contracts/index";

describe("capsule bounds data", () => {
  test("every declared cap is the pinned positive value", () => {
    expect(
      [
        CAPSULE_MAX_EVENTS,
        CAPSULE_MAX_BYTES,
        CAPSULE_MAX_EVENT_PAYLOAD_BYTES,
        CAPSULE_MAX_CANDIDATES,
        CAPSULE_MAX_CANDIDATE_BYTES,
        CAPSULE_MAX_INDEX_LINES,
        CAPSULE_MAX_RESIDUE_ITEMS,
        CAPSULE_MAX_DIFF_BYTES,
        CAPSULE_MAX_DIFF_FILES,
        CAPSULE_MAX_DIFF_HITS,
        CAPSULE_MAX_HUMAN_THREADS,
        CAPSULE_MAX_SESSIONS,
      ].every((value) => Number.isInteger(value) && value > 0),
    ).toBe(true);
  });

  test("the residue and marker vocabularies stay closed", () => {
    expect(CAPSULE_RESIDUE_KINDS.length).toBe(8);
    expect(new Set(CAPSULE_RESIDUE_KINDS).size).toBe(8);
    expect(CAPSULE_DIFF_MARKER_KINDS.length).toBe(4);
    expect(CAPSULE_DIFF_ACTIONS.length).toBe(4);
  });
});
