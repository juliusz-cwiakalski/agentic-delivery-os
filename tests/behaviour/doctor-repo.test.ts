/**
 * TC-DOCTOR-006 — repo wiring: clean HTTPS/SSH, dirty, bad origin, unreadable,
 * linked worktree. Local-only: zero network reads, no base-conformance claim,
 * and no watchdog refusal identity.
 */
import { describe, expect, test } from "bun:test";
import { runDoctorCli, UNRESOLVED_BINDING } from "../fixtures/doctor/harness";

const checkOf = (
  report: Record<string, unknown> | undefined,
  area: string,
): Record<string, unknown> => {
  const data = report as { readonly checks: readonly Record<string, unknown>[] };
  const found = data.checks.find((entry) => entry.area === area);
  if (found === undefined) throw new Error(`${area} check missing`);
  return found;
};

describe("TC-DOCTOR-006 repo check", () => {
  test("a clean checkout with a GitHub origin is ok with factual branch/HEAD detail", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.exitCode).toBe(0);
    const repo = checkOf(run.report, "repo");
    expect(repo.verdict).toBe("ok");
    expect(String(repo.detail)).toContain("feat/GH-224/doctor-v1");
    expect(String(repo.detail)).toContain("1111111");
    expect(String(repo.detail).toLowerCase()).not.toContain("base");
    expect(repo.fixHint).toBeUndefined();
  });

  test("the repo check performs zero network reads", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { binding: UNRESOLVED_BINDING },
      tracker: { read: undefined },
      ci: { read: undefined },
    });
    expect(run.counts.tracker).toBe(0);
    expect(run.counts.ci).toBe(0);
  });

  test("a dirty work tree is fail with the commit-or-discard hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], { checkout: { clean: false } });
    expect(run.exitCode).toBe(1);
    const repo = checkOf(run.report, "repo");
    expect(repo.verdict).toBe("fail");
    expect((repo.evidence as { readonly reasons: readonly string[] }).reasons).toContain(
      "checkout-dirty",
    );
    expect(repo.fixHint).toBe("commit or discard the uncommitted changes, then re-run doctor");
    expect(run.stdout).not.toContain("watchdog.checkout-dirty");
    expect(run.stdout).not.toContain("watchdog.checkout-non-base");
  });

  test("a missing or non-GitHub origin is fail with the fix-the-remote hint", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { binding: UNRESOLVED_BINDING },
      tracker: { read: undefined },
      ci: { read: undefined },
    });
    const repo = checkOf(run.report, "repo");
    expect(repo.verdict).toBe("fail");
    expect((repo.evidence as { readonly reasons: readonly string[] }).reasons).toContain(
      "remote-unresolvable",
    );
    expect(String(repo.fixHint)).toContain("origin remote");
    expect(run.counts.tracker).toBe(0);
    expect(run.counts.ci).toBe(0);
  });

  test("unreadable checkout facts are unreachable with doctor.check.repo.unreachable", async () => {
    const run = await runDoctorCli(["doctor", "--json"], { checkout: { readable: false } });
    const repo = checkOf(run.report, "repo");
    expect(repo.verdict).toBe("unreachable");
    expect((repo.evidence as { readonly reasons: readonly string[] }).reasons).toContain(
      "checkout-unreadable",
    );
    expect(repo.fixHint).toBeDefined();
  });

  test("a detached HEAD (linked worktree shape) is ok and invents no base branch", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { branch: undefined, detached: true },
    });
    const repo = checkOf(run.report, "repo");
    expect(repo.verdict).toBe("ok");
    expect(String(repo.detail)).toContain("detached HEAD");
    expect(String(repo.detail).toLowerCase()).not.toContain("main-tools");
  });

  test("the dirty fixture restored to clean yields ok", async () => {
    const dirty = await runDoctorCli(["doctor", "--json"], { checkout: { clean: false } });
    expect(checkOf(dirty.report, "repo").verdict).toBe("fail");
    const restored = await runDoctorCli(["doctor", "--json"]);
    expect(checkOf(restored.report, "repo").verdict).toBe("ok");
  });
});
