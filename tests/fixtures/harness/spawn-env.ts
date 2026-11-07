/**
 * The synthetic spawn-environment fixture (test-plan §4.3).
 *
 * Every value is fabricated. The parent environment holds declared and
 * undeclared variables; the undeclared ones carry unique canaries that must
 * never appear in a constructed child environment or serialized evidence.
 */
import type {
  CredentialPort,
  CredentialReference,
  CredentialResolution,
  HarnessExecutionEnvironmentDescriptor,
} from "../../../packages/core/src/contracts/index";

export const DECLARED_MODEL_VARIABLE = "HARNESS_MODEL";
export const DECLARED_SMALL_MODEL_VARIABLE = "HARNESS_SMALL_MODEL";
export const DECLARED_WORK_PATH_VARIABLE = "DELIVERY_WORK_PATH";
export const DECLARED_PATH_VARIABLE = "PATH";
export const DECLARED_CREDENTIAL_VARIABLE = "HARNESS_AUTH";
export const DECLARED_CREDENTIAL_SOURCE_KEY = "HARNESS_CREDENTIAL_KEY";

export const UNDECLARED_TOKEN_VARIABLE = "SYNTHETIC_UNDECLARED_TOKEN";
export const UNDECLARED_HOME_VARIABLE = "HOME";
export const UNDECLARED_PATH_VARIABLE = "PATH_ALT";

export const CANARY_UNDECLARED_TOKEN = "canary-undeclared-token-9f1";
export const CANARY_HOME = "canary-home-2b7";
export const CANARY_PATH_ALT = "canary-path-alt-4c3";
export const CANARY_CREDENTIAL_SOURCE = "canary-credential-source-6d5";
export const CANARY_DECOY_CREDENTIAL = "canary-decoy-credential-8e2";

export const WORK_DIRECTORY = "/synthetic/work/GH-233";

export const CREDENTIAL_REFERENCE: CredentialReference = {
  referenceName: "harness-auth",
  sourceKey: { style: "literal", name: DECLARED_CREDENTIAL_SOURCE_KEY },
};

export const PARENT_ENVIRONMENT: Readonly<Record<string, string>> = {
  [DECLARED_MODEL_VARIABLE]: "synthetic/model-large",
  [DECLARED_SMALL_MODEL_VARIABLE]: "synthetic/model-small",
  [DECLARED_WORK_PATH_VARIABLE]: WORK_DIRECTORY,
  [DECLARED_PATH_VARIABLE]: "/synthetic/bin:/synthetic/usr/bin",
  [DECLARED_CREDENTIAL_SOURCE_KEY]: CANARY_CREDENTIAL_SOURCE,
  [DECLARED_CREDENTIAL_VARIABLE]: CANARY_DECOY_CREDENTIAL,
  [UNDECLARED_TOKEN_VARIABLE]: CANARY_UNDECLARED_TOKEN,
  [UNDECLARED_HOME_VARIABLE]: CANARY_HOME,
  [UNDECLARED_PATH_VARIABLE]: CANARY_PATH_ALT,
};

export const UNDECLARED_VARIABLES = [
  UNDECLARED_TOKEN_VARIABLE,
  UNDECLARED_HOME_VARIABLE,
  UNDECLARED_PATH_VARIABLE,
] as const;

export const DECLARED_VARIABLES = [
  DECLARED_MODEL_VARIABLE,
  DECLARED_SMALL_MODEL_VARIABLE,
  DECLARED_WORK_PATH_VARIABLE,
  DECLARED_PATH_VARIABLE,
  DECLARED_CREDENTIAL_VARIABLE,
] as const;

export const SPAWN_ENV_DESCRIPTOR: HarnessExecutionEnvironmentDescriptor = {
  kind: "host",
  workDirectory: WORK_DIRECTORY,
  environment: [
    { kind: "variable", name: DECLARED_MODEL_VARIABLE },
    { kind: "variable", name: DECLARED_SMALL_MODEL_VARIABLE },
    { kind: "variable", name: DECLARED_WORK_PATH_VARIABLE },
    { kind: "variable", name: DECLARED_PATH_VARIABLE },
    {
      kind: "credential",
      name: DECLARED_CREDENTIAL_VARIABLE,
      reference: CREDENTIAL_REFERENCE,
    },
  ],
};

export type CredentialCall = { readonly referenceName: string };

export type FakeCredentialPort = {
  readonly port: CredentialPort;
  readonly calls: CredentialCall[];
  setMaterial(material: string): void;
  setFailure(): void;
};

export const createFakeCredentialPort = (
  material = "synthetic-credential-material-1",
): FakeCredentialPort => {
  let current = material;
  let failing = false;
  const calls: CredentialCall[] = [];
  const port: CredentialPort = {
    resolve: (reference: CredentialReference): CredentialResolution => {
      calls.push({ referenceName: reference.referenceName });
      if (failing) {
        return {
          ok: false,
          code: "config.credential.missing",
          domainKind: "config",
          category: "user",
          retryable: false,
          consequence: "not_landed",
          projectionClass: "user-validation",
        };
      }
      return { ok: true, material: { value: current } };
    },
  };
  return {
    port,
    calls,
    setMaterial: (next) => {
      current = next;
    },
    setFailure: () => {
      failing = true;
    },
  };
};
