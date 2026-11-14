# GH-313 — M0/M1/M2 tracker-consistency evidence

Recorded: 2026-11-14 (plan phase 6, PM lane)
Method: read-only tracker reads (`gh issue list/view`, paged at 1000) compared as data against the `- Ticket: GH-N (milestone Mx)` declarations in `doc/planning/oss-tooling/backlog.md`. Zero tracker writes: no issue, label, or milestone was created, edited, or closed during this evidence run.

## Declared vs attached

Every ticket declared by an M0, M1, or M2 backlog section is attached to the milestone its declaration names. Declared totals and matches:

| Milestone | Declared in backlog | Attached to the declared milestone | Gap list |
|---|---|---|---|
| M0: Trust substrate (#1) | 20 | 20 (all closed) | empty |
| M1: Delivery engine and autonomous dispatch (#2) | 23 | 23 (all closed) | empty |
| M2: Ceremonies, measurement, and memory (#3) | 19 | 19 (12 closed, 7 open) | empty |
| **Total** | **62** | **62** | **empty** |

Per-ticket verification compared the issue's milestone title against the declared milestone code and the issue title's story-code prefix against the declared story; zero mismatches. The raw per-ticket table is reproducible with the read-only command set in the method line.

## Attached but undeclared (reported, not reconciled)

Five milestone members carry no backlog `- Ticket:` declaration. They are planning and scaffolding issues, all closed, and they are reported here rather than edited:

| Issue | Milestone | State | Disposition |
|---|---|---|---|
| GH-219 | M1 | closed | Planning umbrella for the M1 redefinition; declared by narrative, not by a story block |
| GH-268 | M2 | closed | Recurring-merge-blocker chore delivered inside M2 |
| GH-284 | M2 | closed | M2 planning document |
| GH-286 | M2 | closed | Daemon lifecycle mount delivered inside M2 |
| GH-303 | M2 | closed | M2 domain-model amendment |

Arithmetic reconciles exactly: M1 declared 23 + 1 = 24 members; M2 declared 19 + 4 = 23 members. No milestone member is phantom, duplicated, or missing.

## Deliberately unattached backlog (reported, not reconciled)

- `change`-labelled issues with no milestone: **94** at recording time, of which **42** are open.
- These are the broad `change` backlog outside the M0-M2 planned scope. None is named in an M0, M1, or M2 backlog section, so none is a declared-but-unattached gap.
- This is a planning-time snapshot, not a live guarantee: the figure moves as issues are opened and attached.

## GH-313

- State: open.
- Milestone: M2: Ceremonies, measurement, and memory (#3) — attached.
- Title: `M2-S20: Milestone-first planning and delivery (M2)`; the backlog declares `- Ticket: GH-313 (milestone M2)` in the M2-S20 block.

## Conclusion

The milestone records are consistent: zero declared tickets unattached across M0, M1, and M2, closed tickets included; the only declared-vs-tracker divergence is the five attached-but-undeclared planning issues, disclosed above with disposition; and the deliberately unattached backlog count is reported rather than reconciled.

## Reproduce (read-only)

```bash
grep -E '^- Ticket: GH-[0-9]+ \(milestone M[0-9]\)' doc/planning/oss-tooling/backlog.md
gh issue list -R juliusz-cwiakalski/agentic-delivery-os --state all --limit 1000 \
  --json number,title,state,milestone
gh issue list -R juliusz-cwiakalski/agentic-delivery-os --label change --state all --limit 1000 \
  --json number,state,milestone
```
