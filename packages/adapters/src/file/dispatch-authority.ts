/**
 * The CLI-independent derived authority read (GH-239 F-6, F-7; DM-4; DEC-9).
 *
 * Bash and other non-typed consumers read the same derived document as a plain
 * file. An absent, unreadable, or malformed view resolves to `dual-run`, so a
 * missing or broken typed installation can never break the fallback and no
 * error escapes to the caller.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DISPATCH_AUTHORITY_DOCUMENT_NAME,
  DISPATCH_AUTHORITY_SCHEMA,
  type DispatchAuthorityView,
} from "@delivery-os/core/contracts";

/** The document name bash reads beside the state header. */
export const dispatchAuthorityDocumentName = (): string => DISPATCH_AUTHORITY_DOCUMENT_NAME;

/** The safe dual-run view for a repository with no usable authority evidence. */
export const dualRunDispatchAuthority = (repository: string): DispatchAuthorityView => ({
  schema: DISPATCH_AUTHORITY_SCHEMA,
  repository,
  authority: "dual-run",
  recordedAt: "",
  reversalAvailable: false,
});

const parse = (text: string): DispatchAuthorityView | undefined => {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (record.schema !== DISPATCH_AUTHORITY_SCHEMA) return undefined;
    if (typeof record.repository !== "string" || record.repository.length === 0) return undefined;
    if (record.authority !== "dual-run" && record.authority !== "authoritative") return undefined;
    if (typeof record.recordedAt !== "string") return undefined;
    if (typeof record.reversalAvailable !== "boolean") return undefined;
    return {
      schema: DISPATCH_AUTHORITY_SCHEMA,
      repository: record.repository,
      authority: record.authority,
      ...(typeof record.handoverRef === "string" ? { handoverRef: record.handoverRef } : {}),
      recordedAt: record.recordedAt,
      reversalAvailable: record.reversalAvailable,
    };
  } catch {
    return undefined;
  }
};

/**
 * Read the derived view for one repository from a state root.
 *
 * The store lays derived documents under `documents.<workspace-id>/`; the read
 * scans those directories only, so several workspaces in one root never leak
 * one repository's authority into another.
 */
export const readDispatchAuthority = (
  stateRoot: string,
  repository: string,
): DispatchAuthorityView => {
  try {
    if (!existsSync(stateRoot)) return dualRunDispatchAuthority(repository);
    const directories = readdirSync(stateRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith("documents."))
      .map((entry) => entry.name)
      .sort();
    for (const directory of directories) {
      const path = join(stateRoot, directory, DISPATCH_AUTHORITY_DOCUMENT_NAME);
      if (!existsSync(path)) continue;
      const view = parse(readFileSync(path, "utf8"));
      if (view !== undefined && view.repository === repository) return view;
    }
    return dualRunDispatchAuthority(repository);
  } catch {
    return dualRunDispatchAuthority(repository);
  }
};

/** Read every parseable view in a state root (diagnostics and tests only). */
export const listDispatchAuthority = (stateRoot: string): readonly DispatchAuthorityView[] => {
  try {
    if (!existsSync(stateRoot)) return [];
    const views: DispatchAuthorityView[] = [];
    for (const entry of readdirSync(stateRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("documents.")) continue;
      const path = join(stateRoot, entry.name, DISPATCH_AUTHORITY_DOCUMENT_NAME);
      if (!existsSync(path)) continue;
      const view = parse(readFileSync(path, "utf8"));
      if (view !== undefined) views.push(view);
    }
    return views;
  } catch {
    return [];
  }
};
