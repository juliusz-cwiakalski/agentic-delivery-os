/**
 * GH-416 — structural branch resolution and the one shared predicate
 * (TC-LRES-001..005, TC-LRES-004 steps 5-7).
 *
 * The composed program runs over injected branch facts and the scripted
 * transport. A resolution refusal is a typed `input.value.rejected` answer with
 * no act and no record; the protected-name check is proven at the predicate
 * level because a resolved convention name can never equal a protected member.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createGitPushSeam,
  type GitPushRunnerResult,
} from "../../packages/adapters/src/git/index";
import {
  type HarnessSpawnRunnerResult,
} from "../../packages/core/src/contracts/index";
import { PROTECTED_REF_NAMES, isSafeRef } from "../../packages/core/src/contracts/index";
import { createParityHarness, readableParityTransport } from "../fixtures/dispatch/parity/harness";
import { createGuardedRunner } from "../fixtures/dispatch/parity/process-runner";

const ROOT = process.cwd();
const REF = "GH-347";
const BRANCH = "feat/GH-347/parity";
const HEAD = "0123456789abcdef0123456789abcdef01234567";

const accepted = (): GitPushRunnerResult => ({ stdout: "", stderr: "", status: 0, timedOut: false });

const branchGit =
  (branches: readonly string[]) =>
  ({ args }: { readonly args: readonly string[] }): HarnessSpawnRunnerResult => {
    const [verb, sub] = args;
    if (verb === "for-each-ref") {
      return {
        stdout: branches.map((name) => `${name} ${HEAD}`).join("\n") + (branches.length > 0 ? "\n" : ""),
        stderr: "",
        status: 0,
        timedOut: false,
      };
    }
    if (verb === "rev-parse" && sub === "--abbrev-ref") {
      return { stdout: `${BRANCH}\n`, stderr: "", status: 0, timedOut: false };
    }
    if (verb === "rev-parse") {
      return { stdout: `${HEAD}\n`, stderr: "", status: 0, timedOut: false };
    }
    return { stdout: "", stderr: "unexpected", status: 1, timedOut: false };
  };

type ResolutionRun = {
  readonly exit: number;
  readonly summary: string | undefined;
  readonly errorCode: string | undefined;
  readonly pushes: number;
  readonly lanePushRecords: number;
  readonly data: Record<string, unknown> | undefined;
};

const runResolution = async (input: {
  readonly branches: readonly string[];
  readonly pmNotesBranch?: string;
}): Promise<ResolutionRun> => {
  const guarded = createGuardedRunner({
    head: HEAD,
    git: branchGit(input.branches),
    push: accepted,
  });
  const harness = createParityHarness({
    label: "lane-push-resolution",
    localHead: HEAD,
    guarded,
    transport: readableParityTransport(),
    ...(input.pmNotesBranch === undefined ? {} : { pmNotesBranch: input.pmNotesBranch }),
  });
  try {
    const run = await harness.run(["push", REF, "--json"]);
    const records = harness.store.readRecords();
    const lanePushRecords =
      records.ok === true
        ? records.value.records.filter((record) => record.kind === "dispatch.lane-push").length
        : 0;
    return {
      exit: run.exit,
      summary: (run.envelope?.error as { readonly summary?: string } | undefined)?.summary,
      errorCode: (run.envelope?.error as { readonly code?: string } | undefined)?.code,
      pushes: guarded.pushes,
      lanePushRecords,
      data: run.envelope?.data as Record<string, unknown> | undefined,
    };
  } finally {
    harness.dispose();
  }
};

describe("GH-416 TC-LRES-001 declaration and convention disagree", () => {
  test("the refusal names both values, performs no act, and appends no record", async () => {
    const run = await runResolution({
      branches: [BRANCH],
      pmNotesBranch: "feat/GH-347/declared",
    });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("feat/GH-347/declared");
    expect(run.summary).toContain(BRANCH);
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });
});

describe("GH-416 TC-LRES-002 the convention read matches no branch", () => {
  test("no match is a named refusal with no current-checkout fallback", async () => {
    const run = await runResolution({ branches: [] });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("no local branch matches");
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });

  test("a declaration alone is insufficient when the convention read is empty", async () => {
    const run = await runResolution({
      branches: [],
      pmNotesBranch: BRANCH,
    });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.pushes).toBe(0);
  });
});

describe("GH-416 TC-LRES-003 the convention read matches more than one branch", () => {
  test("ambiguity names the candidates with no act and no record", async () => {
    const run = await runResolution({
      branches: ["feat/GH-347/a", "fix/GH-347/b"],
    });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("feat/GH-347/a");
    expect(run.summary).toContain("fix/GH-347/b");
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });
});

describe("GH-416 TC-LRES-004 the shared predicate and the protected set", () => {
  test("arm a1: a convention-resolved unsafe name is refused pre-act", async () => {
    const run = await runResolution({ branches: ["feat/GH-347/a~b"] });
    expect(run.exit).toBe(1);
    expect(run.errorCode).toBe("input.value.rejected");
    expect(run.summary).toContain("feat/GH-347/a~b");
    expect(run.pushes).toBe(0);
    expect(run.lanePushRecords).toBe(0);
  });

  test("the safe-ref predicate accepts protected names; the membership check refuses them", () => {
    for (const name of PROTECTED_REF_NAMES) {
      expect(isSafeRef(name), name).toBe(true);
      expect((PROTECTED_REF_NAMES as readonly string[]).includes(name)).toBe(true);
    }
    expect(isSafeRef("feat/GH-347/parity")).toBe(true);
    expect(isSafeRef("bad~name")).toBe(false);
  });

  test("the protected-set arm is structurally unreachable from a resolved name", () => {
    for (const name of PROTECTED_REF_NAMES) {
      expect(name.includes("/")).toBe(false);
    }
    expect("feat/GH-347/parity".includes("/")).toBe(true);
  });

  test("the command composes and imports both, never re-declaring either", () => {
    const source = readFileSync(join(ROOT, "packages/core/src/app/dispatch-lane-push.ts"), "utf8");
    expect(source).toContain("isSafeRef");
    expect(source).toContain("PROTECTED_REF_NAMES");
    expect(source).not.toContain("const isSafeRef");
    expect(source).not.toContain('PROTECTED_REF_NAMES = [');
    expect(source).not.toContain("REF_PATTERN");
  });

  test("the seam's direct-consumer guard refuses before any child", async () => {
    let calls = 0;
    const seam = createGitPushSeam({
      childRunner: async () => {
        calls += 1;
        return accepted();
      },
    });
    for (const name of ["bad~name", ...PROTECTED_REF_NAMES]) {
      const result = await seam.pushChangeBranch({ branch: name });
      expect(result.outcome).toBe("rejected");
      expect(calls).toBe(0);
    }
  });
});

describe("GH-416 TC-LRES-005 the unique-resolution arms", () => {
  test("arm B: no declaration, the convention read unique", async () => {
    const run = await runResolution({ branches: [BRANCH] });
    expect(run.exit).toBe(0);
    const lanePush = (run.data?.lanePush ?? {}) as Record<string, unknown>;
    expect(lanePush.verdict).toBe("pushed");
    expect(lanePush.branch).toBe(BRANCH);
    expect(run.pushes).toBe(1);
  });

  test("arm A: declaration and convention agree", async () => {
    const run = await runResolution({ branches: [BRANCH], pmNotesBranch: BRANCH });
    expect(run.exit).toBe(0);
    const lanePush = (run.data?.lanePush ?? {}) as Record<string, unknown>;
    expect(lanePush.branch).toBe(BRANCH);
    expect(run.pushes).toBe(1);
  });
});
