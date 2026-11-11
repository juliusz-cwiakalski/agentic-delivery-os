---
# Copyright (c) 2025-2026 Juliusz Ćwiąkalski (https://www.cwiakalski.com | https://www.linkedin.com/in/juliusz-cwiakalski/ | https://x.com/cwiakalski)
# Apache-2.0 License - see LICENSE file for full terms
source: https://github.com/juliusz-cwiakalski/agentic-delivery-os/blob/main-tools/doc/guides/migrating-to-per-repository-state.md
ados_distribution: redistributable
id: GUIDE-MIGRATE-PER-REPOSITORY-STATE
status: Draft
created: 2026-11-11
owners: ["engineering"]
summary: "One-step, reversible move of an existing single delivery store into a per-repository project state root."
links:
  related_changes: ["GH-288"]
---

# Migrating to Per-Repository Delivery State

Delivery state is now scoped per repository. The host root keeps the host-wide
documents it always had, and each checkout's delivery state lives in its own
project root beneath it:

```
<host root>/                      the host root: the override, or <home>/<state directory name>
  host-index.json                 the derived host index (not a store artifact)
  owner-hold                      the host-wide owner hold (unchanged; see below)
  projects/
    <project key>/                one project state root per checkout
      ledger.<workspace>.jsonl
      header.<workspace>.json
      index.<workspace>.sqlite
      fence.<workspace>.lock
      documents.<workspace>/
      quarantine.<workspace>/
      chain-key.<workspace>.json
      chain-key.retro.<workspace>.json
      retro-evidence.<workspace>.jsonl
      retro-evidence.lock
  unbound/                        the declared scope for an invocation outside any checkout
```

An existing installation has one populated store directly at the host root.
Migration is **one directory move**, performed by an operator. Nothing migrates
automatically, no command performs the move, and no state file is rewritten.

## Choose the primary checkout

Designate exactly **one** checkout as the primary project and run any state-opening
command inside it (for example `status`). That command registers the project and
prints the derived project key and state location.

Why one: queue entries, phase transitions, and audit records carry no repository
attribution, so any split of the historical store across repositories would be
inference presented as evidence. The primary project keeps the history it had.

## Perform the move

1. Stop the foreground coordinator (and any resident daemon) so nothing writes
   while the files move.
2. Resolve the primary project's state root with `projects list --json` — its
   `stateLocation` is `<host root>/projects/<project key>`.
3. Move every artifact named above from the host root into that directory,
   keeping its name and its mode. The artifact set moves as one unit: the ledger,
   the header, the index, the fence, `documents.<workspace>/`,
   `quarantine.<workspace>/`, the audit chain key, the retro sidecar and its
   lock, and the retro chain key.
4. Leave `host-index.json`, `owner-hold`, `projects/` and `unbound/` where they
   are: they are not store artifacts.

## Verify

- `projects list` shows the primary project and its state location.
- A read command inside the primary checkout serves the moved history: the
  audit chain still verifies, `retro` still reads its sidecar, and the phase
  position is unchanged.
- `status` reports no migration warning. A warning means the move is incomplete.

## What happens to other checkouts

Every other checkout starts fresh. Its first state-opening command creates an
empty project root, and its records begin at that point. Historical records are
not re-attributed, copied, or shared — two checkouts never read one another's
state.

## The owner hold stays host-wide

The owner-hold marker stays at the host root and keeps holding **every** project
on the host; it is not moved into any project root and no per-project marker
exists. A hold that was active before the migration is still active after it.

## Invocations outside a checkout

A delivery command run outside any git work tree uses the declared `unbound`
scope at `<host root>/unbound` and warns once that its state is not
repository-scoped. It registers nothing, creates no project root, and keeps its
exit code. Run delivery commands inside a checkout.

## The host root override

An absolute `<PREFIX>_STATE_DIR` environment value names the **host root**;
project roots derive beneath it (`<host root>/projects/<key>`). The delivery
store begins honouring that override in this change — until now only the audit
seam did. An operator who already sets the override previously kept the store
under the home default (`<home>/<state directory name>`), so that store's
contents must be moved into the derived project root under the override, using
the same procedure above with `<host root>` meaning the override path.

The CLI-independent shell fallback reads its **own** pre-freeze state-root
variable, with its unchanged precedence: that variable first, then the
repository-local default (`<checkout>/.ai/local/state`), then the home default.
Its exact name is declared — and documented — at the top of
`scripts/lib/dispatch-authority.sh`: the product's pre-freeze prefix plus
`DISPATCH_STATE_ROOT`. The typed commands read `<PREFIX>_STATE_DIR`. The two
names are separate contracts, so on a host that sets the typed override you must
also export the fallback's variable with the same absolute host root as its
value, and keep it in the environment of the shell entry points. Without it the
fallback looks under its old default, finds no project authority document, and
reports `dual-run`, while the typed commands are authoritative — a split
authority that looks like a missing handover. Setting both is the supported
configuration.

## Reversing the migration

Move the artifacts back from the project root to the host root, keeping their
names and modes, and start the commands again: the pre-migration reads work
unchanged. Because the move rewrites nothing, the inverse move is sufficient —
no export, import, or re-key step exists.

## Do not delete the identity marker

The project key is minted once inside the checkout's git common directory
(`project-identity.json`) and recorded there with its mint-time basename. That
marker is authoritative: deleting it mints a new key, and the moved state would
no longer be found. Keep it, and keep it out of version control only if your
tooling already ignores the git directory.

## What `projects list` writes

`projects list` is read-only with respect to delivery state: it never writes the
host index, never prunes, never replaces a corrupt index, never creates a project
state root, and never changes a phase document, a queue record, or any other
store content. Two side effects are permitted and bounded: on a checkout without
an identity marker, scope resolution mints that marker inside the checkout's git
common directory (the same create-once file every command needs), and reading a
project's handover evidence opens its store read-only, which lets the store
remove a leftover `*.tmp` sibling. Neither can create or change state.

## Troubleshooting

- **A migration warning keeps appearing.** The host root still holds at least one
  store artifact. Re-check the artifact list above; the host index and the owner
  hold never trigger it.
- **A project disappeared from `projects list`.** Its recorded checkout root no
  longer exists, so the row is not reported; the index entry stays until the next
  state-opening invocation prunes it. The state root it referenced is never
  deleted by pruning.
- **Two checkouts show the same project key.** A marker was copied between
  checkouts. The host index keeps the first registration and the colliding
  checkout reports `projects.state-unavailable`; restore the correct marker from
  that checkout's own history or start it as a new checkout.
