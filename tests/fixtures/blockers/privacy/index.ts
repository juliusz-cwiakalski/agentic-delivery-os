/**
 * Privacy fixtures: a synthetic registered secret, an unrelated ambient value,
 * and a legitimate content canary. None is a real credential.
 */
export const PRIVACY_SECRET = "blocker-test-secret-0001";
export const UNRELATED_AMBIENT = "planted-ambient-value-0001";
export const CONTENT_CANARY = "planted-blocker-canary-0001";

export const privacySecrets = (): readonly string[] => [PRIVACY_SECRET];

export const cleanQuestion = (): string => `legitimate question ${CONTENT_CANARY}`;
export const secretQuestion = (): string => `the token is ${PRIVACY_SECRET} for this lane`;
