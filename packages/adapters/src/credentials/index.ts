/**
 * `@delivery-os/adapters/credentials` — the environment-backed credential port
 * implementation (F-3, DEC-2).
 *
 * This is the single runtime-aware implementation of the runtime-neutral
 * `CredentialPort` contract. The ambient environment is read only by the
 * production wrapper below; the resolution itself accepts an injected
 * environment record, so tests never depend on the host environment.
 *
 * Secret material is returned exactly once through the port result. The port
 * exposes no diagnostic channel and no implementation-mode surface; the future
 * credential sidecar becomes a second implementation behind the same interface.
 */
import type {
  BrandIdentity,
  CredentialPort,
  CredentialReference,
  CredentialResolution,
  CredentialResolutionFailure,
} from "@delivery-os/core/contracts";

/** An injected environment record; production passes the process environment. */
export type CredentialEnvironment = Readonly<Record<string, string | undefined>>;

/** Construction input for the injected environment-backed port. */
export type EnvironmentCredentialPortOptions = {
  readonly environment: CredentialEnvironment;
  readonly brand: BrandIdentity;
};

/**
 * Resolve a declared reference to its source key.
 *
 * The mapping is declarative data on the reference: a literal key is used
 * verbatim, while an environment-prefixed key derives its prefix from the
 * branding seam supplied as data. No external system name participates.
 */
export const resolveCredentialSourceKey = (
  reference: CredentialReference,
  brand: BrandIdentity,
): string =>
  reference.sourceKey.style === "literal"
    ? reference.sourceKey.name
    : `${brand.environmentPrefix}${reference.sourceKey.suffix}`;

/** The reified `config.credential.missing` identity. */
const credentialMissing = (): CredentialResolutionFailure => ({
  ok: false,
  code: "config.credential.missing",
  domainKind: "config",
  category: "user",
  retryable: false,
  consequence: "not_landed",
  projectionClass: "user-validation",
});

/** An absent key and an empty-string value both fail; whitespace is a value. */
const materialFrom = (value: string | undefined): CredentialResolution =>
  value === undefined || value === "" ? credentialMissing() : { ok: true, material: { value } };

/** Build a credential port over an injected environment record. */
export const createEnvironmentCredentialPort = (
  options: EnvironmentCredentialPortOptions,
): CredentialPort => ({
  resolve: (reference: CredentialReference): CredentialResolution =>
    materialFrom(options.environment[resolveCredentialSourceKey(reference, options.brand)]),
});

/** The process environment supplied by the production composition edge. */
const readProcessEnvironment = (): CredentialEnvironment => {
  const environment: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(process.env)) {
    environment[key] = value;
  }
  return environment;
};

/** The production wrapper: the only ambient-environment read in the I/O tier. */
export const createProcessCredentialPort = (brand: BrandIdentity): CredentialPort =>
  createEnvironmentCredentialPort({ environment: readProcessEnvironment(), brand });
