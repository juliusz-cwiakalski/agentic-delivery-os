import type { QuotaTransportResult } from "../../../../packages/core/src/contracts/index";

export type FailOpenCase = {
  readonly id: string;
  readonly legacyId: string;
  readonly announcementCode: string;
  readonly errorCode: string;
  readonly parkCause?: string;
  readonly result: () => QuotaTransportResult;
};

const ok = (value: unknown): QuotaTransportResult => ({
  status: 200,
  bodyText: JSON.stringify(value),
});

export const FAIL_OPEN_CASES: readonly FailOpenCase[] = [
  {
    id: "transport",
    legacyId: "TC-ZAI-010",
    announcementCode: "provider.quota.unreachable",
    errorCode: "provider.outage",
    parkCause: "provider-outage",
    result: () => {
      throw new Error("transport unavailable");
    },
  },
  {
    id: "http-401",
    legacyId: "TC-ZAI-011",
    announcementCode: "provider.quota.auth_rejected",
    errorCode: "provider.auth.rejected",
    parkCause: "credential-rejected",
    result: () => ({ status: 401, bodyText: "" }),
  },
  {
    id: "http-403",
    legacyId: "TC-ZAI-012",
    announcementCode: "provider.quota.auth_rejected",
    errorCode: "provider.auth.rejected",
    parkCause: "credential-rejected",
    result: () => ({ status: 403, bodyText: "" }),
  },
  {
    id: "envelope-code",
    legacyId: "TC-ZAI-013",
    announcementCode: "provider.quota.malformed",
    errorCode: "provider.outage",
    parkCause: "provider-outage",
    result: () => ok({ code: 500, success: true, data: { limits: [] } }),
  },
  {
    id: "envelope-success",
    legacyId: "TC-ZAI-014",
    announcementCode: "provider.quota.malformed",
    errorCode: "provider.outage",
    parkCause: "provider-outage",
    result: () => ok({ code: 200, success: false, data: { limits: [] } }),
  },
  {
    id: "malformed-json",
    legacyId: "TC-ZAI-015",
    announcementCode: "provider.quota.malformed",
    errorCode: "provider.outage",
    parkCause: "provider-outage",
    result: () => ({ status: 200, bodyText: "{not json" }),
  },
  {
    id: "limits-absent",
    legacyId: "TC-ZAI-016",
    announcementCode: "provider.quota.malformed",
    errorCode: "provider.outage",
    parkCause: "provider-outage",
    result: () => ok({ code: 200, success: true, data: {} }),
  },
  {
    id: "pct-non-numeric",
    legacyId: "TC-ZAI-017",
    announcementCode: "provider.quota.malformed",
    errorCode: "provider.outage",
    parkCause: "provider-outage",
    result: () =>
      ok({
        code: 200,
        success: true,
        data: { limits: [{ type: "TOKENS_LIMIT", percentage: "100" }] },
      }),
  },
  {
    id: "reset-missing",
    legacyId: "TC-ZAI-018",
    announcementCode: "provider.quota.reset_missing",
    errorCode: "provider.quota.exceeded",
    result: () =>
      ok({
        code: 200,
        success: true,
        data: { limits: [{ type: "TOKENS_LIMIT", percentage: 100 }] },
      }),
  },
];
