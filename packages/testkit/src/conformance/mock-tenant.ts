/**
 * Declarative mock-tenant decoding and exact-URL replay (GH-189 F-4).
 *
 * Pure data validation and an injected transport. No filesystem access, no
 * ambient environment, no network, and no time or randomness live here.
 */

import type { CredentialSourceKey } from "@delivery-os/core/contracts";
import type {
  ConformanceDecodeResult,
  ConformanceTransport,
  ConformanceTransportRequest,
  MockTenant,
  MockTenantAddressing,
  MockTenantEffect,
  MockTenantRoute,
  MockTenantState,
  MockTenantStateEntry,
  MockTenantStateResource,
  MockTenantStateValue,
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
    const milestoneNumber = numberField(value, "milestoneNumber");
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
      value: {
        provider: "github",
        owner,
        repo,
        issueNumber,
        pullNumber,
        commitSha,
        threadId,
        ...(milestoneNumber === undefined ? {} : { milestoneNumber }),
      },
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

const EFFECT_KINDS: ReadonlySet<string> = new Set([
  "set-field",
  "reset-field",
  "replace-collection",
  "append-entry",
  "mark-resolved",
]);

const scalar = (value: unknown): MockTenantStateValue | undefined => {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return undefined;
};

const decodeStateEntry = (
  value: unknown,
  label: string,
): ConformanceDecodeResult<MockTenantStateEntry> => {
  if (!isRecord(value)) return { ok: false, detail: `${label} is not an object` };
  const entry: Record<string, MockTenantStateValue> = {};
  for (const [key, candidate] of Object.entries(value)) {
    const decoded = scalar(candidate);
    if (decoded === undefined) return { ok: false, detail: `${label}.${key} is not a scalar` };
    entry[key] = decoded;
  }
  return { ok: true, value: entry };
};

const decodeStateResource = (
  value: unknown,
  label: string,
): ConformanceDecodeResult<MockTenantStateResource> => {
  if (!isRecord(value)) return { ok: false, detail: `${label} is not an object` };
  if (!isRecord(value.fields)) return { ok: false, detail: `${label} has no fields object` };
  const fields: Record<string, MockTenantStateValue> = {};
  for (const [key, candidate] of Object.entries(value.fields)) {
    const decoded = scalar(candidate);
    if (decoded === undefined)
      return { ok: false, detail: `${label}.fields.${key} is not a scalar` };
    fields[key] = decoded;
  }
  const collections: Record<string, readonly MockTenantStateEntry[]> = {};
  if (value.collections !== undefined) {
    if (!isRecord(value.collections))
      return { ok: false, detail: `${label}.collections is not an object` };
    for (const [name, entries] of Object.entries(value.collections)) {
      if (!Array.isArray(entries))
        return { ok: false, detail: `${label}.collections.${name} is not an array` };
      const decoded: MockTenantStateEntry[] = [];
      for (const [index, candidate] of entries.entries()) {
        const entry = decodeStateEntry(candidate, `${label}.collections.${name}[${index}]`);
        if (!entry.ok) return entry;
        decoded.push(entry.value);
      }
      collections[name] = decoded;
    }
  }
  const subResources: Record<string, { readonly resolved: boolean }> = {};
  if (value.subResources !== undefined) {
    if (!isRecord(value.subResources))
      return { ok: false, detail: `${label}.subResources is not an object` };
    for (const [name, candidate] of Object.entries(value.subResources)) {
      if (!isRecord(candidate) || typeof candidate.resolved !== "boolean") {
        return { ok: false, detail: `${label}.subResources.${name} has no boolean resolved flag` };
      }
      subResources[name] = { resolved: candidate.resolved };
    }
  }
  return {
    ok: true,
    value: {
      fields,
      ...(Object.keys(collections).length === 0 ? {} : { collections }),
      ...(Object.keys(subResources).length === 0 ? {} : { subResources }),
    },
  };
};

const decodeState = (value: unknown): ConformanceDecodeResult<MockTenantState> => {
  if (!isRecord(value)) return { ok: false, detail: "initialState is not an object" };
  const state: Record<string, MockTenantStateResource> = {};
  for (const [name, candidate] of Object.entries(value)) {
    const decoded = decodeStateResource(candidate, `initialState.${name}`);
    if (!decoded.ok) return decoded;
    state[name] = decoded.value;
  }
  return { ok: true, value: state };
};

const decodeStringSequence = (
  value: unknown,
  label: string,
): ConformanceDecodeResult<readonly string[]> => {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    return { ok: false, detail: `${label} must be an array of strings` };
  }
  return { ok: true, value: value.filter((entry): entry is string => typeof entry === "string") };
};

const decodeEffect = (
  value: unknown,
  index: number,
  state: MockTenantState,
  sequences: Readonly<Record<string, readonly string[]>> | undefined,
): ConformanceDecodeResult<MockTenantEffect> => {
  const label = `route ${index}`;
  if (Array.isArray(value)) {
    return {
      ok: false,
      detail: `${label} declares two effects; one effect per route is the declared shape`,
    };
  }
  if (!isRecord(value)) return { ok: false, detail: `${label} effect is not an object` };
  const kind = value.kind;
  if (typeof kind !== "string" || !EFFECT_KINDS.has(kind)) {
    return { ok: false, detail: `${label} declares unknown effect ${String(kind)}` };
  }
  const resource = stringField(value, "resource");
  const target = resource === undefined ? undefined : state[resource];
  if (resource === undefined || target === undefined) {
    return {
      ok: false,
      detail: `${label} effect ${kind} names a missing resource ${String(resource)}`,
    };
  }
  if (kind === "set-field") {
    const field = stringField(value, "field");
    if (field === undefined || !(field in target.fields)) {
      return {
        ok: false,
        detail: `${label} effect set-field names a missing field ${String(field)}`,
      };
    }
    const decoded = scalar(value.value);
    if (decoded === undefined) {
      return { ok: false, detail: `${label} effect set-field has no scalar value` };
    }
    return { ok: true, value: { kind: "set-field", resource, field, value: decoded } };
  }
  if (kind === "reset-field") {
    const field = stringField(value, "field");
    if (field === undefined || !(field in target.fields)) {
      return {
        ok: false,
        detail: `${label} effect reset-field names a missing field ${String(field)}`,
      };
    }
    return { ok: true, value: { kind: "reset-field", resource, field } };
  }
  if (kind === "replace-collection") {
    const collection = stringField(value, "collection");
    if (collection === undefined || target.collections?.[collection] === undefined) {
      return {
        ok: false,
        detail: `${label} effect replace-collection names a missing collection ${String(collection)}`,
      };
    }
    if (!Array.isArray(value.entries)) {
      return { ok: false, detail: `${label} effect replace-collection has no entries array` };
    }
    const entries: MockTenantStateEntry[] = [];
    for (const [entryIndex, candidate] of value.entries.entries()) {
      const decoded = decodeStateEntry(candidate, `${label} entry ${entryIndex}`);
      if (!decoded.ok) return decoded;
      entries.push(decoded.value);
    }
    return { ok: true, value: { kind: "replace-collection", resource, collection, entries } };
  }
  if (kind === "append-entry") {
    const collection = stringField(value, "collection");
    if (collection === undefined || target.collections?.[collection] === undefined) {
      return {
        ok: false,
        detail: `${label} effect append-entry names a missing collection ${String(collection)}`,
      };
    }
    const identityField = stringField(value, "identityField");
    if (identityField === undefined) {
      return { ok: false, detail: `${label} effect append-entry has no identityField` };
    }
    const entry = decodeStateEntry(value.entry, `${label} append entry`);
    if (!entry.ok) return entry;
    const sequenceKey = `${resource}.${collection}`;
    if (sequences?.[sequenceKey] === undefined || sequences[sequenceKey].length === 0) {
      return {
        ok: false,
        detail: `${label} effect append-entry requires a declared identity sequence ${sequenceKey}`,
      };
    }
    return {
      ok: true,
      value: { kind: "append-entry", resource, collection, entry: entry.value, identityField },
    };
  }
  const subResource = stringField(value, "subResource");
  if (subResource === undefined || target.subResources?.[subResource] === undefined) {
    return {
      ok: false,
      detail: `${label} effect mark-resolved names a missing sub-resource ${String(subResource)}`,
    };
  }
  return { ok: true, value: { kind: "mark-resolved", resource, subResource } };
};

const ROUTE_METHODS: ReadonlySet<string> = new Set(["GET", "POST", "PATCH", "PUT", "DELETE"]);

const decodeRoute = (
  value: unknown,
  index: number,
  state: MockTenantState,
  sequences: Readonly<Record<string, readonly string[]>> | undefined,
): ConformanceDecodeResult<MockTenantRoute> => {
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
  const responseFromState = stringField(value, "responseFromState");
  if (responseFromState !== undefined && state[responseFromState] === undefined) {
    return { ok: false, detail: `route ${index} responseFromState names a missing resource` };
  }
  let effect: MockTenantEffect | undefined;
  if (Object.hasOwn(value, "effects")) {
    return {
      ok: false,
      detail: `route ${index} declares two effects; one effect per route is the declared shape`,
    };
  }
  if (value.effect !== undefined) {
    const decoded = decodeEffect(value.effect, index, state, sequences);
    if (!decoded.ok) return decoded;
    effect = decoded.value;
  }
  return {
    ok: true,
    value: {
      method: method as MockTenantRoute["method"],
      url,
      status,
      body: value.body,
      ...(requestBody === undefined ? {} : { requestBody }),
      ...(effect === undefined ? {} : { effect }),
      ...(responseFromState === undefined ? {} : { responseFromState }),
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

  let initialState: MockTenantState | undefined;
  if (value.initialState !== undefined) {
    const decodedState = decodeState(value.initialState);
    if (!decodedState.ok) return decodedState;
    initialState = decodedState.value;
  }
  let identitySequences: Readonly<Record<string, readonly string[]>> | undefined;
  if (value.identitySequences !== undefined) {
    if (!isRecord(value.identitySequences)) return fail("identitySequences is not an object");
    const sequences: Record<string, readonly string[]> = {};
    for (const [key, candidate] of Object.entries(value.identitySequences)) {
      const decoded = decodeStringSequence(candidate, `identitySequences.${key}`);
      if (!decoded.ok) return decoded;
      sequences[key] = decoded.value;
    }
    identitySequences = sequences;
  }
  if (!Array.isArray(value.routes) || value.routes.length === 0) {
    return fail("tenant has no routes");
  }
  const routes: MockTenantRoute[] = [];
  const seen = new Set<string>();
  for (const [index, rawRoute] of value.routes.entries()) {
    const decoded = decodeRoute(rawRoute, index, initialState ?? {}, identitySequences);
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
      ...(initialState === undefined ? {} : { initialState }),
      ...(identitySequences === undefined ? {} : { identitySequences }),
    },
  };
};

const decodeSourceKey = (value: unknown): CredentialSourceKey | undefined => {
  if (!isRecord(value)) return undefined;
  const style = value.style;
  if (style === "literal" && typeof value.name === "string") {
    return { style: "literal", name: value.name };
  }
  if (style === "environment-prefixed" && typeof value.suffix === "string") {
    return { style: "environment-prefixed", suffix: value.suffix };
  }
  if (style === "command") {
    if (typeof value.program !== "string") return undefined;
    if (!Array.isArray(value.args)) return undefined;
    const args: string[] = [];
    for (const arg of value.args) {
      if (typeof arg !== "string") return undefined;
      args.push(arg);
    }
    if (value.timeoutMs === undefined) {
      return { style: "command", program: value.program, args };
    }
    if (typeof value.timeoutMs !== "number" || !Number.isFinite(value.timeoutMs)) return undefined;
    return { style: "command", program: value.program, args, timeoutMs: value.timeoutMs };
  }
  if (
    style === "harness-store" &&
    typeof value.harness === "string" &&
    typeof value.integrationId === "string"
  ) {
    return { style: "harness-store", harness: value.harness, integrationId: value.integrationId };
  }
  return undefined;
};

/**
 * Build the exact method/URL replay transport for a decoded tenant.
 *
 * When several routes share a method and URL, a route declaring an exact
 * `requestBody` is preferred over a body-agnostic route, regardless of order.
 * A request whose body matches no candidate is rejected.
 */
export const createMockTenantTransport = (tenant: MockTenant): MockTenantTransport => {
  const requests: ConformanceTransportRequest[] = [];
  return {
    requests,
    send: async (request) => {
      requests.push(request);
      const candidates = tenant.routes.filter(
        (candidate) => candidate.method === request.method && candidate.url === request.url,
      );
      const bodySpecific = candidates.find(
        (candidate) =>
          candidate.requestBody !== undefined && candidate.requestBody === request.body,
      );
      const bodyAgnostic = candidates.find((candidate) => candidate.requestBody === undefined);
      const route = bodySpecific ?? bodyAgnostic;
      if (route === undefined) {
        throw new Error(`unfixtured provider request ${request.method} ${request.url}`);
      }
      return { status: route.status, body: route.body };
    },
  };
};
