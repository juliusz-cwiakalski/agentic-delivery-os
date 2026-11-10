/**
 * TC-DOCTOR-027 — the success machine envelope, the success and mixed human
 * reports, and the two Appendix B summaries are pinned byte-for-byte at the
 * fixed run id, clock, and synthetic brand. A changed fact breaks equality.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { assertEnvelopeContract } from "../../packages/testkit/src/result-conformance";
import { parkRecord, parseEnvelope, READ_FAILED, runDoctorCli } from "../fixtures/doctor/harness";

const GOLDEN = join(process.cwd(), "tests/fixtures/doctor/golden");
const golden = (name: string): string => readFileSync(join(GOLDEN, name), "utf8");

describe("TC-DOCTOR-027 golden outputs", () => {
  test("the all-ok machine envelope equals the committed golden", async () => {
    const run = await runDoctorCli(["doctor", "--json"]);
    expect(run.stdout).toBe(golden("success.json"));
    const envelope = JSON.parse(run.stdout.trim()) as unknown;
    expect(assertEnvelopeContract(envelope as never)).toEqual([]);
    const data = parseEnvelope(run.stdout).data as { readonly checks: readonly unknown[] };
    expect(data.checks).toHaveLength(5);
    expect(Buffer.byteLength(JSON.stringify(data), "utf8")).toBeLessThanOrEqual(65536);
  });

  test("the all-ok human report equals the committed golden", async () => {
    const run = await runDoctorCli(["doctor"]);
    expect(run.stdout).toBe(golden("success-human.txt"));
    expect(run.stdout.trimEnd().split("\n").length).toBeLessThanOrEqual(24);
    expect(Buffer.byteLength(run.stdout, "utf8")).toBeLessThanOrEqual(4096);
  });

  test("the 1/5 provider summary equals the committed Appendix B golden", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      provider: {
        fold: {
          ok: true,
          parks: [parkRecord({ subjectName: "provider-c", cause: "credential-rejected" })],
          announcements: [],
        },
      },
    });
    const summary = (parseEnvelope(run.stdout).error as { readonly summary: string }).summary;
    expect(`${summary}\n`).toBe(golden("summary-1-of-5.txt"));
  });

  test("the 2/5 repo+tracker summary equals the committed Appendix B golden", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { clean: false },
      tracker: { read: READ_FAILED(500) },
    });
    const summary = (parseEnvelope(run.stdout).error as { readonly summary: string }).summary;
    expect(`${summary}\n`).toBe(golden("summary-2-of-5.txt"));
  });

  test("the mixed failure human report equals the committed golden", async () => {
    const run = await runDoctorCli(["doctor"], { checkout: { clean: false } });
    expect(run.stdout + run.stderr).toBe(golden("mixed-human.txt"));
    const text = golden("mixed-human.txt");
    expect(text).toContain("repo     fail");
    expect(text).toContain("hint:");
    expect(text).toContain("summary: doctor check failures (1/5)");
  });

  test("the held machine and human goldens match byte-for-byte", async () => {
    const world = {
      provider: {
        ownerHold: {
          active: true as const,
          source: "marker" as const,
          reason: "peak-hour cost pause",
        },
      },
    };
    const json = await runDoctorCli(["doctor", "--json"], world);
    expect(json.stdout).toBe(golden("owner-hold.json"));
    const human = await runDoctorCli(["doctor"], world);
    expect(human.stdout + human.stderr).toBe(golden("owner-hold-human.txt"));
  });

  test("a changed fact breaks byte equality (the golden is live)", async () => {
    const run = await runDoctorCli(["doctor", "--json"], {
      checkout: { branch: "feat/GH-224/other-branch" },
    });
    expect(run.stdout).not.toBe(golden("success.json"));
  });

  test("no secret or canary appears in any golden", () => {
    for (const name of [
      "success.json",
      "success-human.txt",
      "summary-1-of-5.txt",
      "summary-2-of-5.txt",
      "mixed-human.txt",
    ]) {
      const text = golden(name);
      expect(text).not.toContain("planted-doctor-secret-canary");
      expect(text).not.toContain("canary-github-read-token");
    }
  });
});
