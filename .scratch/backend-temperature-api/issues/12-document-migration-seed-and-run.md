# 12: Document the migration, seed, and run procedure

**What to build:** The manual steps become discoverable without reading source. Someone arriving at a fresh checkout can bring the stack up,
migrate, seed, run the dev frontend against it, and know what to expect — including that the globe will be empty and fill in over roughly 26
minutes.

What the documentation needs to cover:

- Bringing the stack up, migrating, and seeding, in order, with the commands to run and the fact that these steps are manual by design —
  nothing migrates as a side effect of starting.
- The two connection strings, why they are two, and which context reads which. This is the step most likely to be got wrong silently.
- Running the dev frontend on the host against the containerised api.
- What a freshly deployed instance looks like: an empty globe filling in over roughly 26 minutes, with Coverage climbing, and why there is
  no seeded sample data.
- For an operator: where a Sweep's upstream call count and Rate Limit hits are recorded, and that they exist to check the undocumented
  Budget weighting from ADR-0001 against reality — if it proves harsher, Resolution or Sweep frequency must come down.

The repo's agent guidelines and architecture guide also need to account for the api package: it follows the same layering, dependency
injection, and naming suffixes as the web app, with the loader constraint from ADR-0004 and Node's built-in test runner as the local
differences. New backend dependencies are pinned exactly; the web app's existing ranges are deliberately untouched in this effort.

**Blocked by:** 11

**Status:** ready-for-agent

- [ ] The migration and seed procedure is documented as an ordered set of commands, stating that the steps are manual by design
- [ ] The two connection strings are documented, including which context reads which and why they are kept apart
- [ ] Running the dev frontend against the containerised api is documented
- [ ] A freshly deployed instance's behaviour is documented: empty globe, Coverage climbing, roughly 26 minutes, no seeded sample data
- [ ] The Sweep counters are documented for an operator, with what they are for
- [ ] The repo's agent guidelines and architecture guide cover the api package's conventions and how they differ from the web app's
- [ ] Someone following the documentation on a fresh checkout reaches a working globe without reading any source
