/**
 * Fixture adapter declarations for TC-PORT-003 / TC-PORT-004 / TC-META-005.
 *
 * Dev-only harness: no provider implementation ships. Declarations are typed
 * data; the fixture adapter consults them and reports explicit gaps, never
 * implied parity.
 */

import {
  type SerializedCarrier,
  serializeEnvelope,
} from "../../../packages/adapters/src/io/envelope-codec";
import {
  ADAPTER_OPERATIONS,
  type AdapterCapabilityDeclaration,
  type AdapterContract,
  type AdapterOperation,
  CARRIER_KINDS,
  type CapabilityGap,
  type CapabilityGapReason,
  type CarrierKind,
  type CommentWriteRequest,
  ENVELOPE_SCHEMA_ID,
  type ExternalSystemKind,
  type MetadataEnvelopeV1,
} from "../../../packages/core/src/contracts/index";

/** An operation that is absent from the flags but has no explicit gap record. */
export type UndeclaredOperation = {
  readonly operation: AdapterOperation;
  readonly reason: "undeclared-operation";
};

/** The result of asking a fixture adapter to perform an operation. */
export type OperationResolution =
  | { readonly supported: true }
  | { readonly supported: false; readonly gap: CapabilityGap | UndeclaredOperation };

/** An operation the fixture adapter does not support. */
export const UNSUPPORTED_OPERATION: AdapterOperation = "write-delivery-request";

/** Fully declared positive control: every operation and carrier is supported. */
export const fullAdapter: AdapterContract = {
  adapterName: "fixture-full",
  systemKind: "tracker",
  capabilities: {
    supportedOperations: [...ADAPTER_OPERATIONS],
    declaredGaps: [],
    writableCarriers: [...CARRIER_KINDS],
    readableCarriers: [...CARRIER_KINDS],
  },
};

/** Partial adapter: declares an explicit gap for one unsupported operation. */
export const gappedAdapter: AdapterContract = {
  adapterName: "fixture-gapped",
  systemKind: "tracker",
  capabilities: {
    supportedOperations: [
      "read-work-item",
      "write-work-item",
      "transition-work-item",
      "read-delivery-request",
      "read-pipeline-run",
      "write-comment",
    ],
    declaredGaps: [{ operation: UNSUPPORTED_OPERATION, reason: "adapter-not-implemented" }],
    writableCarriers: ["invisible-comment-block"],
    readableCarriers: ["invisible-comment-block", "compact-marker"],
  },
};

/** Carrier-subset adapters used by the declared-carrier typing matrix. */
export const commentBlockOnlyAdapter: AdapterContract = {
  adapterName: "fixture-comment-block",
  systemKind: "tracker",
  capabilities: {
    supportedOperations: ["read-work-item", "write-comment"],
    declaredGaps: [],
    writableCarriers: ["invisible-comment-block"],
    readableCarriers: ["invisible-comment-block"],
  },
};

export const customFieldOnlyAdapter: AdapterContract = {
  adapterName: "fixture-custom-field",
  systemKind: "vcs",
  capabilities: {
    supportedOperations: ["read-delivery-request", "write-comment"],
    declaredGaps: [],
    writableCarriers: ["provider-custom-field"],
    readableCarriers: ["provider-custom-field"],
  },
};

export const compactMarkerOnlyAdapter: AdapterContract = {
  adapterName: "fixture-compact-marker",
  systemKind: "ci",
  capabilities: {
    supportedOperations: ["read-pipeline-run", "write-comment"],
    declaredGaps: [],
    writableCarriers: ["compact-marker"],
    readableCarriers: ["compact-marker"],
  },
};

/** Ask the fixture adapter about one operation; absence is an explicit gap. */
export const resolveOperation = (
  declaration: AdapterCapabilityDeclaration,
  operation: AdapterOperation,
): OperationResolution => {
  if (declaration.supportedOperations.includes(operation)) return { supported: true };
  const gap = declaration.declaredGaps.find((candidate) => candidate.operation === operation);
  if (gap !== undefined) return { supported: false, gap };
  return { supported: false, gap: { operation, reason: "undeclared-operation" } };
};

/** The operations the declaration explicitly records as gaps. */
export const explicitGapOperations = (
  declaration: AdapterCapabilityDeclaration,
): readonly AdapterOperation[] => declaration.declaredGaps.map((gap) => gap.operation);

/** Structural validation of one capability declaration (no implied parity). */
export const validateCapabilityDeclaration = (
  declaration: AdapterCapabilityDeclaration,
): string[] => {
  const failures: string[] = [];
  for (const operation of declaration.supportedOperations) {
    if (!(ADAPTER_OPERATIONS as readonly string[]).includes(operation)) {
      failures.push(`unknown operation ${operation}`);
    }
  }
  for (const gap of declaration.declaredGaps) {
    if (declaration.supportedOperations.includes(gap.operation)) {
      failures.push(`gap declared for supported operation ${gap.operation}`);
    }
  }
  for (const carrier of [...declaration.writableCarriers, ...declaration.readableCarriers]) {
    if (!(CARRIER_KINDS as readonly string[]).includes(carrier)) {
      failures.push(`unknown carrier ${carrier}`);
    }
  }
  return failures;
};

const containsCarrier = <Declared extends readonly CarrierKind[]>(
  declared: Declared,
  candidate: CarrierKind,
): candidate is Declared[number] => declared.some((entry) => entry === candidate);

/** Runtime half of declared-carrier selection: undeclared carriers are gaps. */
export const selectDeclaredCarrier = <Declared extends readonly CarrierKind[]>(
  declared: Declared,
  candidate: CarrierKind,
):
  | { readonly ok: true; readonly carrier: Declared[number] }
  | { readonly ok: false; readonly gap: CapabilityGap } => {
  if (!containsCarrier(declared, candidate)) {
    return {
      ok: false,
      gap: { operation: "write-comment", reason: "plan-restriction" },
    };
  }
  return { ok: true, carrier: candidate };
};

/** Build the v1 envelope an adapter writes for an agent-facing comment request. */
export const envelopeForRequest = (request: CommentWriteRequest): MetadataEnvelopeV1 => ({
  schema: ENVELOPE_SCHEMA_ID,
  kind: "work-item-comment",
  payload: { comment: request.provenance, delivery: request.delivery },
});

/** The adapter-only write path: a declared carrier is required. */
export const writeMetadata = (
  declaration: AdapterCapabilityDeclaration,
  request: CommentWriteRequest,
  carrier: CarrierKind,
):
  | { readonly ok: true; readonly serialized: SerializedCarrier }
  | { readonly ok: false; readonly gap: CapabilityGap } => {
  const selection = selectDeclaredCarrier(declaration.writableCarriers, carrier);
  if (!selection.ok) return selection;
  const serialized = serializeEnvelope({
    envelope: envelopeForRequest(request),
    carrier: selection.carrier,
    humanContent: request.body,
    policy: () => ({ ok: true }),
  });
  if (!serialized.ok) {
    return { ok: false, gap: { operation: "write-comment", reason: "plan-restriction" } };
  }
  return { ok: true, serialized: serialized.carrier };
};

/**
 * The exact GH-188 OQ-G postures. This is the expected data the delivered
 * provider declarations are compared against — not a second source of truth:
 * the test binds the production `AdapterContract` values to these rows.
 */
export type ExpectedSeedPosture = {
  readonly adapterName: string;
  readonly systemKind: ExternalSystemKind;
  readonly supported: readonly AdapterOperation[];
  readonly gapReasons: Readonly<Partial<Record<AdapterOperation, CapabilityGapReason>>>;
};

export const EXPECTED_SEED_POSTURES = {
  jira: {
    adapterName: "jira",
    systemKind: "tracker",
    supported: ["read-work-item"],
    gapReasons: {
      "write-work-item": "adapter-not-implemented",
      "transition-work-item": "adapter-not-implemented",
      "write-comment": "adapter-not-implemented",
      "read-delivery-request": "provider-unsupported",
      "write-delivery-request": "provider-unsupported",
      "read-pipeline-run": "provider-unsupported",
      "resolve-delivery-thread": "provider-unsupported",
    },
  },
  gitlab: {
    adapterName: "gitlab",
    systemKind: "vcs",
    supported: ["read-delivery-request", "read-pipeline-run"],
    gapReasons: {
      "write-delivery-request": "adapter-not-implemented",
      "read-work-item": "adapter-not-implemented",
      "write-work-item": "adapter-not-implemented",
      "transition-work-item": "adapter-not-implemented",
      "write-comment": "adapter-not-implemented",
      "resolve-delivery-thread": "adapter-not-implemented",
    },
  },
  github: {
    adapterName: "github",
    systemKind: "vcs",
    supported: ["read-work-item", "read-delivery-request", "read-pipeline-run"],
    gapReasons: {
      "write-work-item": "adapter-not-implemented",
      "write-delivery-request": "adapter-not-implemented",
      "transition-work-item": "adapter-not-implemented",
      "write-comment": "adapter-not-implemented",
      "resolve-delivery-thread": "adapter-not-implemented",
    },
  },
} as const satisfies Readonly<Record<"jira" | "gitlab" | "github", ExpectedSeedPosture>>;
