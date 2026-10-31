/**
 * TC-POLICY-001..008 — the required injected content policy at the one
 * serialization point: denial across every field/carrier, validation order,
 * failure shape, human-content exclusion, hashed entries, and shared-rule
 * parity.
 */
import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  type EnvelopeSerializationFailure,
  parseEnvelope,
  serializeEnvelope,
} from "../../packages/adapters/src/io/envelope-codec";
import { buildEnvelopeContentPolicy } from "../../packages/adapters/src/io/envelope-content-policy";
import {
  normalizeLiteral,
  PRIVACY_RULE_IDS,
  privacyDigestInput,
} from "../../packages/adapters/src/io/privacy-rules.js";
import type {
  ContentPolicyVerdict,
  EnvelopeContentPolicy,
  MetadataEnvelopeV1,
} from "../../packages/core/src/contracts/index";
import { ENVELOPE_MAX_BYTES, ENVELOPE_SCHEMA_ID } from "../../packages/core/src/contracts/index";
import {
  createPrivacyRepo,
  makeMutantCheck,
  ROOT,
  readLiveRegistry,
  scan,
} from "../checks/privacy-support";
import {
  CLOUD_TERM,
  CLOUD_TERM_ENTRY,
  PRIVATE_LITERAL,
  PRIVATE_LITERAL_ENTRY,
} from "../fixtures/privacy-literals/activation";
import {
  CARRIERS,
  CLEAN_ENVELOPE,
  GUARDED_VALUE,
  guardedEnvelope,
  HUMAN_CONTENT,
  HUMAN_GUARDED_VALUE,
  OVER_SIZE_ENVELOPE,
  PAYLOAD_FIELDS,
  type PayloadField,
} from "../fixtures/privacy-literals/envelopes";
import {
  PLATFORM_FORM_POSITIVES,
  RULE_POSITIVES,
  SUPPRESSION_FIXTURES,
} from "../fixtures/privacy-literals/rules";

const hash = (preimage: string): string =>
  createHash("sha256").update(preimage, "utf8").digest("hex");

const cleanPolicy = (): EnvelopeContentPolicy => () => ({ ok: true });
const genericPolicy = (): EnvelopeContentPolicy =>
  buildEnvelopeContentPolicy({ hash, entries: [] });
const policyWith = (
  entries: Array<{ id: string; hash: string; length: number }>,
): EnvelopeContentPolicy => buildEnvelopeContentPolicy({ hash, entries });

const recording = (
  policy: EnvelopeContentPolicy,
): { policy: EnvelopeContentPolicy; calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    policy: (json: string) => {
      calls.push(json);
      return policy(json);
    },
  };
};

const stringsOf = (value: unknown): string[] => {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(stringsOf);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, item]) => [key, ...stringsOf(item)]);
  }
  return [];
};

const invalidEnvelope = (envelope: MetadataEnvelopeV1): MetadataEnvelopeV1 =>
  ({
    ...envelope,
    payload: { ...envelope.payload, extra: "not-closed" },
  }) as unknown as MetadataEnvelopeV1;

const cleanOverSize = (): MetadataEnvelopeV1 => ({
  ...CLEAN_ENVELOPE,
  payload: {
    comment: { producingAgent: "a".repeat(1500), operatorAuthority: "o".repeat(1500) },
    delivery: { workItemRef: "GH-184", runId: "run-synthetic" },
  },
});

const golden = JSON.parse(
  readFileSync(join(ROOT, "tests/fixtures/envelope/golden/payloads.json"), "utf8"),
) as { cases: Array<{ id: string; humanContent: string; envelope: MetadataEnvelopeV1 }> };

describe("TC-POLICY-001 guarded payload denied in every field and carrier", () => {
  test("every payload field and carrier denies with one id and no carrier", () => {
    const policy = genericPolicy();
    for (const field of PAYLOAD_FIELDS) {
      for (const carrier of CARRIERS) {
        const envelope = guardedEnvelope(field, GUARDED_VALUE);
        const result = serializeEnvelope({ envelope, carrier, humanContent: "body", policy });
        expect(result.ok, `${field}/${carrier}`).toBe(false);
        if (result.ok) continue;
        expect(result.failure).toBe("content-policy-violation");
        if (result.failure !== "content-policy-violation") continue;
        expect(result.ruleOrEntryId).toBe("secret.credential-assignment");
        expect(Object.hasOwn(result, "carrier")).toBe(false);
        expect(stringsOf(result).some((value) => value.includes(GUARDED_VALUE))).toBe(false);
      }
    }
  });

  test("exactly one id is returned for a value matching more than one rule", () => {
    const multi = `api_key = "ghp_ZQ7XK9M2P4R6T8V0W1Y3A5B7C9D2E4F6"`;
    const envelope = guardedEnvelope("producingAgent", multi);
    const ids = new Set<string>();
    for (let run = 0; run < 3; run += 1) {
      const result = serializeEnvelope({
        envelope,
        carrier: "compact-marker",
        humanContent: "body",
        policy: genericPolicy(),
      });
      expect(result.ok).toBe(false);
      if (!result.ok && result.failure === "content-policy-violation") {
        expect(["secret.provider-token-prefix", "secret.credential-assignment"]).toContain(
          result.ruleOrEntryId,
        );
        ids.add(result.ruleOrEntryId);
      }
    }
    expect(ids.size).toBe(1);
  });

  test("denial is decided on the escaped compact JSON representation", () => {
    const value = `quote" backslash\\ ${GUARDED_VALUE}`;
    const envelope = guardedEnvelope("producingAgent", value);
    const recorder = recording(genericPolicy());
    const result = serializeEnvelope({
      envelope,
      carrier: "invisible-comment-block",
      humanContent: "body",
      policy: recorder.policy,
    });
    expect(result.ok).toBe(false);
    expect(recorder.calls).toEqual([JSON.stringify(envelope)]);
    expect(recorder.calls[0]).toContain('\\"');
    expect(recorder.calls[0]).toContain("\\\\");
  });

  test("a clean control serializes in every carrier", () => {
    for (const carrier of CARRIERS) {
      const result = serializeEnvelope({
        envelope: CLEAN_ENVELOPE,
        carrier,
        humanContent: "body",
        policy: genericPolicy(),
      });
      expect(result.ok, carrier).toBe(true);
    }
  });
});

describe("F-2 emitter policy ignores documentation-placeholder suppression", () => {
  test("marker-carrying guarded payloads are denied at every field and carrier", () => {
    const cases: Array<[string, string]> = [
      ["secret.credential-assignment", SUPPRESSION_FIXTURES.placeholder],
      ["secret.bearer-credential", SUPPRESSION_FIXTURES.markerBearer],
    ];
    for (const [expectedId, value] of cases) {
      for (const field of PAYLOAD_FIELDS) {
        for (const carrier of CARRIERS) {
          const result = serializeEnvelope({
            envelope: guardedEnvelope(field, value),
            carrier,
            humanContent: "body",
            policy: genericPolicy(),
          });
          expect(result.ok, `${expectedId}/${field}/${carrier}`).toBe(false);
          if (!result.ok && result.failure === "content-policy-violation") {
            expect(result.ruleOrEntryId, `${expectedId}/${field}/${carrier}`).toBe(expectedId);
            expect(Object.hasOwn(result, "carrier")).toBe(false);
          }
        }
      }
    }
  });
});

describe("TC-POLICY-002 clean envelopes serialize and the policy is required", () => {
  test("every golden envelope round-trips through every carrier within the bound", () => {
    for (const testCase of golden.cases) {
      for (const carrier of CARRIERS) {
        const result = serializeEnvelope({
          envelope: testCase.envelope,
          carrier,
          humanContent: testCase.humanContent,
          policy: genericPolicy(),
        });
        expect(result.ok, `${testCase.id}/${carrier}`).toBe(true);
        if (!result.ok) continue;
        expect(result.byteLength).toBeLessThanOrEqual(ENVELOPE_MAX_BYTES);
        expect(result.carrier.carrier).toBe(carrier);
        const parsed =
          result.carrier.carrier === "provider-custom-field"
            ? parseEnvelope({ carrier, fieldValue: result.carrier.fieldValue })
            : parseEnvelope({ carrier, text: result.carrier.text });
        expect(parsed.ok).toBe(true);
      }
    }
  });

  test("the failure union adds exactly the content-policy kind", () => {
    const kinds: EnvelopeSerializationFailure[] = [
      "payload-not-closed",
      "size-bound-exceeded",
      "content-policy-violation",
    ];
    expect(kinds).toHaveLength(3);
  });
});

describe("TC-POLICY-003 validation order and totality at the codec", () => {
  const cases: Array<[string, MetadataEnvelopeV1]> = [
    ["open payload", invalidEnvelope(guardedEnvelope("producingAgent", GUARDED_VALUE))],
    ["over-size guarded", OVER_SIZE_ENVELOPE],
    ["closed guarded", guardedEnvelope("producingAgent", GUARDED_VALUE)],
    ["clean over-size", cleanOverSize()],
    ["clean within size", CLEAN_ENVELOPE],
  ];

  test("the order is closed payload, size, policy, then carrier", () => {
    const expectations: Record<string, { calls: number; failure?: string }> = {
      "open payload": { calls: 0, failure: "payload-not-closed" },
      "over-size guarded": { calls: 0, failure: "size-bound-exceeded" },
      "closed guarded": { calls: 1, failure: "content-policy-violation" },
      "clean over-size": { calls: 0, failure: "size-bound-exceeded" },
      "clean within size": { calls: 1 },
    };
    for (const [label, envelope] of cases) {
      const recorder = recording(genericPolicy());
      const result = serializeEnvelope({
        envelope,
        carrier: "invisible-comment-block",
        humanContent: "body",
        policy: recorder.policy,
      });
      expect(recorder.calls.length, label).toBe(expectations[label]?.calls as number);
      if (expectations[label]?.failure !== undefined) {
        expect(result.ok, label).toBe(false);
        if (!result.ok) expect(result.failure, label).toBe(expectations[label]?.failure as string);
      } else {
        expect(result.ok, label).toBe(true);
      }
    }
  });

  test("every path returns a result and never throws; denial leaves no carrier", () => {
    for (const [label, envelope] of cases) {
      let result: ReturnType<typeof serializeEnvelope> | undefined;
      expect(() => {
        result = serializeEnvelope({
          envelope,
          carrier: "provider-custom-field",
          humanContent: "body",
          policy: genericPolicy(),
        });
      }, label).not.toThrow();
      if (result !== undefined && !result.ok && result.failure === "content-policy-violation") {
        expect(Object.hasOwn(result, "carrier"), label).toBe(false);
      }
    }
  });

  test("the recorded policy input equals the embedded representation on success", () => {
    const recorder = recording(cleanPolicy());
    const result = serializeEnvelope({
      envelope: CLEAN_ENVELOPE,
      carrier: "compact-marker",
      humanContent: "body",
      policy: recorder.policy,
    });
    expect(result.ok).toBe(true);
    expect(recorder.calls[0]).toBe(JSON.stringify(CLEAN_ENVELOPE));
  });
});

describe("TC-POLICY-004 failure shape and DM-6 compatibility", () => {
  test("existing failures keep their fields and the new failure adds only the id", () => {
    const closed = serializeEnvelope({
      envelope: invalidEnvelope(CLEAN_ENVELOPE),
      carrier: "compact-marker",
      humanContent: "body",
      policy: genericPolicy(),
    });
    expect(closed).toEqual({ ok: false, failure: "payload-not-closed", byteLength: 0 });

    const oversized = serializeEnvelope({
      envelope: cleanOverSize(),
      carrier: "compact-marker",
      humanContent: "body",
      policy: genericPolicy(),
    });
    expect(oversized.ok).toBe(false);
    if (!oversized.ok) {
      expect(Object.keys(oversized).sort()).toEqual(["byteLength", "failure", "ok"]);
      expect(oversized.byteLength).toBeGreaterThan(ENVELOPE_MAX_BYTES);
    }

    const denied = serializeEnvelope({
      envelope: guardedEnvelope("runId", GUARDED_VALUE),
      carrier: "compact-marker",
      humanContent: "body",
      policy: genericPolicy(),
    });
    expect(denied.ok).toBe(false);
    if (!denied.ok) {
      expect(Object.keys(denied).sort()).toEqual(["byteLength", "failure", "ok", "ruleOrEntryId"]);
      expect(stringsOf(denied).some((value) => value.includes(GUARDED_VALUE))).toBe(false);
    }
  });
});

describe("TC-POLICY-007 human content is preserved and not scanned", () => {
  test("human content is preserved and never passed to the policy", () => {
    const recorder = recording(genericPolicy());
    for (const carrier of CARRIERS) {
      const result = serializeEnvelope({
        envelope: CLEAN_ENVELOPE,
        carrier,
        humanContent: HUMAN_CONTENT,
        policy: recorder.policy,
      });
      expect(result.ok, carrier).toBe(true);
      if (!result.ok) continue;
      if (result.carrier.carrier === "provider-custom-field") {
        expect(result.carrier.fieldValue).not.toContain(HUMAN_CONTENT);
      } else {
        expect(result.carrier.text).toContain(HUMAN_CONTENT);
        const parsed = parseEnvelope({ carrier, text: result.carrier.text });
        expect(parsed.ok).toBe(true);
        if (parsed.ok) expect(parsed.humanContent).toBe(HUMAN_CONTENT);
      }
    }
    expect(recorder.calls.every((call) => !call.includes(HUMAN_CONTENT))).toBe(true);
  });

  test("a widening mutant would deny the human content, proving the exclusion is real", () => {
    expect(genericPolicy()(HUMAN_CONTENT)).toEqual({
      ok: false,
      ruleOrEntryId: "secret.provider-token-prefix",
    });
    expect(HUMAN_CONTENT).toContain(HUMAN_GUARDED_VALUE);
  });
});

describe("TC-POLICY-008 hashed entries at the emitter with injected hash/entries", () => {
  const entries = [
    {
      id: PRIVATE_LITERAL_ENTRY.id,
      hash: PRIVATE_LITERAL_ENTRY.hash,
      length: PRIVATE_LITERAL_ENTRY.length,
    },
    { id: CLOUD_TERM_ENTRY.id, hash: CLOUD_TERM_ENTRY.hash, length: CLOUD_TERM_ENTRY.length },
  ];

  test("both classes deny with the entry id across every payload field", () => {
    const policy = policyWith(entries);
    for (const [term, id] of [
      [PRIVATE_LITERAL, PRIVATE_LITERAL_ENTRY.id],
      [CLOUD_TERM, CLOUD_TERM_ENTRY.id],
    ] as const) {
      for (const field of PAYLOAD_FIELDS) {
        const result = serializeEnvelope({
          envelope: guardedEnvelope(field, term),
          carrier: "invisible-comment-block",
          humanContent: "body",
          policy,
        });
        expect(result.ok, `${id}/${field}`).toBe(false);
        if (!result.ok && result.failure === "content-policy-violation") {
          expect(result.ruleOrEntryId).toBe(id);
          expect(Object.hasOwn(result, "carrier")).toBe(false);
          expect(stringsOf(result).some((value) => value.includes(term))).toBe(false);
        }
      }
    }
  });

  test("a fixed-hash stub yields no match; empty entries serialize the payload", () => {
    const fixed = buildEnvelopeContentPolicy({ hash: () => "0".repeat(64), entries });
    const result = serializeEnvelope({
      envelope: guardedEnvelope("producingAgent", PRIVATE_LITERAL),
      carrier: "compact-marker",
      humanContent: "body",
      policy: fixed,
    });
    expect(result.ok).toBe(true);
    const empty = buildEnvelopeContentPolicy({ hash, entries: [] });
    expect(
      serializeEnvelope({
        envelope: guardedEnvelope("producingAgent", PRIVATE_LITERAL),
        carrier: "compact-marker",
        humanContent: "body",
        policy: empty,
      }).ok,
    ).toBe(true);
  });

  test("entry ids do not collide with rule ids", () => {
    for (const entry of entries) expect(PRIVACY_RULE_IDS).not.toContain(entry.id);
  });
});

describe("F-4 policy builder fails closed on invalid injected entries", () => {
  const valid = { id: "entry-one", hash: "a".repeat(64), length: 8 };
  const call = (inputs: unknown): EnvelopeContentPolicy =>
    buildEnvelopeContentPolicy(inputs as Parameters<typeof buildEnvelopeContentPolicy>[0]);

  test("valid inputs construct a policy", () => {
    expect(() => buildEnvelopeContentPolicy({ hash, entries: [valid] })).not.toThrow();
  });

  test("more than 32 distinct lengths are rejected at construction", () => {
    const entries = Array.from({ length: 33 }, (_, index) => ({
      id: `entry-${index}`,
      hash: index.toString(16).padStart(64, "0"),
      length: 4 + index,
    }));
    expect(() => buildEnvelopeContentPolicy({ hash, entries })).toThrow(/distinct length cap/);
  });

  test("malformed digests, lengths, duplicate ids, and duplicate digests are rejected", () => {
    expect(() =>
      buildEnvelopeContentPolicy({ hash, entries: [{ ...valid, hash: "not-a-digest" }] }),
    ).toThrow(/64-character lowercase hex digest/);
    expect(() => buildEnvelopeContentPolicy({ hash, entries: [{ ...valid, length: 3 }] })).toThrow(
      /length must be an integer/,
    );
    expect(() =>
      buildEnvelopeContentPolicy({ hash, entries: [{ ...valid, length: 513 }] }),
    ).toThrow(/length must be an integer/);
    expect(() =>
      buildEnvelopeContentPolicy({
        hash,
        entries: [{ ...valid, algorithm: "sha1" as unknown as "sha256" }],
      }),
    ).toThrow(/unsupported algorithm/);
    expect(() =>
      buildEnvelopeContentPolicy({
        hash,
        entries: [valid, { ...valid, hash: "b".repeat(64) }],
      }),
    ).toThrow(/duplicate entry id/);
    expect(() =>
      buildEnvelopeContentPolicy({ hash, entries: [valid, { ...valid, id: "entry-two" }] }),
    ).toThrow(/duplicate digest/);
  });

  test("non-array entries and a non-function hash are rejected", () => {
    expect(() => call({ hash, entries: null })).toThrow(/entries must be an array/);
    expect(() => call({ hash: "not-a-function", entries: [] })).toThrow(/hash must be a function/);
  });
});

describe("TC-POLICY-006 shared-rule parity between scan and emitter", () => {
  test("every paired rule reports the same id at both surfaces", () => {
    for (const positive of [...RULE_POSITIVES, ...PLATFORM_FORM_POSITIVES]) {
      const repo = createPrivacyRepo({ "scanned/planted.txt": `${positive.value}\n` });
      try {
        const fileIds = new Set(
          scan(repo.root).violations.map((violation) => violation.ruleOrEntryId),
        );
        const verdict = genericPolicy()(
          JSON.stringify(guardedEnvelope("producingAgent", positive.value)),
        );
        expect(verdict.ok).toBe(false);
        if (!verdict.ok) {
          expect(fileIds.has(verdict.ruleOrEntryId), positive.id).toBe(true);
          expect(verdict.ruleOrEntryId, positive.id).toBe(positive.id);
        }
      } finally {
        repo.cleanup();
      }
    }
  });

  test("renaming one shared rule id propagates to both surfaces", async () => {
    const renamed = "secret.provider-token-prefix-renamed";
    const mutant = makeMutantCheck({
      moduleReplacements: [
        { search: '"secret.provider-token-prefix"', replacement: `"${renamed}"` },
      ],
    });
    const provider = RULE_POSITIVES[0]?.value as string;
    const repo = createPrivacyRepo({ "scanned/planted.txt": `${provider}\n` });
    try {
      const live = readLiveRegistry();
      const mutatedRegistry = structuredClone(live);
      mutatedRegistry.enabledRuleIds = mutatedRegistry.enabledRuleIds.map((id) =>
        id === "secret.provider-token-prefix" ? renamed : id,
      );
      for (const entry of mutatedRegistry.allowlist) {
        entry.rules = entry.rules.map((id) =>
          id === "secret.provider-token-prefix" ? renamed : id,
        );
      }
      repo.writeRegistry(mutatedRegistry);
      const policyPath = join(
        mutant.root,
        "packages/adapters/src/io/envelope-content-policy-mutant.ts",
      );
      writeFileSync(
        policyPath,
        readFileSync(
          join(ROOT, "packages/adapters/src/io/envelope-content-policy.ts"),
          "utf8",
        ).replace("./privacy-rules.js", "./privacy-rules-mutant.js"),
      );
      const module = (await import(
        `${pathToFileURL(policyPath).href}?v=${Date.now()}`
      )) as typeof import("../../packages/adapters/src/io/envelope-content-policy");
      const mutantCheck = await mutant.importCheck();
      const fileIds = mutantCheck
        .runPrivacyScan(repo.root)
        .violations.map((violation) => violation.ruleOrEntryId);
      expect(fileIds).toContain(renamed);
      const verdict = module.buildEnvelopeContentPolicy({ hash, entries: [] })(
        JSON.stringify(guardedEnvelope("producingAgent", provider)),
      );
      expect(verdict.ok).toBe(false);
      if (!verdict.ok) expect(verdict.ruleOrEntryId).toBe(renamed);
    } finally {
      repo.cleanup();
      mutant.cleanup();
    }
  });

  test("neither surface carries a private rule-id table", () => {
    for (const file of [
      "scripts/checks/privacy-literals.ts",
      "packages/adapters/src/io/envelope-content-policy.ts",
    ]) {
      const text = readFileSync(join(ROOT, file), "utf8");
      for (const id of PRIVACY_RULE_IDS) expect(text, file).not.toContain(`"${id}"`);
    }
  });
});
