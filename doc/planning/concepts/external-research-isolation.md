---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/planning/concepts/external-research-isolation.md
---
# Concept: external research isolation

Status: Draft (2026-10-27, from owner notes; local refinement in
progress, not committed). The external-researcher agent is the
designated contact point with untrusted internet content, making it
the **most dangerous zone in the system** - treat it as assumed
compromised and design accordingly. Companions:
[containerized-delivery.md](containerized-delivery.md) (container
profiles), [policy-as-code.md](policy-as-code.md) (threat model:
external content is data), the memory model (quarantine of external
content, trust level T1), [retrospectives.md](retrospectives.md)
(incident triggers, evidence).

## The threat this answers

Prompt injection is assumed to succeed eventually: fetched web content
carries instructions, the agent follows them, and the payload wants
one thing - out. Exfiltration needs a channel: network egress, a
credential to abuse, or data worth stealing. This concept removes all
three for the agent that touches the outside world.

## The pattern (five layers)

### 1. Nothing to reap

The external researcher runs in a **bare, disposable container**: no
real credentials, no other repos mounted, no fleet state, no memory
beyond its scratchpad, no secrets in the environment. The mounted
research context is scrubbed (the research question and references,
never unrelated content). If the agent is fully compromised, the
attacker controls an empty room.

### 2. Mediated egress - the sole window to the internet

Default posture: containers have **no direct network egress**. The
researcher gets exactly one mediated path: an **egress proxy service**
(the firewall container) that only it may use.

- HTTP(S) only, through the proxy; **all other protocols blocked**
  (no SMTP, no IRC, no raw TCP; DNS resolves through the proxy so DNS
  tunneling is visible and bounded).
- **Read-only web by default**: GET allowed; POST and request bodies
  blocked at the proxy. Not airtight (a key can hide in a query
  parameter, a path, or a resource name) - but it removes the cheap
  exfiltration shapes and leaves only the noisy ones.
- URL allowlists and blocklists, reputation filtering, and optional
  content scanning in the proxy: strip or flag active content and
  known injection patterns before pages reach the agent.
- Other agents get no window by default. Any agent needing internet
  access goes through the same mediated path with an explicit grant
  (AutonomyContract egress policy) - the proxy is the single choke
  point, not a researcher perk that becomes a habit.

### 3. Canary traps

The researcher's container is **seeded with booby traps**: realistic
fake keys in the home directory, a fake credentials file, decoy
services on localhost. Normal work never touches them. A read tool
scanning the home folder or opening a key file trips the trap:
**automatic safe-state demotion - the agent is paused, the container
frozen (not destroyed - it is evidence), and an incident retro
triggers** (retrospectives.md R3). Tripwires are safe-state
operations, not punishments; a false trip costs a container restart,
a missed trip is caught by layers 2 and 4.

### 4. Contact observability and injection attribution

The proxy logs every request: which address, when, from which agent,
correlated with which fetched content later appeared in the agent's
output. When a tripwire fires or injected instructions surface, the
**source address is already known** - injection attribution becomes a
lookup, not a forensic project. Tripwires and attributions feed a
blocklist service: addresses that served injected or malicious content
are blocked for the whole fleet, and the corpus of attributed
injections becomes research material (what injection patterns
actually look like in the wild - retro and research track input).

### 5. Results enter through quarantine

Nothing the researcher fetches becomes authoritative directly. Fetched
content lands in the quarantine store as T1 external content (memory
model): sanitized, provenance-tagged with the source URL and fetch
time, and referenced - never inlined into shared memory or artifacts
without passing the promotion gates. The researcher's report is
evidence with provenance; its citations point into quarantine.

Two refinements to the reference-not-content rule:

- **When the URL is the artifact**: sometimes the deliverable is the
  pointer itself (official framework docs, a spec page). Citations
  carry the URL with fetch date and a content hash, and the quarantine
  keeps an archived snapshot so the citation survives link rot. The
  URL as data is fine; the page content as instructions is not.
- **Research results are first-class persisted citizens**: the
  research working area (reports, extracted findings, intermediate
  files, execution plans) is persisted in durable storage decoupled
  from the container - kill and remove the container, keep the
  research. Git or blob storage are the candidate backends (research
  output is mostly text and snapshots; git gives provenance and
  reviewability for free, blobs handle bulk). The container's
  filesystem is the scratch; the persisted store is the record.

### 6. Stateful research sessions

Research is not always one-shot. A research session is a persistent
object with a TTL (default on the order of days, for example 7): the
researcher's container lives across runs, or is recreated on demand
from its persisted state, and the agent keeps a local memory inside
its isolated zone - intermediate findings, files, execution plans -
which it can recap and resume. Consumers can start a new research or
**ask follow-up questions against an existing one** ("the 2026-10
container runtimes comparison - does it cover Windows?"). Session
state stays inside the isolation boundary; only promoted, sanitized
results exit through quarantine. Every safety layer above still
applies for the session's whole life: a tripwire fires or injection
is detected, the research dies instantly regardless of age or value.

### 7. Research levels as skills

Different depth levels are skills inside the researcher container:
quick lookup (one source, cite and done), focused research (a few
sources, short synthesis), and deep research in the style of the
hosted providers - execution plan, iterative search-read-synthesize
loops, contradiction handling, structured report - executed inside
the isolated zone under the same egress policy. The level is chosen
by the requesting agent and priced accordingly (tokens and time);
deep research is the most exposed profile and the primary beneficiary
of the stateful-session pattern above.

## Security testing: red-team the traps

The isolation pattern ships with its own adversarial test practice:
fabricate malicious pages (injection payloads instructing the agent to
scan for keys and exfiltrate them), point a researcher - deliberately
on a weak or cheap model - at them, and try to break out: reach the
canary keys, smuggle content past the read-only proxy, exfiltrate via
query parameters. Every escape is a finding; every trip is a pass.
This is the injection red-team drill, run periodically (cheap model =
cheap drill) and after any change to the proxy policy, the canary
layout, or the researcher skill set. Findings feed the blocklist
service and the incident retro track.

## Why this generalizes

The egress-mediator + bare-container + tripwire pattern is the
template for **any agent with an unusual attack surface** (email
readers, tracker-sync agents, package-install agents). The external
researcher is simply the first and most exposed instance, and the one
where the pattern pays for itself fastest. The AutonomyContract
egress block is the policy hook; this concept is the reference
implementation of its most restrictive profile.

## Story impact

Extends the containerized-delivery stories: the researcher container
profile (bare image), the egress proxy service with policy config and
request logging, tripwire seeding and the freeze-on-trip safe state,
quarantine-store integration, and the blocklist feed. All local-first
(one proxy container on the workstation); the fleet service built
from attribution logs is a later increment.

## Open questions

1. Proxy policy granularity: per-agent URL classes (search versus
   docs versus code hosts) - worth the config surface, or one
   read-only profile first?
2. Canary realism tuning: how often to rotate fake keys and decoys so
   they read as real to a scanning payload but never as noise to the
   agent's legitimate work.
3. Blocking at the proxy cannot see TLS interiors (CONNECT tunnels):
   accept and rely on tripwires plus attribution, or terminate TLS in
   the proxy for inspection (bigger trade-off - privacy, cert
   pinning breakage)?
4. Should tripwire events auto-publish to the fleet blocklist
   immediately (fast, spam risk) or after a retro confirms
   attribution (slower, cleaner)?
