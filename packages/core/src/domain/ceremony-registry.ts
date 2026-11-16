/**
 * The ceremony registry (GH-296 F-6; DEC-6, DEC-15).
 *
 * One registry built from the six built-ins plus, when the committed document is
 * present and valid, the project declarations. Absence and an empty document are
 * the built-ins-only path; a malformed document is `config.file.malformed`; a
 * defective entry or a built-in collision is `ceremony.declaration.invalid` with
 * zero partial registration and the built-in still effective. No overlay,
 * user-global, or environment source completes a declaration.
 */
import {
  BUILTIN_CEREMONY_DECLARATIONS,
  CEREMONY_DECLARATIONS_SCHEMA,
  type CeremonyDeclaration,
} from "#contracts";
import { validateCeremonyDocument } from "./ceremony-declaration.js";

/** The origin a registry entry carries (F-6). */
export type CeremonyOrigin = "built-in" | "project";

/** One registered ceremony. */
export type CeremonyRegistryEntry = {
  readonly declaration: CeremonyDeclaration;
  readonly origin: CeremonyOrigin;
};

/** One built registry; the built-ins are always effective. */
export type CeremonyRegistry = {
  readonly entries: readonly CeremonyRegistryEntry[];
  readonly builtins: readonly CeremonyRegistryEntry[];
  readonly projects: readonly CeremonyRegistryEntry[];
  readonly source: "absent" | "document";
};

/** The two refusal identities the registry can report. */
export type CeremonyRegistryFailure = {
  readonly code: "config.file.malformed" | "ceremony.declaration.invalid";
  readonly summary: string;
  readonly field?: string;
};

/** The registry read outcome. */
export type CeremonyRegistryRead =
  | { readonly ok: true; readonly registry: CeremonyRegistry }
  | { readonly ok: false; readonly error: CeremonyRegistryFailure };

/** The document facts the registry consumes (the adapter supplies them). */
export type CeremonyDeclarationDocumentFacts =
  | { readonly state: "absent" }
  | { readonly state: "malformed"; readonly path: string }
  | { readonly state: "unreadable"; readonly path: string }
  | { readonly state: "document"; readonly path: string; readonly value: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const emptyDocument = (value: unknown): boolean =>
  isRecord(value) &&
  value.schemaVersion === CEREMONY_DECLARATIONS_SCHEMA &&
  Array.isArray(value.ceremonies) &&
  value.ceremonies.length === 0;

const builtinEntries = (
  builtins: readonly CeremonyDeclaration[],
): readonly CeremonyRegistryEntry[] =>
  builtins.map((declaration) => ({ declaration, origin: "built-in" }));

/** Build the registry from the built-ins and one committed document read. */
export const buildCeremonyRegistry = (input: {
  readonly document: CeremonyDeclarationDocumentFacts;
  readonly builtins?: readonly CeremonyDeclaration[];
}): CeremonyRegistryRead => {
  const builtins = input.builtins ?? BUILTIN_CEREMONY_DECLARATIONS;
  const effects = builtinEntries(builtins);
  const absent: CeremonyRegistry = {
    entries: effects,
    builtins: effects,
    projects: [],
    source: "absent",
  };
  if (input.document.state === "absent") return { ok: true, registry: absent };
  if (input.document.state === "malformed" || input.document.state === "unreadable") {
    return {
      ok: false,
      error: {
        code: "config.file.malformed",
        summary:
          input.document.state === "malformed"
            ? `the ceremony declaration document at "${input.document.path}" cannot be parsed`
            : `the ceremony declaration document at "${input.document.path}" cannot be read`,
        field: "document",
      },
    };
  }
  if (emptyDocument(input.document.value)) return { ok: true, registry: absent };
  const validated = validateCeremonyDocument(input.document.value, {
    reservedIds: builtins.map((declaration) => declaration.id),
  });
  if (!validated.ok) {
    return {
      ok: false,
      error: {
        code: "ceremony.declaration.invalid",
        summary: validated.error.summary,
        field: validated.error.field,
      },
    };
  }
  const projects = validated.value.ceremonies.map(
    (declaration): CeremonyRegistryEntry => ({ declaration, origin: "project" }),
  );
  return {
    ok: true,
    registry: {
      entries: [...effects, ...projects],
      builtins: effects,
      projects,
      source: "document",
    },
  };
};

/** Resolve one registered declaration by id. */
export const ceremonyRegistryEntry = (
  registry: CeremonyRegistry,
  id: string,
): CeremonyRegistryEntry | undefined =>
  registry.entries.find((entry) => entry.declaration.id === id);

/** The declared ceremony ids in registry order (built-ins first). */
export const ceremonyRegistryIds = (registry: CeremonyRegistry): readonly string[] =>
  registry.entries.map((entry) => entry.declaration.id);

/** The project-declared entries only. */
export const ceremonyProjectEntries = (
  registry: CeremonyRegistry,
): readonly CeremonyRegistryEntry[] => registry.projects;
