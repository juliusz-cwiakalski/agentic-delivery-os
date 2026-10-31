/**
 * TC-SURFACE-001 — no provider-native type crosses a provider subpath surface.
 *
 * Each subpath's `index.ts` exports exactly the client factory, its core-built
 * input/return types, and the `AdapterContract`. Native payload shapes, `any`
 * escapes, and parallel view types are rejected by name.
 */
import { describe, expect, test } from "bun:test";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import ts from "typescript";
import {
  createGitHubClient,
  GITHUB_ADAPTER_CONTRACT,
} from "../../packages/adapters/src/github/index";
import { ADAPTER_OPERATIONS, type CredentialPort } from "../../packages/core/src/contracts/index";

const ROOT = process.cwd();
const PROVIDERS = ["jira", "gitlab", "github"] as const;
type Provider = (typeof PROVIDERS)[number];

const EXPECTED_SURFACE: Readonly<Record<Provider, readonly string[]>> = {
  jira: ["createJiraClient", "JIRA_ADAPTER_CONTRACT", "JiraClient", "JiraClientOptions"],
  gitlab: ["createGitLabClient", "GITLAB_ADAPTER_CONTRACT", "GitLabClient", "GitLabClientOptions"],
  github: [
    "createGitHubClient",
    "GITHUB_ADAPTER_CONTRACT",
    "GithubClient",
    "GithubClientOptions",
    "GithubRepositoryRef",
  ],
};

const NATIVE_SHAPE = /^(GitLabMR|JiraIssue|OctokitResponse|Octokit.*|.*Payload|.*Response|.*Raw)$/;
const PARALLEL_VIEW = /.*(View|Augmented)$/;

const exportedNames = (root: string, relative: string): string[] => {
  const source = ts.createSourceFile(
    relative,
    readFileSync(join(root, relative), "utf8"),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const names = new Set<string>();
  for (const statement of source.statements) {
    const exported = ((statement as { modifiers?: readonly ts.Modifier[] }).modifiers ?? []).some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    );
    if (ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)) {
      if (exported) names.add(statement.name.text);
    } else if (ts.isFunctionDeclaration(statement)) {
      if (exported && statement.name !== undefined) names.add(statement.name.text);
    } else if (ts.isVariableStatement(statement) && exported) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    } else if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined) {
      if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) names.add(element.name.text);
      }
    }
  }
  return [...names].sort();
};

const providerFiles = (root: string, provider: Provider): string[] => {
  const relative = `packages/adapters/src/${provider}`;
  const directory = join(root, relative);
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      for (const nested of readdirSync(join(root, path), { withFileTypes: true })) {
        if (nested.name.endsWith(".ts")) files.push(`${path}/${nested.name}`);
      }
    } else if (entry.name.endsWith(".ts")) {
      files.push(path);
    }
  }
  return files.sort();
};

const anyKeywordViolations = (root: string, provider: Provider): string[] => {
  const violations: string[] = [];
  for (const relative of providerFiles(root, provider)) {
    const source = ts.createSourceFile(
      relative,
      readFileSync(join(root, relative), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    const visit = (node: ts.Node): void => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) {
        violations.push(`${relative}: exported source contains an \`any\` escape`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return violations;
};

/** Validate one provider's public surface (also used against a temp mutation copy). */
export const surfaceFailures = (root: string, provider: Provider): string[] => {
  const failures: string[] = [];
  const index = `packages/adapters/src/${provider}/index.ts`;
  const actual = exportedNames(root, index);
  const expected = [...EXPECTED_SURFACE[provider]].sort();
  for (const name of expected.filter((entry) => !actual.includes(entry))) {
    failures.push(`${provider}: missing surface export ${name}`);
  }
  for (const name of actual.filter((entry) => !expected.includes(entry))) {
    failures.push(`${provider}: undeclared surface export ${name}`);
  }
  for (const relative of providerFiles(root, provider)) {
    for (const name of exportedNames(root, relative)) {
      if (NATIVE_SHAPE.test(name)) failures.push(`${relative}: provider-native export ${name}`);
      if (PARALLEL_VIEW.test(name)) failures.push(`${relative}: parallel view export ${name}`);
    }
  }
  failures.push(...anyKeywordViolations(root, provider));
  return failures;
};

const makeProviderCopy = (provider: Provider, extra: string): string => {
  const root = mkdtempSync(join(tmpdir(), "provider-surface-"));
  const target = join(root, "packages/adapters/src", provider);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(ROOT, "packages/adapters/src", provider), target, { recursive: true });
  writeFileSync(
    join(target, "index.ts"),
    `${readFileSync(join(target, "index.ts"), "utf8")}${extra}`,
  );
  return root;
};

describe("TC-STATUS-022 unchanged operation set and collection-read surface", () => {
  test("collection reads stay query-shaped under the unchanged operation set", () => {
    expect(GITHUB_ADAPTER_CONTRACT.capabilities.supportedOperations).toEqual([
      "read-work-item",
      "read-delivery-request",
      "read-pipeline-run",
    ]);
    expect(ADAPTER_OPERATIONS.filter((operation) => operation.startsWith("list-"))).toEqual([]);
    const credentials: CredentialPort = {
      resolve: () => ({
        ok: false,
        code: "config.credential.missing",
        domainKind: "config",
        category: "user",
        retryable: false,
        consequence: "not_landed",
        projectionClass: "user-validation",
      }),
    };
    const client = createGitHubClient({
      instance: {
        instanceName: "vcs-github",
        systemKind: "vcs",
        baseUrl: "https://api.github.example.com",
        authMethod: { mechanism: "anonymous" },
      },
      credentials,
      repository: { owner: "owner", name: "name" },
      transport: { send: async () => ({ status: 200, body: [] }) },
    });
    expect(Object.keys(client).sort()).toEqual([
      "listDeliveryRequests",
      "listWorkItems",
      "readDeliveryRequest",
      "readPipelineRun",
      "readWorkItem",
    ]);
  });
});

describe("TC-SURFACE-001 provider export surface", () => {
  test("each provider subpath exports only factory, contract, and input/view types", () => {
    for (const provider of PROVIDERS) {
      expect(surfaceFailures(ROOT, provider), provider).toEqual([]);
    }
  });

  test("a provider-native type added to a subpath fails by name", () => {
    const root = makeProviderCopy(
      "jira",
      "\nexport type JiraIssue = { readonly fields: unknown };\n",
    );
    try {
      const failures = surfaceFailures(root, "jira");
      expect(failures.some((message) => message.includes("JiraIssue"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("a parallel view type added to a subpath fails by name", () => {
    const root = makeProviderCopy(
      "gitlab",
      "\nexport type DeliveryRequestView = { readonly value: string };\n",
    );
    try {
      const failures = surfaceFailures(root, "gitlab");
      expect(failures.some((message) => message.includes("DeliveryRequestView"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
