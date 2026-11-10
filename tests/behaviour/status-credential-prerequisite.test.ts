/**
 * GH-279 status credential prerequisite (TC-STATCRED-001..004): a section whose
 * credential-dependent source failed carries the additive optional
 * `credentialPrerequisite {referenceName, sourceKey}`; the `sources[]` shape and
 * bound are unchanged; the digest stays exit 0 with nine sections.
 */
import { describe, expect, test } from "bun:test";
import type { StatusDigest, StatusSection } from "../../packages/core/src/contracts/index";
import {
  ADMISSION_CANARY,
  type AdmissionHarnessOptions,
  createAdmissionHarness,
  readableAdmissionTransport,
} from "../fixtures/dispatch/admission";

const statusOf = (observed: { readonly envelope?: { readonly data?: unknown } }): StatusDigest =>
  observed.envelope?.data as StatusDigest;

const sectionsWithPrerequisite = (digest: StatusDigest): readonly StatusSection[] =>
  digest.sections.filter((section) => section.evidence.credentialPrerequisite !== undefined);

const sectionsWithCredentialReason = (digest: StatusDigest): readonly StatusSection[] =>
  digest.sections.filter((section) => section.evidence.reasons.includes("credential-unavailable"));

const runStatus = async (options: AdmissionHarnessOptions) => {
  const harness = createAdmissionHarness({ ...options, label: options.label ?? "gh279-status-" });
  try {
    const observed = await harness.run(["status", "--json"]);
    return { observed, digest: statusOf(observed) };
  } finally {
    harness.dispose();
  }
};

describe("TC-STATCRED-001 affected sections carry credentialPrerequisite", () => {
  test("the derived set carries names only; every other section carries none", async () => {
    const { observed, digest } = await runStatus({ credential: "missing" });
    expect(observed.exit).toBe(0);
    expect(digest.schemaVersion).toBe("delivery.status.v1");
    expect(digest.sections).toHaveLength(9);

    const affected = sectionsWithCredentialReason(digest);
    expect(affected.length).toBeGreaterThan(0);
    for (const section of affected) {
      expect(section.state).toBe("unknown");
      expect(section.evidence.credentialPrerequisite).toEqual({
        referenceName: "github-read",
        sourceKey: "GITHUB_TOKEN",
      });
      for (const entry of section.evidence.sources) {
        expect(
          Object.keys(entry).every((key) =>
            ["source", "outcome", "failureCode", "failureClass"].includes(key),
          ),
        ).toBe(true);
      }
      expect(section.evidence.sources.length).toBeLessThanOrEqual(6);
    }
    for (const section of digest.sections.filter((entry) => !affected.includes(entry))) {
      expect(section.evidence.credentialPrerequisite).toBeUndefined();
    }
    expect(sectionsWithPrerequisite(digest)).toEqual(affected);
  });
});

describe("TC-STATCRED-002 observing and otherwise-unavailable sections carry no prerequisite", () => {
  test("a readable credential leaves no prerequisite", async () => {
    const { digest } = await runStatus({ credential: "resolved" });
    expect(sectionsWithPrerequisite(digest)).toEqual([]);
  });

  test("a non-credential read failure leaves no prerequisite", async () => {
    const { digest } = await runStatus({
      credential: "resolved",
      transport: {
        send: async () => ({ status: 500, body: {} }),
      },
    });
    expect(sectionsWithPrerequisite(digest)).toEqual([]);
  });
});

describe("TC-STATCRED-003 no observed section, no fabricated zero, no finding", () => {
  test("the affected sections stay unknown with no fabricated count or finding", async () => {
    const { observed, digest } = await runStatus({ credential: "missing" });
    expect(observed.exit).toBe(0);
    for (const section of sectionsWithCredentialReason(digest)) {
      expect(section.state).not.toBe("observed");
      expect(section.findings ?? []).toEqual([]);
      expect(section.counts.observed).toBe(0);
    }
    expect(digest.summary.sections).toBe(9);
  });
});

describe("TC-STATCRED-001 human output names the prerequisite on each affected section", () => {
  test("the operator learns the required key without --json", async () => {
    const harness = createAdmissionHarness({
      label: "gh279-status-human-",
      credential: "missing",
    });
    try {
      const machine = await harness.run(["status", "--json"]);
      const affected = sectionsWithCredentialReason(statusOf(machine)).length;
      expect(affected).toBeGreaterThan(0);
      const human = await harness.run(["status"]);
      const occurrences = human.stdout.split("requires GITHUB_TOKEN (github-read)").length - 1;
      expect(occurrences).toBe(affected);
      const lines = human.stdout.split("\n");
      for (const prefix of ["tracker    ", "changes    ", "ready      "]) {
        expect(lines.find((line) => line.startsWith(prefix)) ?? "").toContain(
          "requires GITHUB_TOKEN (github-read)",
        );
      }
    } finally {
      harness.dispose();
    }
  });
});

describe("TC-STATCRED-004 the prerequisite carries names only, never a value", () => {
  test("the digest and human output never contain the credential value", async () => {
    const harness = createAdmissionHarness({
      label: "gh279-status-canary-",
      credential: "missing",
      environment: { GITHUB_TOKEN: ADMISSION_CANARY },
    });
    try {
      const machine = await harness.run(["status", "--json"]);
      const human = await harness.run(["status"]);
      expect(machine.stdout + machine.stderr).not.toContain(ADMISSION_CANARY);
      expect(human.stdout + human.stderr).not.toContain(ADMISSION_CANARY);
    } finally {
      harness.dispose();
    }
  });
});

describe("the status prerequisite is derived from the digest, not a fixed list", () => {
  test("the helper covers every section whose reason is credential-unavailable", async () => {
    const { digest } = await runStatus({ credential: "missing" });
    const derived = sectionsWithCredentialReason(digest).map((section) => section.id);
    expect(derived).toEqual(sectionsWithPrerequisite(digest).map((section) => section.id));
    expect(readableAdmissionTransport).toBeDefined();
  });
});
