/**
 * Built-in ceremony fixtures (GH-296 F-3, §4.1): one synthetic input set per
 * declaration, the note each note-consuming built-in requires, and the artifact
 * reference a read-back failure targets. No real participant or repository data.
 */
import {
  BUILTIN_CEREMONY_DECLARATIONS,
  builtinCeremonyDeclaration,
  type CeremonyDeclaration,
  type CeremonyNote,
  type CeremonyWindow,
} from "../../../packages/core/src/contracts/index";
import { runCeremony, type CeremonyRunOutcome } from "../../../packages/core/src/domain/index";
import { makeEngineHarness, type EngineHarness } from "./engine";
import { conformingNote, retroNote } from "./notes";

export const MIRROR_WINDOW: CeremonyWindow = {
  start: "2026-11-16T00:00:00.000Z",
  end: "2026-11-16T12:00:00.000Z",
};

export const MIRROR_TARGETS = ["github.com/example/alpha", "github.com/example/beta"] as const;

export type BuiltinPreparation = {
  readonly id: string;
  readonly declaration: CeremonyDeclaration;
  readonly harness: EngineHarness;
  readonly note?: CeremonyNote;
  readonly window?: CeremonyWindow;
  readonly apply: boolean;
};

export type BuiltinOptions = {
  readonly apply?: boolean;
  readonly note?: CeremonyNote;
  readonly noteOverrides?: Partial<CeremonyNote>;
  readonly corruptFirstArtifact?: boolean;
  readonly mirrorDrift?: boolean;
  readonly mirrorApplyNoop?: boolean;
  readonly unavailable?: readonly string[];
  readonly ownerNoteItems?: readonly { readonly text: string; readonly evidenceRef?: string }[];
};

/** Run one prepared built-in through the production runner. */
export const runPrepared = (prepared: BuiltinPreparation): CeremonyRunOutcome =>
  runCeremony({
    declaration: prepared.declaration,
    env: prepared.harness.env,
    noteSupplied: prepared.note !== undefined,
    ...(prepared.note === undefined ? {} : { note: prepared.note }),
    apply: prepared.apply,
    ...(prepared.window === undefined ? {} : { window: prepared.window }),
  });

/** The first artifact reference every built-in writes (ceremony-artifact slot). */
export const firstArtifactRef = (): string => "ceremony-artifact:run-1.json";

/** Prepare one built-in's synthetic environment and inputs. */
export const prepareBuiltin = (id: string, options: BuiltinOptions = {}): BuiltinPreparation => {
  const declaration = builtinCeremonyDeclaration(id);
  if (declaration === undefined) throw new Error(`unknown built-in ${id}`);
  const harness = makeEngineHarness(
    options.mirrorApplyNoop === true ? { mirrorApply: "noop" } : {},
  );

  const ownerNoteItems = options.ownerNoteItems ?? [
    { text: "item covered by cited evidence", evidenceRef: "evidence:item-1" },
    { text: "item with no citation" },
  ];
  harness.scriptInput("owner-note", { state: "present", facts: { items: ownerNoteItems } });
  harness.scriptInput("queue-state", {
    state: "present",
    facts: {
      carryOver: [
        {
          ref: "GH-101",
          reason: "blocked-dependency",
          nextMilestone: "M3",
        },
        {
          ref: "GH-102",
          reason: "awaiting-review",
          nextMilestone: "M3",
        },
      ],
    },
  });
  harness.scriptInput("tracker-milestone", { state: "present", facts: { milestone: "M2" } });
  harness.scriptInput("measurement-metrics", { state: "present", facts: { rows: [] } });
  harness.scriptInput("decision-register", {
    state: "present",
    facts: {
      repositories: {
        [MIRROR_TARGETS[0]]: ["ODR-0001", "ODR-0002"],
        [MIRROR_TARGETS[1]]: ["ODR-0003"],
      },
    },
  });
  harness.scriptInput("affected-repositories", {
    state: "present",
    facts: { targets: [...MIRROR_TARGETS] },
  });
  harness.mirrorTargets.set(MIRROR_TARGETS[0], ["ODR-0001", "ODR-0002"]);
  harness.mirrorTargets.set(MIRROR_TARGETS[1], ["ODR-0003"]);
  if (options.mirrorDrift === true) {
    harness.mirrorTargets.set(MIRROR_TARGETS[1], ["ODR-0003", "ODR-9999"]);
  }
  for (const source of options.unavailable ?? []) {
    harness.scriptInput(source as never, { state: "unavailable", reason: `${source} unavailable` });
  }

  const note =
    options.note ??
    (id === "retro-evidence-pass"
      ? retroNote(id, "window", options.noteOverrides)
      : declaration.note?.required === true
        ? conformingNote(id, options.noteOverrides)
        : undefined);
  if (options.corruptFirstArtifact === true) {
    harness.corruptArtifact(firstArtifactRef(), "corrupted artifact");
  }
  return {
    id,
    declaration,
    harness,
    ...(note === undefined ? {} : { note }),
    ...(id === "decision-record-mirror-sync" ? { window: MIRROR_WINDOW } : {}),
    apply: options.apply ?? false,
  };
};

/** All six built-in declarations, in canonical order. */
export const BUILTINS = BUILTIN_CEREMONY_DECLARATIONS;
