/**
 * TC-STATUS-019 — parked work from the git-ignored PM context: observed,
 * observed-empty, absent, malformed/wrong-shape, item-level unknown, optional
 * age, no notes projection, caps/ordering, and read-only access.
 *
 * The lanes/providers cases of this file land in Phase 5.
 */
import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nodeFileSystemFacts, readLocalPmContext } from "../../packages/adapters/src/file/index";
import { aggregateStatus } from "../../packages/core/src/domain/index";
import { baseFacts, sectionById } from "../fixtures/status/harness";

const fs = nodeFileSystemFacts();

const withContext = (text: string): { readonly root: string; readonly path: string } => {
  const root = mkdtempSync(join(tmpdir(), "status-pm-context-"));
  const path = join(root, "pm-context.yaml");
  writeFileSync(path, text);
  return { root, path };
};

const readContext = (text: string) => {
  const temp = withContext(text);
  return {
    ...temp,
    read: readLocalPmContext({ path: temp.path, fs }),
    cleanup: () => rmSync(temp.root, { recursive: true, force: true }),
  };
};

const digestFor = (text: string) => {
  const context = readContext(text);
  const digest = aggregateStatus(baseFacts({ localContext: context.read }));
  return { digest, context, section: sectionById(digest.sections, "parked-work") };
};

const BASE =
  "active_change:\n  workItemRef: GH-175\n  branch: feat/GH-175/status-v1\n  change_folder: doc/changes/x\n";

describe("TC-STATUS-019 parked work from the local PM context", () => {
  test("an absent file is unavailable with local-context-missing", () => {
    const parsed = readLocalPmContext({ path: "/nonexistent/pm-context.yaml", fs });
    expect(parsed).toEqual({ ok: false, reason: "missing", path: "/nonexistent/pm-context.yaml" });
    const digest = aggregateStatus(baseFacts({ localContext: parsed }));
    const section = sectionById(digest.sections, "parked-work");
    expect(section.state).toBe("unavailable");
    expect(section.evidence.reasons).toContain("local-context-missing");
    expect(section.items).toEqual([]);
  });

  test("an explicit empty array is observed-empty with the git-ignored marker", () => {
    const { section, context } = digestFor(`${BASE}\nparked_changes: []\n`);
    try {
      expect(section.state).toBe("observed");
      expect(section.evidence.reasons).toContain("observed-empty");
      expect(section.source).toEqual({
        kind: "local-pm-context",
        path: context.path,
        tracked: false,
        gitIgnored: true,
      });
      expect(section.items).toEqual([]);
    } finally {
      context.cleanup();
    }
  });

  test("observed entries project only the declared fields and derive age", () => {
    const { section, context } = digestFor(
      `${BASE}\nparked_changes:\n  - workItemRef: GH-200\n    branch: feat/GH-200/parked\n    change_folder: doc/changes/2026-10/GH-200\n    reason: waiting-on-owner\n    parkedAt: 2026-10-21T00:00:00Z\n    notes: planted-status-notes-canary\n`,
    );
    try {
      expect(section.state).toBe("observed");
      expect(section.items).toHaveLength(1);
      const item = section.items?.[0];
      expect(item).toMatchObject({
        workItemRef: "GH-200",
        branch: "feat/GH-200/parked",
        changeFolder: "doc/changes/2026-10/GH-200",
        reason: "waiting-on-owner",
        itemState: "observed",
      });
      expect(item?.ageDays).toBe(10);
      expect(JSON.stringify(section)).not.toContain("planted-status-notes-canary");
    } finally {
      context.cleanup();
    }
  });

  test("an entry without workItemRef is item-level unknown", () => {
    const { section, context } = digestFor(
      `${BASE}\nparked_changes:\n  - branch: feat/GH-201/parked\n    reason: waiting\n`,
    );
    try {
      expect(section.state).toBe("observed");
      expect(section.items?.[0]?.itemState).toBe("unknown");
      expect(section.counts.unknown).toBe(1);
      expect(section.evidence.reasons).toContain("item-signal-absent");
    } finally {
      context.cleanup();
    }
  });

  test("malformed YAML and a non-array parked_changes are unknown", () => {
    const malformed = digestFor("active_change: [unclosed\n");
    try {
      expect(malformed.section.state).toBe("unknown");
      expect(malformed.section.evidence.reasons).toContain("local-context-malformed");
    } finally {
      malformed.context.cleanup();
    }
    const wrongShape = digestFor(`${BASE}\nparked_changes:\n  workItemRef: GH-1\n`);
    try {
      expect(wrongShape.section.state).toBe("unknown");
      expect(wrongShape.section.evidence.reasons).toContain("local-context-malformed");
    } finally {
      wrongShape.context.cleanup();
    }
  });

  test("an invalid parkedAt yields no age and never fabricates one", () => {
    const { section, context } = digestFor(
      `${BASE}\nparked_changes:\n  - workItemRef: GH-202\n    parkedAt: not-a-date\n`,
    );
    try {
      expect(section.items?.[0]?.parkedAt).toBe("not-a-date");
      expect(section.items?.[0]?.ageDays).toBeUndefined();
    } finally {
      context.cleanup();
    }
  });

  test("caps at eight and orders oldest parkedAt first", () => {
    const entries = Array.from({ length: 9 }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return `  - workItemRef: GH-${300 + index}\n    parkedAt: 2026-09-${day}T00:00:00Z\n`;
    }).join("");
    const { section, context } = digestFor(`${BASE}\nparked_changes:\n${entries}`);
    try {
      expect(section.items).toHaveLength(8);
      expect(section.counts.omitted).toBe(1);
      expect(section.truncated).toBe(true);
      expect(section.items?.[0]?.workItemRef).toBe("GH-300");
      expect(section.items?.[7]?.workItemRef).toBe("GH-307");
    } finally {
      context.cleanup();
    }
  });

  test("reading and aggregating never writes the PM context", () => {
    const context = readContext(`${BASE}\nparked_changes: []\n`);
    try {
      const beforeBytes = readFileSync(context.path, "utf8");
      const beforeMtime = statSync(context.path).mtimeMs;
      const read = readLocalPmContext({ path: context.path, fs });
      aggregateStatus(baseFacts({ localContext: read }));
      expect(readFileSync(context.path, "utf8")).toBe(beforeBytes);
      expect(statSync(context.path).mtimeMs).toBe(beforeMtime);
    } finally {
      context.cleanup();
    }
  });
});

// --- Phase 5: lanes and providers -----------------------------------------

import { aggregateStatus } from "../../packages/core/src/domain/index";
import {
  createParkRecord,
  persistProviderResolution,
  readProviderParkViews,
} from "../../packages/core/src/provider/index";
import { makeIdentity, makeTempRoot, openStore, removeRoot } from "../fixtures/state/harness";
import {
  baseFacts,
  parkView,
  providerConfig,
  providerConfigRead,
  providers,
  sectionById,
} from "../fixtures/status/harness";

const section = (facts: Parameters<typeof aggregateStatus>[0], id: string) =>
  sectionById(aggregateStatus(facts).sections, id);

const providerFacts = (overrides: {
  readonly chain?: string;
  readonly entries?: readonly string[];
  readonly parks?: Parameters<typeof providers>[0]["parks"];
  readonly config?: Parameters<typeof providers>[0]["config"];
}) => {
  const names = overrides.entries ?? ["primary"];
  return providers({
    config:
      overrides.config ??
      providerConfigRead(
        providerConfig({
          defaultChain: overrides.chain ?? "primary",
          entries: Object.fromEntries(
            names.map((name) => [name, { name, class: "subscription", enabled: true }]),
          ),
          chains: {
            primary: { name: "primary", entries: [...names], allowPaidFallback: false },
          },
        }),
      ),
    ...(overrides.parks === undefined ? {} : { parks: overrides.parks }),
  });
};

describe("TC-STATUS-016 lanes-or-queue is always a declared gap", () => {
  test("every input yields not-delivered with zero items and no queue read", () => {
    const fixtures = [
      baseFacts(),
      baseFacts({ providers: providers({ config: { ok: false, reason: "config-invalid" } }) }),
      baseFacts({ localContext: { ok: false, reason: "missing", path: "/absent" } }),
    ];
    for (const facts of fixtures) {
      const lanes = section(facts, "lanes-or-queue");
      expect(lanes.state).toBe("not-delivered");
      expect(lanes.capability).toBe("queue-lane-engine");
      expect(lanes.expectedStory).toBe("M2-S1");
      expect(lanes.items).toEqual([]);
      expect(lanes.counts).toEqual({ observed: 0, unknown: 0, total: 0, omitted: 0 });
      expect(lanes.evidence.reasons).toEqual(["engine-not-delivered"]);
      expect(lanes.note).toContain("no queue or lane engine");
      expect(lanes.state).not.toBe("observed");
    }
  });
});

describe("TC-STATUS-017 providers from config and the verified park fold", () => {
  test("declared entries are unverified, never available", () => {
    const providersSection = section(
      baseFacts({ providers: providerFacts({ entries: ["primary", "secondary"] }) }),
      "providers",
    );
    expect(providersSection.state).toBe("observed");
    expect(providersSection.chain).toMatchObject({ state: "declared", name: "primary" });
    for (const entry of providersSection.entries ?? []) {
      expect(entry.availability).toBe("unverified");
      expect(JSON.stringify(entry)).not.toContain('"available"');
    }
  });

  test("an active provider park marks the entry parked", () => {
    const providersSection = section(
      baseFacts({
        providers: providerFacts({
          entries: ["primary", "secondary"],
          parks: { ok: true, parks: [parkView({ subjectName: "primary" })] },
        }),
      }),
      "providers",
    );
    expect(providersSection.state).toBe("observed");
    expect(providersSection.entries?.find((entry) => entry.name === "primary")?.availability).toBe(
      "parked",
    );
    expect(
      providersSection.entries?.find((entry) => entry.name === "secondary")?.availability,
    ).toBe("unverified");
  });

  test("a chain park marks the chain parked", () => {
    const providersSection = section(
      baseFacts({
        providers: providerFacts({
          parks: {
            ok: true,
            parks: [
              parkView({
                name: "chain:primary",
                subjectKind: "chain",
                subjectName: "primary",
              }),
            ],
          },
        }),
      }),
      "providers",
    );
    expect(providersSection.chain).toMatchObject({ state: "parked", name: "primary" });
  });

  test("no default chain is unavailable, never an empty observed chain", () => {
    const providersSection = section(
      baseFacts({
        providers: providers({
          config: providerConfigRead(
            providerConfig({ defaultChain: undefined, chains: {}, entries: {} }),
          ),
        }),
      }),
      "providers",
    );
    expect(providersSection.state).toBe("unavailable");
    expect(providersSection.evidence.reasons).toContain("provider-chain-not-declared");
    expect(providersSection.entries).toEqual([]);
    expect(providersSection.parks).toEqual([]);
    expect(JSON.stringify(providersSection)).not.toContain('"available"');
  });

  test("an unresolved chain is unknown with the pinned identity and no failureClass", () => {
    const providersSection = section(
      baseFacts({
        providers: providers({
          config: {
            ok: false,
            reason: "provider-chain-unresolved",
            failureCode: "config.value.invalid",
          },
        }),
      }),
      "providers",
    );
    expect(providersSection.state).toBe("unknown");
    expect(providersSection.evidence.reasons).toContain("provider-chain-unresolved");
    const source = providersSection.evidence.sources[0];
    expect(source).toMatchObject({
      source: "provider-config",
      failureCode: "config.value.invalid",
    });
    expect(source?.failureClass).toBeUndefined();
    expect(JSON.stringify(providersSection)).not.toContain("provider.chain.invalid");
  });

  test("a config-resolution failure is unknown with config-invalid and the config code", () => {
    const providersSection = section(
      baseFacts({
        providers: providers({
          config: { ok: false, reason: "config-invalid", failureCode: "config.value.invalid" },
        }),
      }),
      "providers",
    );
    expect(providersSection.state).toBe("unknown");
    expect(providersSection.evidence.reasons).toContain("config-invalid");
    expect(providersSection.evidence.sources[0]).toMatchObject({
      failureCode: "config.value.invalid",
    });
    expect(providersSection.evidence.sources[0]?.failureClass).toBeUndefined();
  });

  test("a park-fold failure degrades the section without claiming no parks", () => {
    const providersSection = section(
      baseFacts({
        providers: providerFacts({
          parks: { ok: false, reason: "state-unreadable", failureCode: "state.store.torn" },
        }),
      }),
      "providers",
    );
    expect(providersSection.state).toBe("degraded");
    expect(providersSection.evidence.reasons).toContain("state-unreadable");
    expect(providersSection.evidence.reasons).toContain("partial-evidence");
    expect(providersSection.parks).toEqual([]);
    expect(JSON.stringify(providersSection)).not.toContain("no parks");
  });

  test("expiry is read-time: T-1 active, T expired, T+1 active only at T+1", () => {
    const now = Date.parse("2026-10-31T00:00:00Z");
    const root = makeTempRoot("gh175-parks");
    try {
      const { store } = openStore(makeIdentity(root));
      const park = (name: string, expiresAtMs: number) =>
        createParkRecord({
          subjectKind: "provider",
          subjectName: name,
          cause: "quota-exhausted",
          conditions: ["quota-exhausted"],
          createdAtMs: now - 1000,
          expiresAtMs,
          evidence: {},
        });
      const persisted = persistProviderResolution({
        store,
        fenceToken: "gh175-provider-park",
        nowMs: now,
        parks: [park("before", now - 1), park("at", now), park("after", now + 1)],
        announcements: [],
      });
      expect(persisted.ok).toBe(true);
      const views = readProviderParkViews(store, now);
      expect(views.ok).toBe(true);
      if (views.ok) {
        expect(views.value.map((view) => [view.subjectName, view.state])).toEqual([
          ["after", "active"],
        ]);
      }
    } finally {
      removeRoot(root);
    }
  });

  test("provider entries and parks are capped at eight", () => {
    const names = Array.from({ length: 9 }, (_, index) => `p${index}`);
    const parks = Array.from({ length: 9 }, (_, index) =>
      parkView({
        name: `provider:p${index}`,
        subjectName: `p${index}`,
        expiresAt: `2026-11-0${(index % 9) + 1}T00:00:00Z`,
      }),
    );
    const providersSection = section(
      baseFacts({ providers: providerFacts({ entries: names, parks: { ok: true, parks } }) }),
      "providers",
    );
    expect(providersSection.entries).toHaveLength(8);
    expect(providersSection.parks).toHaveLength(8);
    expect(providersSection.counts.omitted).toBe(2);
  });
});

describe("TC-STATUS-018 providers never run the engine or quota", () => {
  test("the status command and domain reference no engine/quota call", () => {
    const files = ["packages/core/src/domain/status.ts", "packages/cli/src/commands/status.ts"];
    for (const file of files) {
      const text = readFileSync(join(process.cwd(), file), "utf8");
      expect(text).not.toContain("createProviderEngine");
      expect(text).not.toContain("quota(");
      expect(text).not.toContain("provider.resolve");
    }
  });
});
