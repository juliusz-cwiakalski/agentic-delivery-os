/**
 * TC-CLOSE-067 credential identity — a pre-request credential resolution
 * failure keeps its config identity at exit 1 instead of becoming a payload
 * failure at exit 2.
 */
import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { createEnvironmentCredentialPort } from "../../packages/adapters/src/credentials/index";
import { createJiraClient } from "../../packages/adapters/src/jira/client";
import { createCloseoutComposition, createConfigProgram } from "../../packages/cli/src/edge";
import { runCli } from "../../packages/cli/src/index";
import { errorOf } from "../fixtures/closeout/cli";
import { CLOSEOUT_TIMESTAMP } from "../fixtures/closeout/harness";
import { jiraInstance } from "../fixtures/closeout/jira-client";
import { fixtureBrand } from "../fixtures/credentials/cases";
import { makeIdentity, openStore, removeRoot } from "../fixtures/state/harness";
import { bufferSink } from "../golden/helpers";

describe("TC-CLOSE-067 credential failure keeps its config identity", () => {
  test("a missing Jira credential exits 1 as config.credential.missing", async () => {
    const stateRoot = (() => {
      const base = join(process.cwd(), "tmp", "tmpdir");
      mkdirSync(base, { recursive: true });
      return mkdtempSync(join(base, "gh183-credential-"));
    })();
    try {
      const { store } = openStore(makeIdentity(stateRoot));
      const missingCredentials = createEnvironmentCredentialPort({
        environment: {},
        brand: fixtureBrand,
      });
      const client = createJiraClient({
        instance: jiraInstance,
        credentials: missingCredentials,
        transport: {
          send: async () => {
            throw new Error("a credential failure must not reach the transport");
          },
        },
      });
      const composition = createCloseoutComposition({
        workspaceId: "workspace-a",
        provider: { kind: "jira", client },
        git: {
          readCheckout: async () => ({ state: "base" }),
          listBranches: async () => [],
          readBranch: async () => undefined,
          isCheckedOutElsewhere: async () => false,
          isClean: async () => true,
          resolveRef: async () => true,
          restoreCheckout: async () => ({ ok: true }),
          deleteBranch: async () => ({ ok: true }),
        },
        store,
        nowIso: () => CLOSEOUT_TIMESTAMP,
        newFenceToken: () => "fence-credential",
      });
      const built = createConfigProgram({
        workingName: "synthetic",
        environment: {},
        cwd: process.cwd(),
        homeDirectory: process.cwd(),
        platform: "linux",
        fs: { exists: () => false, readText: () => "" },
        repositoryIo: { exists: () => false, isFile: () => false, readText: () => "" },
        closeout: composition,
      });
      expect(built.ok).toBe(true);
      if (!built.ok) return;
      const out = bufferSink();
      const err = bufferSink();
      const exit = await runCli(
        ["closeout", "TRACK-101", "--json"],
        { stdout: out, stderr: err },
        {
          brand: built.brand,
          clock: { now: () => 1 },
          newRunId: () => "run-credential-closeout",
          secrets: [],
          program: built.program,
        },
      );
      expect(exit).toBe(1);
      const envelope = JSON.parse(out.value) as Record<string, unknown>;
      expect(errorOf(envelope).code).toBe("config.credential.missing");
    } finally {
      removeRoot(stateRoot);
    }
  });
});
