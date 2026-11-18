/**
 * The simulated stateful tracker double (GH-339 F-3, DM-5, API-3/API-4;
 * TDR-0038).
 *
 * A pure in-memory implementation of the existing transport seam: declared
 * initial state, the delivered route table, and one declared effect per route
 * from the closed five-effect vocabulary. No clock, randomness, environment, or
 * provider branch; a request that matches no route or an effect that cannot
 * apply fails closed by name.
 */
import type {
  ConformanceTransport,
  ConformanceTransportRequest,
  MockTenant,
  MockTenantEffect,
  MockTenantRoute,
  MockTenantState,
  MockTenantStateEntry,
  MockTenantStateResource,
} from "./types.js";

/** The closed five-effect vocabulary. */
export const STATEFUL_EFFECTS = [
  "set-field",
  "reset-field",
  "replace-collection",
  "append-entry",
  "mark-resolved",
] as const;

export type StatefulEffect = (typeof STATEFUL_EFFECTS)[number];

/** A stateful transport plus its recorded request log and canonical state. */
export type StatefulTenantTransport = ConformanceTransport & {
  readonly requests: readonly ConformanceTransportRequest[];
  readonly canonicalState: () => string;
  readonly state: () => MockTenantState;
};

export type StatefulTenantOptions = {
  readonly tenant: MockTenant;
  /** Optional override; the tenant's own `initialState` is the default. */
  readonly initialState?: MockTenantState;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonical(value[key]);
    return sorted;
  }
  return value;
};

/** Render declared state as sorted-key JSON so replay equality is structural. */
export const canonicalizeState = (state: MockTenantState): string =>
  JSON.stringify(canonical(state));

const resourceOf = (state: MockTenantState, name: string): MockTenantStateResource => {
  const resource = state[name];
  if (resource === undefined) throw new Error(`state resource ${name} is missing`);
  return resource;
};

const replaceResource = (
  state: MockTenantState,
  name: string,
  resource: MockTenantStateResource,
): MockTenantState => ({ ...state, [name]: resource });

/** Apply one declared effect; a missing operand fails rather than no-ops. */
const applyEffect = (
  state: MockTenantState,
  effect: MockTenantEffect,
  baseline: MockTenantState,
  tenant: MockTenant,
  counters: Map<string, number>,
): MockTenantState => {
  const resource = resourceOf(state, effect.resource);
  if (effect.kind === "set-field") {
    if (!(effect.field in resource.fields)) {
      throw new Error(`effect set-field field ${effect.field} is missing on ${effect.resource}`);
    }
    return replaceResource(state, effect.resource, {
      ...resource,
      fields: { ...resource.fields, [effect.field]: effect.value },
    });
  }
  if (effect.kind === "reset-field") {
    const initial = baseline[effect.resource];
    if (initial === undefined || !(effect.field in initial.fields)) {
      throw new Error(
        `effect reset-field has no declared baseline for ${effect.resource}.${effect.field}`,
      );
    }
    return replaceResource(state, effect.resource, {
      ...resource,
      fields: { ...resource.fields, [effect.field]: initial.fields[effect.field] as never },
    });
  }
  if (effect.kind === "replace-collection") {
    if (resource.collections?.[effect.collection] === undefined) {
      throw new Error(
        `effect replace-collection ${effect.collection} is missing on ${effect.resource}`,
      );
    }
    return replaceResource(state, effect.resource, {
      ...resource,
      collections: { ...resource.collections, [effect.collection]: effect.entries },
    });
  }
  if (effect.kind === "mark-resolved") {
    if (resource.subResources?.[effect.subResource] === undefined) {
      throw new Error(
        `effect mark-resolved sub-resource ${effect.subResource} is missing on ${effect.resource}`,
      );
    }
    return replaceResource(state, effect.resource, {
      ...resource,
      subResources: {
        ...resource.subResources,
        [effect.subResource]: { resolved: true },
      },
    });
  }
  const key = `${effect.resource}.${effect.collection}`;
  const sequence = tenant.identitySequences?.[key];
  const existing = resource.collections?.[effect.collection];
  if (existing === undefined) {
    throw new Error(
      `effect append-entry collection ${effect.collection} is missing on ${effect.resource}`,
    );
  }
  if (sequence === undefined || sequence.length === 0) {
    throw new Error(`effect append-entry requires a declared identity sequence ${key}`);
  }
  const index = counters.get(key) ?? 0;
  const identity = sequence[index];
  if (identity === undefined) {
    throw new Error(`effect append-entry exhausted the declared identity sequence ${key}`);
  }
  counters.set(key, index + 1);
  const entry: MockTenantStateEntry = { ...effect.entry, [effect.identityField]: identity };
  return replaceResource(state, effect.resource, {
    ...resource,
    collections: { ...resource.collections, [effect.collection]: [...existing, entry] },
  });
};

const responseBody = (route: MockTenantRoute, state: MockTenantState): unknown => {
  if (route.responseFromState === undefined) return route.body;
  const resource = resourceOf(state, route.responseFromState);
  const body: Record<string, unknown> = { ...resource.fields };
  for (const [name, entries] of Object.entries(resource.collections ?? {})) {
    body[name] = entries;
  }
  return isRecord(route.body) ? { ...route.body, ...body } : body;
};

/**
 * Build the stateful transport for one declared tenant.
 *
 * Absence of declared state means the delivered stateless replay: the same
 * exact-URL matching, the same body, and no state change.
 */
export const createStatefulTenantTransport = (
  options: StatefulTenantOptions,
): StatefulTenantTransport => {
  const baseline = clone(options.initialState ?? options.tenant.initialState ?? {});
  let current: MockTenantState = clone(baseline);
  const requests: ConformanceTransportRequest[] = [];
  const counters = new Map<string, number>();

  return {
    requests,
    state: () => current,
    canonicalState: () => canonicalizeState(current),
    send: async (request) => {
      requests.push(request);
      const candidates = options.tenant.routes.filter(
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
      if (route.effect !== undefined) {
        try {
          current = applyEffect(current, route.effect, baseline, options.tenant, counters);
        } catch (error: unknown) {
          const detail = error instanceof Error ? error.message : String(error);
          throw new Error(
            `effect ${route.effect.kind} failed for ${request.method} ${request.url}: ${detail}`,
          );
        }
      }
      return { status: route.status, body: responseBody(route, current) };
    },
  };
};
