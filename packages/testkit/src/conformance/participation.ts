/**
 * Registration-only participation contract (GH-339 F-4, DM-6, API-5;
 * TDR-0039).
 *
 * Exactly five supplied items and a closed refusal vocabulary. Data plus two
 * pure validators; provider-free and runtime-neutral.
 */
import { ADAPTER_OPERATIONS } from "@delivery-os/core/contracts";

/** The five items a new adapter supplies, in declared order. */
export const PARTICIPATION_ITEMS = [
  "contract",
  "registration",
  "matrix-column",
  "tenant-fixtures",
  "trap-catalog",
] as const;

export type ParticipationItem = (typeof PARTICIPATION_ITEMS)[number];

/** One declared participation item. */
export type ParticipationEntry = {
  readonly item: ParticipationItem;
  readonly description: string;
};

export const PARTICIPATION_CONTRACT: readonly ParticipationEntry[] = [
  { item: "contract", description: "an AdapterContract drawn from the closed operation set" },
  {
    item: "registration",
    description:
      "one registration binding a client builder over tenant, credential port and transport",
  },
  {
    item: "matrix-column",
    description: "one parity-matrix column with one cell per closed operation",
  },
  { item: "tenant-fixtures", description: "one mock-tenant fixture set" },
  { item: "trap-catalog", description: "one trap catalog covering the error families" },
];

/** The closed refusal vocabulary for anything outside the five items. */
export const PARTICIPATION_REFUSALS = [
  "operation-outside-closed-set",
  "lifecycle-hook",
  "per-adapter-runner-branch",
] as const;

export type ParticipationRefusal = (typeof PARTICIPATION_REFUSALS)[number];

/** Validate a declared participation record; extra and missing items are named. */
export const participationViolations = (value: unknown): string[] => {
  if (!isRecord(value)) return ["participation record is not an object"];
  const violations: string[] = [];
  const keys = Object.keys(value);
  for (const key of keys) {
    if (!(PARTICIPATION_ITEMS as readonly string[]).includes(key)) {
      violations.push(`${key}: item is outside the five-item participation contract`);
    }
  }
  for (const item of PARTICIPATION_ITEMS) {
    if (!Object.hasOwn(value, item)) violations.push(`${item}: declared item is missing`);
  }
  if (Object.keys(value).length !== PARTICIPATION_ITEMS.length) {
    violations.push(
      `expected exactly ${PARTICIPATION_ITEMS.length} items, found ${Object.keys(value).length}`,
    );
  }
  for (const hook of ["lifecyclePhase", "port", "phaseHook"]) {
    if (Object.hasOwn(value, hook)) {
      violations.push(`${hook}: lifecycle hooks are not part of the participation contract`);
    }
  }
  return violations;
};

/** Refuse a requirement outside the five items, naming the refusal id. */
export const participationRefusal = (requirement: string): ParticipationRefusal | undefined => {
  if (requirement === "operation") return "operation-outside-closed-set";
  if (requirement === "lifecyclePhase" || requirement === "phaseHook") return "lifecycle-hook";
  if (requirement === "runnerBranch") return "per-adapter-runner-branch";
  return undefined;
};

/** True when an operation belongs to the closed operation set. */
export const isClosedOperation = (operation: string): boolean =>
  (ADAPTER_OPERATIONS as readonly string[]).includes(operation);

/** Refuse a supported operation outside the closed set, naming the operation. */
export const operationRefusal = (operation: string): string | undefined =>
  isClosedOperation(operation)
    ? undefined
    : `operation-outside-closed-set: ${operation} is not in the closed operation set`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
