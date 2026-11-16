/**
 * The six built-in ceremony declarations (GH-296 F-3; DM-1, DM-2).
 *
 * Runtime-neutral contract data only: each ceremony is a declaration on exactly
 * the closed vocabularies, never a branch. Four derive their scope key from the
 * invoking repository and two require a note. The retro declaration declares
 * exactly the four sub-R1 level triggers and no `change-merged`; R1 stays
 * closeout's own change-level retro.
 */
import type { CeremonyDeclaration } from "./ceremony.js";
import { CEREMONY_NOTE_SCHEMA } from "./ceremony.js";

const compaction = (atPhases: readonly number[]) => ({
  atPhases,
  maxBytes: 4_096,
  maxLines: 40,
});

const step = (input: {
  readonly kind: CeremonyDeclaration["agenda"][number]["steps"][number]["kind"];
  readonly inputs?: readonly CeremonyDeclaration["inputs"][number]["source"][];
  readonly slot?: CeremonyDeclaration["agenda"][number]["steps"][number]["outputs"][number]["slot"];
  readonly schema: string;
  readonly verify: CeremonyDeclaration["agenda"][number]["steps"][number]["verify"];
}) => ({
  kind: input.kind,
  ...(input.inputs === undefined ? {} : { inputs: input.inputs }),
  outputs: [{ slot: input.slot ?? "ceremony-artifact", schema: input.schema }],
  verify: input.verify,
});

/** The morning brief: collect → render `delivery.brief.v1` → record. */
const MORNING_BRIEF: CeremonyDeclaration = {
  id: "morning-brief",
  title: "Morning brief",
  tiers: ["full", "lite"],
  triggers: [{ kind: "schedule", cadence: "daily", at: "07:00" }],
  inputs: [
    { source: "status-facts" },
    { source: "brief-projection" },
    { source: "spend-citation" },
    { source: "open-questions" },
    { source: "provider-parks" },
  ],
  agenda: [
    {
      id: "collect",
      steps: [
        step({
          kind: "collect",
          inputs: [
            "status-facts",
            "brief-projection",
            "spend-citation",
            "open-questions",
            "provider-parks",
          ],
          schema: "delivery.ceremony.collected.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "render",
      steps: [
        step({
          kind: "render",
          inputs: [
            "status-facts",
            "brief-projection",
            "spend-citation",
            "open-questions",
            "provider-parks",
          ],
          schema: "delivery.brief.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "record",
      steps: [
        step({
          kind: "record",
          slot: "state-record",
          schema: "delivery.ceremony.brief-record.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
  ],
  scopeKey: { kind: "repository" },
  catchUp: { mode: "once", maxMissedWindows: 1 },
  compaction: compaction([0, 1]),
};

/** The retro evidence pass at the four sub-R1 levels (session/incident/window/project). */
const RETRO_EVIDENCE_PASS: CeremonyDeclaration = {
  id: "retro-evidence-pass",
  title: "Retro evidence pass",
  tiers: ["full", "lite"],
  triggers: [
    { kind: "event", event: "session-end" },
    { kind: "event", event: "incident-severity" },
    { kind: "schedule", cadence: "daily" },
    { kind: "event", event: "milestone-end" },
  ],
  inputs: [
    { source: "retro-evidence" },
    { source: "retro-runs" },
    { source: "memory-audit" },
    { source: "pm-notes-retro" },
    { source: "spend-citation" },
  ],
  agenda: [
    {
      id: "follow-through",
      steps: [
        step({
          kind: "fold",
          inputs: ["retro-runs"],
          schema: "delivery.ceremony.follow-through.v1",
          verify: "artifact-covers-items",
        }),
      ],
    },
    {
      id: "evidence",
      steps: [
        step({
          kind: "fold",
          inputs: [
            "retro-evidence",
            "retro-runs",
            "memory-audit",
            "pm-notes-retro",
            "spend-citation",
          ],
          schema: "delivery.ceremony.retro-evidence.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "insights",
      steps: [
        step({
          kind: "render",
          inputs: ["retro-evidence"],
          schema: "delivery.ceremony.retro-insights.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "actions",
      steps: [
        step({
          kind: "render",
          schema: "delivery.ceremony.retro-actions.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "record",
      steps: [
        step({
          kind: "record",
          slot: "memory",
          schema: CEREMONY_NOTE_SCHEMA,
          verify: "artifact-conforms",
        }),
      ],
    },
  ],
  scopeKey: { kind: "note" },
  note: { required: true, schema: CEREMONY_NOTE_SCHEMA, scopeKey: "required" },
  catchUp: { mode: "once", maxMissedWindows: 1 },
  compaction: compaction([0, 1, 2, 3]),
};

/** Sprint rollover: collect → fold carry-over → render → record. */
const SPRINT_ROLLOVER: CeremonyDeclaration = {
  id: "sprint-rollover",
  title: "Sprint rollover",
  tiers: ["full"],
  triggers: [
    { kind: "schedule", cadence: "iteration" },
    { kind: "event", event: "milestone-end" },
  ],
  inputs: [
    { source: "queue-state" },
    { source: "tracker-milestone" },
    { source: "measurement-metrics" },
  ],
  agenda: [
    {
      id: "collect",
      steps: [
        step({
          kind: "collect",
          inputs: ["queue-state", "tracker-milestone", "measurement-metrics"],
          schema: "delivery.ceremony.rollover-collected.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "fold",
      steps: [
        step({
          kind: "fold",
          inputs: ["queue-state", "tracker-milestone", "measurement-metrics"],
          schema: "delivery.ceremony.carry-over.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "render",
      steps: [
        step({
          kind: "render",
          inputs: ["queue-state", "tracker-milestone", "measurement-metrics"],
          schema: "delivery.ceremony.rollover.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "record",
      steps: [
        step({
          kind: "record",
          slot: "state-record",
          schema: "delivery.ceremony.rollover-record.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
  ],
  scopeKey: { kind: "repository" },
  catchUp: { mode: "once", maxMissedWindows: 1 },
  compaction: compaction([0, 1, 2]),
};

/** Night watch: collect → fold → render the declared check set → record. */
const NIGHT_WATCH: CeremonyDeclaration = {
  id: "night-watch",
  title: "Night watch",
  tiers: ["full", "lite"],
  triggers: [{ kind: "schedule", cadence: "daily", at: "02:00" }],
  inputs: [
    { source: "audit-ledger" },
    { source: "harness-telemetry" },
    { source: "lane-queue-facts" },
    { source: "gate-verification" },
  ],
  agenda: [
    {
      id: "collect",
      steps: [
        step({
          kind: "collect",
          inputs: ["audit-ledger", "harness-telemetry", "lane-queue-facts", "gate-verification"],
          schema: "delivery.ceremony.night-watch-collected.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "fold",
      steps: [
        step({
          kind: "fold",
          inputs: ["audit-ledger", "harness-telemetry", "lane-queue-facts", "gate-verification"],
          schema: "delivery.ceremony.anomaly-set.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "render",
      steps: [
        step({
          kind: "render",
          inputs: ["audit-ledger", "harness-telemetry", "lane-queue-facts", "gate-verification"],
          schema: "delivery.ceremony.night-watch.v1",
          verify: "artifact-covers-items",
        }),
      ],
    },
    {
      id: "record",
      steps: [
        step({
          kind: "record",
          slot: "state-record",
          schema: "delivery.ceremony.night-watch-record.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
  ],
  scopeKey: { kind: "repository" },
  catchUp: { mode: "once", maxMissedWindows: 1 },
  compaction: compaction([0, 1, 2]),
};

/** Testing-session assessment: note intake → assess → render → record. */
const TESTING_SESSION_ASSESSMENT: CeremonyDeclaration = {
  id: "testing-session-assessment",
  title: "Testing-session assessment",
  tiers: ["full"],
  triggers: [{ kind: "event", event: "owner-note" }],
  inputs: [{ source: "owner-note" }, { source: "test-artifacts" }, { source: "gate-report" }],
  agenda: [
    {
      id: "intake",
      steps: [
        step({
          kind: "collect",
          inputs: ["owner-note", "test-artifacts", "gate-report"],
          schema: "delivery.ceremony.assessment-intake.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "assess",
      steps: [
        step({
          kind: "assess",
          inputs: ["owner-note", "test-artifacts", "gate-report"],
          schema: "delivery.ceremony.assessment.v1",
          verify: "artifact-covers-items",
        }),
      ],
    },
    {
      id: "render",
      steps: [
        step({
          kind: "render",
          inputs: ["owner-note"],
          schema: "delivery.ceremony.assessment.v1",
          verify: "artifact-covers-items",
        }),
      ],
    },
    {
      id: "record",
      steps: [
        step({
          kind: "record",
          slot: "state-record",
          schema: "delivery.ceremony.assessment-record.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
  ],
  scopeKey: { kind: "note" },
  note: { required: true, schema: CEREMONY_NOTE_SCHEMA, scopeKey: "required" },
  catchUp: { mode: "none", maxMissedWindows: 1 },
  compaction: compaction([0, 1, 2]),
};

/** Decision-record mirror sync before dispatch: collect → sync → render. */
const DECISION_RECORD_MIRROR_SYNC: CeremonyDeclaration = {
  id: "decision-record-mirror-sync",
  title: "Decision-record mirror sync",
  tiers: ["full"],
  triggers: [{ kind: "event", event: "pre-dispatch" }],
  inputs: [{ source: "decision-register" }, { source: "affected-repositories" }],
  agenda: [
    {
      id: "collect",
      steps: [
        step({
          kind: "collect",
          inputs: ["decision-register", "affected-repositories"],
          schema: "delivery.ceremony.mirror-collected.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
    {
      id: "sync",
      steps: [
        step({
          kind: "sync",
          inputs: ["decision-register", "affected-repositories"],
          slot: "mirror-target",
          schema: "delivery.ceremony.mirror-target.v1",
          verify: "artifact-equals-source",
        }),
      ],
    },
    {
      id: "render",
      steps: [
        step({
          kind: "render",
          inputs: ["decision-register", "affected-repositories"],
          schema: "delivery.ceremony.mirror-report.v1",
          verify: "artifact-conforms",
        }),
      ],
    },
  ],
  scopeKey: { kind: "repository" },
  catchUp: { mode: "once", maxMissedWindows: 1 },
  compaction: compaction([0, 1]),
};

/** The six built-in declarations in canonical order (F-3). */
export const BUILTIN_CEREMONY_DECLARATIONS: readonly CeremonyDeclaration[] = [
  MORNING_BRIEF,
  RETRO_EVIDENCE_PASS,
  SPRINT_ROLLOVER,
  NIGHT_WATCH,
  TESTING_SESSION_ASSESSMENT,
  DECISION_RECORD_MIRROR_SYNC,
];

/** The six built-in ceremony ids (F-6 collision control). */
export const BUILTIN_CEREMONY_IDS = BUILTIN_CEREMONY_DECLARATIONS.map(
  (declaration) => declaration.id,
) as readonly string[];

/** Resolve one built-in declaration by id. */
export const builtinCeremonyDeclaration = (id: string): CeremonyDeclaration | undefined =>
  BUILTIN_CEREMONY_DECLARATIONS.find((declaration) => declaration.id === id);
