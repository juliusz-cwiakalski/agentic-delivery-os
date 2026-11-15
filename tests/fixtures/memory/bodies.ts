/** GH-301 derivable-content body fixtures (TC-MEMHEUR-001/002). */
export const fileListingBody = "```text\npackages/core/src/a.ts\npackages/core/src/b.ts\n```\n";

/** A fenced block restating a declared workspace command. */
export const commandEchoBody = "```bash\npnpm check\n```\n";

/** A fenced block that is neither a listing nor a declared command. */
export const cleanBody = "```ts\nconst answer = 1;\n```\n";
