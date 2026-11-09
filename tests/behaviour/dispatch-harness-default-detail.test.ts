/**
 * TC-HDA-030 / TC-HDA-031 / TC-HDA-032 / TC-HDA-034 / TC-HDA-035 — the
 * pre-session spawn failure keeps the delivered identity while carrying the
 * underlying harness kind/code (and field when present) in machine JSON and
 * verbose human text; non-verbose text stays exactly four keys.
 */
import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { readDispatchAttempts } from "../../packages/core/src/app/dispatch-ledger";
import {
  DISPATCH_MAX_ERROR_DETAIL_CHARS,
  type HarnessFailure,
  type HarnessSessionPort,
} from "../../packages/core/src/contracts/index";
import { createCommandScenario } from "../fixtures/dispatch/golden/harness";
import {
  createControlledParent,
  createSyntheticOpencode,
  repairedDefaultDescriptor,
} from "../fixtures/harness/default-spawn";

const HARNESS_MODEL_FAILURE: HarnessFailure = {
  kind: "harness",
  code: "harness.spawn.variable-missing",
  field: "HARNESS_MODEL",
  summary: "declared environment variable HARNESS_MODEL is absent",
};

const CONFIG_FAILURE: HarnessFailure = {
  kind: "config",
  code: "config.credential.missing",
  field: "HARNESS_AUTH",
  summary: "declared credential reference did not resolve",
};

const failingScenario = (spawnFailure: HarnessFailure) => createCommandScenario({ spawnFailure });

const attemptsOf = (scenario: ReturnType<typeof createCommandScenario>) => {
  const read = readDispatchAttempts(scenario.state.store);
  if (!read.ok) throw new Error("ledger read failed");
  return read.records;
};

describe("TC-HDA-030 always-present underlying detail on the pre-session path", () => {
  test("harness failure keeps the spawn-failed identity and names kind/code/field", async () => {
    const scenario = failingScenario(HARNESS_MODEL_FAILURE);
    try {
      const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
      expect(run.exit).toBe(1);
      const error = run.envelope?.data?.error;
      expect(error?.code).toBe("dispatch.session.spawn-failed");
      expect(error?.detail).toEqual({
        kind: "harness",
        code: "harness.spawn.variable-missing",
        field: "HARNESS_MODEL",
      });
      expect(Object.keys(error?.detail ?? {}).sort()).toEqual(["code", "field", "kind"]);
      expect(run.envelope?.data?.result).toBe("failed");
      expect(run.envelope?.data?.outcome).toBe("failed");
      expect(error?.category).toBe("user");
      expect(error?.retryable).toBe(false);
      expect(error?.consequence).toBe("not_landed");
      expect(run.envelope?.data?.lastMessage).toBe("spawn failed before a session existed");
      const records = attemptsOf(scenario);
      expect(records).toHaveLength(1);
      expect(records[0]?.token).toBe("failed");
      expect(records[0]?.outcome).toBe("failed");
      expect(records[0]?.evidenceRefs).toContain("harness:spawn-failed");
    } finally {
      scenario.dispose();
    }
  });

  test("a config-kind failure carries the config identity with the same spawn-failed identity", async () => {
    const scenario = failingScenario(CONFIG_FAILURE);
    try {
      const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
      expect(run.envelope?.data?.error?.code).toBe("dispatch.session.spawn-failed");
      expect(run.envelope?.data?.error?.detail).toEqual({
        kind: "config",
        code: "config.credential.missing",
        field: "HARNESS_AUTH",
      });
    } finally {
      scenario.dispose();
    }
  });

  test("the delivered refusal carries kind and code and omits field", async () => {
    const scenario = createCommandScenario({ spawnFails: true });
    try {
      const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
      const detail = run.envelope?.data?.error?.detail;
      expect(detail).toEqual({ kind: "harness", code: "harness.spawn.refused" });
      expect(Object.hasOwn(detail ?? {}, "field")).toBe(false);
    } finally {
      scenario.dispose();
    }
  });
});

describe("TC-HDA-031 machine JSON carries the detail through redaction", () => {
  test("the detail survives redaction while a registered secret stays absent", async () => {
    const registeredValue = "synthetic-secret-value-gh277";
    const scenario = createCommandScenario({
      spawnFailure: HARNESS_MODEL_FAILURE,
      secrets: [registeredValue],
    });
    try {
      const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
      const envelope = JSON.parse(run.stdout) as typeof run.envelope;
      expect(envelope?.data?.error?.detail).toEqual({
        kind: "harness",
        code: "harness.spawn.variable-missing",
        field: "HARNESS_MODEL",
      });
      expect(run.stdout).not.toContain(registeredValue);
      expect(envelope?.data?.error?.code).toBe("dispatch.session.spawn-failed");
      expect(envelope?.data?.result).toBe("failed");
      expect(envelope?.data?.lastMessage).toBe("spawn failed before a session existed");
    } finally {
      scenario.dispose();
    }
  });
});

const keyLines = (stdout: string): readonly string[] =>
  stdout.split("\n").filter((line) => line.length > 0 && line.includes("="));

describe("TC-HDA-032 verbose human detail and the four-key non-verbose text", () => {
  test("verbose text names the code and field without adding a fifth key line", async () => {
    const scenario = failingScenario(HARNESS_MODEL_FAILURE);
    try {
      const run = await scenario.invoke(["dispatch", "GH-277", "--verbose"]);
      expect(run.stdout).toContain("harness.spawn.variable-missing");
      expect(run.stdout).toContain("HARNESS_MODEL");
      expect(keyLines(run.stdout)).toHaveLength(4);
      expect(keyLines(run.stdout).map((line) => line.split("=")[0])).toEqual([
        "result",
        "pr_url",
        "exit_code",
        "last_message",
      ]);
      expect(run.stderr).not.toContain("harness.spawn.variable-missing");
      expect(run.stderr).not.toContain("HARNESS_MODEL");
    } finally {
      scenario.dispose();
    }
  });

  test("non-verbose text is exactly the four delivered keys in order", async () => {
    const scenario = failingScenario(HARNESS_MODEL_FAILURE);
    try {
      const run = await scenario.invoke(["dispatch", "GH-277"]);
      const lines = run.stdout.trimEnd().split("\n");
      expect(lines).toHaveLength(4);
      expect(lines.map((line) => line.split("=")[0])).toEqual([
        "result",
        "pr_url",
        "exit_code",
        "last_message",
      ]);
      expect(run.stdout).not.toContain("harness.spawn.variable-missing");
      expect(run.stdout).not.toContain("HARNESS_MODEL");
      expect(run.stdout).toContain("last_message=spawn failed before a session existed");
      expect(run.stderr).not.toContain("harness.spawn.variable-missing");
    } finally {
      scenario.dispose();
    }
  });

  test("--verbose changes no machine shape", async () => {
    const plain = failingScenario(HARNESS_MODEL_FAILURE);
    const verbose = failingScenario(HARNESS_MODEL_FAILURE);
    try {
      const withoutVerbose = await plain.invoke(["dispatch", "GH-277", "--json"]);
      const withVerbose = await verbose.invoke(["dispatch", "GH-277", "--json", "--verbose"]);
      const normalize = (run: typeof withoutVerbose) => {
        const parsed = JSON.parse(run.stdout) as {
          readonly runId?: unknown;
          readonly timing?: unknown;
          readonly data?: unknown;
        };
        return { data: parsed.data };
      };
      expect(normalize(withVerbose)).toEqual(normalize(withoutVerbose));
    } finally {
      plain.dispose();
      verbose.dispose();
    }
  });
});

describe("TC-HDA-034 detail hygiene: identifiers only, single line, bounded", () => {
  const serialize = (detail: {
    readonly kind: string;
    readonly code: string;
    readonly field?: string;
  }) => JSON.stringify(detail);

  test("the real detail is identifiers-only, single-line, and within the exported bound", async () => {
    const scenario = failingScenario(HARNESS_MODEL_FAILURE);
    try {
      const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
      const detail = run.envelope?.data?.error?.detail;
      expect(detail).toBeDefined();
      if (detail === undefined) return;
      const text = JSON.stringify(detail);
      expect(Object.keys(detail).sort()).toEqual(["code", "field", "kind"]);
      expect(text).not.toContain("\n");
      expect(text).not.toContain("\r");
      expect(detail.field).not.toContain("\n");
      expect(detail.field).not.toContain("\r");
      expect(text.length).toBeLessThanOrEqual(DISPATCH_MAX_ERROR_DETAIL_CHARS);
      expect(text).not.toContain(HARNESS_MODEL_FAILURE.summary as string);
    } finally {
      scenario.dispose();
    }
  });

  test("an over-bound field or a newline would fail the hygiene assertions", () => {
    const overBound = {
      kind: "harness",
      code: "harness.spawn.variable-missing",
      field: "X".repeat(300),
    };
    expect(serialize(overBound).length).toBeGreaterThan(DISPATCH_MAX_ERROR_DETAIL_CHARS);
    const multiLine = { kind: "harness", code: "harness.spawn.variable-missing", field: "A\nB" };
    expect(multiLine.field).toContain("\n");
    expect(serialize(multiLine)).not.toContain("\n");
    const absentField = { kind: "harness", code: "harness.spawn.refused" };
    expect(Object.hasOwn(absentField, "field")).toBe(false);
    expect(serialize(absentField)).not.toContain("null");
  });
});

describe("TC-HDA-035 the required-absence field reaches both layers", () => {
  test("a missing HOME fails closed and the same field appears in the dispatch detail", async () => {
    const controlled = createControlledParent({ omitHome: true });
    try {
      const descriptor = repairedDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const captured: HarnessFailure[] = [];
      const capturingPort: HarnessSessionPort = {
        ...synthetic.port,
        spawn: async (input) => {
          const result = await synthetic.port.spawn(input);
          if (!result.ok) captured.push(result.error);
          return result;
        },
      };
      const scenario = createCommandScenario({
        harnessPort: capturingPort,
        descriptor,
        prompt: (ref) => `deliver ${ref}`,
      });
      try {
        const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
        expect(captured[0]?.code).toBe("harness.spawn.variable-missing");
        expect(captured[0]?.field).toBe("HOME");
        expect(run.envelope?.data?.error?.code).toBe("dispatch.session.spawn-failed");
        expect(run.envelope?.data?.error?.detail?.code).toBe("harness.spawn.variable-missing");
        expect(run.envelope?.data?.error?.detail?.field).toBe("HOME");
        expect(captured[0]?.field).toBe(run.envelope?.data?.error?.detail?.field);
        expect(existsSync(controlled.markerPath)).toBe(false);
        const records = attemptsOf(scenario);
        expect(records).toHaveLength(1);
        expect(records[0]?.token).toBe("failed");

        const text = await scenario.invoke(["dispatch", "GH-277"]);
        expect(text.stdout.trimEnd().split("\n")).toHaveLength(4);
        expect(text.stdout).not.toContain("HOME");
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });

  test("supplying HOME makes the same failure disappear", async () => {
    const controlled = createControlledParent();
    try {
      const descriptor = repairedDefaultDescriptor(controlled.workDirectory);
      const synthetic = createSyntheticOpencode({
        parentEnvironment: controlled.parentEnvironment,
      });
      const scenario = createCommandScenario({
        harnessPort: synthetic.port,
        descriptor,
        prompt: (ref) => `deliver ${ref}`,
      });
      try {
        const run = await scenario.invoke(["dispatch", "GH-277", "--json"]);
        expect(run.envelope?.data?.error?.code).not.toBe("dispatch.session.spawn-failed");
        expect(existsSync(controlled.markerPath)).toBe(true);
      } finally {
        scenario.dispose();
      }
    } finally {
      controlled.dispose();
    }
  });
});
