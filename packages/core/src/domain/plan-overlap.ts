/**
 * Pure pairwise plan overlap (GH-226 F-10, F-2, F-5; DEC-1, DEC-5).
 *
 * A sequence verdict names every overlapping descriptor that is present in both
 * declared scopes, orders a declared producer first, and is stable across
 * argument order and replay. No I/O, clock, randomness, or environment access.
 */
import {
  PLAN_MAX_OVERLAPPING_PATHS,
  type PlanDocument,
  type PlanInteraction,
  type PlanOverlapData,
  type PlanOverlapReason,
  type PlanScope,
} from "#contracts";
import { globToRegExp, normalizeRepoPath, packageCovers, staticPrefix } from "./plan-paths.js";

/** The injected pair. */
export type PlanOverlapInput = {
  readonly refA: string;
  readonly planA: PlanDocument;
  readonly refB: string;
  readonly planB: PlanDocument;
};

const compareText = (left: string, right: string): number => {
  const a = Array.from(left);
  const b = Array.from(right);
  const length = Math.min(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const leftPoint = a[index]?.codePointAt(0) ?? 0;
    const rightPoint = b[index]?.codePointAt(0) ?? 0;
    if (leftPoint !== rightPoint) return leftPoint < rightPoint ? -1 : 1;
  }
  return a.length === b.length ? 0 : a.length < b.length ? -1 : 1;
};

type Descriptor = {
  readonly kind: "file" | "folder" | "package";
  readonly value: string;
};

const descriptors = (scope: PlanScope): readonly Descriptor[] => [
  ...(scope.files ?? []).map((value) => ({ kind: "file" as const, value })),
  ...(scope.folders ?? []).map((value) => ({ kind: "folder" as const, value })),
  ...(scope.packages ?? []).map((value) => ({ kind: "package" as const, value })),
];

const folderCovers = (folder: string, target: string): boolean =>
  target === folder || target.startsWith(`${folder}/`);

const moreSpecificFolder = (left: string, right: string): string | undefined => {
  if (left === right) return left;
  if (folderCovers(left, right)) return right;
  if (folderCovers(right, left)) return left;
  return undefined;
};

const packagePairOverlap = (left: string, right: string): string | undefined => {
  if (left === right) return left;
  const leftPrefix = staticPrefix(left);
  const rightPrefix = staticPrefix(right);
  if (leftPrefix === rightPrefix) return compareText(left, right) <= 0 ? left : right;
  if (rightPrefix === "" || (leftPrefix !== "" && leftPrefix.startsWith(`${rightPrefix}/`))) {
    return left;
  }
  if (leftPrefix === "" || (rightPrefix !== "" && rightPrefix.startsWith(`${leftPrefix}/`))) {
    return right;
  }
  return undefined;
};

/** The most concrete shared descriptor for one declared pair, if any. */
const pairOverlap = (left: Descriptor, right: Descriptor): string | undefined => {
  const leftValue = normalizeRepoPath(left.value);
  const rightValue = normalizeRepoPath(right.value);
  if (left.kind === "file" && right.kind === "file") {
    return leftValue === rightValue ? leftValue : undefined;
  }
  if (left.kind === "file") {
    if (right.kind === "folder" && folderCovers(rightValue, leftValue)) return leftValue;
    if (right.kind === "package" && packageCovers(rightValue, leftValue)) return leftValue;
    return undefined;
  }
  if (right.kind === "file") {
    if (left.kind === "folder" && folderCovers(leftValue, rightValue)) return rightValue;
    if (left.kind === "package" && packageCovers(leftValue, rightValue)) return rightValue;
    return undefined;
  }
  if (left.kind === "folder" && right.kind === "folder") {
    return moreSpecificFolder(leftValue, rightValue);
  }
  if (left.kind === "folder") {
    if (packageCovers(rightValue, leftValue)) return leftValue;
    const prefix = staticPrefix(rightValue);
    if (prefix.length > 0 && folderCovers(leftValue, prefix)) return rightValue;
    return undefined;
  }
  if (right.kind === "folder") {
    if (packageCovers(leftValue, rightValue)) return rightValue;
    const prefix = staticPrefix(leftValue);
    if (prefix.length > 0 && folderCovers(rightValue, prefix)) return leftValue;
    return undefined;
  }
  return packagePairOverlap(leftValue, rightValue);
};

const scopeDescriptors = (document: PlanDocument): readonly Descriptor[] =>
  document.phases.flatMap((phase) => descriptors(phase.scope));

const interactions = (
  ref: string,
  document: PlanDocument,
): readonly { readonly ref: string; readonly interaction: PlanInteraction }[] =>
  document.phases.flatMap((phase) =>
    (phase.interactions ?? []).map((interaction) => ({ ref, interaction })),
  );

const interactionOrder = (
  refA: string,
  planA: PlanDocument,
  refB: string,
  planB: PlanDocument,
): { readonly first: string; readonly reason: PlanOverlapReason } | undefined => {
  const left = interactions(refA, planA);
  const right = interactions(refB, planB);
  for (const l of left) {
    for (const r of right) {
      if (normalizeRepoPath(l.interaction.target) !== normalizeRepoPath(r.interaction.target)) {
        continue;
      }
      if (l.interaction.role === "producer" && r.interaction.role === "consumer") {
        return { first: l.ref, reason: "shared-contract-files" };
      }
      if (r.interaction.role === "producer" && l.interaction.role === "consumer") {
        return { first: r.ref, reason: "shared-contract-files" };
      }
    }
  }
  return undefined;
};

const declaredProduction = (document: PlanDocument, overlapping: readonly string[]): boolean =>
  document.phases.some((phase) =>
    (phase.interactions ?? []).some(
      (interaction) =>
        interaction.role === "producer" &&
        overlapping.some((path) => {
          const target = normalizeRepoPath(interaction.target);
          const candidate = normalizeRepoPath(path);
          return (
            target === candidate ||
            packageCovers(candidate, target) ||
            globToRegExp(candidate).test(target)
          );
        }),
    ),
  );

/** Compute the pairwise overlap verdict. */
export const computePlanOverlap = (input: PlanOverlapInput): PlanOverlapData => {
  const leftDescriptors = scopeDescriptors(input.planA);
  const rightDescriptors = scopeDescriptors(input.planB);
  const found = new Set<string>();
  for (const left of leftDescriptors) {
    for (const right of rightDescriptors) {
      const overlap = pairOverlap(left, right);
      if (overlap !== undefined) found.add(overlap);
    }
  }
  const sorted = [...found].sort(compareText);
  const total = sorted.length;
  const overlappingPaths = sorted.slice(0, PLAN_MAX_OVERLAPPING_PATHS);
  if (total === 0) {
    return {
      verdict: "parallel",
      planA: input.refA,
      planB: input.refB,
      overlappingPaths: [],
      truncated: false,
      totalOverlappingPaths: 0,
    };
  }

  const interaction = interactionOrder(input.refA, input.planA, input.refB, input.planB);
  let first: string;
  if (interaction !== undefined) {
    first = interaction.first;
  } else if (
    declaredProduction(input.planA, overlappingPaths) &&
    !declaredProduction(input.planB, overlappingPaths)
  ) {
    first = input.refA;
  } else if (
    declaredProduction(input.planB, overlappingPaths) &&
    !declaredProduction(input.planA, overlappingPaths)
  ) {
    first = input.refB;
  } else {
    first = compareText(input.refA, input.refB) <= 0 ? input.refA : input.refB;
  }
  const second = first === input.refA ? input.refB : input.refA;
  return {
    verdict: "run-in-sequence",
    planA: input.refA,
    planB: input.refB,
    overlappingPaths,
    truncated: sorted.length > overlappingPaths.length,
    totalOverlappingPaths: total,
    ordering: `${first}-before-${second}`,
    reason: interaction?.reason ?? "shared-paths",
  };
};
