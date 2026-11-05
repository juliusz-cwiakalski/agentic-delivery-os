/**
 * Committed mutant catalog (TC-BRIEF-021).
 *
 * Each mutant names the AC it challenges and produces exactly one prohibited
 * observable from a clean payload. The meta-check proves the production payload
 * does not carry the observable and that the mutant does, naming the case.
 */
import type { BriefPayload } from "../../../packages/core/src/contracts/index";

export type BriefMutant = {
  readonly id: string;
  readonly caseName: string;
  readonly ac: string;
  readonly apply: (brief: BriefPayload) => unknown;
  readonly detect: (value: unknown) => boolean;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const textOf = (value: unknown): string =>
  typeof value === "string" ? value : JSON.stringify(value);

const clone = (brief: BriefPayload): Record<string, unknown> =>
  JSON.parse(JSON.stringify(brief)) as Record<string, unknown>;

const isArray = (value: unknown): unknown[] | undefined =>
  Array.isArray(value) ? (value as unknown[]) : undefined;

const arrayField = (record: Record<string, unknown>, field: string): unknown[] | undefined =>
  isArray(record[field]);

const tokenMutant = (id: string, caseName: string, ac: string, token: string): BriefMutant => ({
  id,
  caseName,
  ac,
  apply: () => `prohibited observable: ${token}`,
  detect: (value) => textOf(value).includes(token),
});

export const briefMutants: readonly BriefMutant[] = [
  {
    id: "fabricated-surface-state",
    caseName: "brief-mutant-fabricated-surface-state",
    ac: "AC-F1-1",
    apply: (brief) => {
      const record = clone(brief);
      const surfaces = arrayField(record, "surfaces") ?? [];
      surfaces.push({ id: "tenth-surface", state: "observed" });
      record.surfaces = surfaces;
      return record;
    },
    detect: (value) => {
      const record = asRecord(value);
      if (record === undefined) return false;
      return (arrayField(record, "surfaces") ?? []).length !== 9;
    },
  },
  {
    id: "brief-only-fact",
    caseName: "brief-mutant-brief-only-fact",
    ac: "AC-F1-1",
    apply: (brief) => ({ ...clone(brief), briefOnly: true }),
    detect: (value) => {
      const record = asRecord(value);
      return record !== undefined && Object.hasOwn(record, "briefOnly");
    },
  },
  {
    id: "count-drift",
    caseName: "brief-mutant-count-drift",
    ac: "AC-F4-1",
    apply: (brief) => ({ ...clone(brief), countDrift: true }),
    detect: (value) => {
      const record = asRecord(value);
      return record !== undefined && Object.hasOwn(record, "countDrift");
    },
  },
  {
    id: "unknown-as-zero-age",
    caseName: "brief-mutant-unknown-as-zero-age",
    ac: "AC-F2-2",
    apply: (brief) => {
      const record = clone(brief);
      const anchors = arrayField(record, "anchors") ?? [];
      for (const anchor of anchors) {
        const anchorRecord = asRecord(anchor);
        if (anchorRecord?.group !== "owner-gate-ages") continue;
        const items = arrayField(anchorRecord, "items") ?? [];
        items[0] = {
          identity: "GH-000",
          state: "observed",
          evidence: { kind: "owner-hand-back", ageState: "observed", ageDays: 0 },
        };
        anchorRecord.items = items;
      }
      record.anchors = anchors;
      return record;
    },
    detect: (value) => {
      const record = asRecord(value);
      if (record === undefined) return false;
      for (const anchor of arrayField(record, "anchors") ?? []) {
        const anchorRecord = asRecord(anchor);
        if (anchorRecord?.group !== "owner-gate-ages") continue;
        for (const item of arrayField(anchorRecord, "items") ?? []) {
          const itemRecord = asRecord(item);
          const evidence = itemRecord === undefined ? undefined : asRecord(itemRecord.evidence);
          if (evidence?.ageDays === 0) return true;
        }
      }
      return false;
    },
  },
  {
    id: "ready-from-unknown-review",
    caseName: "brief-mutant-ready-from-unknown-review",
    ac: "AC-F2-1",
    apply: (brief) => {
      const record = clone(brief);
      const anchors = arrayField(record, "anchors") ?? [];
      for (const anchor of anchors) {
        const anchorRecord = asRecord(anchor);
        if (anchorRecord?.group !== "ready-to-merge") continue;
        anchorRecord.items = [
          {
            identity: "GH-999",
            state: "degraded",
            evidence: {
              kind: "pull-request",
              deliveryState: "approved",
              draft: false,
              reviewState: "unknown",
            },
          },
        ];
      }
      record.anchors = anchors;
      return record;
    },
    detect: (value) => {
      const record = asRecord(value);
      if (record === undefined) return false;
      for (const anchor of arrayField(record, "anchors") ?? []) {
        const anchorRecord = asRecord(anchor);
        if (anchorRecord?.group !== "ready-to-merge") continue;
        for (const item of arrayField(anchorRecord, "items") ?? []) {
          const evidence = asRecord(asRecord(item)?.evidence);
          if (evidence?.reviewState !== "observed") return true;
        }
      }
      return false;
    },
  },
  {
    id: "ready-from-cap-omitted-item",
    caseName: "brief-mutant-ready-from-cap-omitted-item",
    ac: "AC-F2-1",
    apply: (brief) => {
      const record = clone(brief);
      const anchors = arrayField(record, "anchors") ?? [];
      for (const anchor of anchors) {
        const anchorRecord = asRecord(anchor);
        if (anchorRecord?.group !== "ready-to-merge") continue;
        anchorRecord.items = [
          {
            identity: "GH-999",
            state: "observed",
            evidence: {
              kind: "pull-request",
              deliveryState: "approved",
              draft: false,
              reviewState: "observed",
            },
          },
        ];
      }
      record.anchors = anchors;
      return record;
    },
    detect: (value) => {
      const record = asRecord(value);
      if (record === undefined) return false;
      for (const anchor of arrayField(record, "anchors") ?? []) {
        const anchorRecord = asRecord(anchor);
        if (anchorRecord?.group !== "ready-to-merge") continue;
        for (const item of arrayField(anchorRecord, "items") ?? []) {
          if (asRecord(item)?.identity === "GH-999") return true;
        }
      }
      return false;
    },
  },
  {
    id: "placeholder-as-observed",
    caseName: "brief-mutant-placeholder-as-observed",
    ac: "AC-F3-1",
    apply: (brief) => {
      const record = clone(brief);
      const placeholders = arrayField(record, "placeholders") ?? [];
      const first = asRecord(placeholders[0]);
      if (first !== undefined) placeholders[0] = { ...first, state: "observed" };
      record.placeholders = placeholders;
      return record;
    },
    detect: (value) => {
      const record = asRecord(value);
      if (record === undefined) return false;
      return (arrayField(record, "placeholders") ?? []).some(
        (entry) => asRecord(entry)?.state !== "not-delivered",
      );
    },
  },
  {
    id: "fourth-catalog-entry",
    caseName: "brief-mutant-fourth-catalog-entry",
    ac: "AC-F3-1",
    apply: (brief) => {
      const record = clone(brief);
      const placeholders = arrayField(record, "placeholders") ?? [];
      placeholders.push({ capability: "spend", owningStory: "M1-S19", state: "not-delivered" });
      record.placeholders = placeholders;
      return record;
    },
    detect: (value) => {
      const record = asRecord(value);
      return record !== undefined && (arrayField(record, "placeholders") ?? []).length !== 3;
    },
  },
  tokenMutant(
    "status-collector-identity",
    "brief-mutant-status-collector-identity",
    "AC-F5-1",
    "status.collector.github.unavailable",
  ),
  {
    id: "exit-one-on-unavailability",
    caseName: "brief-mutant-exit-one-on-unavailability",
    ac: "AC-F5-1",
    apply: (brief) => ({ ...clone(brief), exitCode: 1 }),
    detect: (value) => asRecord(value)?.exitCode === 1,
  },
  tokenMutant("sla-state-fabrication", "brief-mutant-sla-state-fabrication", "AC-F2-2", "slaState"),
  tokenMutant("date-now-renderer", "brief-mutant-date-now-renderer", "AC-F6-1", "Date.now"),
  {
    id: "unbounded-renderer",
    caseName: "brief-mutant-unbounded-renderer",
    ac: "AC-F1-2",
    apply: () => Array.from({ length: 30 }, (_, index) => `line ${index}`).join("\n"),
    detect: (value) =>
      typeof value === "string" && value.split("\n").filter((line) => line.length > 0).length > 24,
  },
  tokenMutant(
    "canary-leaking-projection",
    "brief-mutant-canary-leaking-projection",
    "AC-F6-3",
    "planted-fake-brief-canary",
  ),
  tokenMutant("model-import", "brief-mutant-model-import", "AC-F6-2", 'import "openai"'),
  tokenMutant("network-import", "brief-mutant-network-import", "AC-F6-2", 'import "node:http"'),
  tokenMutant("store-write", "brief-mutant-store-write", "AC-F6-3", "replaceDocument"),
  tokenMutant("spawned-child", "brief-mutant-spawned-child", "AC-F6-3", "node:child_process"),
  tokenMutant("product-literal", "brief-mutant-product-literal", "AC-F1-1", "ados"),
];
