/**
 * Canary cases for the fixture sanitization audit (TC-FIXTURE-002).
 *
 * Each case plants one secret/PII shape the scanner claims to detect. Nothing is
 * written here at rest: the test materialises every case in a `mkdtemp` tree.
 */

export type SanitizationCanary = {
  readonly id: string;
  readonly file: string;
  readonly content: string;
  readonly detail: string;
};

export const SANITIZATION_CANARIES: readonly SanitizationCanary[] = [
  {
    id: "authorization-bearer",
    file: "tests/fixtures/providers/jira/canary-bearer.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "headers": { "Authorization": "Bearer abcdefghijklmnop" }\n}\n',
    detail: "authorization bearer header",
  },
  {
    id: "github-token",
    file: "tests/fixtures/providers/jira/canary-github-token.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "token": "ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"\n}\n',
    detail: "github token",
  },
  {
    id: "gitlab-token",
    file: "tests/fixtures/providers/gitlab/canary-gitlab-token.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "token": "glpat-ABCDEFGHIJKLMNOPQRST"\n}\n',
    detail: "gitlab token",
  },
  {
    id: "atlassian-token",
    file: "tests/fixtures/providers/jira/canary-atlassian-token.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "token": "ATATT3xFfGF0ABCDEFGHIJKLMNOPQRSTUVWXYZ"\n}\n',
    detail: "atlassian token",
  },
  {
    id: "pem-private-key",
    file: "tests/fixtures/providers/github/canary-pem.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "key": "-----BEGIN RSA PRIVATE KEY-----"\n}\n',
    detail: "PEM private key",
  },
  {
    id: "email",
    file: "tests/fixtures/providers/github/canary-email.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "owner": "jane.doe@real-domain.com"\n}\n',
    detail: "email address",
  },
  {
    id: "avatar-url",
    file: "tests/fixtures/providers/github/canary-avatar.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "avatar_url": "https://avatars.githubusercontent.com/u/12345"\n}\n',
    detail: "avatar URL",
  },
  {
    id: "private-repository",
    file: "tests/fixtures/providers/github/canary-private-repo.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "repository": "https://github.com/private-org/private-repo"\n}\n',
    detail: "private repository reference",
  },
  {
    id: "live-provider-host",
    file: "tests/fixtures/providers/jira/canary-live-host.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "host": "https://jira.real-company.com"\n}\n',
    detail: "non-example provider host",
  },
  {
    id: "undeclared-placeholder",
    file: "tests/fixtures/providers/jira/canary-placeholder.json",
    content:
      '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "owner": "someone-placeholder"\n}\n',
    detail: "undeclared placeholder",
  },
];

/** A clean control: only declared placeholders, example hosts, provenance. */
export const CLEAN_CANARY = {
  file: "tests/fixtures/providers/jira/clean-control.json",
  content:
    '{\n  "provenance": "hand-authored-synthetic 2026-10-31",\n  "owner": "owner-placeholder",\n  "accountId": "acct-0001",\n  "projectPath": "group-placeholder/project-placeholder",\n  "self": "https://jira.example.com/rest/api/2/issue/1"\n}\n',
  placeholders: ["owner-placeholder", "acct-0001", "group-placeholder", "project-placeholder"],
} as const;
