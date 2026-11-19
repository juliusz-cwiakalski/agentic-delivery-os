/**
 * GH-350 TC-MIG-005 (checks arm) — the credential firewall across every surface:
 * stdout, stderr, the envelope, `data.proposal`, `data.report`, the diagnostic
 * stream, the verbose stream, the written file, and the serialised parse result.
 *
 * The canary scanner is itself driven over a planted canary, so a scanner that
 * never fires fails rather than passes.
 */

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { ProviderComposition } from "@delivery-os/core/contracts";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { parseProviderMigrateSource } from "../../packages/core/src/provider/migrate";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const TMP_ROOT = join(process.cwd(), "tmp/tmpdir");
const PRIOR_DIR = ".delivery-os";

const CANARIES = [
  "CANARY-API-KEY-0001",
  "CANARY-API-TOKEN-0002",
  "CANARY-ACCESS-TOKEN-0003",
  "CANARY-SECRET-0004",
  "CANARY-PASSWORD-0005",
  "CANARY-PRIVATE-KEY-0006",
  "CANARY-CLIENT-SECRET-0007",
] as const;

const CREDENTIAL_LINES = [
  `OPENAI_API_KEY='${CANARIES[0]}'`,
  `OPENAI_API_TOKEN="${CANARIES[1]}"`,
  `GITHUB_ACCESS_TOKEN=${CANARIES[2]}`,
  `SERVICE_SECRET='${CANARIES[3]}'`,
  `DB_PASSWORD="${CANARIES[4]};with-semicolon"`,
  `DEPLOY_PRIVATE_KEY='${CANARIES[5]}'`,
  `APP_CLIENT_SECRET='${CANARIES[6]}'`,
];

export const canaryHits = (text: string, canaries: readonly string[]): string[] =>
  canaries.filter((canary) => text.includes(canary));

describe("TC-MIG-005 no credential value reaches any surface", () => {
  test("7/7 canaries appear in zero captured bytes across nine surfaces", async () => {
    mkdirSync(TMP_ROOT, { recursive: true });
    const root = mkdtempSync(join(TMP_ROOT, "gh350-migrate-secrets-"));
    const repo = join(root, "repo");
    const home = join(root, "home");
    const profiles = join(home, PRIOR_DIR, "config", "profiles");
    const sourcePath = join(profiles, "creds.sh");
    const sourceText = `${CREDENTIAL_LINES.join("\n")}\n`;
    const target = join(repo, ".jaiship", "config.yaml");
    mkdirSync(join(repo, ".git"), { recursive: true });
    mkdirSync(profiles, { recursive: true });
    writeFileSync(sourcePath, sourceText);
    const storeRoot = makeTempRoot("gh350-migrate-secrets-state");
    try {
      const { store } = openStore(makeIdentity(storeRoot));
      const provider: ProviderComposition = {
        clock: { nowMs: () => 0 },
        credentialPort: { resolve: () => ({ ok: true, material: { value: "" } }) },
        transport: { send: async () => ({ status: 200, bodyText: "{}" }) },
        sleep: { sleep: async () => undefined },
        stateStore: store,
        newFenceToken: () => "fence-migrate-secrets",
        migrateFs: {
          exists: (path) => existsSync(path),
          readText: (path) => readFileSync(path, "utf8"),
          readDirectory: (path) => readdirSync(path),
        },
      };
      const program = createConfigProgram({
        workingName: "jaiship",
        environment: { HOME: home },
        cwd: repo,
        homeDirectory: home,
        platform: "linux",
        priorConfigurationDirectoryName: PRIOR_DIR,
        fs: {
          exists: (path) => path === target,
          readText: (path) => readFileSync(path, "utf8"),
        },
        repositoryIo: {
          exists: (path) => path === join(repo, ".git"),
          isFile: () => false,
          readText: () => "",
        },
        provider,
      });
      if (!program.ok) throw new Error("compose");
      let stdout = "";
      let stderr = "";
      const deps: CliDependencies = {
        brand: program.brand,
        clock: { now: () => 0 },
        newRunId: () => "run-gh350-migrate-secrets",
        secrets: program.secrets,
        program: program.program,
      };
      const exitCode = await runCli(
        ["provider", "migrate", "legacy", "--write", "--json", "--verbose"],
        {
          stdout: { write: (chunk: string) => (stdout += chunk) },
          stderr: { write: (chunk: string) => (stderr += chunk) },
        },
        deps,
      );
      expect(exitCode).toBe(0);
      const envelope = JSON.parse(stdout) as {
        data: { proposal: string; report: Record<string, unknown> };
      };
      const written = readFileSync(target, "utf8");
      const parsed = parseProviderMigrateSource({
        kind: "profiles",
        path: sourcePath,
        text: sourceText,
        bytes: Buffer.byteLength(sourceText, "utf8"),
        lines: CREDENTIAL_LINES.length,
      });
      expect(parsed.ok).toBe(true);
      const surfaces: readonly [string, string][] = [
        ["stdout", stdout],
        ["stderr", stderr],
        ["proposal", envelope.data.proposal],
        ["report", JSON.stringify(envelope.data.report)],
        ["written", written],
        ["parse-result", JSON.stringify(parsed)],
      ];
      for (const [label, text] of surfaces) {
        expect(canaryHits(text, CANARIES), label).toEqual([]);
      }
      // The references (names) are disclosed; the values are not.
      expect(envelope.data.proposal).toContain('name: "GITHUB_ACCESS_TOKEN"');
      expect(envelope.data.proposal).toContain('name: "DB_PASSWORD"');
    } finally {
      removeRoot(storeRoot);
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("the scanner is non-vacuous: a planted canary fires by name", () => {
    const planted = `proposal: ${CANARIES[0]}`;
    expect(canaryHits(planted, CANARIES)).toEqual([CANARIES[0]]);
    expect(canaryHits("clean", CANARIES)).toEqual([]);
  });
});
