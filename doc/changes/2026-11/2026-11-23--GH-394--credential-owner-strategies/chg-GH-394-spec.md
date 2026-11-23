---
change:
  ref: GH-394
  type: feat
  status: Proposed
  slug: credential-owner-strategies
  title: "M4-S28: Credential strategies — resolve from the credential's owner (gh CLI, harness store), never a copied env (M4)"
  owners: ["Juliusz Ćwiąkalski"]
  service: "credential port and one-shot CLI credential provisioning (strategy vocabulary, store-ownership resolution)"
  milestone: "M4: Jaiship-native delivery"
  labels:
    - change
    - m4
    - credentials
    - security
    - cli
    - config
  version_impact: minor
  audience: internal
  security_impact: high
  risk_level: medium
  dependencies:
    internal:
      - "delivered credential port: one resolve operation, one success and one failure variant, the failure variant bound to the single config.credential.missing error-table row by a drift test (ADR-0007)"
      - "delivered secret-read boundary invariant: exactly one credential-material directory, no ambient environment reads outside its allowlist entry"
      - "delivered entrypoint redaction chokepoint (today a static secrets snapshot; becomes a live registry) and the three edge-composed command registration sites"
      - "delivered dispatch admission preflight posture and its one-second budget (TDR-0019)"
      - "delivered provider park vocabulary: credential-missing condition, provider.credential.missing announcement, credential park TTL (ADR-0007; event taxonomy TDR-0025/0029/0030)"
      - "delivered harness adapter contract capability/gap posture (ADR-0008)"
      - "delivered daemon environment and re-entry posture (TDR-0023); the supervise-only daemon composition with no credential consumer"
      - "delivered CLI exit taxonomy {0,1,2} (TDR-0005) and the config-summary suppression rule"
      - "governing record: ADR-0014 (credential strategies — store ownership behind an unchanged port), landing with this change as status Proposed"
    external:
      - "GitHub CLI (gh) non-interactive auth token surface; the token is held in the OS keyring"
      - "OpenCode CLI auth export surface (JSON array of store entries; integration-id target selector; optional --standalone; session-scoped background service)"
      - "OS keyring / secret-service availability on the operator host"
---

# CHANGE SPECIFICATION

> **PURPOSE**: Let a one-shot CLI command resolve a declared credential from the store of whoever owns it — the tracker token from the tracker CLI's own authenticated store, a provider key from the harness's own store — through a closed four-style vocabulary behind the unchanged credential port, with a closed execution allowlist, a live redaction registry, and a classified, remedied failure on every refusal, so the operator stops maintaining a second copy of every secret and never copies one again (story M4-S28; governed by ADR-0014, Proposed).

## 1. SUMMARY

Today the credential port admits exactly two source styles, both environment-backed, and the tracker credential reference is a hard-coded literal: an operator who authenticates once with `gh` or signs in to a harness must still hand-copy every secret into an environment file the product consumes, repair that copy when it drifts, and debug failures that name a variable instead of the owner whose store actually changed. This change adds two opt-in source styles — `command` (a shipped, closed allowlist of pinned owner-CLI subcommands: the tracker CLI's token read and the harness CLI's credential export) and `harness-store` (the harness's own export surface, selected by declared integration id) — behind a port whose operation and result union do not change: one success variant, one failure variant that gains three additive optional fields (`source`, `reason`, `remedy`) over the delivered single code. The shipped consumer is the one-shot CLI composition (`dispatch`, `merge`, `status`, `commit`, `verify`, `queue`), which resolves on demand, synchronously, once per reference per process. Resolution registers obtained material into a live redaction registry at the moment of materialization — before any emit path can carry it — executes each allowlisted child with closed stdin, bounded stdout, a reduced environment and a per-execution cap, classifies every failure with a closed ten-member reason set and a fixed `(reason, style)`-keyed remedy, and never falls back, never hangs, never returns empty material. Harness-owned OAuth grants are excluded outright: the product never consumes, refreshes, or writes back one. The resident daemon ships no credential consumer and gains no benefit in this change; the resident composition is specified forward for #395 only.

## 2. CONTEXT

### 2.1 Current State Snapshot

- **The port is narrow, synchronous, and stable.** One operation (`resolve(reference)`), exactly two declared source styles — `literal` (a named environment variable) and `environment-prefixed` (brand prefix plus suffix) — one success variant, and one failure variant reified from a single error-table row whose only code is `config.credential.missing`. The failure variant is bound to that row by a drift test. Consumers resolve synchronously on the request path: the three tracker clients per request, the inference transport per generation, the quota reader and provider engine per availability decision, and the harness spawn-environment builder per spawn.
- **The failure code is consumed everywhere.** `config.credential.missing` is constructed or observed at 37 enumerated sites across 16 files. Every site branches on the failure flag and the code; several reconstruct the failure rather than forward it, so detail added at the port dies before any renderer unless each site is carried through.
- **The tracker reference is not declarable.** It is a hard-coded literal `GITHUB_TOKEN` in the production composition; the only tracker-related configuration key is a poll interval. There is no configuration path to point the tracker read at any other source.
- **Redaction is a construction-time snapshot of environment keys.** The entrypoint derives environment keys from declared references and freezes them before composition. For a hypothetical non-environment source the derivation yields no key, so nothing would be registered and the material would be rendered unredacted. Three additional edge-composed command paths register secrets through the same snapshot shape.
- **The shipped daemon has no credential consumer.** The production daemon composition passes no lane and no executor, runs `supervise-only`, reads no tracker, and resolves no credential. Any daemon provisioning benefit claimed today would be an unverifiable claim.
- **The delivered posture is deny-by-default.** Production never reads the OS keyring, never inherits an ambient variable implicitly, and declares no fallback; the `gh` bridge is documentation plus an operator-performed export into an environment file. The secret-read boundary is mechanical: exactly one credential-material directory, one allowlist entry, no ambient read outside it. The posture change needed for store-ownership resolution is owner-stated (GH-394) and structured in ADR-0014, which lands with this change as `Proposed`; the owner accepts it at the PR.
- **The external owner surfaces are measured and verified.** The tracker CLI's token read is non-interactive, keyring-backed, and hands over one static durable bearer token for one host (measured 34–36 ms and ~83 ms). The harness CLI's export prints stored credentials as JSON: a root array of entries carrying `id`, `integrationID`, `label`, `active`, `value`, where `value.type` is `key` or `oauth`; a declared target returns only that integration's entries; the `--` terminator before the positional and the host-scoped token form both exit 0 as written. With the harness's background service the export costs 103–117 ms and 229 ms warm; standalone it costs 4.4–4.6 s and 5.5–6.0 s on two hosts. One integration is OAuth-only today; an `active` entry can report no recorded expiry while live; one integration id carries two entries, one `active`. The harness CLI is normally installed through a version manager and reaches the product through a symlink.
- **Lane spawns need no provider key.** The shipped profile environment record carries only model names — but the spawn descriptor, the configuration catalog, and the production mapping all *support* a declared credential entry, so "the lane environment is model-only" is a property of shipped settings that must be proven, not assumed.

### 2.2 Pain Points / Gaps

- **Every install duplicates every secret by hand.** The only supported source family is the environment, so the operator maintains a second copy per secret per install, invisible to the owner tool: revoking in one place leaves a live copy in the other.
- **Failures name the wrong thing.** A locked keyring or a logged-out host surfaces as a variable-absent-shaped refusal telling the operator to export a variable — an instruction that cannot help and that contradicts where the credential actually lives.
- **The tracker reference cannot be pointed anywhere else.** Opting into store-ownership resolution for the tracker is impossible without a code change.
- **A non-environment source would be silently unredacted today.** The static entrypoint snapshot cannot see material that does not exist at construction time; the registry must become live before any style that materializes later can ship.
- **A generic "declared command" is an exfiltration primitive.** A committed argv can read an arbitrary local file and send it somewhere on every resolve, unattended, with no shell and no interpolation; review alone is not a control against a committed line that looks like configuration.
- **OAuth material cannot be borrowed safely.** The export hands over the refresh grant beside the access token, and expiry data is untrustworthy, so any use-while-unexpired rule either refuses a live credential or trusts an unknowable one.

## 3. PROBLEM STATEMENT

Because the credential port admits only environment-backed sources and the tracker reference is hard-coded, an operator who already authenticates with the tracker CLI and the harness cannot run a one-shot command from those owners' stores, and must instead maintain — and repair, and secure — a hand-copied environment file per secret per install; meanwhile, any future non-environment source would render its material unredacted under today's construction-time redaction snapshot, and a failure in the owner's store would be reported as a missing environment variable that no remedy can satisfy, resulting in duplicated secrets everywhere, a silently unsafe extension path, and unactionable failures on an unattended surface.

## 4. GOALS

- **G-1**: A one-shot CLI command (`dispatch`, `merge`, `status`, `commit`, `verify`, `queue`) resolves a declared credential from its owner's store — the tracker token through the tracker CLI's token read, a provider key through the harness store's export — with no product-written credential file and no operator-copied credential on any product-consumed path; and the tracker credential reference becomes declarable configuration with the shipped default unchanged (`literal` / `GITHUB_TOKEN`).
- **G-2**: The credential port keeps exactly one operation and a result union with exactly one success and one failure variant; the failure variant grows only by three additive optional fields (`source`, `reason`, `remedy`); resolution context enters as construction inputs, never as new members.
- **G-3**: The declared style vocabulary is closed at four — `literal`, `environment-prefixed`, `command`, `harness-store` — with declared keys, no chain, no discovery, no fallback: an unresolvable declaration refuses by name and never consults a second source.
- **G-4**: `command` is a shipped, closed allowlist of (absolute program path, pinned subcommand prefix) pairs with grammar-closed slots, a `--` terminator before the positional, symlink resolution to a regular executable target, and a CI tripwire over the table, every committed argv, and the effective argv derived from configuration.
- **G-5**: `harness-store` resolves only the declared integration through the export's own target selector, requires exactly one `active` entry (zero or multiple refuse as `ambiguous-account`), treats a no-stored-entry integration as `empty-output` with no fall-through, accepts `key` entries only, classifies shape drift by name, matches a declared harness field against the active harness identity or refuses, and never reads another harness's store.
- **G-6**: Every credential-shaped failure carries the delivered single code plus `source` (when a declared reference was resolved), a `reason` from a closed ten-member set, and a `remedy` taken from a fixed `(reason, style)`-keyed table selected per allowlist entry — never interpolated configuration text; failures never return empty material, never block past the per-execution cap, and never make the process fail beyond the one read that needed the credential.
- **G-7**: Redaction is a live registry consulted at render time, with material registered at the moment of materialization — before any emit path (log line, throw with payload, render, return to a caller that logs) can carry it; environment-backed styles keep today's entrypoint-static registration.
- **G-8**: One-shot resolution is memoized per process — exactly one execution per reference per process — with a per-execution cap (15 s default, 30 s bound), closed stdin, bounded stdout capture, and a reduced child environment; the suite is hermetic (injected child seams; CI requires no credential), everything ships additive and migration-free, and the lane environment staying model-only for shipped settings is proven by check, not asserted.

### 4.1 Success Metrics / KPIs

| Metric | Target |
|--------|--------|
| Previously resolvable declared references that resolve differently after the change (defaults, every provider-config fixture, tracker default) | 0 (F-8, AC-F8-1) |
| Real production composition cases resolving a declared non-default source through an injected child seam, with the declared argv (not the hard-coded literal) reaching the seam | ≥ 1, plus the default case unchanged (F-1, AC-F1-1) |
| Child executions for one reference resolved twice in one one-shot process | exactly 1 (F-6, NFR-2, AC-F6-1) |
| Further child executions after first materialization within the same process | 0 (F-6, NFR-2) |
| `merge` child executions for its tracker reference / `status` child executions by composition | 1 / 0–2, and 0 under shipped defaults (F-6, NFR-2) |
| Shipped compositions observing the reserved `resolution-pending` reason | 0 (F-4, AC-F4-1) |
| Healthy executions ended by the 15 s default cap on either measured standalone path | 0 (NFR-1) |
| Canary material materialized after composition observed unredacted on any rendered or persisted surface (human output, JSON envelope, `status`, `doctor`, park/log line, ledger record, capsule event) | 0 (F-5, NFR-5, AC-F5-1) |
| Malformed child output rendered raw, or a child stderr canary reaching a rendered surface | 0 (F-5, AC-F5-2) |
| Out-of-grammar slot values accepted, or argv constructed without the `--` terminator before the positional | 0 (F-4/F-7 grammar; AC-F2-1) |
| Out-of-table programs, interpreters, network clients, or unpermitted parameters accepted | 0 (F-7, AC-F2-1) |
| Allowlist-table, committed-argv, or effective-argv changes passing CI without the allowlist module in the change | 0 (F-7, AC-F7-1) |
| OAuth-derived material consumed anywhere (access, refresh, write-back) | 0 (F-3, AC-F3-4) |
| `harness-store` resolutions emitting more than the declared integration | 0 (F-3) |
| Multi-account integrations resolved without `ambiguous-account` | 0 (F-3, AC-F3-1) |
| Credential-shaped failures rendered without `reason`, or rendered surfaces dropping `source`/`reason`/`remedy` | 0 (F-4, AC-F4-2) |
| Suite invocations of a real owner CLI or real store | 0 (NFR-4) |
| New error-table rows, park-record fields, park causes, announcement codes, result tokens, or exit codes | 0 (F-8, NFR-6) |
| Lane spawn descriptors built from shipped settings carrying a credential entry | 0, by checked proof (F-8, AC-F8-2) |
| End-to-end demonstration against a real owner store on an authenticated host | 1, manual/post-merge, never a CI gate (F-1, §18) |

### 4.2 Non-Goals

- **NG-1**: No `harness-oauth` style — excluded, not deferred. Rule OAuth-1: the product never consumes a harness-owned OAuth grant — no access, no refresh, no write-back — and no style can express one. An OAuth-only provider is `config.credential.missing` / `reason: oauth-excluded` for the product's own calls; its quota read parks best-effort under the delivered `credential-missing` condition. This is an accepted, named capability loss.
- **NG-2**: No resident-daemon benefit and no resident composition. The shipped daemon is `supervise-only` with no credential consumer; nothing may claim or build a daemon provisioning benefit here. The resident design (asynchronous materialization, readiness that never waits, atomic swap, the activated `resolution-pending`) is specified forward for #395 only (§7.3).
- **NG-3**: No `store` style, no `jaiship auth` command, no profiles, no binding, no configuration layers, and no `store-insecure` / `store-unreadable` / `profile-missing` reasons — later tickets own each (#396, #397, #399).
- **NG-4**: No doctor requirement derivation or provisioning hints (#398). Doctor's delivered presence display gains only the source identity and the failure fields; it derives no requirements.
- **NG-5**: No allowlist entries beyond the two shipped pairs: no GitLab CLI (`glab`), no Jira, no secret managers. Each future entry is a reviewed allowlist addition with its own pinned subcommand.
- **NG-6**: No new failure identity mechanism: no new error-table row, no park cause, no announcement code, no delivery-result token, no exit code. The CLI exit taxonomy stays `{0, 1, 2}`.
- **NG-7**: No rotation, write-back, keyring access, or unlock automation against any owner's store; the strategy set is read-only and the product never touches an owner's storage.
- **NG-8**: The C-10 binding-supplied slot exception (a slot valued only from a committed tracker-host coordinate) is stated in the allowlist schema but ships inert: no binding and no credentials catalog branch exist in this change, and no committed host coordinates exist (#396/#399 activate it).
- **NG-9**: No changes to the tracker adapters' transports, the inference transport's request behaviour (beyond forwarding the three failure fields), the provider engine's park vocabulary, the error table's row set, the daemon's unit shape, or startup reconciliation.
- **NG-10**: No proactive credential-state surface ships: identifier-only source facts appear only where a credential failure is rendered (including `status`), never as a new standing surface.

## 5. FUNCTIONAL CAPABILITIES

| ID | Capability | Rationale |
|----|------------|-----------|
| F-1 | Declarable credential sources: a closed four-style vocabulary (`literal`, `environment-prefixed`, `command`, `harness-store`) with explicit per-reference source keys, and a declarable tracker credential reference whose shipped default is exactly today's `literal` / `GITHUB_TOKEN` | Opt-in store-ownership resolution needs a declaration surface; the unchanged default keeps every existing install and fixture byte-identical |
| F-2 | `command` style: one line of stdout from a shipped-allowlisted (absolute program path, pinned subcommand prefix) pair, with grammar-closed slots, a `--` terminator before the positional, symlink resolution requiring a regular executable target, no shell or interpolation, closed stdin, bounded stdout, a reduced child environment, and a per-execution cap | The allowlist turns "a declared program" into "a pinned owner CLI running a pinned subcommand", closing the committed-argv exfiltration path by construction |
| F-3 | `harness-store` style: the harness export's own target selector selects the declared integration; exactly one `active` entry or refuse; `key`-type entries only; shape drift classified; harness identity as a construction fact with declared-harness match or refuse; OAuth entries refused (OAuth-1) | Custody of a renewable grant is never taken; ambiguity is refused rather than resolved arbitrarily; a harness that cannot serve a declaration says so by name |
| F-4 | Failure classification and propagation: the single delivered code stays; the failure variant gains additive optional `source`/`reason`/`remedy`; a closed ten-member reason set; a fixed `(reason, style)`-keyed remedy table selected per allowlist entry (host-aware text only for entries with a host slot); the fields survive every propagation site and render on every surface, exempt from config-summary suppression while every other config summary stays suppressed | One code plus rendered reason/remedy delivers actionable failures on an unattended surface without a cross-surface error-taxonomy change (37 enumerated consumer sites) |
| F-5 | Live redaction registry with register-on-materialize: the registry is consulted at render/redaction time, the resolver registers material before parsing and before any throw, the three edge-composed registration sites join the same registry, and environment styles keep entrypoint-static registration | A construction-time snapshot structurally cannot redact material that does not exist yet; the invariant "registered before any emit path" is the achievable property |
| F-6 | One-shot resolution semantics: on-demand, synchronous first materialization; a per-process memo of exactly one execution per reference; per-execution cap (15 s default, 30 s bound); closed stdin; bounded stdout; reduced child environment; declared spawn-count profile per command | Keeps subprocesses off the request path after one bounded execution and bounds a slow or hanging owner CLI |
| F-7 | Allowlist governance: configuration-load validation against the closed table and slot grammars, plus a CI tripwire over the table, every committed argv, and the effective argv derived from committed configuration, tolerating the absence of committed host coordinates | Review alone is not a control on the exfiltration path; the tripwire makes any widening loud |
| F-8 | Compatibility and hermeticity: `literal` and `environment-prefixed` resolve byte-identically; shipped defaults unchanged; no migration; no new error identity, park cause, announcement code, result token, or exit; the suite runs on injected child seams with no credential; the lane environment stays model-only for shipped settings by checked proof | The change must be adoptable and abandonable without an operator edit, testable without a credential, and must not widen any delivered vocabulary |

### 5.1 Capability Details

- **F-1 — declarable sources.** Every credential reference names exactly one style from the closed set and carries its own explicit source keys. `literal` names an environment variable used verbatim; `environment-prefixed` names a suffix on the branded prefix; `command` names an allowlisted program pair and its permitted parameters; `harness-store` names a harness and an integration id. Nothing is discovered by matching a label, account name, display name, or provider name; an unknown style, an unknown field on a known style, or an out-of-table pair is a validation refusal naming the field or program. The tracker credential reference moves from a hard-coded literal to a declared value whose default is exactly today's `{ style: literal, name: GITHUB_TOKEN }`; the reference used for redaction registration follows the declared value. No reference admits a chain and no strategy has a fallback.
- **F-2 — command style.** A `command` declaration is accepted only when it matches a shipped allowlist entry: an absolute program path plus a pinned subcommand prefix. The initial table is exactly the tracker CLI's token read (`gh` → `auth token [--hostname <host>]`) and the harness CLI's export (`opencode` → `auth export [--standalone <integrationID>]`), where the standalone flag is permitted and optional — part of the declared argv, deterministic per declaration: the shipped default declaration omits it (background-service path, measured 103–229 ms, preserving the one-shot latency profile), and a declaration may opt in (4.4–6.0 s, knowingly paid). The two free slots are grammar-closed and validated at configuration load: `<host>` matches `[A-Za-z0-9.-]+` with no leading `-` and a bounded length; `<integrationID>` matches `[a-z0-9][a-z0-9_-]*` with a bounded length and no leading `-` (an id beginning with `-` would be flag smuggling into a program that documents a global server flag). The constructed argv always inserts the `--` terminator before the positional. Validation resolves every symlink on the program path and requires a regular, executable file at the end of the chain; an unresolvable chain or a non-regular/non-executable target is `program-unavailable` ("declare the program path as installed"). Execution is direct — no shell, no metacharacter interpretation, no runtime interpolation — with closed stdin (a prompt fails immediately), bounded stdout capture, stderr captured for size and exit status only and never rendered, and a per-execution cap ending every run. Material is one line: trailing line endings stripped; an interior newline or empty output after stripping is a refused shape, never material. Interpreters and general network clients are absent from the table by construction, so no configuration can name them.
- **F-3 — harness-store style.** The declared integration id is passed to the allowlisted export call, so the export's own target selector returns only that integration's entries; in-process single-entry selection remains as defense in depth, and the raw export is never logged, stored, re-emitted, or retained. The strategy requires exactly one entry with `active: true`: zero or more than one is `ambiguous-account` — never "the first", never "the newest". An integration with no stored entry is `empty-output`, because the material is not in the store at all; the strategy never falls through to the environment on its own. Only `value.type: "key"` entries yield material (`value.key`); an `"oauth"` entry is refused `oauth-excluded` (OAuth-1: the same object carries the refresh grant, and an `active` entry can report no recorded expiry while live). Any shape departure — non-array root, missing field, unexpected `value.type`, unparseable output — is `shape-drift` naming the harness and the field. Harness identity is a construction input of the composition: a declared `harness` field must equal the active identity, the active identity wins, a mismatch refuses `source-not-supported`, and a harness with no declared support refuses the same way — never borrowing another store's layout or surface. The strategy is read-only against the store, proven by a test double that fails if any write path is reached.
- **F-4 — failure classification and propagation.** `config.credential.missing` stays the single credential failure code with its delivered projection and exit. The failure variant gains exactly three additive optional fields: `source` (style plus source identity, present whenever a declared reference was being resolved), `reason` (one token from the closed set `program-unavailable` · `timeout` · `non-zero-exit` · `empty-output` · `shape-drift` · `ambiguous-account` · `oauth-excluded` · `source-not-supported` · `variable-absent` · `resolution-pending`, the last reserved and unobservable by shipped callers), and `remedy` (bounded text naming the one operator act that helps, taken from a fixed shipped table keyed by `(reason, style)` and selected per allowlist entry — never interpolated from configuration text or child output). The `command` / `non-zero-exit` remedy is host-aware — "the program could not obtain a token; it may not be authenticated to the required host — log in to that host (for `gh`: `gh auth login --hostname <host>`), or declare another source." — and is used only for allowlist entries that have a binding-supplied or declared host slot; an entry without one gets the neutral text ("the program could not obtain a token; it may not be authenticated — log in, or declare another source."). Because no binding exists in this change, the host-aware text names no concrete host. Both texts are fixture-pinned. The fields survive every propagation site — including the sites that today reconstruct the failure and drop detail, the doctor presence variant and its display (which shows the source identity; the variable name remains only for the two environment styles), and the MCP serve state placeholders (which gain a reason so the renderer never guesses) — and are exempt from config-summary suppression for credential refusals only, while every other config summary stays suppressed. A failed resolution degrades the one read that needed it and is reported; the quota path keeps the delivered park condition and announcement with no park-record field (the reason appears in the rendered refusal and the log line only). In the one-shot composition a credential failure never aborts the process beyond that read: the command reports the classified refusal through the delivered exit taxonomy.
- **F-5 — live redaction registry.** The redaction set becomes a live registry — a register/values pair consulted at render/redaction time — replacing the construction-time frozen snapshot, and the three edge-composed command registration sites register into the same registry. The resolver registers obtained material at the moment of materialization, before parsing and before any throw, so there is no instant at which material is present and renderable while unregistered, and malformed child output throws without ever rendering the raw output. The entrypoint keeps its static registration for the two environment styles (their values exist before any command runs) and never resolves anything itself — resolving at the entrypoint would add an execution to every command, including those that never touch a credential.
- **F-6 — one-shot resolution semantics.** `resolve` stays synchronous. In the one-shot composition, a subprocess-style reference is resolved on demand at its first use — the caller blocking for one bounded execution — and the result is memoized for the lifetime of the process: exactly one execution per reference, every further resolve of that reference a memory read with zero spawns, and a repeated reference never spawning twice. The declared spawn-count profile: `merge` pays exactly one execution (one reference); `status` pays at most two by composition (tracker plus the one provider credential shipped defaults declare) and zero under shipped defaults; the memo makes the count independent of how many operations the command performs. Every execution carries the per-execution cap (15 s default, hard bound 30 s; a run ending at the cap is `timeout`, never a blocked caller), closed stdin, bounded stdout capture, and a reduced child environment — the path, the home directory, the session-bus facts where a keyring-backed store requires them, plus declared non-secret variables — never the parent's secret-bearing environment.
- **F-7 — allowlist governance.** Configuration load validates every `command` declaration against the closed table and the slot grammars, failing closed by name. A CI tripwire guards the exfiltration path: it fails on any change to the allowlist table, to any committed command argv, or to the effective argv derived from committed configuration, unless the allowlist module is part of the change. The tripwire enumerates declared tracker-host coordinates from configuration itself — there is no named constant list to keep in sync — and must pass when none exist, as in this change.
- **F-8 — compatibility and hermeticity.** Existing `literal` and `environment-prefixed` declarations validate and resolve byte-identically; shipped defaults — including the tracker reference — are unchanged; no operator edits configuration to upgrade; no style is renamed. No error-table row, park-record field, park cause, announcement code, delivery-result token, or exit is added; the failure variant grows only by the three optional fields of F-4, which are projection data on the variant, not columns on the row. The suite never consults a real store, real keyring, or real harness: every strategy is constructed over injected seams (child runner, environment record, harness identity, allowlist table), and CI requires no credential — the C-1 proof is the real production composition with an injected child seam, so the composition is real and the credential is not. The lane environment staying model-only for shipped settings is proven by an inventory-style check over built descriptors (the descriptor supports credential entries; the proof shows none is present), and an operator-declared credential entry keeps its delivered spawn-time behaviour unchanged.

## 6. USER & SYSTEM FLOWS

**Flow 1 — opt in and resolve (one-shot, happy path).**
Operator authenticates with the tracker CLI once, then declares the tracker reference as `command` (token read for the required host) in configuration → on the next `dispatch`, the first consumer needing the tracker token triggers the one materialization for that reference → the resolver validates the declaration against the allowlist, resolves the program path through symlinks, constructs the argv with the `--` terminator, and runs the child with closed stdin, reduced environment, and the cap → one line of stdout is the material → the resolver registers it into the live redaction registry before parsing → the tracker client uses it; every later resolve of that reference in the process is a memory read → no environment file exists and none was copied.

**Flow 2 — provider key from the harness store.**
Operator declares a provider credential as `harness-store` (harness identity, integration id) → at first use, the resolver runs the allowlisted export with the declared target, so only that integration's entries are returned → the parser requires the pinned shape: an array of entries with `id`/`integrationID`/`label`/`active`/`value` → exactly one `active` entry must exist; `value.type` must be `key` → the key is registered before parsing completes and returned once → the quota reader uses it; a second stored account, an OAuth entry, or a shape departure is refused with its named reason and remedy → the raw export is never retained.

**Flow 3 — classified failure, rendered everywhere.**
The child exits non-zero (operator not authenticated to that host), or hangs (cap fires), or emits malformed output → the resolver classifies the outcome into the closed reason set, attaches `source` and the fixed `(reason, style)` remedy from the per-allowlist-entry table, and throws with that payload (raw child output is never rendered) → the failure propagates through every forwarding site to each renderer → the human output, JSON envelope, `status`, `doctor`, and the park/log line each show source, reason, and remedy → the command degrades the one read and exits through the delivered taxonomy; nothing flaps, nothing retries the source, nothing falls back.

**Flow 4 — allowlist governance in CI.**
A change edits a committed command argv, or the effective argv a committed configuration derives, or the allowlist table itself → the tripwire compares the three against the table → if the allowlist module is not part of the change, CI fails and names the drift → if it is part of the change, the widening is a reviewed code change, loud by construction → absent committed host coordinates, the tripwire passes.

## 7. SCOPE & BOUNDARIES

### 7.1 In Scope

- The one-shot CLI composition (`dispatch`, `merge`, `status`, `commit`, `verify`, `queue`) resolving a declared credential from its owner's store, on demand, with no environment file.
- The closed four-style vocabulary (`literal`, `environment-prefixed`, `command`, `harness-store`) behind the unchanged port: one operation, one success variant, one failure variant gaining additive optional `source`/`reason`/`remedy`.
- The `command` closed allowlist: tracker CLI token read and harness CLI export, with grammar-closed slots, the `--` terminator before the positional, bounded lengths, no leading `-`, and symlink resolution requiring a regular executable target (`program-unavailable` otherwise).
- The declarable tracker credential reference; shipped default unchanged (`literal` / `GITHUB_TOKEN`).
- The single failure code (`config.credential.missing` stays) with the closed ten-member reason set (`resolution-pending` reserved and unobservable by shipped callers) and remedy strings from the `(reason, style)`-keyed, per-allowlist-entry table (never interpolated configuration text); the host-aware and neutral `command`/`non-zero-exit` texts, both fixture-pinned.
- The live redaction registry with register-on-materialize (invariant: registered before any emit path — log, throw-with-payload, render, return-to-caller-that-logs; malformed child output throws and is never rendered raw; the three edge-composed registration sites join the registry; environment styles keep today's entrypoint-static registration).
- The per-process memo (exactly one execution per reference per process; `merge` → 1, `status` → 0–2 by composition) and the per-execution cap (15 s default, 30 s bound), closed stdin, bounded stdout capture, reduced child environment (path, home, session-bus facts where the keyring requires them, declared non-secret variables — never the parent's secret-bearing environment).
- Harness identity as a construction input, with declared-harness match or refuse; a harness without declared support borrows nothing.
- The CI tripwire over the allowlist table, committed argv, and effective argv derived from configuration, enumerating declared tracker-host coordinates from configuration itself and passing on their absence.
- Exactly one new failure-identity mechanism: no new error-table row, park cause, announcement code, result token, or exit; additive and migration-free.
- The hermetic suite: injected child seams; CI needs no credential.
- ADR-0014 landing with this change (`Proposed`, decision date unset; owner accepts at the PR), with its index and register registration.

### 7.2 Out of Scope

- [OUT] `harness-oauth` — excluded, not deferred (OAuth-1: the product never consumes a harness-owned OAuth grant — no access, no refresh, no write-back; OAuth-only providers are `oauth-excluded` for product calls; the quota read parks best-effort under the delivered `credential-missing`).
- [OUT] Any resident-daemon credential behaviour: the shipped daemon is supervise-only with no credential consumer; no daemon benefit may be claimed or built; the resident composition is specified forward for #395 only.
- [OUT] The `store` style, the `jaiship auth` command, profiles, binding, configuration layers, and the `store-insecure` / `store-unreadable` / `profile-missing` reasons (#396, #397, #399).
- [OUT] Doctor requirement derivation and provisioning hints (#398).
- [OUT] GitLab (`glab`) and Jira strategies, and any allowlist entry beyond the two shipped pairs.
- [OUT] The C-10 binding-supplied host slot (stated in the allowlist schema but inert in this change: no binding, no credentials catalog branch, no committed host coordinates).
- [OUT] Rotation, write-back, keyring access, product-side unlock automation, or any product-written credential file.
- [OUT] Changes to tracker-adapter transports, the inference request path (beyond failure-field forwarding), the park vocabulary, the error-table row set, or the daemon's unit shape and readiness poll.
- [OUT] A real-store demonstration as a CI gate: it is a named manual/post-merge step, never a gate.
- [OUT] A proactive credential-state surface (identifier-only facts render only where a credential failure is rendered).

### 7.3 Deferred / Maybe-Later

**Forward context — resident composition (#395), explicitly out of scope here.** When the lane composition is mounted (#395), the daemon gains its first credential consumer, and the resident design recorded in ADR-0014 activates: the resident declaration sets the standalone flag (a lingered unit cannot assume a session-scoped service); materialization runs asynchronously from construction with readiness untouched and no synchronous execution class in the daemon; a resolve before first materialization returns the reserved `resolution-pending` ("not yet", never "failed"), which every daemon-side caller treats as a deferred pass — no recorded failure, no park, no restart-counter advance; re-resolution runs on a declared interval with an atomic swap, an in-flight refresh serving the previous value, and a bounded backoff on failure. None of that is delivered, claimed, or verified by this change; its verification is deferred to #395.

Also deferred: a narrower harness read than the full export (a single-integration read that never returns a refresh grant), if ever offered; an install-time pre-flight over allowlisted programs; retiring the documented environment-file bridge from operator docs; the sidecar as a second implementation of the unchanged union; rotation/revocation operator guidance.

## 8. INTERFACES & INTEGRATION CONTRACTS

### 8.1 REST / HTTP Endpoints

N/A — no HTTP surface changes.

### 8.2 Events / Messages

N/A as new vocabulary: no new event kind, park cause, or announcement code. Credential failures in the quota path keep the delivered `credential-missing` condition and `provider.credential.missing` announcement, bounded by the delivered park TTL; the classified `reason` is carried in the rendered refusal and the log line only, never as a park-record field. Capsule events, ledger records, and telemetry events carry no credential material (F-5/NFR-5).

### 8.3 Data Model Impact

| ID | Element | Description |
|----|---------|-------------|
| DM-1 | Credential source declaration | Per-reference declaration naming one of the four closed styles with its explicit keys: `literal` (variable name), `environment-prefixed` (suffix), `command` (allowlisted program pair and permitted parameters, optional per-execution timeout within the bound), `harness-store` (harness identity, integration id); unknown styles and unknown fields refuse by name |
| DM-2 | Failure variant fields | Three additive optional fields on the existing failure variant — `source` (style plus source identity, e.g. `command:<program>`, `harness-store:<integrationID>`, `literal:<NAME>`, `environment-prefixed:<SUFFIX>`), `reason`, `remedy` — projection data on the variant, not columns on the bound error-table row |
| DM-3 | Closed reason union | Ten members: `program-unavailable`, `timeout`, `non-zero-exit`, `empty-output`, `shape-drift`, `ambiguous-account`, `oauth-excluded`, `source-not-supported`, `variable-absent`, `resolution-pending` (reserved; no shipped caller can observe it) |
| DM-4 | Allowlist table | Shipped, closed set of (absolute program path, pinned subcommand prefix, permitted parameters, per-entry slot grammar and remedy selection); initial entries exactly `gh` → `auth token [--hostname <host>]` and `opencode` → `auth export [--standalone] <integrationID>`; the entry schema states the binding-supplied slot exception inertly |
| DM-5 | Tracker credential declaration | A tracker (GitHub) credential source declaration in configuration, defaulting exactly to today's `{ style: literal, name: GITHUB_TOKEN }`; the redaction registration reference follows the declared value |
| DM-6 | Doctor presence variant | The delivered closed presence variant carries the three optional failure fields; its display shows the source identity for all four styles, keeping the variable name only for the two environment styles |
| DM-7 | Redaction registry | The construction-time frozen secrets snapshot becomes a live register/values registry consulted at render time, shared by the entrypoint path and the three edge-composed registration sites |

### 8.4 External Integrations

- **GitHub CLI (`gh`)** — `auth token [--hostname <host>]`: non-interactive, selects the active account for the host, token held in the OS keyring; hands over one static durable bearer token with no separate refresh grant (a leak is long-lived access; revocation stays the operator's act in `gh`; a revoked token surfaces through the delivered auth-rejected mapping at use time). Measured 34–36 ms and ~83 ms. The host-scoped form exits 0 as specified.
- **OpenCode CLI (`opencode`)** — `auth export [--standalone] <integrationID>`: prints stored credentials as JSON; root is an array of `{id, integrationID, label, active, value}`; `value.type` is `key` (with `value.key`) or `oauth` (with `methodID`, `access`, `refresh`, `expires`, optional `metadata`); a declared target returns only that integration's entries; the `--` terminator form exits 0. With the background service: 103–117 ms / 229 ms warm; standalone: 4.4–4.6 s and 5.5–6.0 s on two hosts. The service is session-scoped, so a sessionless caller on the default path may fail or hang — a classified `non-zero-exit`/`timeout` whose remedy names the flag. The observed shape and a supported version window are pinned in the suite; normal installation is through a symlink, which validation resolves.
- **OS keyring / secret service** — availability on the operator host is the owner tools' concern; the product never calls a keyring API, never unlocks, and forwards only the session-bus facts where the child's own keyring access requires them.

### 8.5 Backward Compatibility

Fully additive and migration-free. Existing `literal` and `environment-prefixed` configurations validate and resolve byte-identically; shipped defaults, including the tracker reference value, are unchanged; no operator edits configuration to upgrade, and none is required to keep upgrading. New styles are opt-in declarations. The only operator-visible change to existing behaviour is richer detail on credential-shaped failures (source, reason, remedy rendered where the failure already rendered), plus the deliberate in-change reversal of the documented absoluteness that "only an environment source is supported" / "the product never runs the tracker CLI's token read" — owner-directed, reconciled in the same change (§18, §22). The port's operation and union are unchanged, so a second implementation (the anticipated sidecar) still satisfies the type.

## 9. NON-FUNCTIONAL REQUIREMENTS (NFRs)

| ID | Requirement | Threshold |
|----|-------------|-----------|
| NFR-1 | Per-execution cap on every child execution; a run reaching the cap is classified `timeout`, never a blocked caller; a healthy execution must never be ended by the default cap on either measured standalone path | 15 s default, 30 s hard bound; 0 healthy executions capped at the default |
| NFR-2 | Per-process memo: exactly one child execution per reference per process; further resolves memory-read only; declared command profile `merge` = 1 execution, `status` = 0–2 by composition and 0 under shipped defaults | exactly 1 per reference; 0 further spawns; profile as stated |
| NFR-3 | One-shot latency profile: the shipped-default declaration occupies the background-service path so a one-shot command's admission preflight profile is preserved; the standalone form is an explicit opt-in | ~103–229 ms observed under shipped defaults; 4.4–6.0 s only when declared |
| NFR-4 | Hermeticity: the suite never invokes a real owner CLI, real store, or real keyring; CI requires no credential | 0 real invocations; suite green with no credentials present |
| NFR-5 | Redaction: no credential material, substring, or value-derived digest on any rendered or persisted surface — human output, JSON envelope, `status`, `doctor`, park/log line, ledger record, capsule event, temp file, child argv, child environment — including material materialized after composition; malformed child output never rendered raw | 0 canary observations across all surfaces, register-after-compose proof |
| NFR-6 | Vocabulary and structure invariants: error-table row set unchanged; no park-record field, park cause, announcement code, delivery-result token, or exit added; CLI exit taxonomy stays `{0,1,2}` | 0 additions; taxonomy unchanged |
| NFR-7 | Secret-read boundary: strategy implementations live only in the single credential-material directory; no new ambient environment read | exactly 1 directory; 0 new ambient reads |
| NFR-8 | Child execution minimality: closed stdin; bounded stdout capture; stderr captured for size/exit status only, never rendered or treated as material; recorded child environment exactly path + home + (where required) session-bus facts + declared non-secret variables | recorded env equals the declared reduced set; 0 secret-bearing variables forwarded |

## 10. TELEMETRY & OBSERVABILITY REQUIREMENTS

No new telemetry: no new metric, event kind, or announcement. Observability of credential state is delivered through classified failure rendering — `source`, `reason`, `remedy` on every surface that already renders a credential failure (human output, JSON envelope, `status`, `doctor`, park/log line) — with identifier-shaped data only. Resolved material never enters any telemetry event, log line, ledger record, capsule event, status digest, or diagnostic (NFR-5). The daemon-facing identifier-only status facts are out of scope here (NG-2, NG-10).

## 11. RISKS & MITIGATIONS

| ID | Risk | Impact | Probability | Mitigation | Residual Risk |
|----|------|--------|-------------|------------|---------------|
| RSK-1 | Exfiltration through a committed command argv (read a local file, send it, unattended, no shell needed) | H | L | Closed allowlist of pinned subcommands; interpreters and network clients absent by construction; grammar-closed slots and `--` terminator; symlink resolution to a regular executable; CI tripwire over table, committed argv, and effective argv | A review that widens the table is ordinary code-change trust; a same-user-writable program path can be redirected (delivered same-user trust model, mitigated by validating the resolved path) |
| RSK-2 | Harness export shape drift in another product's release | M | M | Typed parsing with a closed `shape-drift` reason naming harness and field; the observed shape and a supported version window pinned in the suite | A same-day drift refuses every `harness-store` reference until re-pinned; the operator sees the reason, never a corrupted token |
| RSK-3 | Long-lived tracker token exposure (the `gh` token is durable, host-scoped, no refresh grant) | H | L | Pinned allowlisted invocation; material never persisted, registered for redaction at materialization, name-only diagnostics; a revoked token surfaces as the delivered auth-rejected refusal at use time | The token stays valid until the operator revokes it; the product cannot shorten or rotate it |
| RSK-4 | Service-less default export path from a sessionless caller fails, hangs, or reads a different store than intended | M | M | Classified `non-zero-exit`/`timeout` with the `(reason, style)` remedy naming the standalone flag; the outcome is a typed delivery-time confirmation (OQ-1) with a recorded revisit trigger | One outcome ("reads a different store") is not expressible in the current reason set; the revisit trigger reopens the assessment if observed |
| RSK-5 | Locked keyring on an unattended host makes the owner CLI fail or block | M | M | Closed stdin (prompt fails immediately), bounded cap, closed reason + remedy stating the store may be locked and offering log-in or the knowingly-duplicated environment path; the product never unlocks | The operator must unlock, log in, or accept the duplicated path; the product must not and does not unlock a keyring |
| RSK-6 | A stale `active` flag selects an account the operator did not mean | M | L | Ambiguity refused (`ambiguous-account`); never "first"/"newest"; the flag is the harness's report and correcting it is the operator's act in the owner's tool | A mislabelled-but-unambiguous flag can still select the wrong account; the product cannot verify it |
| RSK-7 | Third-party CLI latency lands on the one-shot path | L | M | Per-process memo (one execution per reference); shipped default omits the standalone flag (103–229 ms); per-execution cap bounds the worst case | A standalone opt-in pays 4.4–6.0 s once per reference, knowingly declared |
| RSK-8 | OAuth-only provider loses its product-side quota read | L | H | Accepted, named capability loss (OAuth-1); the read parks best-effort under the delivered `credential-missing`; model work unaffected (the harness authenticates its own lanes) | Unavailable until a narrower non-OAuth read exists; not engineered around |
| RSK-9 | A redaction regression: a present or future emit path bypasses the live registry | H | L | Registry consulted at render time; register-before-parse-and-throw invariant; canary materialized after composition asserted redacted on every surface; the three edge-composed registration sites join the registry; malformed output never rendered raw | A future emit path added without consulting the registry would reintroduce the window; guarded by the canary suite and code review |

## 12. ASSUMPTIONS

- The harness export shape (JSON array of `{id, integrationID, label, active, value}`; `value.type` ∈ `key` | `oauth`) is stable within the pinned supported version window; drift is a classified refusal, not a wrong token.
- The tracker CLI's token read hands over one static durable host-scoped token and exposes no separate refresh grant, so reading it is delegation without custody of a renewable grant.
- Symlinked installation through a version manager is the normal harness install; validation resolves symlinks rather than refusing them.
- The `active` flag is the harness's report and cannot be verified by the product; ambiguity is refused, and a mislabelled flag is corrected in the owner's tool.
- The harness's background service is session-scoped; sessionless callers may fail or hang on the default path (typed outcomes; OQ-1).
- The observed integration ids satisfy the `<integrationID>` grammar.
- CI holds no credential and never will; every proof of store resolution uses injected seams, with exactly one manual/post-merge real-store demonstration.
- The operator's shell history and other same-user processes are outside the product's control (delivered same-user trust model).

## 13. DEPENDENCIES

| Direction | Item | Notes |
|-----------|------|-------|
| Depends on | Delivered credential port contract (ADR-0007): one operation, reference/material separation, failure variant bound to the single error-table row by a drift test | The unchanged union is what makes the change additive |
| Depends on | Delivered secret-read boundary invariant (exactly one credential-material directory; no ambient reads outside its allowlist) | Strategies land inside the existing directory; no new allowlist entry |
| Depends on | Delivered entrypoint redaction chokepoint and the three edge-composed registration sites | They become consumers of the live registry (DM-7) |
| Depends on | Delivered dispatch admission preflight posture (TDR-0019) and its one-second budget | The shipped-default export path (103–229 ms) keeps the profile intact |
| Depends on | Delivered provider park vocabulary and event taxonomy (ADR-0007; TDR-0025/0029/0030) | Untouched; the park shape gains no field |
| Depends on | Delivered harness adapter contract capability/gap posture (ADR-0008) | An unsupported harness is a declared gap that refuses by name |
| Depends on | Delivered daemon environment posture (TDR-0023) and supervise-only composition | Unchanged here; the daemon resolves nothing in this change |
| Depends on | Delivered CLI exit taxonomy (TDR-0005) and config-summary suppression rule | The exemption for credential refusals carrying the three fields is the only rendering-rule change |
| Depends on | External: `gh` auth token surface; `opencode` auth export surface (version window pinned); OS keyring availability | Owner CLIs are versioned externals; drift is classified `shape-drift`/`program-unavailable` |
| Blocks | #395 resident composition | Consumes the reserved `resolution-pending`, the field forwarding, and the composition inputs |
| Blocks | #396 / #397 / #399 (store style, auth command, profiles, binding, layers) | Build on the vocabulary; activate the inert binding-supplied slot exception |
| Blocks | #398 doctor requirement derivation and hints | Extends the doctor surface this change only widens additively |

## 14. OPEN QUESTIONS

| ID | Question | Context | Status |
|----|----------|---------|--------|
| OQ-1 | Does the harness export work from a lingered sessionless unit, and does the service-less default path fail fast or hang? An observed "reads a different store" outcome is not expressible in the current reason set | Owner-designated delivery-time confirmation; closed stdin + bounded cap make any answer safe; the remedy (add the flag) is already declared; revisit trigger recorded in ADR-0014 | Non-blocking — confirm during delivery as a typed classified outcome; no contract change |
| OQ-2 | Does the tracker CLI's token read exit non-zero or block on a locked keyring? | Owner-designated delivery-time confirmation; only the reason token differs (`non-zero-exit` vs `timeout`); both are safe under closed stdin and the cap | Non-blocking — confirm during delivery as a typed classified outcome |
| OQ-3 | Confirm the three edge-composed command registration sites receive the live-registry treatment, with the malformed-child-output-never-rendered test covering each | Owner-designated delivery-time confirmation; the invariant (registered before any emit path) applies at all three | Non-blocking — confirm during delivery; the requirement itself is in scope (F-5) |
| OQ-4 | Pin the concrete bounded lengths for `<host>` and `<integrationID>` | The grammar properties (charset, no leading `-`, bounded length) are contractual; the numeric bounds are constants this spec leaves to the change's plan | Non-blocking — fix in the plan; any reasonable bound satisfies the grammar |

## 15. DECISION LOG

| ID | Decision | Rationale | Date |
|----|----------|-----------|------|
| DEC-1 | ADR-0014 (credential strategies — store ownership behind an unchanged port) governs this change and lands with it as `Proposed`, decision date unset; the owner accepts the posture change at the PR | The change reverses a documented absoluteness ("never runs the owner CLI's token read"), which TDR-0019 reserves to an owner decision; the delivered "never reads the OS keyring / no ambient read" guarantees hold mechanically | 2026-11-23 |
| DEC-2 | Four-style closed vocabulary behind the unchanged port; the shipped style names `literal` and `environment-prefixed` are kept (no rename) | Existing configs migrate nothing; renaming would touch defaults, catalog, validation, migration, fixtures, and the conformance double for zero behaviour | 2026-11-23 |
| DEC-3 | No `harness-oauth` style, ever (OAuth-1): OAuth entries refused `oauth-excluded`; the OAuth-only provider's quota read is an accepted, named capability loss | The export hands over the refresh grant beside the access token; an `active` entry can report no recorded expiry while live — a time-based rule refuses live credentials and trusts unknowable ones; a second refresher would invalidate the owner's session | 2026-11-23 |
| DEC-4 | One failure code stays (`config.credential.missing`); the failure variant gains additive optional `source`/`reason`/`remedy`; no new error identity, park cause, announcement code, result token, or exit | A second code would have to be threaded through 37 enumerated sites in 16 files, several of which reconstruct the failure and would silently collapse it in an unattended tool | 2026-11-23 |
| DEC-5 | `command` is a shipped closed allowlist of (absolute program path, pinned subcommand prefix) pairs — not "a declared program" — with grammar-closed slots and a CI tripwire | A committed generic argv is an exfiltration primitive needing no shell and no interpolation; review alone is not a control; interpreters and network clients are absent by construction | 2026-11-23 |
| DEC-6 | Symlinks are resolved and accepted; the fully-resolved target must be a regular executable file; an unresolvable chain or non-regular/non-executable target is `program-unavailable` | Refusing symlinks would reject the standard version-manager harness install; the superseded `lstat`-refuse rule was corrected by the owner after host verification | 2026-11-23 |
| DEC-7 | The remedy table is keyed by `(reason, style)` and selected per allowlist entry: host-aware `command`/`non-zero-exit` text only for entries with a host slot, neutral text otherwise; both texts fixture-pinned; never interpolated configuration text | Keyed by reason alone, a tracker-CLI timeout would be told to add a harness flag; keyed without per-entry selection, a host-less program would be told to log in to a host it cannot name | 2026-11-23 |
| DEC-8 | The export's own target selector is the primary control (`opencode auth export <integrationID>`); in-process single-entry selection is defense in depth; the raw export is never retained | "Export everything, pick one, discard the rest" describes only the target-less form and would widen the leak blast radius to every integration | 2026-11-23 |
| DEC-9 | Exactly one `active` entry or `ambiguous-account`; a no-stored-entry integration is `empty-output`, never an environment fall-through; `key` entries only | One integration id can carry several accounts (observed); an account must never be picked silently; an integration the store does not hold is not a stored source | 2026-11-23 |
| DEC-10 | Redaction becomes a live registry with register-on-materialize (registered before parsing and before any throw), covering the entrypoint path and the three edge-composed registration sites; environment styles keep entrypoint-static registration; the entrypoint itself never resolves | The construction-time snapshot structurally cannot see later-obtained material, so a command-resolved token would be silently unredacted; resolving at the entrypoint would add an execution to every command | 2026-11-23 |
| DEC-11 | One-shot resolution is synchronous on first use with a per-process memo (one execution per reference), cap 15 s default / 30 s bound; the shipped default declaration omits the standalone flag; the standalone form is a per-declaration opt-in | Measured standalone cost (4.4–6.0 s, two hosts) against the one-second preflight budget; forcing the flag would tax every one-shot command; forcing its omission would break sessionless callers | 2026-11-23 |
| DEC-12 | The shipped benefit is scoped to the one-shot CLI composition; the shipped daemon (supervise-only, no credential consumer) gains nothing here; the resident composition is specified forward for #395 | Claiming a daemon benefit would be an unverifiable claim about a component with no credential consumer | 2026-11-23 |
| DEC-13 | The C-10 binding-supplied host-slot exception is stated in the allowlist schema but ships inert: no binding, no credentials catalog branch, no committed host coordinates in this change; the tripwire enumerates declared host coordinates from configuration and passes on their absence | The exception does nothing until #396 activates it; shipping it active would add an unneeded surface; the tripwire must not fail on an empty coordinate set | 2026-11-23 |

## 16. AFFECTED COMPONENTS (HIGH-LEVEL)

| Component | Impact |
|-----------|--------|
| Credential port contract (operation, result union, source declaration shapes, reason union) | Updated (additive fields and declarations; operation and union shape unchanged) |
| Credential adapter implementation (strategy dispatch, allowlist table and slot grammars, injected seams) | Updated (new styles; same single credential-material directory) |
| Configuration catalog, validation, defaults (declarable sources; tracker credential declaration; shared source-key validator) | Updated |
| One-shot command compositions (dispatch, merge, status, commit, verify, queue) | Updated (resolver construction inputs; unchanged command surfaces) |
| Entrypoint redaction path (live registry) and the three edge-composed registration sites | Updated |
| Failure rendering surfaces (CLI human output and JSON envelope, status, doctor display, MCP serve state placeholders) | Updated (field forwarding and rendering; exemption from config-summary suppression for credential refusals only) |
| Doctor credential-presence variant and its source display | Updated |
| Inference transport and harness spawn-environment forwarding | Updated (failure-field forwarding only; spawn-time behaviour unchanged) |
| Provider engine park mapping | Unchanged (verified: no park-record change; reason in refusal/log line only) |
| Testkit conformance double (style union representation) | Updated |
| CI checks (allowlist tripwire) | New |
| Decision record registration (ADR-0014 index row and register binding) | New |
| Feature specs and operator guides (adapter ports, config layer, provider engine, doctor; tracker-credential provisioning guide; dispatch-engine preflight section) | Updated (phase 7 reconciliation) |

## 17. ACCEPTANCE CRITERIA

| ID | Criterion | Linked |
|----|-----------|--------|
| AC-F1-1 | **Given** an operator declares the tracker reference as `command` (tracker CLI token read) and a provider credential as `harness-store`, **when** a one-shot command runs in the real production composition against an injected child seam, **then** the declared argv — not the hard-coded literal — reaches the seam, the resolved material is registered for redaction, no daemon environment file and no operator-copied credential exist on the path, and the shipped default reference resolves exactly as before; a real-store end-to-end demonstration exists as a named manual/post-merge step, never a CI gate | F-1, F-2, F-3, F-6, DM-5 |
| AC-F1-2 | **Given** existing `literal` and `environment-prefixed` declarations and every shipped provider-config fixture, **when** validation and resolution run after the change, **then** each validates and resolves byte-identically, the shipped defaults (including the tracker reference) are unchanged, no migration step exists, and no operator config edit is required to upgrade | F-8, DM-1, DM-5 |
| AC-F2-1 | **Given** the shipped allowlist table, **when** declarations are validated at configuration load, **then** every in-table entry is accepted with exactly its permitted parameters; out-of-table programs, interpreters, and network clients are refused by name; unpermitted parameters are refused; a `<host>` with a leading `-` or outside `[A-Za-z0-9.-]+`, and an `<integrationID>` with a leading `-`, an uppercase character, or an out-of-charset character are each refused at load; and the constructed argv always carries the `--` terminator before the positional | F-2, F-7, DM-4 |
| AC-F2-2 | **Given** a `command` declaration whose program path is a symlink, **when** validation resolves the chain, **then** the declaration is accepted when the fully-resolved target is a regular executable file and refused `program-unavailable` (remedy "declare the program path as installed") when the chain is unresolvable or the target is not a regular executable | F-2, DM-3, DM-4 |
| AC-F3-1 | **Given** a declared integration id whose store holds zero or multiple `active` entries, **when** a `harness-store` reference resolves, **then** the resolution refuses `ambiguous-account` — never "first", never "newest" — with `source` and remedy rendered | F-3, DM-3 |
| AC-F3-2 | **Given** a declared integration id with no stored entry, **when** the reference resolves, **then** the refusal is `empty-output` and no other source — in particular the environment — is consulted | F-3, F-8 |
| AC-F3-3 | **Given** a non-opencode harness (e.g. `claude-code`) with a `harness-store` declaration, **when** resolution runs, **then** it refuses `source-not-supported` and consults no other source; and **given** a declaration whose `harness` field disagrees with the active harness identity, **when** resolution runs, **then** it refuses by reason without reading the declared harness's store or borrowing any store layout | F-3, DM-3 |
| AC-F3-4 | **Given** a store entry with `value.type: "oauth"`, **when** a `harness-store` reference resolves, **then** the entry is refused `oauth-excluded`; and no code path anywhere consumes, refreshes, or writes back an access or refresh grant | F-3, NG-1 |
| AC-F3-5 | **Given** export output that departs from the pinned shape (non-array root, missing field, unexpected `value.type`, or unparseable output), **when** the reference resolves, **then** the failure is `shape-drift` naming the harness and the field, with `type: "key"` extracting `key` and `type: "oauth"` refused per AC-F3-4 | F-3, DM-3 |
| AC-F4-1 | **Given** the closed reason set, **when** classification is exercised, **then** each of the ten reasons has a test case — including a `timeout` case proven distinct from the reserved `resolution-pending` — and **given** the shipped compositions, **when** they run, **then** no shipped caller ever observes `resolution-pending` (one-shot commands resolve before returning; the shipped daemon resolves nothing) | F-4, F-6, DM-3 |
| AC-F4-2 | **Given** a credential failure on each propagation site and rendered surface, **when** the refusal is rendered, **then** `source`, `reason`, and `remedy` survive on every surface (human output, JSON envelope, `status`, `doctor`, park/log line), other config-shaped summaries stay suppressed, the remedy strings come from the fixed `(reason, style)`-keyed per-allowlist-entry table, the host-aware `command`/`non-zero-exit` text applies only to entries with a host slot, the neutral text applies otherwise, and both texts are fixture-pinned | F-4, DM-2, DM-3, DM-6 |
| AC-F4-3 | **Given** any classified credential failure in the one-shot composition, **when** the command reports it, **then** the material is never empty, the caller never blocks past the per-execution cap, the quota path keeps the delivered park condition with no park-record field, and the command exits through the delivered `{0,1,2}` taxonomy without involving any daemon unit | F-4, F-6, NFR-1, NFR-6 |
| AC-F5-1 | **Given** a canary emitted by the child double, materialized **after** composition has completed, **when** every surface that carries diagnostics renders (human output, JSON envelope, `status`, `doctor`, park/log line, ledger record, capsule event), **then** the canary is redacted on each; a test that registers before composing is not an acceptable proof of this criterion | F-5, NFR-5 |
| AC-F5-2 | **Given** a child that emits malformed output, **when** the resolver processes it, **then** the resolver registers before parsing and before any throw, the resolution throws classified, and the raw output is never rendered; and **given** a fake child's stderr canary, **when** any surface renders, **then** the canary never appears | F-5, NFR-5 |
| AC-F6-1 | **Given** one reference resolved twice within one one-shot process, **when** the resolves execute, **then** exactly one child execution occurs and the second resolve is a memory read; a second distinct reference produces its own single execution; no further spawns occur for the remainder of the process; and the declared profile holds: `merge` exactly 1, `status` 0–2 by composition and 0 under shipped defaults | F-6, NFR-2 |
| AC-F6-2 | **Given** a hanging child and a recorded-invocation seam, **when** an execution runs, **then** the cap ends it and it is classified `timeout`; stdin is closed; stdout capture is bounded; stderr is captured for size and exit status only and never rendered; and the recorded child environment is exactly the reduced set (path, home, session-bus facts where the keyring requires them, declared non-secret variables) with no secret-bearing variable forwarded | F-6, NFR-1, NFR-8 |
| AC-F6-3 | **Given** the delivered spawn descriptor's capacity to carry a declared credential entry, **when** lane descriptors and the profile environment record are built from shipped settings, **then** an inventory-style checked proof (not an assertion) shows no credential entry in any descriptor and the record's key set is exactly the model-name set; and a declared credential entry keeps its unchanged spawn-time behaviour | F-8, DM-1 |
| AC-F7-1 | **Given** the CI tripwire, **when** a change alters the allowlist table, a committed command argv, or the effective argv derived from committed configuration without the allowlist module in the change, **then** CI fails naming the drift; **when** none of the three changes, CI passes; and **given** that no committed tracker-host coordinate exists in this change, **when** the tripwire enumerates declared `integrations.<kind>.host` coordinates from configuration itself, **then** it passes on their absence | F-7, DM-4 |
| AC-F8-1 | **Given** the delivered error table, park-record shape, announcement vocabulary, delivery-result tokens, and exit taxonomy, **when** the change's structure is inventoried, **then** no row, field, cause, code, token, or exit was added, and the failure variant grew only by the three optional fields bound as projection data to the unchanged row | F-8, F-4, NFR-6 |
| AC-F8-2 | **Given** the hermetic-suite requirement, **when** CI runs, **then** no test invokes a real owner CLI, real store, or real keyring; every strategy is exercised over injected seams (child runner, environment record, harness identity, allowlist table); and the suite passes with no credential present | F-8, NFR-4 |

## 18. ROLLOUT & CHANGE MANAGEMENT (HIGH-LEVEL)

Single additive change delivered on the feature branch; no data migration and no operator action required to upgrade. ADR-0014 lands in the same change as a `Proposed` decision record (decision date unset; draft-handling and revision-log material removed), with its index row and register binding; the owner accepts or rejects the posture change at the PR review — no agent marks it Accepted. Adoption is opt-in: nothing changes until an operator declares a non-default source, and the documented environment bridge keeps working unchanged. Documentation reconciliation happens in the change's documentation phase: the adapter-ports feature spec (whose "never reads the OS keyring" line holds mechanically — the product causes a declared owner CLI to read its own store, and the invocation is configuration), the config-layer, provider-engine, and doctor feature specs, the tracker-credential provisioning guide (whose "only an environment source is supported" / "never runs the tracker CLI's token read" absoluteness is deliberately reversed in-change), and the dispatch-engine preflight section. After merge, one named manual demonstration runs against a real owner store on an authenticated host (proof of the end-to-end promise, never a CI gate), and the three owner-designated delivery-time confirmations (OQ-1..OQ-3) are recorded as typed outcomes.

## 19. DATA MIGRATION / SEEDING (IF APPLICABLE)

N/A — no migration, no back-fill, no seeding. Existing declarations, defaults, and fixtures are unchanged and resolve byte-identically (AC-F1-2).

## 20. PRIVACY / COMPLIANCE REVIEW

Credential material is returned once through the port result and never persisted: not in logs, telemetry events, ledger records, capsule events, error envelopes, human diagnostics, status digests, or temporary files; never in a child argv or child environment (the declared harness-spawn path excepted and unchanged). Child stdout is material or discarded; stderr is never rendered. The reduced child environment forwards no secret-bearing variable. All redaction-registry consult points see material registered before any emit path. Custody remains with the owners: the tracker CLI keeps its keyring, the harness keeps its store and its OAuth grants, and the product never touches an owner's storage. Residual exposures are the operator's own shell history and same-user processes — the delivered same-user trust model, unchanged.

## 21. SECURITY REVIEW HIGHLIGHTS

- **Posture change, owner-stated.** The product may now cause a pinned owner CLI to run a pinned subcommand; it still never reads a store itself, never calls a keyring API, never inherits an ambient variable implicitly, and declares no fallback — the delivered guarantees (one credential-material directory, one allowlist entry, no new ambient read) hold mechanically. The direction is owner-stated in GH-394; ADR-0014 (Proposed) supplies the record and the owner accepts it at the PR.
- **The allowlist is the exfiltration control.** A committed generic argv would be an exfiltration primitive without needing a shell; the closed table, grammar-closed slots, `--` terminator, symlink-to-regular-executable validation, and the CI tripwire over table/committed argv/effective argv make the act "two pinned subcommands" and any widening loud.
- **Register-on-materialize closes the unredacted window** that today's construction-time snapshot would open for any later-obtained material; the invariant and the register-after-compose canary proof are contractual (AC-F5-1/2).
- **OAuth custody is refused outright** (OAuth-1): no access, no refresh, no write-back, anywhere (AC-F3-4).
- **Named residuals:** a same-user-writable program path can be redirected (same-user trust model; validated resolution mitigates); a review that widens the table is ordinary code-change trust; the `active` flag is the harness's unverified report; a leaked tracker token is durable until the operator revokes it; the service-less sessionless default path has one outcome not expressible in the reason set (OQ-1, revisit trigger recorded).

## 22. MAINTENANCE & OPERATIONS IMPACT

Allowlist additions are reviewed code changes with a tripwire-backed diff requirement — never operator-side configuration. The harness export shape and a supported version window are pinned in the suite, so another product's release that drifts the shape is a red test and a classified refusal until re-pinned. The remedy table is shipped data: edits are fixture-pinned, and the host-aware/neutral selection must be revisited whenever an allowlist entry gains or loses a host slot. Operator documentation changes in-change (the reversed absoluteness; opt-in declaration guidance; the knowingly-duplicated fallback path). The per-process memo and cap values are declared, reviewed constants; changing them reopens the latency assessment recorded in ADR-0014. No new operational surface exists for the daemon: it still resolves nothing after this change.

## 23. GLOSSARY

| Term | Definition |
|------|------------|
| Credential owner | The tool that already holds and manages the credential — the tracker CLI for the tracker token, the harness for provider keys; the product uses, never holds, the credential |
| Store-ownership resolution | Obtaining a credential at use time from its owner's own store through the owner's supported non-interactive surface, instead of reading a copied value |
| Style | One of the four closed source families a reference may declare: `literal`, `environment-prefixed`, `command`, `harness-store` |
| Allowlist entry | A shipped (absolute program path, pinned subcommand prefix, permitted parameters, slot grammar, remedy selection) tuple; the only `command` declarations expressible |
| Slot grammar | The closed pattern a free parameter must match (`<host>`: `[A-Za-z0-9.-]+`; `<integrationID>`: `[a-z0-9][a-z0-9_-]*`), no leading `-`, bounded length, `--` terminator before the positional |
| Binding-supplied slot (inert) | An allowlist slot marked to take its value only from a committed tracker-host coordinate; stated in the schema, inactive until #396 |
| Register-on-materialize | Registering resolved material into the live redaction registry at the moment it is obtained — before parsing and before any throw — so no emit path can carry it unredacted |
| Per-process memo | The one-shot guarantee that a reference triggers exactly one child execution per process; every later resolve is a memory read |
| Per-execution cap | The declared bound on one child execution (15 s default, 30 s hard bound); a run reaching it is classified `timeout` |
| OAuth-1 | The rule that the product never consumes a harness-owned OAuth grant — no access, no refresh, no write-back — and no style can express one |
| Shape drift | A departure of the harness export from its pinned shape, classified `shape-drift` naming harness and field |
| Supervise-only | The shipped daemon mode: no lane executor, no tracker read, no credential consumer |
| `resolution-pending` | The reserved reason meaning "declared, first materialization not yet complete — not a failure"; unobservable by shipped callers; activates with #395 |
| One-shot CLI composition | The command set that resolves on demand and synchronously in this change: `dispatch`, `merge`, `status`, `commit`, `verify`, `queue` |

## 24. APPENDICES

### Appendix A — Measured external surfaces (2026-11-23, timings only, no value read)

| Command | With background service | Standalone |
|---------|------------------------|------------|
| `gh auth token` | 34–36 ms; ~83 ms (second host) | — |
| `opencode auth export <id>` | 103–117 ms; 229 ms warm | 4,393–4,579 ms; 5,481–6,012 ms (second host) |

Verified forms: `opencode auth export -- <id>` → exit 0; `opencode auth export --standalone -- <id>` → exit 0; `gh auth token --hostname github.com` → exit 0. Export root: JSON array of `{id, integrationID, label, active, value}`; `value.type` ∈ `key` | `oauth`.

### Appendix B — Reason set and remedy selection

Closed reason set (ten members): `program-unavailable` · `timeout` · `non-zero-exit` · `empty-output` · `shape-drift` · `ambiguous-account` · `oauth-excluded` · `source-not-supported` · `variable-absent` · `resolution-pending` (reserved).

Owner-pinned remedy texts (fixture-pinned byte-exact):
- `command` / `program-unavailable`: "declare the program path as installed".
- `command` / `non-zero-exit`, host-aware (entries with a host slot): "the program could not obtain a token; it may not be authenticated to the required host — log in to that host (for `gh`: `gh auth login --hostname <host>`), or declare another source." (names no concrete host in this change — no binding exists).
- `command` / `non-zero-exit`, neutral (entries without a host slot): "the program could not obtain a token; it may not be authenticated — log in, or declare another source."

All other cells are fixed shipped table strings keyed by `(reason, style)`, selected per allowlist entry, never interpolated from configuration text or child output; content contract: bounded text naming the one operator act that helps (e.g. a `harness-store`/`timeout` remedy names the standalone flag; a `literal`/`variable-absent` remedy names the variable declaration path).

### Appendix C — Owner-restated acceptance criteria mapping

| Owner AC (restated) | Spec criteria |
|---------------------|---------------|
| 1. One-shot resolves tracker via `gh` and provider keys via harness store; no environment file, no operator copy; daemon-status AC superseded (shipped daemon consumes no credential — the proof is the one-shot composition) | AC-F1-1, AC-F6-1 |
| 2. Exactly one `active` entry else `ambiguous-account`; no-stored-entry is `empty-output`, never fall-through | AC-F3-1, AC-F3-2 |
| 3. `literal`/`environment-prefixed` validate and resolve byte-identically; no migration | AC-F1-2 |
| 4. OAuth never consumed; refused `oauth-excluded`; no refresh, no write-back | AC-F3-4 |
| 5. No resolved material on any surface — canary materialized AFTER composition; malformed output throws, never rendered; stderr canary never rendered | AC-F5-1, AC-F5-2 |
| 6. Non-opencode harness refuses `source-not-supported`; declared harness must match or refuse | AC-F3-3 |
| 7. Export shape drift classified `shape-drift` naming harness and field | AC-F3-5 |
| 8. Lane spawn env model-only for shipped settings — checked proof, not assertion; declared entry keeps spawn behaviour | AC-F6-3 |
| 9. Allowlist enforcement: in-table accepted, out-of-table/interpreters/network clients/unpermitted parameters/flag-smuggling refused at load; symlink accepted on regular executable target; tripwire fails without the allowlist module in the change and passes with no committed host coordinates | AC-F2-1, AC-F2-2, AC-F7-1 |
| 10. One case per reason incl. reserved `resolution-pending`, `timeout` distinct; hanging child asserts the cap; remedy fields survive every rendered surface; host-aware and neutral texts fixture-pinned | AC-F4-1, AC-F4-2, AC-F4-3, AC-F6-2 |

### Appendix D — Governing records and precedent

ADR-0007 (credential port placement and parks), ADR-0008 (harness adapter contract), TDR-0012 (name-only credential diagnostics), TDR-0019 (dispatch admission preflight; the deny-by-default posture whose C-4 direction change is owner-stated here), TDR-0023 (daemon environment), TDR-0049 (lane records carry no credential value), TDR-0056/0057 (loop supervision and stop records), ADR-0013 (one-identity-with-named-reason pattern precedent only), and ADR-0014 — the governing decision record for this change, landing `Proposed` with the change.

## 25. DOCUMENT HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-23 | @spec-writer | Initial specification, built from the owner's six ticket comments (read order per the READ ORDER comment) and the ADR-0014 revision-8 draft |

---

## AUTHORING GUIDELINES

Authored from the planning-session authority chain only: the ticket body is superseded by the owner's six comments (settled design D1–D11; two corrections — symlink resolved and accepted, remedy keyed by `(reason, style)`; the READ ORDER boundary note; the two remedy-wording comments), with the ADR-0014 revision-8 draft as the canonical design artifact. The draft is never copied verbatim and never referenced as a local path; ADR-0014 is cited as the governing record, and its landing (status `Proposed`, decision date unset, index/register rows) is a plan/delivery concern. Acceptance criteria encode the owner-restated set one-to-one (Appendix C) in Given/When/Then with linked capability IDs. Verification statements are CI-provable with injected seams; a real-store demonstration is named as a manual/post-merge step, never a gate. Scope boundaries follow the READ ORDER note exactly: the #395 resident composition appears only as explicitly-out-of-scope forward context (§7.3), and the C-10 binding-supplied slot exception is stated as inert. Missing upstream specifics (concrete slot length bounds) are recorded as open questions rather than invented. No implementation file paths, tasks, or git instructions appear in this spec.

## VALIDATION CHECKLIST

- [x] `change.ref` matches provided `workItemRef` (GH-394)
- [x] `owners` has at least one entry
- [x] `status` is "Proposed"
- [x] All sections present in order (1–25 + guidelines + checklist)
- [x] ID prefixes consistent and unique (F-, AC-, NFR-, RSK-, DEC-, DM-, OQ-, NG-, G-)
- [x] Acceptance criteria reference at least one F-/DM-/NFR- ID and use Given/When/Then
- [x] NFRs include measurable values
- [x] Risks include Impact & Probability
- [x] No implementation details (no file-level code paths, no step-by-step tasks)
- [x] No content duplicated from linked docs (ADR-0014 referenced as governing record, not copied)
- [x] Front matter validates per front_matter_rules
