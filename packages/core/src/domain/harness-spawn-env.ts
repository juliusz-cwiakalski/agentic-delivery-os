/**
 * Deny-by-default spawn-environment construction (GH-233 F-5, DEC-2, NFR-5,
 * NFR-9).
 *
 * The child environment is exactly the declared set. Variable entries take the
 * value supplied by the injected parent-environment record; credential entries
 * resolve through the credential port at construction (spawn) time. An absent
 * declared variable or an unresolvable reference is a classified failure naming
 * the item, with zero partial environment. The module reads no ambient
 * environment and accepts no value from an undeclared key.
 */
import type {
  CredentialPort,
  HarnessExecutionEnvironmentDescriptor,
  HarnessFailure,
  HarnessResult,
} from "#contracts";

const failure = (error: HarnessFailure): HarnessResult<never> => ({ ok: false, error });

const credentialFailure = (reference: string, variable: string): HarnessResult<never> =>
  failure({
    kind: "config",
    code: "config.credential.missing",
    cause: "config.credential.missing",
    reference,
    field: variable,
    summary: `declared credential reference ${reference} did not resolve for ${variable}`,
  });

/**
 * Build the spawn environment from the descriptor alone.
 *
 * Every returned key is declared; every undeclared parent key is absent. The
 * credential port is consulted once per declared credential entry, at build
 * (spawn) time, and its material enters only the returned record.
 */
export const buildHarnessSpawnEnvironment = (input: {
  readonly descriptor: HarnessExecutionEnvironmentDescriptor;
  readonly parentEnvironment: Readonly<Record<string, string | undefined>>;
  readonly credentials: CredentialPort;
}): HarnessResult<Readonly<Record<string, string>>> => {
  const environment: Record<string, string> = {};
  for (const entry of input.descriptor.environment) {
    if (entry.kind === "variable") {
      const value = input.parentEnvironment[entry.name];
      if (value === undefined) {
        return failure({
          kind: "harness",
          code: "harness.spawn.variable-missing",
          field: entry.name,
          summary: `declared environment variable ${entry.name} is absent from the parent environment`,
        });
      }
      environment[entry.name] = value;
      continue;
    }
    const resolution = input.credentials.resolve(entry.reference);
    if (!resolution.ok) {
      return credentialFailure(entry.reference.referenceName, entry.name);
    }
    environment[entry.name] = resolution.material.value;
  }
  return { ok: true, value: Object.freeze({ ...environment }) };
};
