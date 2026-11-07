/**
 * Capability-declaration validation and consumer inspection (GH-233 F-1, DM-4).
 *
 * Supported and gap sets are disjoint and exhaustive by validation: a
 * capability in neither set fails naming the harness and capability, and a
 * capability in both sets fails as a contradiction. Inspection returns a
 * machine-readable gap, never an unclassified throw.
 */
import {
  HARNESS_GAP_REASONS,
  HARNESS_LIFECYCLE_CAPABILITIES,
  HARNESS_LIVENESS_KINDS,
  HARNESS_OPERATIONS,
  type HarnessCapability,
  type HarnessCapabilityDeclaration,
  type HarnessCapabilityGap,
  type HarnessGapReason,
  type HarnessInstance,
  type HarnessKind,
} from "#contracts";

export type HarnessCapabilityInspection =
  | { readonly supported: true }
  | {
      readonly supported: false;
      readonly gap: {
        readonly harnessKind: HarnessKind;
        readonly capability: HarnessCapability;
        readonly reason: HarnessGapReason;
      };
    };

const duplicates = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const value of values) {
    if (seen.has(value)) repeated.push(value);
    seen.add(value);
  }
  return repeated;
};

const supportedCapabilities = (
  declaration: HarnessCapabilityDeclaration,
): readonly HarnessCapability[] => [
  ...declaration.supportedOperations,
  ...declaration.lifecycleCapabilities,
  ...declaration.livenessSources,
];

const universalCapabilities = (): readonly HarnessCapability[] => [
  ...HARNESS_OPERATIONS,
  ...HARNESS_LIFECYCLE_CAPABILITIES,
  ...HARNESS_LIVENESS_KINDS,
];

/**
 * Return every declaration defect, naming the harness and capability.
 *
 * `harnessKind` is used only in the message; the check is over declaration
 * data, so a copied declaration can be validated without an adapter.
 */
export const harnessCapabilityViolations = (
  harnessKind: string,
  declaration: HarnessCapabilityDeclaration,
): string[] => {
  const violations: string[] = [];
  const supported = supportedCapabilities(declaration);
  for (const repeated of duplicates(supported)) {
    violations.push(`${harnessKind}: capability ${repeated} is declared twice as supported`);
  }
  for (const repeated of duplicates(declaration.declaredGaps.map((gap) => gap.capability))) {
    violations.push(`${harnessKind}: capability ${repeated} is declared twice as a gap`);
  }
  const known = new Set<string>(universalCapabilities());
  for (const capability of supported) {
    if (!known.has(capability)) violations.push(`${harnessKind}: unknown capability ${capability}`);
  }
  for (const gap of declaration.declaredGaps) {
    if (!known.has(gap.capability)) {
      violations.push(`${harnessKind}: unknown gap capability ${gap.capability}`);
    }
    if (!(HARNESS_GAP_REASONS as readonly string[]).includes(gap.reason)) {
      violations.push(`${harnessKind}: unknown gap reason ${gap.reason}`);
    }
    if (supported.includes(gap.capability)) {
      violations.push(`${harnessKind}: capability ${gap.capability} is both supported and a gap`);
    }
  }
  const gaps = new Set(declaration.declaredGaps.map((gap) => gap.capability));
  for (const capability of universalCapabilities()) {
    if (!supported.includes(capability) && !gaps.has(capability)) {
      violations.push(
        `${harnessKind}: capability ${capability} is neither supported nor declared as a gap`,
      );
    }
  }
  return violations;
};

/** Inspect one capability on an instance; a gap is returned, never thrown. */
export const inspectHarnessCapability = (
  instance: HarnessInstance,
  capability: HarnessCapability,
): HarnessCapabilityInspection => {
  const declaration = instance.capabilities;
  const supported: readonly HarnessCapability[] = supportedCapabilities(declaration);
  if (supported.includes(capability)) return { supported: true };
  const gap: HarnessCapabilityGap | undefined = declaration.declaredGaps.find(
    (entry) => entry.capability === capability,
  );
  if (gap === undefined) {
    return {
      supported: false,
      gap: { harnessKind: instance.kind, capability, reason: "adapter-not-implemented" },
    };
  }
  return {
    supported: false,
    gap: { harnessKind: instance.kind, capability, reason: gap.reason },
  };
};
