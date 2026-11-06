/**
 * Artifact-boundary declarations used by the GH-222 suites (DM-4).
 *
 * These are stand-in kinds for the future retro registry (M1-S8) and ceremony
 * artifacts (M2-S3): declarations only, with no pipeline or runner behaviour
 * (DEC-1, NG-1).
 */
import type {
  StateAppendOutcome,
  StateAppendRequest,
  StateArtifactBoundaryDeclaration,
  StateArtifactKindDeclaration,
  StateResult,
  StateStorePort,
} from "../../../packages/core/src/contracts/index";
import type { StateArtifactBoundary } from "../../../packages/core/src/state/index";
import { createArtifactBoundary } from "../../../packages/core/src/state/index";
import { AUDIT_BOUNDARY_DECLARATION as AUDIT_DECLARATION } from "../../../packages/core/src/contracts/index";

/** The GH-223 audit artifact boundary: both audit kinds under one key family. */
export const AUDIT_BOUNDARY_DECLARATION = AUDIT_DECLARATION;

/** Compose the audit boundary over a store (the production factory path). */
export const createAuditBoundaryFor = (store: StateStorePort): StateArtifactBoundary =>
  createArtifactBoundary(store, AUDIT_BOUNDARY_DECLARATION);

/** A retro-registry stand-in kind: required identity, required vocabulary. */
export const RETRO_FINDING_KIND: StateArtifactKindDeclaration = {
  kind: "retro.finding",
  payloadSchema: "delivery.retro.finding.v1",
  identityField: "findingId",
  fields: [
    { name: "findingId", type: "string", required: true },
    { name: "severity", type: "string", required: true },
    { name: "count", type: "number", required: true },
    { name: "resolved", type: "boolean", required: false },
    { name: "note", type: "string", required: false },
  ],
  vocabularies: [{ field: "severity", values: ["low", "medium", "high"] }],
};

export const RETRO_BOUNDARY: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: "retro.records:",
  kinds: [RETRO_FINDING_KIND],
};

/** A ceremony-artifact stand-in kind: closed status vocabulary, identity. */
export const CEREMONY_ARTIFACT_KIND: StateArtifactKindDeclaration = {
  kind: "ceremony.artifact",
  payloadSchema: "delivery.ceremony.artifact.v1",
  identityField: "artifactId",
  fields: [
    { name: "artifactId", type: "string", required: true },
    { name: "status", type: "string", required: true },
    { name: "attempt", type: "number", required: false },
  ],
  vocabularies: [{ field: "status", values: ["pending", "approved", "rejected"] }],
};

export const CEREMONY_BOUNDARY: StateArtifactBoundaryDeclaration = {
  recordKeyPrefix: "ceremony.artifacts:",
  kinds: [CEREMONY_ARTIFACT_KIND],
};

/** Append one artifact through the boundary under a fresh fence. */
export const appendArtifact = (
  boundary: StateArtifactBoundary,
  store: StateStorePort,
  request: StateAppendRequest,
  token = "boundary-writer",
): StateResult<StateAppendOutcome> => {
  const acquired = store.acquireFence(token);
  if (!acquired.ok) return acquired;
  try {
    return boundary.append(acquired.value.handle, request);
  } finally {
    store.releaseFence(acquired.value.handle);
  }
};
