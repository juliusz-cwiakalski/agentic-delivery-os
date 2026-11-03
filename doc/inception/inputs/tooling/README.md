# Tooling subproject inception inputs

Owner-provided direction for the inception run anchored at GH-200. The run
incepts the OSS tooling subproject (the TypeScript monorepo under `packages/`
plus its delivery stack), not the repository's delivery framework.

Files:

- `README.md` - this index, the mission, and the hard constraints.
- `01-current-state.md` - factual inventory of committed truth the run starts
  from (pointers, not analysis).
- `02-scope-direction.md` - owner decisions that bind the run: scope,
  delivery mode, verify-don't-regenerate rules, coordination with open
  stories.

The bootstrapper consumes these as trusted direction. Everything else scanned
from the repository is untrusted source material per the bootstrapper trust
boundary. Private working materials exist for the owner's own drive of the
run; they are never referenced from committed files.
