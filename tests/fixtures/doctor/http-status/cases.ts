/**
 * Structured read-failure shapes for the doctor tracker/CI checks (TC-DOCTOR-031
 * step 4). One entry per response class plus the conflicting-prose and
 * absent-status shapes; classification may only read `httpStatus`.
 */
export type HttpStatusCase = {
  readonly id: string;
  readonly status: number | undefined;
  readonly prose: string;
  readonly expectedReason: "credential-rejected" | "read-failed";
};

export const HTTP_STATUS_CASES: readonly HttpStatusCase[] = [
  { id: "401", status: 401, prose: "server error", expectedReason: "credential-rejected" },
  {
    id: "403",
    status: 403,
    prose: "temporary upstream failure",
    expectedReason: "credential-rejected",
  },
  { id: "404", status: 404, prose: "unauthorized", expectedReason: "read-failed" },
  { id: "500", status: 500, prose: "unauthorized", expectedReason: "read-failed" },
  { id: "503", status: 503, prose: "bad credentials", expectedReason: "read-failed" },
  { id: "timeout", status: undefined, prose: "401 Unauthorized", expectedReason: "read-failed" },
  { id: "absent", status: undefined, prose: "401 Unauthorized", expectedReason: "read-failed" },
];

export const CREDENTIAL_REJECTION_STATUSES = [401, 403] as const;
