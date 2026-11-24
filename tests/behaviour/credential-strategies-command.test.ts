/**
 * TC-ALLOW-001..006, TC-MEMO-001, TC-EXEC-001/002 — the command credential
 * strategy over the shipped closed allowlist, exercised through injected
 * seams only. No real owner CLI, store, or keyring is ever touched.
 */
import { describe, expect, test } from "bun:test";
import {
  COMMAND_ALLOWLIST,
  COMMAND_STDOUT_MAX_BYTES,
  COMMAND_TIMEOUT_DEFAULT_MS,
  COMMAND_TIMEOUT_MAX_MS,
  constructArgv,
  HOST_SLOT_MAX_LENGTH,
  INTEGRATION_ID_MAX_LENGTH,
  matchCommandDeclaration,
  validateHostSlot,
  validateIntegrationIdSlot,
} from "../../packages/adapters/src/credentials/allowlist";
import {
  type ChildRunRequest,
  createSpawnChildRunner,
  reducedChildEnvironment,
  resolveCommandSource,
} from "../../packages/adapters/src/credentials/command-strategy";
import { createCredentialResolver } from "../../packages/adapters/src/credentials/index";
import {
  CREDENTIAL_COMMAND_TIMEOUT_MAX_MS,
  CREDENTIAL_HOST_SLOT_MAX_LENGTH,
  CREDENTIAL_INTEGRATION_ID_MAX_LENGTH,
  parseCredentialSourceKey,
} from "../../packages/core/src/provider/validate";
import { CANARY, fixtureBrand } from "../fixtures/credentials/cases";

const GH_TOKEN_READ = {
  style: "command" as const,
  program: "/usr/bin/gh",
  args: ["auth", "token", "--hostname", "example.com"],
};

const GH_TOKEN_READ_NO_HOST = {
  style: "command" as const,
  program: "/usr/bin/gh",
  args: ["auth", "token"],
};

const OPENCODE_EXPORT = {
  style: "command" as const,
  program: "/usr/local/bin/opencode",
  args: ["auth", "export", "deepseek"],
};

/**
 * Resolver-level tests need the strategy's pre-spawn path check to succeed,
 * so the declared program paths point at real regular executables carrying
 * the allowlisted canonical names. The files are copies of `/bin/true` in a
 * temp workspace: the injected child runner answers every execution, so no
 * real owner CLI semantics are ever reached.
 */
import { chmodSync, copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureBinDirectory = mkdtempSync(join(tmpdir(), "cred-command-"));
const fixtureBin = (name: string): string => {
  const path = join(fixtureBinDirectory, name);
  copyFileSync("/bin/true", path);
  chmodSync(path, 0o755);
  return path;
};
const EXECUTABLE_GH = fixtureBin("gh");
const EXECUTABLE_OPENCODE = fixtureBin("opencode");

/** A recording child runner: captures every request and returns canned outcomes. */
const recordingRunner = (
  outcome: (request: ChildRunRequest) =>
    | {
        ok: true;
        exitCode: number;
        stdout: string;
        stdoutTruncated?: boolean;
        stderrBytes?: number;
      }
    | { ok: false; reason: "timeout" | "program-unavailable" },
) => {
  const requests: ChildRunRequest[] = [];
  return {
    requests,
    runChild: (request: ChildRunRequest) => {
      requests.push(request);
      return outcome(request);
    },
  };
};

const commandResolver = (runChild: ReturnType<typeof recordingRunner>["runChild"]) =>
  createCredentialResolver({
    environment: {},
    brand: fixtureBrand,
    harness: "opencode",
    runChild,
    storeFacts: { exportEntries: () => ({ ok: false, reason: "program-unavailable" }) },
    registerSecret: () => undefined,
  });

const EXECUTABLE_TOKEN_READ = {
  style: "command" as const,
  program: EXECUTABLE_GH,
  args: ["auth", "token", "--hostname", "example.com"],
};

const EXECUTABLE_EXPORT = {
  style: "command" as const,
  program: EXECUTABLE_OPENCODE,
  args: ["auth", "export", "deepseek"],
};

const INPUT = {
  runChild: recordingRunner(() => ({
    ok: true as const,
    exitCode: 0,
    stdout: `${CANARY}\n`,
  })),
  parentEnvironment: { PATH: "/usr/bin", HOME: "/home/op" },
  registerSecret: () => undefined,
};

describe("TC-ALLOW-001 in-table declarations accepted with exactly their permitted parameters", () => {
  test("the tracker token read accepts the host slot and the host omitted", () => {
    for (const declaration of [GH_TOKEN_READ, GH_TOKEN_READ_NO_HOST]) {
      const match = matchCommandDeclaration(declaration);
      expect(match.ok).toBe(true);
    }
  });

  test("the harness export accepts the standalone flag and requires the positional", () => {
    expect(
      matchCommandDeclaration({
        style: "command",
        program: "/usr/local/bin/opencode",
        args: ["auth", "export", "--standalone", "deepseek"],
      }).ok,
    ).toBe(true);
    expect(matchCommandDeclaration(OPENCODE_EXPORT).ok).toBe(true);
    expect(
      matchCommandDeclaration({
        style: "command",
        program: "/usr/local/bin/opencode",
        args: ["auth", "export"],
      }).ok,
    ).toBe(false);
  });

  test("the permitted-parameter set is exact: nothing beyond prefix and slots is tolerated", () => {
    const match = matchCommandDeclaration(GH_TOKEN_READ);
    if (!match.ok) throw new Error("the in-table declaration must match");
    expect(constructArgv(match.entry, match.parsed)).toEqual([
      "auth",
      "token",
      "--hostname",
      "example.com",
    ]);
    expect(
      matchCommandDeclaration({
        style: "command",
        program: "/usr/bin/gh",
        args: ["auth", "token", "--hostname", "example.com", "--scope", "repo"],
      }).ok,
    ).toBe(false);
  });

  test("the shipped default export shape omits the standalone flag; opting in is per declaration", () => {
    const exportEntry = COMMAND_ALLOWLIST.find((entry) => entry.program === "opencode");
    expect(exportEntry?.booleanFlag?.name).toBe("--standalone");
    // The declared argv shape without the flag is accepted verbatim.
    expect(matchCommandDeclaration(OPENCODE_EXPORT).ok).toBe(true);
  });

  test("load-time validation accepts every in-table shape through the shared validator", () => {
    expect(parseCredentialSourceKey("t", GH_TOKEN_READ)).toEqual(GH_TOKEN_READ);
    expect(parseCredentialSourceKey("t", OPENCODE_EXPORT)).toEqual(OPENCODE_EXPORT);
  });
});

describe("TC-ALLOW-002 out-of-table programs, interpreters, and network clients refused", () => {
  test.each([
    ["/usr/bin/pass", ["show", "github"]],
    ["/bin/sh", ["-c", "gh auth token"]],
    ["/usr/bin/python3", ["-c", "print(1)"]],
    ["/usr/bin/node", ["-e", "process.exit(0)"]],
    ["/usr/bin/curl", ["https://example.com"]],
    ["/usr/bin/wget", ["https://example.com"]],
    ["/usr/bin/nc", ["example.com", "443"]],
  ])("%s is refused by name", (program, args) => {
    const match = matchCommandDeclaration({
      style: "command",
      program: program as string,
      args: args as string[],
    });
    expect(match.ok).toBe(false);
    if (!match.ok) expect(match.detail).toContain("allowlist");
  });

  test("refusals are the composition layer's table match; the raw validator stays tolerant (TC-POL-SEC-002)", () => {
    // The raw load-time validator enforces style grammar only; the closed
    // table refusal happens at the composition edge's strict pass.
    const parsed = parseCredentialSourceKey("t", {
      style: "command",
      program: "/usr/bin/curl",
      args: ["https://example.com"],
    });
    expect(parsed).toEqual({
      style: "command",
      program: "/usr/bin/curl",
      args: ["https://example.com"],
    });
    const match = matchCommandDeclaration({
      style: "command",
      program: "/usr/bin/curl",
      args: ["https://example.com"],
    });
    if (match.ok) throw new Error("an out-of-table program must refuse");
    expect(match.detail).toContain("allowlist");
  });
});

describe("TC-ALLOW-003 unpermitted parameters and unknown declaration fields refused by name", () => {
  test("a prefix mismatch, an extra flag, and a flag in the slot position each refuse by name", () => {
    const mismatch = matchCommandDeclaration({
      style: "command",
      program: "/usr/bin/gh",
      args: ["auth", "login"],
    });
    if (mismatch.ok) throw new Error("prefix mismatch must refuse");
    expect(mismatch.detail).toContain("pinned prefix");

    const extra = matchCommandDeclaration({
      style: "command",
      program: "/usr/bin/gh",
      args: ["auth", "token", "--extra"],
    });
    if (extra.ok) throw new Error("an unpermitted parameter must refuse");
    expect(extra.detail).toContain("--extra");

    const slotFlag = matchCommandDeclaration({
      style: "command",
      program: "/usr/bin/gh",
      args: ["auth", "token", "--hostname", "--other-flag"],
    });
    expect(slotFlag.ok).toBe(false);
  });

  test("an unknown style and a wrong-style known field refuse by name", () => {
    expect(parseCredentialSourceKey("t", { style: "vault", program: "/v" })).toBe("t.style");
    // A known source-key field on a style that does not admit it refuses by
    // name at configuration load (DM-1) — never a silent drop. One arm per
    // style proves the per-style key sets.
    expect(
      parseCredentialSourceKey("t", { style: "literal", name: "K", program: "/usr/bin/gh" }),
    ).toBe("t.program: the literal style does not admit program");
    expect(
      parseCredentialSourceKey("t", { style: "environment-prefixed", suffix: "X", program: "/v" }),
    ).toBe("t.program: the environment-prefixed style does not admit program");
    expect(
      parseCredentialSourceKey("t", {
        style: "command",
        program: "/usr/bin/gh",
        args: ["auth", "token"],
        harness: "opencode",
      }),
    ).toBe("t.harness: the command style does not admit harness");
    expect(
      parseCredentialSourceKey("t", {
        style: "harness-store",
        harness: "opencode",
        integrationId: "deepseek",
        args: ["auth", "token"],
      }),
    ).toBe("t.args: the harness-store style does not admit args");
    // `name` is the one exempt field: the DM-5 default declaration deep-merges
    // with every user restyling at the same path, so the merged declaration
    // legitimately carries the default's `name` beside its own keys — the
    // merged shape TC-COMP-001 (AC-F1-1) resolves through the real
    // composition. A wrong-style `name` is the config layer's synthesized
    // member, not an operator error.
    expect(
      parseCredentialSourceKey("t", {
        style: "command",
        program: "/usr/bin/gh",
        args: ["auth", "token"],
        name: "GITHUB_TOKEN",
      }),
    ).toEqual({ style: "command", program: "/usr/bin/gh", args: ["auth", "token"] });
    // Keys outside the source-key vocabulary are not wrong-style fields: they
    // stay the config layer's refusal (TC-POL-SEC-002's pinned two-layer
    // semantic — this raw layer ignores them, the catalog refuses them).
    expect(parseCredentialSourceKey("t", { style: "literal", name: "K", extra: "x" })).toEqual({
      style: "literal",
      name: "K",
    });
    const unknownField = matchCommandDeclaration({
      style: "command",
      program: "/usr/bin/gh",
      args: ["auth", "token", "--hostname", "example.com", "surprise"],
    });
    expect(unknownField.ok).toBe(false);
    // The bare pinned prefix with no parameters is accepted.
    expect(
      matchCommandDeclaration({
        style: "command",
        program: "/usr/bin/gh",
        args: ["auth", "token"],
      }).ok,
    ).toBe(true);
  });

  test("the inert binding-supplied slot exception accepts no binding input", () => {
    const entry = COMMAND_ALLOWLIST.find((candidate) => candidate.program === "gh");
    expect(entry?.bindingSuppliedSlot).toEqual({ slot: "host", active: false });
  });
});

const _unknownFlagArgs = (): string[] => ["auth", "token", "--hostname", "example.com", "surprise"];
const _unknownFlagRefusal = (args: string[]): boolean =>
  !matchCommandDeclaration({ style: "command", program: "/usr/bin/gh", args }).ok;

describe("TC-ALLOW-004 slot grammars via named constants", () => {
  test("the named constants are the plan's fixed values", () => {
    expect(HOST_SLOT_MAX_LENGTH).toBe(253);
    expect(INTEGRATION_ID_MAX_LENGTH).toBe(64);
    expect(CREDENTIAL_HOST_SLOT_MAX_LENGTH).toBe(HOST_SLOT_MAX_LENGTH);
    expect(CREDENTIAL_INTEGRATION_ID_MAX_LENGTH).toBe(INTEGRATION_ID_MAX_LENGTH);
  });

  test("host slot: charset, no leading dash, bounded length", () => {
    expect(validateHostSlot("github.example.com").ok).toBe(true);
    expect(validateHostSlot("-leading.example.com").ok).toBe(false);
    expect(validateHostSlot("host_underscore.example.com").ok).toBe(false);
    expect(validateHostSlot(`${"a".repeat(HOST_SLOT_MAX_LENGTH + 4)}`).ok).toBe(false);
    expect(validateHostSlot("a".repeat(HOST_SLOT_MAX_LENGTH)).ok).toBe(true);
    expect(validateHostSlot("").ok).toBe(false);
  });

  test("integration id slot: closed pattern, no leading dash, bounded length", () => {
    expect(validateIntegrationIdSlot("deepseek").ok).toBe(true);
    expect(validateIntegrationIdSlot("zai-coding-plan").ok).toBe(true);
    expect(validateIntegrationIdSlot("-leading").ok).toBe(false);
    expect(validateIntegrationIdSlot("Uppercase").ok).toBe(false);
    expect(validateIntegrationIdSlot("a".repeat(65)).ok).toBe(false);
    expect(validateIntegrationIdSlot("a".repeat(64)).ok).toBe(true);
  });

  test("a command declaration may not exceed the 30 s hard bound", () => {
    expect(
      parseCredentialSourceKey("t", {
        ...GH_TOKEN_READ,
        timeoutMs: CREDENTIAL_COMMAND_TIMEOUT_MAX_MS,
      }),
    ).not.toBe("t.timeoutMs");
    expect(
      parseCredentialSourceKey("t", {
        ...GH_TOKEN_READ,
        timeoutMs: CREDENTIAL_COMMAND_TIMEOUT_MAX_MS + 1,
      }),
    ).toBe("t.timeoutMs: the declared timeout exceeds the 30000 ms hard bound");
  });
});

describe("TC-ALLOW-005 the constructed argv always carries the -- terminator", () => {
  test("the positional form always carries -- before the positional", () => {
    for (const args of [
      ["auth", "export", "deepseek"],
      ["auth", "export", "--standalone", "deepseek"],
    ]) {
      const match = matchCommandDeclaration({
        style: "command",
        program: "/usr/local/bin/opencode",
        args,
      });
      if (!match.ok) throw new Error("fixture must match");
      const argv = constructArgv(match.entry, match.parsed);
      const positional = argv[argv.length - 2];
      expect(positional).toBe("--");
    }
  });

  test("the host form places no terminator (no positional slot)", () => {
    const match = matchCommandDeclaration(GH_TOKEN_READ);
    if (!match.ok) throw new Error("fixture must match");
    expect(constructArgv(match.entry, match.parsed)).not.toContain("--");
  });
});

describe("TC-ALLOW-006 symlink resolution and program-unavailable", () => {
  test("an unresolvable program path is program-unavailable", () => {
    const resolution = resolveCommandSource(
      { style: "command", program: "/nonexistent/path/gh", args: ["auth", "token"] },
      {
        ...INPUT,
        runChild: recordingRunner(() => ({ ok: true, exitCode: 0, stdout: "x" })).runChild,
      },
    );
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) {
      expect(resolution.reason).toBe("program-unavailable");
      expect(resolution.source).toBe("command:/nonexistent/path/gh");
    }
  });

  test("the real spawn child runner preserves the closed posture", () => {
    // A real binary that exists everywhere: /bin/true exits 0 with no output;
    // an empty token read is a refused shape, not material.
    const runner = createSpawnChildRunner();
    const outcome = runner({
      argv: ["/bin/true"],
      environment: reducedChildEnvironment({ PATH: "/usr/bin" }),
      timeoutMs: 1_000,
      stdoutMaxBytes: COMMAND_STDOUT_MAX_BYTES,
    });
    expect(outcome.ok).toBe(true);
  });
});

describe("TC-MEMO-001 exactly one execution per reference per process", () => {
  test("the second resolve is a memory read; a second reference spawns once", () => {
    const recording = recordingRunner(() => ({
      ok: true as const,
      exitCode: 0,
      stdout: `${CANARY}\n`,
    }));
    const resolver = commandResolver(recording.runChild);
    const reference = { referenceName: "tracker-cli", sourceKey: EXECUTABLE_TOKEN_READ };

    const first = resolver.resolve(reference);
    expect(first.ok).toBe(true);
    expect(recording.requests).toHaveLength(1);

    const second = resolver.resolve(reference);
    expect(second.ok).toBe(true);
    expect(recording.requests).toHaveLength(1);

    const other = resolver.resolve({
      referenceName: "export-cli",
      sourceKey: EXECUTABLE_EXPORT,
    });
    expect(other.ok).toBe(true);
    expect(recording.requests).toHaveLength(2);
  });

  test("the memo makes the count independent of how many operations consume the reference", () => {
    const recording = recordingRunner(() => ({
      ok: true as const,
      exitCode: 0,
      stdout: `${CANARY}\n`,
    }));
    const resolver = commandResolver(recording.runChild);
    const reference = { referenceName: "tracker-cli", sourceKey: EXECUTABLE_TOKEN_READ };
    for (let index = 0; index < 10; index += 1) resolver.resolve(reference);
    expect(recording.requests).toHaveLength(1);
  });
});

describe("TC-EXEC-001 the cap classifies timeout; healthy runs complete", () => {
  test("a hanging child under a declared short timeout classifies timeout", () => {
    const recording = recordingRunner(() => ({ ok: false as const, reason: "timeout" as const }));
    const resolution = resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recording.runChild,
      parentEnvironment: INPUT.parentEnvironment,
      registerSecret: INPUT.registerSecret,
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.reason).toBe("timeout");
  });

  test("the shipped constants are pinned: 15 s default, 30 s bound", () => {
    expect(COMMAND_TIMEOUT_DEFAULT_MS).toBe(15_000);
    expect(COMMAND_TIMEOUT_MAX_MS).toBe(30_000);
  });

  test("a healthy child completing inside the cap yields material", () => {
    const recording = recordingRunner(() => ({
      ok: true as const,
      exitCode: 0,
      stdout: `${CANARY}\n`,
    }));
    const resolution = resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recording.runChild,
      parentEnvironment: INPUT.parentEnvironment,
      registerSecret: INPUT.registerSecret,
    });
    expect(resolution.ok).toBe(true);
  });

  test("a capped run never yields partial material and never falls back", () => {
    const resolution = resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recordingRunner(() => ({ ok: false as const, reason: "timeout" as const }))
        .runChild,
      parentEnvironment: INPUT.parentEnvironment,
      registerSecret: INPUT.registerSecret,
    });
    expect(resolution.ok).toBe(false);
  });
});

describe("TC-EXEC-002 child execution posture", () => {
  test("the recorded child environment is exactly the reduced set", () => {
    const recording = recordingRunner(() => ({
      ok: true as const,
      exitCode: 0,
      stdout: `${CANARY}\n`,
    }));
    resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recording.runChild,
      parentEnvironment: {
        PATH: "/usr/bin",
        HOME: "/home/op",
        DBUS_SESSION_BUS_ADDRESS: "unix:path=/dev/null",
        XDG_RUNTIME_DIR: "/run/user/1000",
        // Non-credential identifier names carrying sentinel values (GH-394
        // review iter-2 F-8, the planted-fixture convention): the proof is
        // that undeclared parent variables and their values never propagate,
        // which is name-independent.
        UNDECLARED_PARENT_ONE: "sentinel-parent-secret",
        UNDECLARED_PARENT_TWO: "sentinel-parent-secret-2",
      },
      registerSecret: INPUT.registerSecret,
    });
    expect(recording.requests).toHaveLength(1);
    const request = recording.requests[0];
    if (request === undefined) throw new Error("the request must be recorded");
    expect(Object.keys(request.environment).sort()).toEqual([
      "DBUS_SESSION_BUS_ADDRESS",
      "HOME",
      "PATH",
      "XDG_RUNTIME_DIR",
    ]);
    expect(Object.values(request.environment).join(" ")).not.toContain("sentinel-parent-secret");
  });

  test("the session-bus facts are forwarded only when present", () => {
    const reduced = reducedChildEnvironment({ PATH: "/usr/bin", HOME: "/home/op" });
    expect(Object.keys(reduced).sort()).toEqual(["HOME", "PATH"]);
  });

  test("argv construction is direct: no shell, no metacharacter interpretation", () => {
    const recording = recordingRunner(() => ({
      ok: true as const,
      exitCode: 0,
      stdout: `${CANARY}\n`,
    }));
    resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recording.runChild,
      parentEnvironment: INPUT.parentEnvironment,
      registerSecret: INPUT.registerSecret,
    });
    const request = recording.requests[0];
    if (request === undefined) throw new Error("the request must be recorded");
    expect(request.argv[0]).toBe(EXECUTABLE_GH);
    expect(request.argv.join(" ")).toBe(`${EXECUTABLE_GH} auth token --hostname example.com`);
    expect(request.argv.join(" ")).not.toMatch(/[;&|`$]/);
  });

  test("stdout beyond the declared bound is a refused shape, never partial material", () => {
    const resolution = resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recordingRunner(() => ({
        ok: true as const,
        exitCode: 0,
        stdout: `${CANARY}${CANARY}`,
        stdoutTruncated: true,
      })).runChild,
      parentEnvironment: INPUT.parentEnvironment,
      registerSecret: INPUT.registerSecret,
    });
    expect(resolution.ok).toBe(false);
    if (!resolution.ok) expect(resolution.reason).toBe("shape-drift");
  });

  test("material is exactly one line; interior newlines are refused", () => {
    const interior = resolveCommandSource(EXECUTABLE_TOKEN_READ, {
      runChild: recordingRunner(() => ({
        ok: true as const,
        exitCode: 0,
        stdout: `line-one\nline-two\n`,
      })).runChild,
      parentEnvironment: INPUT.parentEnvironment,
      registerSecret: INPUT.registerSecret,
    });
    expect(interior.ok).toBe(false);
    if (!interior.ok) expect(interior.reason).toBe("shape-drift");
  });
});
