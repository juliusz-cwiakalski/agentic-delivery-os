/**
 * The `harness-store` credential strategy (F-3, DM-1).
 *
 * The declared integration id reaches the allowlisted export's own target
 * selector, so only that integration's entries return; in-process single-entry
 * selection remains as defense in depth. The raw export is never retained:
 * only the selected entry's key materializes. Exactly one `active` entry is
 * required; a store with no stored entry is `empty-output`; OAuth entries are
 * refused outright; every shape departure is classified `shape-drift` naming
 * the harness and the offending field. The declared harness must equal the
 * active harness identity — a mismatch refuses cold, never borrowing another
 * store's layout. The posture is read-only.
 *
 * Hermetic by construction: the store facts arrive through the injected seam,
 * so no real store, keyring, or owner CLI is ever touched here.
 */
import type {
  CredentialFailureReason,
  CredentialSourceKey,
  SecretMaterial,
} from "@delivery-os/core/contracts";
import { HARNESS_KINDS, type HarnessKind } from "@delivery-os/core/contracts";

/**
 * The supported harness CLI version window, pinned by the suites and re-pinned
 * only deliberately (spec §22). Declarative: no runtime version check exists.
 */
export const HARNESS_CLI_VERSION_WINDOW = ">=2.3.2 <3.0.0" as const;

/** One raw export request against the injected store facts. */
export type StoreExportRequest = {
  readonly integrationId: string;
  readonly standalone: boolean;
};

/** One raw export outcome: the bounded stdout or the classified run failure. */
export type StoreExportOutcome =
  | { readonly ok: true; readonly stdout: string; readonly stdoutTruncated: boolean }
  | { readonly ok: false; readonly reason: "timeout" | "non-zero-exit" | "program-unavailable" };

/**
 * The injected store facts seam: the export of the declared integration only.
 * The production composition wires this seam over the bounded child runner;
 * tests inject recorded doubles. Read-only by shape: no write operation exists.
 */
export type HarnessStoreFacts = {
  readonly exportEntries: (request: StoreExportRequest) => StoreExportOutcome;
};

/** One pinned-shape export entry. */
export type HarnessStoreEntry = {
  readonly id: string;
  readonly integrationID: string;
  readonly label: string;
  readonly active: boolean;
  readonly value: { readonly type: "key"; readonly key: string } | { readonly type: "oauth" };
};

/**
 * The strategy's classification. Shape drift names the harness and the
 * offending field; the resolver projects the port-level failure variant from
 * the reason, and the suites assert the classification's naming.
 */
export type HarnessStoreClassification =
  | { readonly status: "resolved"; readonly material: SecretMaterial }
  | {
      readonly status: "refused";
      readonly reason: CredentialFailureReason;
      /** The offending field for a shape-drift refusal; absent otherwise. */
      readonly field?: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const drift = (field: string): HarnessStoreClassification => ({
  status: "refused",
  reason: "shape-drift",
  field,
});

/** The parsed export entries or the drift classification that refused them. */
type ParsedEntries =
  | { readonly ok: true; readonly entries: readonly HarnessStoreEntry[] }
  | { readonly ok: false; readonly classification: HarnessStoreClassification };

/** Parse the pinned export shape: an array of fully-shaped entries. */
const parseEntries = (stdout: string): ParsedEntries => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout) as unknown;
  } catch {
    return { ok: false, classification: drift("output") };
  }
  if (!Array.isArray(parsed)) return { ok: false, classification: drift("root") };
  const entries: HarnessStoreEntry[] = [];
  for (const raw of parsed) {
    if (!isRecord(raw)) return { ok: false, classification: drift("entry") };
    const id = raw.id;
    const integrationID = raw.integrationID;
    const label = raw.label;
    const active = raw.active;
    const value = raw.value;
    if (typeof id !== "string") return { ok: false, classification: drift("id") };
    if (typeof integrationID !== "string") {
      return { ok: false, classification: drift("integrationID") };
    }
    if (typeof label !== "string") return { ok: false, classification: drift("label") };
    if (typeof active !== "boolean") return { ok: false, classification: drift("active") };
    if (!isRecord(value) || typeof value.type !== "string") {
      return { ok: false, classification: drift("value") };
    }
    if (value.type === "key") {
      if (typeof value.key !== "string") return { ok: false, classification: drift("value.key") };
    } else if (value.type !== "oauth") {
      return { ok: false, classification: drift("value.type") };
    }
    entries.push({
      id,
      integrationID,
      label,
      active,
      value:
        value.type === "key"
          ? { type: "key", key: typeof value.key === "string" ? value.key : "" }
          : { type: "oauth" },
    });
  }
  return { ok: true, entries };
};

/** The strategy's inputs, over the injected seams. */
export type HarnessStoreSourceInput = {
  readonly activeHarness: HarnessKind;
  readonly storeFacts: HarnessStoreFacts;
  readonly registerSecret: (value: string) => void;
};

/**
 * Classify a `harness-store` resolution. The declared harness must equal the
 * active identity and be a supported kind — otherwise the refusal is cold and
 * the store is never consulted. Material registers the moment an entry key is
 * validated, before selection and before any throw.
 */
export const classifyHarnessStoreSource = (
  sourceKey: Extract<CredentialSourceKey, { style: "harness-store" }>,
  input: HarnessStoreSourceInput,
): HarnessStoreClassification => {
  if (
    !(HARNESS_KINDS as readonly string[]).includes(sourceKey.harness) ||
    sourceKey.harness !== input.activeHarness
  ) {
    return { status: "refused", reason: "source-not-supported" };
  }
  const exported = input.storeFacts.exportEntries({
    integrationId: sourceKey.integrationId,
    standalone: false,
  });
  if (!exported.ok) {
    return { status: "refused", reason: exported.reason };
  }
  if (exported.stdoutTruncated) return drift("stdout");
  const parsed = parseEntries(exported.stdout);
  if (!parsed.ok) return parsed.classification;
  if (parsed.entries.length === 0) return { status: "refused", reason: "empty-output" };
  // Register every key entry's material as it is validated — before selection
  // and before any refusal the selection may raise.
  for (const entry of parsed.entries) {
    if (entry.value.type === "key") input.registerSecret(entry.value.key);
  }
  const active = parsed.entries.filter((entry) => entry.active);
  if (active.length !== 1) return { status: "refused", reason: "ambiguous-account" };
  const selected = active[0];
  if (selected === undefined) return { status: "refused", reason: "ambiguous-account" };
  if (selected.value.type === "oauth") return { status: "refused", reason: "oauth-excluded" };
  if (selected.value.type !== "key") return drift("value.type");
  return { status: "resolved", material: { value: selected.value.key } };
};
