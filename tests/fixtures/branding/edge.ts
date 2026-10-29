/**
 * Runtime-aware-edge fixture for TC-BRANDING-007.
 *
 * The edge owns the neutral override variable name and injects environment
 * facts into the pure resolver. It never reads the real process environment:
 * facts arrive as a parameter, and only own properties are consulted.
 */
import { resolveBrandIdentity } from "../../../packages/core/src/branding/index.ts";

export const WORKING_NAME_OVERRIDE = "DELIVERY_OS_WORKING_NAME";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (record: Record<string, unknown>, key: string): boolean =>
  Object.hasOwn(record, key);

export const resolveAtEdge = (configuredName: string, facts: unknown) => {
  const record = isRecord(facts) ? facts : {};
  if (!hasOwn(record, WORKING_NAME_OVERRIDE)) {
    return resolveBrandIdentity({ workingName: configuredName });
  }
  // The edge forwards the raw fact; the resolver owns fail-closed validation.
  return resolveBrandIdentity({
    workingName: configuredName,
    override: record[WORKING_NAME_OVERRIDE] as string,
  });
};
