/**
 * The four-section board fixtures (GH-297 TC-BOARD-001/002/006/030..034).
 *
 * Pure builders for the facts the edge resolves from the delivered lane/queue
 * fold, the typed-question view, and the park projection. No clock, filesystem,
 * or network access.
 */

import type {
  BoardActionFact,
  BoardAskFact,
  BoardLaneFact,
  BoardOwnerHold,
  BoardParkedFact,
  BoardRepositoryFixture,
} from "./harness";
import { HOUR_MS, ownerReviewGate, waiverGate } from "./matrix";

export const BOARD_REPOSITORY = "example-repository";

export const deliveringLane = (overrides: Partial<BoardLaneFact> = {}): BoardLaneFact => ({
  ref: "GH-3001",
  laneId: "GH-3001",
  state: "delivering",
  holder: "principal-a",
  leaseId: "lease-GH-3001",
  phase: "delivery",
  ...overrides,
});

export const failedLane = (overrides: Partial<BoardLaneFact> = {}): BoardLaneFact => ({
  ref: "GH-3002",
  laneId: "GH-3002",
  state: "failed",
  holder: null,
  phase: null,
  phaseUnknownReason: "phase-unrecorded",
  ...overrides,
});

export const idleLane = (overrides: Partial<BoardLaneFact> = {}): BoardLaneFact => ({
  ref: "GH-3003",
  laneId: "GH-3003",
  state: "delivering",
  holder: null,
  phase: null,
  phaseUnknownReason: "phases-complete",
  ...overrides,
});

export const ownerAsk = (overrides: Partial<BoardAskFact> = {}): BoardAskFact => ({
  id: "ask-GH-3001-1",
  type: "approval",
  ref: "GH-3001",
  lane: "GH-3001",
  question: "Approve the merge?",
  askedAt: "2026-11-06T09:00:00Z",
  age: 3 * HOUR_MS,
  owner: "owner",
  ...overrides,
});

export const peakPark = (overrides: Partial<BoardParkedFact> = {}): BoardParkedFact => ({
  ref: "GH-3010",
  reason: "peak-window",
  until: "2026-11-06T18:00:00Z",
  preservation: "preserved",
  providerProfile: "primary",
  owner: null,
  ...overrides,
});

export const ownerHoldPark = (overrides: Partial<BoardParkedFact> = {}): BoardParkedFact => ({
  ref: "GH-3011",
  reason: "owner-hold",
  until: null,
  untilReason: "owner-hold-no-expiry",
  owner: null,
  ...overrides,
});

/** One open retro action row fact with its aging state and window disclosure. */
export const boardAction = (overrides: Partial<BoardActionFact> = {}): BoardActionFact => ({
  actionId: "action-3001",
  owner: "agent-role:reviewer",
  level: "change",
  age: 5 * HOUR_MS,
  agingState: "current",
  window: "window-a",
  windowOpenCount: 1,
  windowLimit: 3,
  ...overrides,
});

export const activeOwnerHold: BoardOwnerHold = {
  active: true,
  source: "env",
  reason: "operator requested a hold",
};

export const allFourRepository = (
  overrides: Partial<BoardRepositoryFixture> = {},
): BoardRepositoryFixture => ({
  key: BOARD_REPOSITORY,
  gates: [
    ownerReviewGate("GH-3001", 2 * HOUR_MS),
    waiverGate("GH-3020", 30 * HOUR_MS, { waivedBy: "principal-w" }),
  ],
  lanes: [deliveringLane(), failedLane()],
  asks: [ownerAsk(), ownerAsk({ id: "ask-3020-1", ref: "GH-3020", lane: "GH-3020" })],
  parks: [peakPark(), ownerHoldPark()],
  actions: [
    boardAction(),
    boardAction({ actionId: "action-3020", window: "window-b", agingState: "nudged" }),
  ],
  ...overrides,
});
