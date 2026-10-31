/**
 * The single fabricated canary and the forbidden field names (test-plan §6.2).
 * The canary is a marker, not a credential; it exists only to prove that no
 * content field escapes the metadata whitelist.
 */
export const CANARY = "CANARY-SESSION-ADMIN-7f3a";
export const ENV_CANARY = "ENV-SESSION-ADMIN-7f3a";

export const FORBIDDEN_FIELDS = [
  "title",
  "prompt",
  "messageBody",
  "partData",
  "credential",
  "envValue",
  "commandArgument",
  "parent_title",
] as const;

export const forbiddenRow = (id: string): Record<string, unknown> => ({
  id,
  title: CANARY,
  prompt: CANARY,
  message_body: CANARY,
  part_data: CANARY,
  credential: CANARY,
  env_value: ENV_CANARY,
  command_argument: CANARY,
  parent_title: CANARY,
});
