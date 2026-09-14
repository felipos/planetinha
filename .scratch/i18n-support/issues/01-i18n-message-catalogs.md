# 01: i18n message catalogs for the frontend

**What to build:** Extract `apps/web`'s user-facing strings (component copy, aria-labels, and the error messages that reach the screen
through `DataFetchStatus`) into pt-BR and English message catalogs, with a way to select or infer which one a viewer sees.

**Status:** needs-triage — deliberately not being worked on now; see `spec.md` for why this ticket exists and what was found while touching
an unrelated string.

- [ ] An i18n approach is chosen (library or hand-rolled) and the choice is recorded
- [ ] Every user-facing string in `apps/web/src/presentation` is extracted into pt-BR and English catalogs
- [ ] A language can be selected or is inferred from the browser, and switches all extracted UI text
- [ ] Internal/technical error strings that are already English by convention (e.g. `HttpClientService`'s messages,
      `MALFORMED_RESPONSE_MESSAGE`) are explicitly excluded from the catalogs — those stay English regardless of UI locale, per `AGENTS.md`
