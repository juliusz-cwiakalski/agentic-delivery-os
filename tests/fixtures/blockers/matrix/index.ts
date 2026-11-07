/**
 * The question matrix: all four closed types, both audiences, and the mixed
 * ages the ranking and surface suites consume.
 */

import type { BlockerQuestionRecord } from "../../../../packages/core/src/contracts/index";
import { FIXED_ISO, FIXED_MS, makeQuestion } from "../records";

export const decisionNeeded = (id = "q-d1", overrides = {}): BlockerQuestionRecord =>
  makeQuestion({
    id,
    type: "decision-needed",
    audience: "coordinator",
    lane: "L5",
    question: "closeout residue sweep: full or lite?",
    options: ["full", "lite+escalation"],
    ...overrides,
  });

export const specAmbiguity = (id = "q-s1", overrides = {}): BlockerQuestionRecord =>
  makeQuestion({
    id,
    type: "spec-ambiguity",
    audience: "owner",
    lane: "L2",
    question: "which acceptance criterion applies?",
    options: [],
    ...overrides,
  });

export const credentialMissing = (id = "q-c1", overrides = {}): BlockerQuestionRecord =>
  makeQuestion({
    id,
    type: "credential-missing",
    audience: "owner",
    lane: "L4",
    question: "GITHUB_TOKEN",
    options: [],
    ...overrides,
  });

export const externalWait = (id = "q-e1", overrides = {}): BlockerQuestionRecord =>
  makeQuestion({
    id,
    type: "external-wait",
    audience: "coordinator",
    lane: "L3",
    question: "awaiting vendor confirmation",
    options: [],
    ...overrides,
  });

export const allTypes = (): readonly BlockerQuestionRecord[] => [
  decisionNeeded(),
  specAmbiguity(),
  credentialMissing(),
  externalWait(),
];

export const older = (hours: number): string =>
  new Date(FIXED_MS - hours * 3_600_000).toISOString();

export { FIXED_ISO, FIXED_MS };
