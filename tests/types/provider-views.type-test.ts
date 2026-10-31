/**
 * TC-SURFACE-001 type probe — each client's declared read return is the
 * primitive view, not a provider type narrowed by assertion (ADR-0004 C-3).
 *
 * Not named `*.test.ts`, so Bun test discovery ignores it;
 * `tests/types/tsconfig.json` compiles it through the root `typecheck` script.
 */
import type { GithubClient } from "../../packages/adapters/src/github/client";
import type { GitLabClient } from "../../packages/adapters/src/gitlab/client";
import type { JiraClient } from "../../packages/adapters/src/jira/client";
import type {
  DeliveryRequest,
  PipelineRun,
  WorkItem,
} from "../../packages/core/src/contracts/ports";

type ReadValue<R> = R extends { readonly ok: true; readonly value: infer Value } ? Value : never;

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type Expect<T extends true> = T;

type JiraWorkItem = Expect<
  Equal<ReadValue<Awaited<ReturnType<JiraClient["readWorkItem"]>>>, WorkItem>
>;
type GitlabDeliveryRequest = Expect<
  Equal<ReadValue<Awaited<ReturnType<GitLabClient["readDeliveryRequest"]>>>, DeliveryRequest>
>;
type GitlabPipelines = Expect<
  Equal<ReadValue<Awaited<ReturnType<GitLabClient["readPipelineRun"]>>>, readonly PipelineRun[]>
>;
type GithubDeliveryRequest = Expect<
  Equal<ReadValue<Awaited<ReturnType<GithubClient["readDeliveryRequest"]>>>, DeliveryRequest>
>;
type GithubPipelines = Expect<
  Equal<
    ReadValue<Awaited<ReturnType<GithubClient["readPipelineRun"]>>>,
    { readonly items: readonly PipelineRun[]; readonly pageItemCount: number }
  >
>;
type GithubWorkItemList = Expect<
  Equal<
    ReadValue<Awaited<ReturnType<GithubClient["listWorkItems"]>>>,
    { readonly items: readonly WorkItem[]; readonly pageItemCount: number }
  >
>;
type GithubWorkItem = Expect<
  Equal<ReadValue<Awaited<ReturnType<GithubClient["readWorkItem"]>>>, WorkItem>
>;

export type Probes = [
  JiraWorkItem,
  GitlabDeliveryRequest,
  GitlabPipelines,
  GithubDeliveryRequest,
  GithubPipelines,
  GithubWorkItem,
  GithubWorkItemList,
];
