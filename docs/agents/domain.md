# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root: the glossary.
- **`docs/adr/`**: read the ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The
`/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions
actually get resolved.

## File structure

This repo is **single-context**:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-fetch-hourly-forecast-windows.md
│   └── ...
└── apps/
    ├── web/
    └── api/
```

`apps/` holds several deployables, not several contexts. The web app, the API, and the sweep worker all speak the same ubiquitous language —
Grid, Grid Point, Sweep, Slice, Snapshot, Forecast, Budget mean exactly the same thing in each — so there is one glossary and one ADR
directory for the whole repo. The packages deliberately share no code (see `CONTEXT.md` and the ADRs), but shared code and shared language
are different concerns.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in
`CONTEXT.md`. Don't drift to synonyms the glossary explicitly lists under `_Avoid_` — several of them (`reading`, `observation`, `batch`)
were rejected for specific reasons recorded there.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or
there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0003 (flat Cells, no interpolation), but worth reopening because…_
