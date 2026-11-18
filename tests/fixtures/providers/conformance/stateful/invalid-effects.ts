/**
 * The four malformed stateful declarations of AC-F3-7 / TC-DMUT-001..004 as
 * TYPED case literals (never committed invalid JSON), so a mutation cannot
 * silently stop being one when a production type changes.
 */
const provenance = "hand-authored-synthetic 2026-11-18";

const baseTenant = {
  provenance,
  provider: "github",
  adapterName: "github",
  instance: {
    instanceName: "vcs-github",
    systemKind: "vcs",
    baseUrl: "https://api.github.example.com",
    authMethod: { mechanism: "anonymous" },
  },
  credentialReferenceName: "github-read",
  addressing: {
    provider: "github",
    owner: "owner-placeholder",
    repo: "project-placeholder",
    issueNumber: 601,
    pullNumber: 504,
    commitSha: "1111111111111111111111111111111111111111",
    threadId: "PRRT_2",
  },
  initialState: {
    issue: {
      fields: { number: 601, title: "Stateful mutation issue", state: "open" },
      collections: { labels: [{ name: "planning" }], comments: [] },
      subResources: { thread: { resolved: false } },
    },
  },
  routes: [
    {
      method: "POST",
      url: "https://api.github.example.com/stateful/mutation",
      status: 200,
      body: {},
    },
  ],
  expected: { "change-lifecycle.read-work-item": {} },
} satisfies Record<string, unknown>;

export type InvalidEffectCase = {
  readonly id: string;
  readonly expected: string;
  readonly tenant: Record<string, unknown>;
};

/** The paired valid baseline: the same tenant with no effect declared. */
export const VALID_STATEFUL_BASELINE: Record<string, unknown> = baseTenant;

const withEffect = (effect: unknown): Record<string, unknown> => ({
  ...baseTenant,
  routes: [
    {
      method: "POST",
      url: "https://api.github.example.com/stateful/mutation",
      status: 200,
      body: {},
      effect,
    },
  ],
});

export const INVALID_EFFECT_CASES: readonly InvalidEffectCase[] = [
  {
    id: "out-of-vocabulary",
    expected: "unknown effect append-item",
    tenant: withEffect({ kind: "append-item", resource: "issue" }),
  },
  {
    id: "two-effects",
    expected: "one effect per route",
    tenant: withEffect([
      { kind: "mark-resolved", resource: "issue", subResource: "thread" },
      { kind: "reset-field", resource: "issue", field: "title" },
    ]),
  },
  {
    id: "unresolvable-operands",
    expected: "missing collection",
    tenant: withEffect({
      kind: "replace-collection",
      resource: "issue",
      collection: "attachments",
      entries: [],
    }),
  },
  {
    id: "missing-sequence",
    expected: "requires a declared identity sequence",
    tenant: withEffect({
      kind: "append-entry",
      resource: "issue",
      collection: "comments",
      entry: { body: "sequence-free" },
      identityField: "id",
    }),
  },
];
