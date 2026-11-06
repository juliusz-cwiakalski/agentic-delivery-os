/**
 * The pure brief projection and deterministic human renderer (GH-228 F-1..F-6).
 *
 * No I/O, clock, randomness, or ambient environment: every variable fact
 * (including `nowMs`/`nowIso`) arrives through `StatusFacts`, and the digest is
 * built over the same facts. The projection reuses the digest's section states,
 * counts, truncation, and binding by reference, then derives only the two
 * declared non-digest claims: owner-gate ages under the digest's parse-and-floor
 * rule and the closed placeholder catalog entries. The renderer is a pure
 * function of the payload plus the injected brand.
 */
import {
  BRIEF_PLACEHOLDER_CATALOG,
  BRIEF_PLACEHOLDER_TITLES,
  BRIEF_SCHEMA_VERSION,
  BRIEF_SURFACE_ORDER,
  type BrandIdentity,
  type BriefAction,
  type BriefActionEvidence,
  type BriefAnchorGroup,
  type BriefPayload,
  type BriefPlaceholderEntry,
  type BriefPlaceholderSurfaceId,
  type BriefSurface,
  type BriefSurfaceId,
  type BriefSurfaceState,
  type BriefTruncation,
  STATUS_MAX_HUMAN_BYTES,
  STATUS_MAX_HUMAN_LINES,
  type StatusDigest,
  type StatusFacts,
  type StatusSection,
  type StatusSectionId,
  type WorkItem,
} from "#contracts";
import { aggregateStatus } from "./status.js";

const DAY_MS = 86_400_000;

/** Ascending code-unit comparison: deterministic and independent of locale. */
const compareText = (left: string, right: string): number => {
  if (left === right) return 0;
  return left < right ? -1 : 1;
};

const numeric = (value: string): number | undefined => {
  if (!/^-?\d+(?:\.\d+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Numeric-aware identity comparison, falling back to text. */
const compareIdentity = (left: string, right: string): number => {
  const a = numeric(left);
  const b = numeric(right);
  if (a !== undefined && b !== undefined) return a === b ? 0 : a < b ? -1 : 1;
  return compareText(left, right);
};

const sectionOf = (digest: StatusDigest, id: StatusSectionId): StatusSection => {
  const section = digest.sections.find((entry) => entry.id === id);
  if (section === undefined) throw new Error(`digest section ${id} is missing`);
  return section;
};

const placeholderEntry = (id: BriefPlaceholderSurfaceId): BriefPlaceholderEntry => {
  const entry = BRIEF_PLACEHOLDER_CATALOG.find((candidate) => candidate.capability === id);
  if (entry === undefined) throw new Error(`placeholder ${id} is missing from the catalog`);
  return entry;
};

const surfaceOf = (brief: BriefPayload, id: BriefSurfaceId): BriefSurface | undefined =>
  brief.surfaces.find((surface) => surface.id === id);

const digestSurface = (section: StatusSection): BriefSurface => {
  const reason = section.evidence.reasons[0];
  return {
    id: section.id,
    title: section.title,
    state: section.state,
    counts: section.counts,
    truncated: section.truncated,
    ...(reason === undefined ? {} : { reason }),
  };
};

const placeholderSurface = (entry: BriefPlaceholderEntry): BriefSurface => ({
  id: entry.capability,
  title: BRIEF_PLACEHOLDER_TITLES[entry.capability],
  state: entry.state,
  counts: { observed: 0, unknown: 0, total: 0, omitted: 0 },
  truncated: false,
});

const buildSurfaces = (digest: StatusDigest): readonly BriefSurface[] =>
  BRIEF_SURFACE_ORDER.map((id) => {
    const section = digest.sections.find((entry) => entry.id === id);
    if (section !== undefined) return digestSurface(section);
    const placeholder = BRIEF_PLACEHOLDER_CATALOG.find((entry) => entry.capability === id);
    if (placeholder === undefined)
      throw new Error(`surface ${id} has no digest section or catalog entry`);
    return placeholderSurface(placeholder);
  });

const isActionableSection = (state: BriefSurfaceState): boolean =>
  state === "observed" || state === "degraded";

const readyToMergeActions = (changes: StatusSection): readonly BriefAction[] => {
  if (!isActionableSection(changes.state)) return [];
  const candidates = (changes.pullRequests ?? []).filter(
    (item) =>
      item.deliveryState === "approved" && item.draft === false && item.reviewState === "observed",
  );
  return [...candidates]
    .sort((left, right) => compareIdentity(left.entityId, right.entityId))
    .map(
      (item): BriefAction => ({
        identity: item.entityId,
        state: changes.state,
        evidence: {
          kind: "pull-request",
          deliveryState: item.deliveryState,
          draft: item.draft,
          reviewState: item.reviewState,
        },
      }),
    );
};

type AgeClaim =
  | { readonly state: "observed"; readonly days: number }
  | { readonly state: "unknown" };

/**
 * The digest's parse-and-floor age rule over a provider-native timestamp.
 * An absent, unparseable, or future timestamp is unknown: never negative and
 * never clamped to zero (D9).
 */
const deriveAge = (updatedAt: string | undefined, nowMs: number): AgeClaim => {
  if (updatedAt === undefined) return { state: "unknown" };
  const parsed = Date.parse(updatedAt);
  if (!Number.isFinite(parsed) || parsed > nowMs) return { state: "unknown" };
  return { state: "observed", days: Math.floor((nowMs - parsed) / DAY_MS) };
};

const ageValue = (action: BriefAction): number => {
  const evidence: BriefActionEvidence = action.evidence;
  return evidence.kind === "owner-hand-back" && evidence.ageState === "observed"
    ? (evidence.ageDays ?? -1)
    : -1;
};

const ownerGateState = (
  tracker: StatusSection,
  familyState: "observed" | "unavailable" | undefined,
): BriefSurfaceState => {
  if (
    tracker.state === "unknown" ||
    tracker.state === "unavailable" ||
    tracker.state === "not-delivered"
  ) {
    return tracker.state;
  }
  if (familyState !== "observed") return "unavailable";
  return tracker.state;
};

type OwnerGateProjection = {
  readonly state: BriefSurfaceState;
  readonly items: readonly BriefAction[];
  readonly truncated: boolean;
  readonly omitted: number;
};

const ownerGateAges = (facts: StatusFacts, tracker: StatusSection): OwnerGateProjection => {
  const family = tracker.families?.find((entry) => entry.family === "ownerHandBacks");
  const state = ownerGateState(tracker, family?.state);
  if (state === "unavailable" || family === undefined || family.state !== "observed") {
    return {
      state,
      items: [],
      truncated: family?.counts.omitted !== undefined && family.counts.omitted > 0,
      omitted: family?.counts.omitted ?? 0,
    };
  }
  const items = facts.tracker.ok ? facts.tracker.items : [];
  const byRef = new Map<string, WorkItem>();
  for (const item of items) byRef.set(item.identity.entityId, item);
  const projected = family.items.map((item): BriefAction => {
    const age = deriveAge(byRef.get(item.workItemRef)?.updatedAt, facts.nowMs);
    return {
      identity: item.workItemRef,
      state,
      evidence:
        age.state === "observed"
          ? { kind: "owner-hand-back", ageState: "observed", ageDays: age.days }
          : { kind: "owner-hand-back", ageState: "unknown" },
    };
  });
  const ranked = [...projected].sort((left, right) => {
    const age = ageValue(right) - ageValue(left);
    return age === 0 ? compareIdentity(left.identity, right.identity) : age;
  });
  return {
    state,
    items: ranked,
    truncated: family.counts.omitted > 0,
    omitted: family.counts.omitted,
  };
};

/** Mirror the digest `typed-questions` section into the real ranked anchor (DM-6). */
const blockerQuestions = (digest: StatusDigest): BriefAnchorGroup => {
  const section = sectionOf(digest, "typed-questions");
  const items = (section.questions ?? []).map(
    (question): BriefAction => ({
      identity: question.id,
      state: section.state,
      evidence: {
        kind: "blocker-question",
        type: question.type,
        audience: question.audience,
        lane: question.lane,
        rank: question.rank,
      },
    }),
  );
  return {
    group: "blocker-questions",
    state: section.state,
    items,
    truncated: section.truncated,
    omitted: section.counts.omitted,
  };
};

const buildAnchors = (facts: StatusFacts, digest: StatusDigest): readonly BriefAnchorGroup[] => {
  const changes = sectionOf(digest, "changes-and-prs");
  const tracker = sectionOf(digest, "tracker");
  const readyItems = readyToMergeActions(changes);
  const blockers = blockerQuestions(digest);
  const owner = ownerGateAges(facts, tracker);
  return [
    {
      group: "ready-to-merge",
      state: changes.state,
      items: readyItems,
      truncated: changes.truncated,
      omitted: changes.counts.omitted,
    },
    blockers,
    {
      group: "owner-gate-ages",
      state: owner.state,
      items: owner.items,
      truncated: owner.truncated,
      omitted: owner.omitted,
    },
  ];
};

const buildTruncation = (
  surfaces: readonly BriefSurface[],
  anchors: readonly BriefAnchorGroup[],
): readonly BriefTruncation[] => {
  const markers: BriefTruncation[] = [];
  for (const surface of surfaces) {
    if (surface.truncated) markers.push({ target: surface.id, omitted: surface.counts.omitted });
  }
  for (const anchor of anchors) {
    if (anchor.truncated) markers.push({ target: anchor.group, omitted: anchor.omitted });
  }
  return markers;
};

/** Project the injected facts into the bounded `delivery.brief.v1` payload. */
export const projectBrief = (facts: StatusFacts): BriefPayload => {
  const digest = aggregateStatus(facts);
  const surfaces = buildSurfaces(digest);
  const anchors = buildAnchors(facts, digest);
  return {
    schemaVersion: BRIEF_SCHEMA_VERSION,
    generatedAt: digest.generatedAt,
    repository: digest.repository,
    surfaces,
    anchors,
    placeholders: BRIEF_PLACEHOLDER_CATALOG,
    truncation: buildTruncation(surfaces, anchors),
  };
};

/* ------------------------------ human render ------------------------------ */

const utf8Length = (text: string): number => {
  let bytes = 0;
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const stateWord = (state: BriefSurfaceState, reason: string | undefined): string =>
  reason === undefined || reason === "observed" || reason === state
    ? state
    : `${state} (${reason})`;

const truncationSuffix = (truncated: boolean, omitted: number): string =>
  omitted > 0 ? ` +${omitted} more` : truncated ? " +more" : "";

const bindingText = (brief: BriefPayload): string =>
  brief.repository.state === "observed"
    ? `${brief.repository.owner}/${brief.repository.name}`
    : `repository unavailable (${brief.repository.reason})`;

const anchorLine = (
  brief: BriefPayload,
  group: BriefAnchorGroup["group"],
  reason: string | undefined,
): string => {
  const anchor = brief.anchors.find((entry) => entry.group === group);
  if (anchor === undefined) return `${group}  unknown`;
  const suffix = truncationSuffix(anchor.truncated, anchor.omitted);
  if (group === "blocker-questions") {
    const entries = anchor.items.map((item) => {
      const evidence = item.evidence;
      return evidence.kind === "blocker-question"
        ? `${evidence.rank}. ${item.identity} ${evidence.type} audience=${evidence.audience} lane=${evidence.lane}`
        : item.identity;
    });
    return entries.length === 0
      ? `blocker-questions  ${stateWord(anchor.state, reason)}  none${suffix}`
      : `blocker-questions  ${stateWord(anchor.state, reason)}  ${entries.join(", ")}${suffix}`;
  }
  if (group === "ready-to-merge") {
    const identities = anchor.items.map((item) => item.identity);
    return identities.length === 0
      ? `ready-to-merge  ${stateWord(anchor.state, reason)}  none approved${suffix}`
      : `ready-to-merge  ${stateWord(anchor.state, reason)}  ${identities.length} approved: ${identities.join(", ")}${suffix}`;
  }
  const ages = anchor.items.map((item) => {
    const evidence = item.evidence;
    return evidence.kind === "owner-hand-back" &&
      evidence.ageState === "observed" &&
      evidence.ageDays !== undefined
      ? `${item.identity} ${evidence.ageDays}d`
      : `${item.identity} age unknown`;
  });
  return ages.length === 0
    ? `owner-gate-ages  ${stateWord(anchor.state, reason)}  none${suffix}`
    : `owner-gate-ages  ${stateWord(anchor.state, reason)}  ${ages.join(", ")}${suffix}`;
};

const contextLine = (surface: BriefSurface): string => {
  const suffix = truncationSuffix(surface.truncated, surface.counts.omitted);
  return `${surface.id}  ${stateWord(surface.state, surface.reason)}  total ${surface.counts.total} (${surface.counts.unknown} unknown)${suffix}`;
};

const bound = (lines: readonly string[]): string => {
  const kept = [...lines];
  let dropped = 0;
  while (
    kept.length > STATUS_MAX_HUMAN_LINES ||
    utf8Length(`${kept.join("\n")}\n`) > STATUS_MAX_HUMAN_BYTES
  ) {
    if (kept.length === 0) break;
    kept.pop();
    dropped += 1;
  }
  if (dropped > 0) {
    const marker = `... ${dropped} line(s) omitted to fit the one-screen bound`;
    while (
      kept.length > 0 &&
      (kept.length + 1 > STATUS_MAX_HUMAN_LINES ||
        utf8Length(`${[...kept, marker].join("\n")}\n`) > STATUS_MAX_HUMAN_BYTES)
    ) {
      kept.pop();
    }
    kept.push(marker);
  }
  return `${kept.join("\n")}\n`;
};

/** Render the deterministic, decision-first human brief from the payload and brand. */
export const renderBriefHuman = (brief: BriefPayload, brand: BrandIdentity): string => {
  const tracker = surfaceOf(brief, "tracker");
  const changes = surfaceOf(brief, "changes-and-prs");
  const gateSla = placeholderEntry("gate-sla-states");
  const laneQueue = placeholderEntry("lane-queue-engine");
  const lines: string[] = [`${brand.binaryName} brief  ${bindingText(brief)}`];

  lines.push(anchorLine(brief, "ready-to-merge", changes?.reason));
  lines.push(anchorLine(brief, "blocker-questions", surfaceOf(brief, "typed-questions")?.reason));
  lines.push(anchorLine(brief, "owner-gate-ages", tracker?.reason));
  lines.push(`${gateSla.capability}  ${gateSla.owningStory}  ${gateSla.state}`);

  for (const id of [
    "tracker",
    "changes-and-prs",
    "ci",
    "lanes-or-queue",
    "providers",
    "parked-work",
  ] as const) {
    const surface = surfaceOf(brief, id);
    if (surface === undefined) continue;
    if (id === "lanes-or-queue") {
      lines.push(
        `lanes-or-queue  ${stateWord(surface.state, surface.reason)}  ${laneQueue.capability} (${laneQueue.owningStory})`,
      );
    } else {
      lines.push(contextLine(surface));
    }
  }

  return bound(lines);
};
