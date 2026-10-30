/**
 * The designated runtime-aware edge (D12).
 *
 * Production defaults for the clock and run id, secret registration from an
 * environment record handed in as data, and brand values passed through as a
 * `BrandIdentity` parameter. No ambient `process.env`/`Bun.env` read ships here.
 */
import type { BrandIdentity } from "@delivery-os/core/contracts";
import type { CliDependencies, CommandProgram } from "./index.js";

/** Register non-empty secret values from an injected environment record. */
export function registerEdgeSecrets(
  environment: Readonly<Record<string, string | undefined>>,
  keys: readonly string[],
): readonly string[] {
  const values: string[] = [];
  for (const key of keys) {
    const value = environment[key];
    if (typeof value === "string" && value.length > 0 && !values.includes(value)) {
      values.push(value);
    }
  }
  return values;
}

export type EdgeOptions = {
  readonly brand: BrandIdentity;
  readonly program: CommandProgram;
  readonly environment?: Readonly<Record<string, string | undefined>>;
  readonly secretKeys?: readonly string[];
};

/** Assemble the production dependency set at the runtime-aware edge. */
export function createProductionDependencies(options: EdgeOptions): CliDependencies {
  return {
    brand: options.brand,
    clock: { now: () => Math.trunc(performance.now()) },
    newRunId: () => globalThis.crypto.randomUUID(),
    secrets: registerEdgeSecrets(options.environment ?? {}, options.secretKeys ?? []),
    program: options.program,
  };
}
