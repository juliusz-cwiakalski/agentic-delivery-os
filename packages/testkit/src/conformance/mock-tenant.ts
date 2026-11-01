/**
 * Declarative mock-tenant decoding and exact-URL replay (GH-189 F-4).
 *
 * Pure data validation and an injected transport. No filesystem access, no
 * ambient environment, no network, and no time or randomness live here.
 */
import type {
  ConformanceDecodeResult,
  ConformanceTransport,
  ConformanceTransportRequest,
  MockTenant,
  MockTenantAddressing,
  MockTenantRoute,
} from "./types.js";

/** A fixture transport that records every request it receives. */
export type MockTenantTransport = ConformanceTransport & {
  readonly requests: readonly ConformanceTransportRequest[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
};

const numberField = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const fail = (detail: string): ConformanceDecodeResult<MockTenant> => ({ ok: false, detail });

const decodeAddressing = (
  provider: string,
  value: unknown,
): ConformanceDecodeResult<MockTenantAddressing> => {
  if (!isRecord(value)) return { ok: false, detail: "addressing is not an object" };
  const declaredProvider = stringField(value, "provider");
  if (declaredProvider !== provider) {
    return { ok: false, detail: "addressing provider does not match the tenant provider" };
  }
  if (provider === "github") {
    const owner = stringField(value, "owner");
    const repo = stringField(value, "repo");
    const issueNumber = numberField(value, "issueNumber");
    const pullNumber = numberField(value, "pullNumber");
    const commitSha = stringField(value, "commitSha");
    const threadId = stringField(value, "threadId");
    if (
      owner === undefined ||
      repo === undefined ||
      issueNumber === undefined ||
      pullNumber === undefined ||
      commitSha === undefined ||
      threadId === undefined
    ) {
      return { ok: false, detail: "github addressing is incomplete" };
    }
    return {
      ok: true,
      value: { provider: "github", owner, repo, issueNumber, pullNumber, commitSha, threadId },
    };
  }
  if (provider === "gitlab") {
    const projectPath = stringField(value, "projectPath");
    const mrIid = numberField(value, "mrIid");
    const commitSha = stringField(value, "commitSha");
    if (projectPath === undefined || mrIid === undefined || commitSha === undefined) {
      return { ok: false, detail: "gitlab addressing is incomplete" };
    }
    return { ok: true, value: { provider: "gitlab", projectPath, mrIid, commitSha } };
  }
  if (provider === "jira") {
    const issueKey = stringField(value, "issueKey");
    if (issueKey === undefined) return { ok: false, detail: "jira addressing is incomplete" };
    return { ok: true, value: { provider: "jira", issueKey } };
  }
  return { ok: false, detail: `unsupported provider ${provider}` };
};

const ROUTE_METHODS: ReadonlySet<string> = new Set([
  "GET",
  "POST",
  "PATCH",
  "PUT",
  "DELETE",
]);

const decodeRoute = (value: unknown, index: number): ConformanceDecodeResult<MockTenantRoute> => {
  if (!isRecord(value)) return { ok: false, detail: `route ${index} is not an object` };
  const method = value.method;
  if (typeof method !== "string" || !ROUTE_METHODS.has(method)) {
    return { ok: false, detail: `route ${index} method must be one of GET/POST/PATCH/PUT/DELETE` };
  }
  const url = stringField(value, "url");
  if (url === undefined) return { ok: false, detail: `route ${index} has no url` };
  const status = numberField(value, "status");
  if (status === undefined || status < 100 || status > 599) {
    return { ok: false, detail: `route ${index} has an invalid status` };
  }
  if (!Object.hasOwn(value, "body")) {
    return { ok: false, detail: `route ${index} has no body` };
  }
  const requestBody = stringField(value, "requestBody");
  return {
    ok: true,
    value: {
      method: method as MockTenantRoute["method"],
      url,
      status,
      body: value.body,
      ...(requestBody === undefined ? {} : { requestBody }),
    },
  };
};

/**
 * Decode untrusted tenant data into the declared model.
 *
 * Duplicate exact routes and unfixtured-shape data are rejected by name.
 */
export const decodeMockTenant = (value: unknown): ConformanceDecodeResult<MockTenant> => {
  if (!isRecord(value)) return fail("tenant is not an object");
  const provenance = stringField(value, "provenance");
  if (provenance === undefined) return fail("tenant has no provenance marker");
  const provider = stringField(value, "provider");
  if (provider === undefined) return fail("tenant has no provider");
  const adapterName = stringField(value, "adapterName");
  if (adapterName === undefined) return fail("tenant has no adapterName");
  const credentialReferenceName = stringField(value, "credentialReferenceName");
  if (credentialReferenceName === undefined) {
    return fail("tenant has no credentialReferenceName");
  }

  const instance = value.instance;
  if (!isRecord(instance)) return fail("tenant has no instance object");
  const instanceName = stringField(instance, "instanceName");
  const systemKind = stringField(instance, "systemKind");
  const baseUrl = stringField(instance, "baseUrl");
  const authMethod = instance.authMethod;
  if (
    instanceName === undefined ||
    systemKind === undefined ||
    baseUrl === undefined ||
    !isRecord(authMethod)
  ) {
    return fail("tenant instance is incomplete");
  }
  if (systemKind !== "tracker" && systemKind !== "vcs" && systemKind !== "ci") {
    return fail("tenant instance has an unknown systemKind");
  }
  const mechanism = authMethod.mechanism;
  if (mechanism !== "credential-reference" && mechanism !== "anonymous") {
    return fail("tenant instance has an unknown auth mechanism");
  }
  const reference = authMethod.reference;
  const referenceName = isRecord(reference) ? stringField(reference, "referenceName") : undefined;
  const sourceKey = isRecord(reference) ? decodeSourceKey(reference.sourceKey) : undefined;
  const decodedReference =
    mechanism === "anonymous"
      ? { mechanism: "anonymous" as const }
      : referenceName !== undefined && sourceKey !== undefined
        ? {
            mechanism: "credential-reference" as const,
            reference: { referenceName, sourceKey },
          }
        : undefined;
  if (decodedReference === undefined) return fail("tenant credential reference is incomplete");

  const decodedAddressing = decodeAddressing(provider, value.addressing);
  if (!decodedAddressing.ok) return decodedAddressing;

  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    return fail("tenant has no routes");
  }
  const routes: MockTenantRoute[] = [];
  const seen = new Set<string>();
  for (const [index, rawRoute] of value.routes.entries()) {
    const decoded = decodeRoute(rawRoute, index);
    if (!decoded.ok) return decoded;
    const key = `${decoded.value.method} ${decoded.value.url}${
      decoded.value.requestBody === undefined ? "" : ` body=${decoded.value.requestBody}`
    }`;
    if (seen.has(key)) return fail(`duplicate route ${key}`);
    seen.add(key);
    routes.push(decoded.value);
  }

  const rawExpected = value.expected;
  if (!isRecord(rawExpected) || Object.keys(rawExpected).length === 0) {
    return fail("tenant has no expected projections");
  }
  const expected: Record<string, unknown> = {};
  for (const [stepId, projection] of Object.entries(rawExpected)) {
    if (projection === undefined) return fail(`expected projection ${stepId} is undefined`);
    expected[stepId] = projection;
  }

  return {
    ok: true,
    value: {
      provenance,
      provider,
      adapterName,
      instance: { instanceName, systemKind, baseUrl, authMethod: decodedReference },
      credentialReferenceName,
      addressing: decodedAddressing.value,
      routes,
      expected,
    },
  };
};

const decodeSourceKey = (
  value: unknown,
):
  | { style: "literal"; name: string }
  | { style: "environment-prefixed"; suffix: string }
  | undefined => {
  if (!isRecord(value)) return undefined;
  const style = value.style;
  const name = value.name;
  const suffix = value.suffix;
  if (style === "literal" && typeof name === "string") return { style: "literal", name };
  if (style === "environment-prefixed" && typeof suffix === "string") {
    return { style: "environment-prefixed", suffix };
  }
  return undefined;
};

/**
 * Build the exact-URL replay transport for a decoded tenant.
 *
 * Every request is recorded; an unfixtured method or URL throws naming both.
 */
export const createMockTenantTransport = (tenant: MockTenant): MockTenantTransport => {
  const requests: ConformanceTransportRequest[] = [];
  return {
    requests,
    send: async (request) => {
      requests.push(request);
      const route = tenant.routes.find(
        (candidate) =>
          candidate.method === request.method && candidate.url === request.url,
      );
      if (route === undefined) {
        throw new Error(`unfixtured provider request ${request.method} ${request.url}`);
      }
      return { status: route.status, body: route.body };
    },
  };
};
