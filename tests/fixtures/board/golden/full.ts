/**
 * The cap-sized two-repository fixture behind the committed four-section golden
 * (GH-297 AC-F9-1, GAP-T4). Deterministic builders only: fixed clock, fixed run
 * id, synthetic brand, and no filesystem, network, or wall clock.
 */
import type { BoardRepositoryFixture } from "../harness";
import { BOARD_NOW_MS, HOUR_MS, ownerReviewGate, waiverGate } from "../matrix";

export const FULL_RUN_ID = "run-board-full-fixture";
export const FULL_NOW_ISO = "2026-11-06T12:00:00Z";
export const FULL_NOW_MS = BOARD_NOW_MS;

const repository = (key: string, offset: number): BoardRepositoryFixture => ({
  key,
  gates: [
    ownerReviewGate(`GH-${String(7001 + offset)}`, 26 * HOUR_MS),
    waiverGate(`GH-${String(7002 + offset)}`, 30 * HOUR_MS, { waivedBy: "principal-w" }),
    ownerReviewGate(`GH-${String(7003 + offset)}`, 2 * HOUR_MS),
  ],
  lanes: [
    {
      ref: `GH-${String(7010 + offset)}`,
      laneId: `GH-${String(7010 + offset)}`,
      state: "delivering",
      holder: "principal-a",
      leaseId: `lease-${String(7010 + offset)}`,
      phase: "delivery",
    },
    {
      ref: `GH-${String(7011 + offset)}`,
      laneId: `GH-${String(7011 + offset)}`,
      state: "failed",
      holder: null,
      phase: null,
      phaseUnknownReason: "phase-unrecorded",
    },
  ],
  asks: [
    {
      id: `ask-${String(7020 + offset)}`,
      type: "approval",
      ref: `GH-${String(7002 + offset)}`,
      lane: `GH-${String(7002 + offset)}`,
      question: "Approve the merge?",
      askedAt: "2026-11-06T09:00:00Z",
      age: 3 * HOUR_MS,
      owner: "owner",
    },
    {
      id: `ask-ref-less-${key}`,
      type: "clarification",
      ref: null,
      lane: "none",
      question: "Which ref should this attach to?",
      askedAt: "2026-11-06T10:00:00Z",
      age: 2 * HOUR_MS,
      owner: "owner",
    },
  ],
  parks: [
    {
      ref: `GH-${String(7030 + offset)}`,
      reason: "peak-window",
      until: "2026-11-06T18:00:00Z",
      preservation: "preserved",
      providerProfile: "primary",
      owner: null,
    },
    {
      ref: `GH-${String(7031 + offset)}`,
      reason: "owner-hold",
      until: null,
      untilReason: "owner-hold-no-expiry",
      owner: null,
    },
  ],
});

export const fullBoardRepositories = (): readonly BoardRepositoryFixture[] => [
  repository("delivery-a-1a2b3c4d", 0),
  repository("delivery-b-5e6f7a8b", 100),
];
