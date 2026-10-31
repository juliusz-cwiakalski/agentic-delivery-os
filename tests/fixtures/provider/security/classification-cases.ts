/** TC-PROV-046 exact-code provider classification cases. */

export type ClassificationCase = {
  readonly id: string;
  readonly failure: unknown;
  readonly expect: "classified" | "contained";
  readonly code?: string;
};

export const CLASSIFICATION_CASES: readonly ClassificationCase[] = [
  {
    id: "quota-exceeded",
    failure: { kind: "provider", code: "provider.quota.exceeded" },
    expect: "classified",
    code: "provider.quota.exceeded",
  },
  {
    id: "outage",
    failure: { kind: "provider", code: "provider.outage" },
    expect: "classified",
    code: "provider.outage",
  },
  {
    id: "auth-rejected",
    failure: { kind: "provider", code: "provider.auth.rejected" },
    expect: "classified",
    code: "provider.auth.rejected",
  },
  {
    id: "chain-empty",
    failure: { kind: "provider", code: "provider.chain.empty" },
    expect: "classified",
    code: "provider.chain.empty",
  },
  {
    id: "chain-invalid",
    failure: { kind: "provider", code: "provider.chain.invalid" },
    expect: "classified",
    code: "provider.chain.invalid",
  },
  { id: "no-code", failure: { kind: "provider" }, expect: "contained" },
  {
    id: "undeclared-code",
    failure: { kind: "provider", code: "provider.other.unknown" },
    expect: "contained",
  },
  {
    id: "wrong-kind-code",
    failure: { kind: "provider", code: "config.value.invalid" },
    expect: "contained",
  },
];
