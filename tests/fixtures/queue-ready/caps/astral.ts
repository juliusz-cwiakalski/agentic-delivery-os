/**
 * Astral-code-point cap fixture (R2.4, TC-QREADY-038).
 *
 * Every provider-derived capped value is built from a non-BMP character
 * (U+1F600, one code point / two UTF-16 units / four UTF-8 bytes) at, below,
 * and above its declared cap, so a UTF-16 slice would split a surrogate pair.
 */
import type { QueueReadyFacts } from "../../../../packages/core/src/contracts/index";
import {
  baseFacts,
  blockedBy,
  deliveryRequestRead,
  makeDeliveryRequest,
  makeWorkItem,
  REVIEWS_AVAILABLE,
  SHA,
  workItemRead,
} from "../harness";

const ASTRAL = "😀";
const SOURCE_PREFIX = "feat/GH-176/";

export const astral = (count: number): string => ASTRAL.repeat(count);

const sourceRefOf = (count: number): string =>
  `${SOURCE_PREFIX}${astral(count - SOURCE_PREFIX.length)}`;

export const astralAtCap = {
  label: astral(128),
  identity: astral(128),
  ref: astral(128),
  owner: astral(128),
  name: astral(128),
  branch: astral(256),
  timestamp: astral(40),
  sourceRef: sourceRefOf(128),
} as const;

export const astralOverCap = {
  label: astral(130),
  identity: astral(130),
  ref: astral(130),
  owner: astral(130),
  name: astral(130),
  branch: astral(258),
  timestamp: astral(42),
  sourceRef: sourceRefOf(130),
} as const;

type AstralValues = {
  readonly label: string;
  readonly identity: string;
  readonly ref: string;
  readonly owner: string;
  readonly name: string;
  readonly branch: string;
  readonly timestamp: string;
  readonly sourceRef: string;
};

const factsFor = (values: AstralValues): QueueReadyFacts =>
  baseFacts({
    repository: {
      binding: {
        state: "observed",
        host: "github.com",
        owner: values.owner,
        name: values.name,
        remoteName: "origin",
      },
      head: { branch: values.branch, sha: SHA, detached: false },
    },
    tracker: workItemRead([
      makeWorkItem({
        entityId: "176",
        labels: ["priority:high", values.label],
        relations: [blockedBy(values.identity)],
        updatedAt: values.timestamp,
      }),
    ]),
    changes: deliveryRequestRead(
      [
        makeDeliveryRequest({
          entityId: values.identity,
          sourceRef: values.sourceRef,
          targetRef: values.ref,
          reviewState: "approved",
        }),
      ],
      REVIEWS_AVAILABLE,
    ),
  });

export const astralAtCapFacts = (): QueueReadyFacts => factsFor(astralAtCap);

export const astralOverCapFacts = (): QueueReadyFacts => factsFor(astralOverCap);
