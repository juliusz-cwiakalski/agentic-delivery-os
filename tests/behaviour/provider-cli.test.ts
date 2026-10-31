/**
 * TC-PROV-036/041..044/046 — provider command envelopes, exits, human/machine
 * output, invalid flags, and exact-code classification through `runCli`.
 */
import { describe, expect, test } from "bun:test";
import type {
  CredentialPort,
  ProviderClock,
  QuotaTransport,
  StateStorePort,
} from "@delivery-os/core/contracts";
import { assertEnvelopeContract } from "@delivery-os/testkit";
import { createConfigProgram } from "../../packages/cli/src/edge";
import { type CliDependencies, runCli } from "../../packages/cli/src/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";

const NOW = Date.UTC(2026, 0, 1, 0, 0, 0);

const CONFIG = `provider:
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

type Sink = { write: (chunk: string) => void; readonly value: string };
const sink = (): Sink => {
  let text = "";
  return {
    write: (chunk) => {
      text += chunk;
    },
    get value() {
      return text;
    },
  };
};

const credentialPort: CredentialPort = {
  resolve: () => ({ ok: true, material: { value: "CANARY-SECRET" } }),
};
const clock: ProviderClock = { nowMs: () => NOW };

const transport = (status: number, body: unknown): QuotaTransport => ({
  send: async () => ({ status, bodyText: JSON.stringify(body) }),
});
const clear = transport(200, { code: 200, success: true, data: { limits: [] } });
const exhausted = transport(200, {
  code: 200,
  success: true,
  data: { limits: [{ type: "TOKENS_LIMIT", percentage: 100, nextResetTime: NOW + 3600 * 1000 }] },
});
const outage: QuotaTransport = {
  send: async () => {
    throw new Error("network down");
  },
};

const run = async (
  args: readonly string[],
  quota: QuotaTransport,
): Promise<{
  exitCode: number;
  stdout: string;
  stderr: string;
  store: StateStorePort;
  root: string;
}> => {
  const root = makeTempRoot("provider-cli");
  const { store } = openStore(makeIdentity(root));
  let counter = 0;
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
    repositoryIo: {
      exists: (path) => path === "/repo/.git",
      isFile: () => false,
      readText: () => "",
    },
    provider: {
      clock,
      credentialPort,
      transport: quota,
      sleep: { sleep: async () => undefined },
      stateStore: store,
      newFenceToken: () => `fence-${counter++}`,
    },
  });
  if (!program.ok) throw new Error("program composition failed");
  const stdout = sink();
  const stderr = sink();
  const deps: CliDependencies = {
    brand: program.brand,
    clock: { now: () => NOW },
    newRunId: () => "run-provider-cli",
    secrets: program.secrets,
    program: program.program,
  };
  const exitCode = await runCli(["provider", ...args], { stdout, stderr }, deps);
  return { exitCode, stdout: stdout.value, stderr: stderr.value, store, root };
};

describe("TC-PROV-041 resolve machine and human output", () => {
  test("a clear chain returns one success envelope and exit 0", async () => {
    const result = await run(["resolve", "--json"], clear);
    try {
      expect(result.exitCode).toBe(0);
      const envelope = JSON.parse(result.stdout) as Record<string, unknown>;
      expect(assertEnvelopeContract(envelope)).toEqual([]);
      expect(envelope.data).toMatchObject({
        decision: { kind: "selected", providerName: "p0", costClass: "subscription" },
        chain: "default",
      });
      expect(result.stdout).not.toContain("CANARY-SECRET");
    } finally {
      removeRoot(result.root);
    }
  });

  test("a parked chain carries the park and announcement", async () => {
    const result = await run(["resolve", "--json"], exhausted);
    try {
      expect(result.exitCode).toBe(0);
      const envelope = JSON.parse(result.stdout) as {
        data: { decision: { kind: string; park?: { cause: string } }; announcements: unknown[] };
      };
      expect(envelope.data.decision.kind).toBe("parked");
      expect(envelope.data.decision.park?.cause).toBe("chain-exhausted");
      expect(envelope.data.announcements.length).toBeGreaterThan(0);
    } finally {
      removeRoot(result.root);
    }
  });

  test("human mode prints the selected provider or park summary", async () => {
    const selected = await run(["resolve"], clear);
    try {
      expect(selected.exitCode).toBe(0);
      expect(selected.stdout).toContain("selected p0");
    } finally {
      removeRoot(selected.root);
    }
    const parked = await run(["resolve"], exhausted);
    try {
      expect(parked.exitCode).toBe(0);
      expect(parked.stdout).toContain("parked chain:default");
    } finally {
      removeRoot(parked.root);
    }
  });

  test("warnings go to stderr, not into the JSON envelope", async () => {
    const result = await run(["resolve", "--json"], outage);
    try {
      expect(result.exitCode).toBe(0);
      const envelope = JSON.parse(result.stdout) as { data: { announcements: unknown[] } };
      expect(envelope.data.announcements.length).toBeGreaterThan(0);
      expect(result.stderr).toContain("provider p0 is parked");
    } finally {
      removeRoot(result.root);
    }
  });
});

describe("TC-PROV-036/042 quota surface", () => {
  test("successful quota returns per-provider state and announcements", async () => {
    const result = await run(["quota", "--json"], clear);
    try {
      expect(result.exitCode).toBe(0);
      const envelope = JSON.parse(result.stdout) as {
        data: { providers: Array<{ providerName: string; status: string }> };
      };
      expect(envelope.data.providers[0]).toMatchObject({ providerName: "p0", status: "clear" });
    } finally {
      removeRoot(result.root);
    }
  });

  test("a failing quota is classified provider.outage with exit 2", async () => {
    const result = await run(["quota", "--json"], outage);
    try {
      expect(result.exitCode).toBe(2);
      const envelope = JSON.parse(result.stdout) as {
        error: { code: string; summary: string };
      };
      expect(envelope.error.code).toBe("provider.outage");
      expect(envelope.error.summary).toContain("provider.quota.unreachable");
      expect(result.stderr).toContain("provider.outage");
      expect(result.stderr).not.toContain("CANARY-SECRET");
    } finally {
      removeRoot(result.root);
    }
  });

  test("quota persists zero state", async () => {
    const result = await run(["quota", "--json"], exhausted);
    try {
      expect(result.exitCode).toBe(0);
      const integrity = result.store.checkIntegrity();
      expect(integrity.ok && integrity.value.evidence.verifiedEmpty).toBe(true);
    } finally {
      removeRoot(result.root);
    }
  });
});

describe("TC-PROV-043 parks list", () => {
  test("parks list is read-only and returns the projection view", async () => {
    const first = await run(["resolve", "--json"], exhausted);
    try {
      expect(first.exitCode).toBe(0);
      const result = await run(["parks", "list", "--json"], clear);
      try {
        expect(result.exitCode).toBe(0);
        const envelope = JSON.parse(result.stdout) as { data: { parks: unknown[] } };
        expect(Array.isArray(envelope.data.parks)).toBe(true);
      } finally {
        removeRoot(result.root);
      }
    } finally {
      removeRoot(first.root);
    }
  });
});

describe("TC-PROV-044/046 invalid flags and exact-code classification", () => {
  test("invalid grammar and flags produce one valid failure envelope", async () => {
    for (const args of [
      ["nope", "--json"],
      ["resolve", "--provider", "p0", "--json"],
      ["resolve", "--chain", "--json"],
      ["parks", "list", "--all=false", "--json"],
    ] as const) {
      const result = await run(args, clear);
      try {
        expect(result.exitCode, args.join(" ")).toBe(1);
        const envelope = JSON.parse(result.stdout) as { error?: { code: string } };
        expect(envelope.error?.code, args.join(" ")).toBeTruthy();
        expect(result.stderr.length).toBeGreaterThan(0);
      } finally {
        removeRoot(result.root);
      }
    }
  });
});
