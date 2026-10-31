/**
 * Synthetic privacy-literal fixtures. Every value is fabricated and stays
 * inside the allowlisted fixture root; none is a real credential, path, or
 * product term. Values deliberately avoid the suppression-marker vocabulary so
 * they exercise the rules rather than the placeholder classes.
 */

export type RulePositive = { readonly id: string; readonly value: string };

/** One fabricated positive per committed rule; each matches exactly one rule. */
export const RULE_POSITIVES: readonly RulePositive[] = [
  {
    id: "secret.provider-token-prefix",
    value: "ghp_ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6",
  },
  {
    id: "secret.private-key-block",
    value: "-----BEGIN OPENSSH PRIVATE KEY-----",
  },
  {
    id: "secret.web-token",
    value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ6cTd4azltMiJ9.ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6",
  },
  {
    id: "secret.bearer-credential",
    value: "Bearer ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6",
  },
  {
    id: "secret.credential-assignment",
    value: 'api_key = "ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6"',
  },
  {
    id: "secret.connection-string-credential",
    value: "postgres://zq7x:ZQ7XK9M2P4R6T8V0@db.invalid/app",
  },
  {
    id: "private.absolute-user-path",
    value: "/home/zq7xk9m2p4r6t8v0/projects/app/file.ts",
  },
];

/**
 * F-1 platform-form breadth matrix: the three platform home forms and the
 * credential/authorization-shaped forms named in review iteration 1. Each
 * value is markerless in its protected segment, so it must fire after marker
 * anchoring; the bare `user`/`apikey` tokens in separators/keys must not
 * suppress it.
 */
export const PLATFORM_FORM_POSITIVES: readonly RulePositive[] = [
  {
    id: "private.absolute-user-path",
    value: "/home/q7x9m2p4r6t8v0/secret-notes.txt",
  },
  {
    id: "private.absolute-user-path",
    value: "/Users/q7x9m2p4r6t8v0/secret-notes.txt",
  },
  {
    id: "private.absolute-user-path",
    value: "C:\\Users\\q7x9m2p4r6t8v0\\Documents\\keys",
  },
  {
    id: "secret.connection-string-credential",
    value: "postgres://user:ZQ7XK9M2P4R6T8V0@db.invalid/app",
  },
  {
    id: "secret.credential-assignment",
    value: 'apikey = "ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6"',
  },
  {
    id: "secret.credential-assignment",
    value: '"apikey": "ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6"',
  },
];

export type RuleNearMiss = {
  readonly id: string;
  /** A substring the near-miss shares with its positive. */
  readonly shares: string;
  readonly value: string;
};

/** One near-miss per rule: shares the discriminating shape but fails a threshold. */
export const RULE_NEAR_MISSES: readonly RuleNearMiss[] = [
  { id: "secret.provider-token-prefix", shares: "ghp_", value: "ghp_ZQ7X" },
  { id: "secret.private-key-block", shares: "BEGIN", value: "-----BEGIN PUBLIC KEY-----" },
  {
    id: "secret.web-token",
    shares: "eyJ",
    value: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ6cTd4azltMiJ9",
  },
  { id: "secret.bearer-credential", shares: "Bearer", value: "Bearer ZQ7X" },
  { id: "secret.credential-assignment", shares: "api_key", value: 'api_key = "ZQ7XK9M2"' },
  {
    id: "secret.connection-string-credential",
    shares: "postgres://",
    value: "postgres://db.invalid/app",
  },
  {
    id: "private.absolute-user-path",
    shares: "home/",
    value: "home/zq7xk9m2p4r6t8v0/projects/app/file.ts",
  },
];

/** Suppression-class fixtures: each is fabricated and carries a marker. */
export const SUPPRESSION_FIXTURES = {
  placeholder: 'api_key = "your-ZQ7XK9M2P4R6T8V0W1Y3"',
  redaction: 'api_key = "REDACTED-ZQ7XK9M2P4R6T8V0"',
  fabricated: 'api_key = "fake-ZQ7XK9M2P4R6T8V0W1Y3"',
  syntheticUserHome: "/home/synthetic/secret-notes.txt",
  syntheticUserWindows: "C:/Users/synthetic/Documents/keys",
  markerBearer: "Bearer test-ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6",
} as const;

/** A suppressed placeholder and a markerless positive on the same line. */
export const MIXED_SUPPRESSION_LINE =
  'api_key = "your-placeholder-value" secret = "ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6"';

/** The markerless positive inside MIXED_SUPPRESSION_LINE. */
export const MIXED_SUPPRESSION_POSITIVE = "ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6";

/** The false-positive corpus: prose, docs, code samples, change artifacts. */
export const FALSE_POSITIVE_CORPUS: readonly { readonly path: string; readonly content: string }[] =
  [
    {
      path: "prose.md",
      content:
        "# Credential handling\n\nThe token rotates hourly. A password policy is documented. " +
        "The secret store is external and the connection string section describes user-information segments.\n",
    },
    {
      path: "documentation.md",
      content:
        '# Environment\n\n```bash\nexport OPENAI_API_KEY="your-openai-key"\n' +
        'export SERVICE_TOKEN="<redacted>"\n```\n\nBearer authentication is documented.\n',
    },
    {
      path: "code-sample.ts",
      content:
        "export const token = process.env.TOKEN;\n" +
        "export const secret = resolveSecret();\n" +
        "const password = await readPassword();\n",
    },
    {
      path: "change-artifact.md",
      content:
        "## Notes\n\n- The plan cites `chg-GH-26-plan.md`.\n" +
        "- A relative path `home/zq7xk9m2p4r6t8v0/projects` is not an absolute user path.\n" +
        "- Documentation placeholders use `your-` markers and redaction markers.\n",
    },
    {
      path: "notes.txt",
      content:
        "Bearer authentication is documented here. Connection strings use user-information segments.\n" +
        'A short `api_key = "placeholder"` value is not opaque enough.\n',
    },
  ];
