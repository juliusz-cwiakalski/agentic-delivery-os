/**
 * Credential fixtures. Every secret is clearly synthetic and never a real
 * credential. The registered set mirrors what `deps.secrets` injects.
 */
export const REGISTERED_SECRET = "blocker-test-secret-0001";
export const REGISTERED_SECRET_B = "blocker-test-secret-0002";
export const UNREGISTERED_TOKEN_LIKE = "ghp_exampleNotARegisteredSecret0000";

export const secrets = (): readonly string[] => [REGISTERED_SECRET];
export const secretsB = (): readonly string[] => [REGISTERED_SECRET_B];
export const bothSecrets = (): readonly string[] => [REGISTERED_SECRET, REGISTERED_SECRET_B];
export const noSecrets = (): readonly string[] => [];

export const VALID_NAMES = ["EXAMPLE_PRODUCT_GITHUB_TOKEN", "GITHUB_TOKEN"] as const;

export const INVALID_CREDENTIAL_TEXTS = [
  "Set EXAMPLE_PRODUCT_GITHUB_TOKEN=abc123 in the environment",
  "GITHUB_TOKEN=abc123",
  "token: abc123",
  "the value is hunter2",
  "abc123",
  "GITHUB_TOKEN=abc123.",
] as const;

export const PROSE_WITH_SECRET = `the token is ${REGISTERED_SECRET} for this lane`;
export const OPTION_WITH_SECRET = `option-${REGISTERED_SECRET}`;
export const LANE_WITH_SECRET = `L2-${REGISTERED_SECRET}`;
export const REF_WITH_SECRET = `GH-${REGISTERED_SECRET}`;

export const LEGITIMATE_IDENTIFIERS = {
  lane: "L2",
  refs: ["GH-230", "PDEV-123"],
} as const;

export const legacySecretLane = "L9-blocker-test-secret-0001";
export const plantedCanary = "planted-blocker-canary-0001";
export const ambientUnrelated = "planted-ambient-value-0001";
