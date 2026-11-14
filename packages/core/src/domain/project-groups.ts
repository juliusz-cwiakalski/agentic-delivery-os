/**
 * The project group configuration validator (GH-309 F-1, F-2, DM-1, OQ-1).
 *
 * Pure and runtime-neutral: the declared document shape is narrowed once here,
 * the pinned OQ-1 rules are enforced exactly, and an unimplemented tracker
 * kind is never rejected — it stays valid configuration and classifies at read
 * time. No filesystem, yaml, clock, or environment access happens in this
 * tier; the adapter seam parses the document bytes and supplies the unknown
 * value. Absent and empty configurations are the valid empty listing.
 */
import {
  PROJECT_GROUPS_CONFIG_SCHEMA,
  type ProjectConfigInvalidReason,
  type ProjectGroupMemberDeclaration,
  type ProjectGroupMemberSelected,
  type ProjectGroupsConfig,
  type ProjectGroupValidated,
} from "../contracts/projects.js";

/** One declared-member selector shape: exactly one of the two keys carries a non-empty string. */
type MemberSelectorShape =
  | { readonly kind: "root"; readonly value: string }
  | { readonly kind: "repoKey"; readonly value: string }
  | { readonly kind: "both" }
  | { readonly kind: "neither" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const schemaFailure = (
  detail: string,
): { readonly ok: false; readonly reason: ProjectConfigInvalidReason } => ({
  ok: false,
  reason: { case: "schema", detail },
});

/** Narrow one declared member's selector without interpreting the values. */
const selectorShapeOf = (member: ProjectGroupMemberDeclaration): MemberSelectorShape => {
  const hasRoot = nonEmptyString(member.root);
  const hasRepoKey = nonEmptyString(member.repoKey);
  if (hasRoot && hasRepoKey) return { kind: "both" };
  if (hasRoot) return { kind: "root", value: member.root ?? "" };
  if (hasRepoKey) return { kind: "repoKey", value: member.repoKey ?? "" };
  return { kind: "neither" };
};

/** The selector key one validated member resolves under, for the duplicate probe. */
const selectorKeyOf = (member: ProjectGroupMemberSelected): string =>
  member.kind === "root" ? `root:${member.root}` : `repoKey:${member.repoKey}`;

/**
 * Validate one declared group's members against the pinned OQ-1 rules: at
 * least one member, exactly one selector per member, a declared tracker kind,
 * and no selector resolving twice inside the group. An unimplemented tracker
 * kind is valid here (NG-5).
 */
const validateMembers = (
  groupKey: string,
  members: readonly unknown[],
):
  | { readonly ok: true; readonly members: readonly ProjectGroupMemberSelected[] }
  | { readonly ok: false; readonly reason: ProjectConfigInvalidReason } => {
  if (members.length === 0) {
    return { ok: false, reason: { case: "empty-members", groupKey } };
  }
  const selected: ProjectGroupMemberSelected[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < members.length; index += 1) {
    const value = members[index];
    if (!isRecord(value)) {
      return schemaFailure(`group ${groupKey} member ${index} is not a mapping`);
    }
    const member = value as ProjectGroupMemberDeclaration;
    const shape = selectorShapeOf(member);
    if (shape.kind === "both") {
      return { ok: false, reason: { case: "member-both-selectors", groupKey, index } };
    }
    if (shape.kind === "neither") {
      return { ok: false, reason: { case: "member-no-selector", groupKey, index } };
    }
    if (!nonEmptyString(member.trackerKind)) {
      return schemaFailure(`group ${groupKey} member ${index} has no declared trackerKind`);
    }
    const candidate: ProjectGroupMemberSelected =
      shape.kind === "root"
        ? { kind: "root", root: shape.value, trackerKind: member.trackerKind }
        : { kind: "repoKey", repoKey: shape.value, trackerKind: member.trackerKind };
    const key = selectorKeyOf(candidate);
    if (seen.has(key)) {
      return { ok: false, reason: { case: "member-duplicate-selector", groupKey, index } };
    }
    seen.add(key);
    selected.push(candidate);
  }
  return { ok: true, members: selected };
};

/** Validate one declared group: non-empty key, declared name, validated members. */
const validateGroup = (
  groupKey: string,
  declaration: Record<string, unknown>,
):
  | { readonly ok: true; readonly group: ProjectGroupValidated }
  | { readonly ok: false; readonly reason: ProjectConfigInvalidReason } => {
  if (!nonEmptyString(declaration.name)) {
    return schemaFailure(`group ${groupKey} has no declared name`);
  }
  const members = declaration.members;
  if (!Array.isArray(members)) {
    return schemaFailure(`group ${groupKey} has no declared members list`);
  }
  const validated = validateMembers(groupKey, members);
  if (!validated.ok) return validated;
  const workspaceRoot = declaration.workspaceRoot;
  return {
    ok: true,
    group: {
      groupKey,
      name: declaration.name,
      ...(nonEmptyString(workspaceRoot) ? { workspaceRoot } : {}),
      members: validated.members,
    },
  };
};

/**
 * Validate the parsed configuration document value (the unknown result of the
 * yaml seam). A document that is not an object, whose declared fields break
 * the schema, or whose content breaks a pinned rule classifies as
 * config-invalid; an absent document and an empty `groups[]` are the valid
 * empty listing. Unknown extra fields are ignored — only the declared fields
 * are consumed, and no invented field is required or honored.
 */
export const validateProjectGroupsDocument = (
  document: unknown,
):
  | {
      readonly ok: true;
      readonly config: ProjectGroupsConfig;
    }
  | { readonly ok: false; readonly reason: ProjectConfigInvalidReason } => {
  if (document === undefined || document === null) {
    return { ok: true, config: { state: "empty" } };
  }
  if (!isRecord(document)) {
    return schemaFailure("the configuration document is not a mapping");
  }
  const schema = document.schema;
  if (schema !== undefined && schema !== PROJECT_GROUPS_CONFIG_SCHEMA) {
    return schemaFailure("the configuration document names a different schema");
  }
  const groups = document.groups;
  if (groups === undefined) {
    return { ok: true, config: { state: "empty" } };
  }
  if (!Array.isArray(groups)) {
    return schemaFailure("the configuration groups value is not a list");
  }
  const seen = new Set<string>();
  const validatedGroups: ProjectGroupValidated[] = [];
  for (const entry of groups) {
    if (!isRecord(entry) || !nonEmptyString(entry.groupKey)) {
      return schemaFailure("a declared group has no non-empty groupKey");
    }
    const groupKey = entry.groupKey;
    if (seen.has(groupKey)) {
      return { ok: false, reason: { case: "duplicate-groupKey", groupKey } };
    }
    seen.add(groupKey);
    const validated = validateGroup(groupKey, entry);
    if (!validated.ok) return validated;
    validatedGroups.push(validated.group);
  }
  return validatedGroups.length === 0
    ? { ok: true, config: { state: "empty" } }
    : { ok: true, config: { state: "loaded", groups: validatedGroups } };
};

/** Whether the validated configuration declares the requested group key. */
export const projectGroupDeclared = (config: ProjectGroupsConfig, groupKey: string): boolean =>
  config.state === "loaded" && config.groups.some((group) => group.groupKey === groupKey);
