/** Shared golden harness for the provider CLI surfaces (TC-PROV-053). */
import type { CredentialPort, ProviderClock, QuotaTransport } from "@delivery-os/core/contracts";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

export const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

export const CONFIG = `provider:
  defaultChain: default
  credentials:
    zai:
      sourceKey:
        style: literal
        name: ZAI_API_KEY
  entries:
    p0:
      class: subscription
      quota:
        endpoint: https://p0.test/quota
        credentialRef: zai
  chains:
    default:
      entries:
        - p0
      allowPaidFallback: false
`;

export const clearTransport: QuotaTransport = {
  send: async () => ({
    status: 200,
    bodyText: JSON.stringify({ code: 200, success: true, data: { limits: [] } }),
  }),
};
export const exhaustedTransport: QuotaTransport = {
  send: async () => ({
    status: 200,
    bodyText: JSON.stringify({
      code: 200,
      success: true,
      data: { limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: NOW + 3600 * 1000 }] },
    }),
  }),
};
export const outageTransport: QuotaTransport = {
  send: async () => {
    throw new Error("network down");
  },
};

export type ProviderHarness = {
  readonly run: (args: readonly string[], transport?: QuotaTransport) => Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
    data: unknown;
    error: unknown;
  }>;
  readonly runSequence: (args: readonly string[][], transports: readonly QuotaTransport[]) => Promise<
    Array<{ exitCode: number; stdout: string; stderr: string; data: unknown; error: unknown }>
  >;
  readonly dispose: () => void;
};

export const createHarness = (): ProviderHarness => {
  const root = makeTempRoot("provider-golden");
  const { store } = openStore(makeIdentity(root));
  let counter = 0;
  let transport: QuotaTransport = clearTransport;
  const credential: CredentialPort = {
    resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }),
  };
  const clock: ProviderClock = { nowMs: () => NOW };
  const program = createConfigProgram({
    workingName: "synthetic",
    environment: {},
    cwd: "/repo",
    homeDirectory: "/home/synthetic",
    platform: "linux",
    fs: {
      exists: (path) => path === "/repo/.synthetic/config.yaml",
      readText: (path) => {
        if (path !== "/repo/.synthetic/config.yaml") throw new Error("missing file");
        return CONFIG;
      },
    },
    repositoryIo: { exists: (path) => path === "/repo/.git", isFile: () => false, readText: () => "" },
    provider: {
      clock,
      credentialPort: credential,
      transport: { send: (request) => transport.send(request) },
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => `fence-${counter++}`,
    },
  });
  if (!program.ok) throw new Error("provider golden program failed");
  const execute = async (args: readonly string[]) => {
    let stdout = "";
    let stderr = "";
    const deps: CliDependencies = {
      brand: program.brand,
      clock: { now: () => NOW },
      newRunId: () => "run-provider-golden",
      secrets: program.secrets,
      program: program.program,
    };
    const exitCode = await runCli(["provider", ...args], {
      stdout: { write: (chunk) => { stdout += chunk; } },
      stderr: { write: (chunk) => { stderr += chunk; } },
    }, deps);
    const envelope = stdout.startsWith("{") ? (JSON.parse(stdout) as { data?: unknown; error?: unknown }) : {};
    return { exitCode, stdout, stderr, data: envelope.data, error: envelope.error };
  };
  return {
    run: async (args, next = transport) => {
      transport = next;
      return execute(args);
    },
    runSequence: async (args, transports) => {
      const results = [];
      for (const [index, command] of args.entries()) {
        transport = transports[index] ?? clearTransport;
        results.push(await execute(command));
      }
      return results;
    },
    dispose: () => removeRoot(root),
  };
};
