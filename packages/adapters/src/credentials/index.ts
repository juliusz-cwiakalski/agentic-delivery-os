/**
 * `@delivery-os/adapters/credentials` — the credential port implementation
 * (F-3, DEC-2) and the strategy resolver over the governing record's four
 * construction-input seams (C-2): the active harness identity, the child
 * runner, the environment record, and the store facts.
 *
 * This is the single runtime-aware implementation directory of the
 * runtime-neutral `CredentialPort` contract (NFR-7): the only ambient
 * environment read is the production wrapper below; every resolution accepts
 * injected inputs, so tests never depend on the host environment.
 *
 * Secret material is returned exactly once through the port result and is
 * registered for redaction at the moment it is obtained — before parsing and
 * before any throw. The port exposes no diagnostic channel; the anticipated
 * credential sidecar becomes a second implementation behind the same
 * interface.
 */
import type {
  BrandIdentity,
  CredentialFailureReason,
  CredentialPort,
  CredentialReference,
  CredentialResolution,
  CredentialResolutionFailure,
  CredentialSourceKey,
  HarnessKind,
} from "@delivery-os/core/contracts";
import { remedyText } from "./allowlist.js";
import { type ChildRunner, resolveCommandSource } from "./command-strategy.js";
import { classifyHarnessStoreSource, type HarnessStoreFacts } from "./harness-store-strategy.js";

export {
  type AllowlistEntry,
  type AllowlistSlotGrammar,
  COMMAND_ALLOWLIST,
  COMMAND_STDOUT_MAX_BYTES,
  COMMAND_TIMEOUT_DEFAULT_MS,
  COMMAND_TIMEOUT_MAX_MS,
  type CommandRemedyCells,
  type CommandRemedyReason,
  commandRemedyText,
  constructArgv,
  type DeclarationMatch,
  environmentRemedyText,
  HOST_SLOT_MAX_LENGTH,
  harnessStoreRemedyText,
  INTEGRATION_ID_MAX_LENGTH,
  matchCommandDeclaration,
  type ParsedParameters,
  remedyText,
  type SlotValidation,
  validateHostSlot,
  validateIntegrationIdSlot,
} from "./allowlist.js";
export {
  type ChildRunner,
  type ChildRunOutcome,
  type ChildRunRequest,
  type CommandSourceInput,
  createSpawnChildRunner,
  type HarnessExportRun,
  reducedChildEnvironment,
  resolveCommandSource,
  runHarnessExport,
} from "./command-strategy.js";
export {
  classifyHarnessStoreSource,
  HARNESS_CLI_VERSION_WINDOW,
  type HarnessStoreClassification,
  type HarnessStoreEntry,
  type HarnessStoreFacts,
  type StoreExportOutcome,
  type StoreExportRequest,
} from "./harness-store-strategy.js";

/** An injected environment record; production passes the process environment. */
export type CredentialEnvironment = Readonly<Record<string, string | undefined>>;

/** Construction input for the injected environment-backed port. */
export type EnvironmentCredentialPortOptions = {
  readonly environment: CredentialEnvironment;
  readonly brand: BrandIdentity;
};

/**
 * Resolve a declared reference to its source-key identity.
 *
 * The mapping is declarative data on the reference: a literal key is used
 * verbatim, an environment-prefixed key derives its prefix from the branding
 * seam supplied as data, and the two execution styles carry their style
 * identity (`command:<program>`, `harness-store:<integrationID>`). No external
 * system name participates.
 */
export const resolveCredentialSourceKey = (
  reference: CredentialReference,
  brand: BrandIdentity,
): string => {
  const key = reference.sourceKey;
  if (key.style === "literal") return key.name;
  if (key.style === "environment-prefixed") return `${brand.environmentPrefix}${key.suffix}`;
  return key.style === "command" ? `command:${key.program}` : `harness-store:${key.integrationId}`;
};

/** The style-plus-source identity a failure carries for one declared key. */
export const credentialSourceIdentity = (sourceKey: CredentialSourceKey): string => {
  if (sourceKey.style === "literal") return `literal:${sourceKey.name}`;
  if (sourceKey.style === "environment-prefixed") {
    return `environment-prefixed:${sourceKey.suffix}`;
  }
  // The harness-store identity names the harness too (AC-F3-5): a shape-drift
  // refusal must say WHICH store layout departed, never only the integration.
  return sourceKey.style === "command"
    ? `command:${sourceKey.program}`
    : `harness-store:${sourceKey.harness}:${sourceKey.integrationId}`;
};

/**
 * The reified `config.credential.missing` identity with its projection fields.
 * A shape-drift refusal additionally carries the offending field name on the
 * rendered source (AC-F3-5); drift fields are closed classifier tokens, never
 * configuration text or child output.
 */
const credentialMissing = (
  sourceKey: CredentialSourceKey,
  reason: CredentialFailureReason,
  driftField?: string,
): CredentialResolutionFailure => {
  const identity = credentialSourceIdentity(sourceKey);
  return {
    ok: false,
    code: "config.credential.missing",
    domainKind: "config",
    category: "user",
    retryable: false,
    consequence: "not_landed",
    projectionClass: "user-validation",
    source: driftField === undefined ? identity : `${identity} field=${driftField}`,
    reason,
    remedy: remedyText(reason, sourceKey.style),
  };
};

/** An absent key and an empty-string value both fail; whitespace is a value. */
const materialFrom = (
  sourceKey: CredentialSourceKey,
  value: string | undefined,
): CredentialResolution =>
  value === undefined || value === ""
    ? credentialMissing(sourceKey, "variable-absent")
    : { ok: true, material: { value } };

/** Build a credential port over an injected environment record. */
export const createEnvironmentCredentialPort = (
  options: EnvironmentCredentialPortOptions,
): CredentialPort => ({
  resolve: (reference: CredentialReference): CredentialResolution => {
    const key = reference.sourceKey;
    if (key.style === "command" || key.style === "harness-store") {
      return credentialMissing(key, "source-not-supported");
    }
    return materialFrom(
      key,
      options.environment[resolveCredentialSourceKey(reference, options.brand)],
    );
  },
});

/** The resolver's construction inputs: the governing record's four seams. */
export type CredentialResolverOptions = {
  /** The environment record every environment-style declaration reads. */
  readonly environment: CredentialEnvironment;
  /** The branding seam feeding derived environment keys. */
  readonly brand: BrandIdentity;
  /** The active harness identity a declared harness field must match. */
  readonly harness: HarnessKind;
  /** The child runner seam every allowlisted execution goes through. */
  readonly runChild: ChildRunner;
  /** The store facts seam the harness export reads through. */
  readonly storeFacts: HarnessStoreFacts;
  /** The register-on-materialize hook: invoked before any parse or throw. */
  readonly registerSecret: (value: string) => void;
};

const memoKeyOf = (reference: CredentialReference): string =>
  JSON.stringify({ referenceName: reference.referenceName, sourceKey: reference.sourceKey });

/**
 * Build the strategy resolver: one operation over all four closed styles, one
 * success variant, one failure variant. Each reference resolves exactly once
 * per process — the second resolve is a memory read — and every obtained
 * material registers for redaction at the moment it is obtained.
 */
export const createCredentialResolver = (options: CredentialResolverOptions): CredentialPort => {
  const memo = new Map<string, CredentialResolution>();
  return {
    resolve: (reference: CredentialReference): CredentialResolution => {
      const memoKey = memoKeyOf(reference);
      const memoized = memo.get(memoKey);
      if (memoized !== undefined) return memoized;
      const key = reference.sourceKey;
      let resolution: CredentialResolution;
      if (key.style === "command") {
        resolution = resolveCommandSource(key, {
          runChild: options.runChild,
          parentEnvironment: options.environment,
          registerSecret: options.registerSecret,
        });
      } else if (key.style === "harness-store") {
        const classified = classifyHarnessStoreSource(key, {
          activeHarness: options.harness,
          storeFacts: options.storeFacts,
          registerSecret: options.registerSecret,
        });
        resolution =
          classified.status === "resolved"
            ? { ok: true, material: classified.material }
            : credentialMissing(key, classified.reason, classified.field);
      } else {
        resolution = materialFrom(
          key,
          options.environment[resolveCredentialSourceKey(reference, options.brand)],
        );
        if (resolution.ok) options.registerSecret(resolution.material.value);
      }
      memo.set(memoKey, resolution);
      return resolution;
    },
  };
};

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
