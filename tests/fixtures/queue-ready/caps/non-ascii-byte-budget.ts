/**
 * Non-ASCII cap-sized fixture (R2.2/R3.3, TC-QREADY-019/035).
 *
 * Eight candidates with 16 multi-byte (CJK) labels and 16 CJK `blocked-by`
 * relation targets each: the raw projected content stays under 65 536 UTF-16
 * code units while exceeding 65 536 UTF-8 bytes, so the byte-budget reduction
 * must fire only when the bound is measured in UTF-8. Every relation target and
 * label carries a rank/index sentinel so the exact survivor set is observable.
 */
import type {
  QueueReadyFacts,
  WorkItemRelation,
} from "../../../../packages/core/src/contracts/index";
import { baseFacts, makeWorkItem, workItemRead } from "../harness";

const CJK = "汉";
const ASCII = "x";

export const nonAsciiRefs = [
  "GH-176",
  "GH-177",
  "GH-178",
  "GH-179",
  "GH-180",
  "GH-181",
  "GH-182",
  "GH-183",
] as const;

/** `r<rank><index>` suffix; at most four characters, so the target stays ≤128. */
export const relationSentinel = (rank: number, index: number): string => `r${rank}${index}`;

/** `l<rank><index:02>` suffix; at most five characters, so the label stays ≤128. */
export const labelSentinel = (rank: number, index: number): string =>
  `l${rank}${String(index).padStart(2, "0")}`;

const cjkLabel = (rank: number, index: number): string =>
  `${CJK.repeat(120)}${labelSentinel(rank, index)}`;

const cjkTarget = (rank: number, index: number): string =>
  `${CJK.repeat(120)}${relationSentinel(rank, index)}`;

const cjkRelations = (rank: number): WorkItemRelation[] =>
  Array.from({ length: 16 }, (_, index) => ({
    relationKind: "blocked-by",
    target: { systemName: "github", entityId: cjkTarget(rank, index) },
  }));

const entityIdOf = (ref: string): string => ref.replace(/^GH-/, "");

export const nonAsciiByteBudgetFacts = (): QueueReadyFacts =>
  baseFacts({
    candidates: [...nonAsciiRefs],
    tracker: workItemRead(
      nonAsciiRefs.map((ref, candidateIndex) => {
        const rank = candidateIndex + 1;
        return makeWorkItem({
          entityId: entityIdOf(ref),
          labels: [
            "priority:high",
            ...Array.from({ length: 15 }, (_, index) => cjkLabel(rank, index + 1)),
          ],
          relations: cjkRelations(rank),
        });
      }),
    ),
  });

/** ASCII twin with the same shape; it must keep the identical verdicts. */
export const nonAsciiByteBudgetControlFacts = (): QueueReadyFacts =>
  baseFacts({
    candidates: [...nonAsciiRefs],
    tracker: workItemRead(
      nonAsciiRefs.map((ref, candidateIndex) => {
        const rank = candidateIndex + 1;
        return makeWorkItem({
          entityId: entityIdOf(ref),
          labels: [
            "priority:high",
            ...Array.from(
              { length: 15 },
              (_, index) => `${ASCII.repeat(120)}${labelSentinel(rank, index + 1)}`,
            ),
          ],
          relations: Array.from({ length: 16 }, (_, index) => ({
            relationKind: "blocked-by",
            target: {
              systemName: "github",
              entityId: `${ASCII.repeat(120)}${relationSentinel(rank, index)}`,
            },
          })),
        });
      }),
    ),
  });
