/**
 * Eight-candidate astral human-bound worst case (R3.1, TC-QREADY-020).
 *
 * Every provider-derived field is at its declared character cap while one
 * code point is four UTF-8 bytes: the payload is legal (`data` ≤ 65 536 UTF-8
 * bytes) and not `value-clamped`, but a character-capped render exceeds the
 * 4 096-byte human bound. A byte-aware renderer stays inside the bound without
 * dropping a candidate line.
 */
import type { QueueReadyFacts } from "../../../../../packages/core/src/contracts/index";
import {
  baseFacts,
  BRANCH,
  deliveryRequestRead,
  job,
  localContext,
  makeDeliveryRequest,
  makePipelineRun,
  pipelineRunRead,
  providerConfig,
  providerConfigRead,
  providers,
  REVIEWS_AVAILABLE,
  SHA,
  workItemRead,
} from "../../harness";

const ASTRAL = "😀";

export const humanAstral8Refs = [
  "GH-176",
  "GH-177",
  "GH-178",
  "GH-179",
  "GH-180",
  "GH-181",
  "GH-182",
  "GH-183",
] as const;

export const humanAstral8 = (count: number): string => ASTRAL.repeat(count);

/** A 128-code-point source ref that still carries the candidate branch segment. */
export const humanAstral8SourceRef = (ref: string): string => `feat/${ref}/${humanAstral8(116)}`;

export const humanAstral8Facts = (): QueueReadyFacts =>
  baseFacts({
    candidates: [...humanAstral8Refs],
    repository: {
      binding: {
        state: "observed",
        host: "github.com",
        owner: humanAstral8(128),
        name: humanAstral8(128),
        remoteName: "origin",
      },
      head: { branch: humanAstral8(256), sha: SHA, detached: false },
    },
    // No observed items: deps, tier, and owner are all unknown.
    tracker: workItemRead([]),
    // Another active change makes repo-free unsatisfied.
    localContext: localContext({
      activeChange: {
        workItemRef: "GH-999",
        branch: BRANCH,
        changeFolder: "doc/changes/2026-10/2026-10-31--GH-999--other",
      },
    }),
    // A failed run and a disabled chain make the last two conditions blocking.
    ci: pipelineRunRead([makePipelineRun({ entityId: "1", jobs: [job("build", "failed")] })]),
    providers: providers({
      config: providerConfigRead(
        providerConfig({
          entries: { primary: { name: "primary", class: "subscription", enabled: false } },
        }),
      ),
    }),
    changes: deliveryRequestRead(
      humanAstral8Refs.map((ref) =>
        makeDeliveryRequest({
          entityId: humanAstral8(128),
          sourceRef: humanAstral8SourceRef(ref),
          reviewState: "approved",
        }),
      ),
      REVIEWS_AVAILABLE,
    ),
  });
