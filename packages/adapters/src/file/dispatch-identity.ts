/**
 * The store-managed first-use identity marker (GH-239 F-6; DEC-13;
 * TDR-0015 §6).
 *
 * This module owns only the store-artifact read/write seam; identity
 * normalization and resolution order are the pure domain policy. The marker is
 * created once and never silently regenerated while guarded dispatch records
 * exist, so the persisted binding survives a checkout rename, a remote change,
 * and a process restart.
 */
import {
  DISPATCH_ATTEMPT_RECORD_KIND,
  DISPATCH_DIVERGENCE_RECORD_KIND,
  DISPATCH_HANDOVER_RECORD_KIND,
  DISPATCH_IDENTITY_MARKER_NAME,
  type StateStorePort,
} from "@delivery-os/core/contracts";

/** The record kinds whose presence proves the marker must already exist. */
export const DISPATCH_IDENTITY_GUARD_KINDS = [
  DISPATCH_ATTEMPT_RECORD_KIND,
  DISPATCH_DIVERGENCE_RECORD_KIND,
  DISPATCH_HANDOVER_RECORD_KIND,
] as const;

/** Read the raw persisted marker content; absent or unreadable is undefined. */
export const readDispatchIdentityMarkerText = (store: StateStorePort): string | undefined => {
  const read = store.readStoreArtifact({ name: DISPATCH_IDENTITY_MARKER_NAME });
  return read.ok ? read.value.content : undefined;
};

/**
 * Get-or-create the marker. Creation happens only on a first open; a later
 * open refuses (`state.keys.missing`) once any guarded record exists.
 */
export const ensureDispatchIdentityMarkerText = (
  store: StateStorePort,
  content: string,
): string | undefined => {
  const artifact = store.ensureStoreArtifact({
    name: DISPATCH_IDENTITY_MARKER_NAME,
    randomBytes: 16,
    create: () => content,
    guardKinds: DISPATCH_IDENTITY_GUARD_KINDS,
  });
  return artifact.ok ? artifact.value.content : undefined;
};
