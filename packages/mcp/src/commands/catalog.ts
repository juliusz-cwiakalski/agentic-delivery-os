/**
 * The closed MCP tool catalog (F-6, DEC-3, DEC-5).
 *
 * The canonical primitive IDs are the stable identity; the served name is the
 * branding projection (`BrandIdentity.mcpToolPrefix` plus the primitive ID).
 * Descriptions are static, secret-free, and brand-free beyond the prefix: they
 * interpolate no product, binary, scope, or environment value.
 */
import type { BrandIdentity } from "@delivery-os/core/contracts";

/** The closed canonical primitive-ID list; no fourth tool exists (DEC-3). */
export const CANONICAL_TOOL_IDS = ["status", "verify-artifact", "gate-report"] as const;

/** A canonical primitive ID: the stable tool identity. */
export type CanonicalToolId = (typeof CANONICAL_TOOL_IDS)[number];

/** One declared input property of a ref tool. */
export type ToolInputProperty = {
  readonly type: "string";
  readonly description: string;
};

/** The JSON-schema subset the catalog declares for a tool input. */
export type ToolInputSchema = {
  readonly type: "object";
  readonly properties: Readonly<Record<string, ToolInputProperty>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
};

/** One advertised tool descriptor; the name is the branding projection. */
export type ToolDescriptor = {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolInputSchema;
};

/** The delivery-bound parameter name for the change ref (OQ-T5). */
const REF_PARAMETER = "ref";

const REF_DESCRIPTION =
  "The tracker work-item reference of the change to inspect, for example GH-123.";

const STATUS_DESCRIPTION =
  "Read the bounded delivery status digest: repository binding, tracker items, delivery " +
  "requests, pipeline runs, provider state, and local parked work. Read-only.";

const VERIFY_DESCRIPTION =
  "Read the change's pm-notes declaration and phase ledger and return the verify-change " +
  "verdict or a classified failure. Read-only.";

const GATE_REPORT_DESCRIPTION =
  "Read the five merge-gate verdicts for a change reference: lifecycle finalization, CI, " +
  "push parity, owner gate, and squash preflight. Read-only.";

const DESCRIPTIONS: Readonly<Record<CanonicalToolId, string>> = {
  status: STATUS_DESCRIPTION,
  "verify-artifact": VERIFY_DESCRIPTION,
  "gate-report": GATE_REPORT_DESCRIPTION,
};

const refSchema = (): ToolInputSchema => ({
  type: "object",
  properties: {
    [REF_PARAMETER]: { type: "string", description: REF_DESCRIPTION },
  },
  required: [REF_PARAMETER],
  additionalProperties: false,
});

const noParameterSchema = (): ToolInputSchema => ({
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
});

const descriptorFor = (brand: BrandIdentity, id: CanonicalToolId): ToolDescriptor => ({
  name: `${brand.mcpToolPrefix}${id}`,
  description: DESCRIPTIONS[id],
  inputSchema: id === "status" ? noParameterSchema() : refSchema(),
});

/** Project the closed catalog into served descriptors under one brand. */
export const describeTools = (brand: BrandIdentity): readonly ToolDescriptor[] =>
  CANONICAL_TOOL_IDS.map((id) => descriptorFor(brand, id));

/** Resolve a served tool name back to its canonical ID, or undefined. */
export const toolIdByName = (brand: BrandIdentity, name: string): CanonicalToolId | undefined => {
  if (!name.startsWith(brand.mcpToolPrefix)) return undefined;
  const id = name.slice(brand.mcpToolPrefix.length);
  return (CANONICAL_TOOL_IDS as readonly string[]).includes(id)
    ? (id as CanonicalToolId)
    : undefined;
};
