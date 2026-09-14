# Internationalization support for frontend messages

Status: needs-triage

## Problem Statement

`apps/web` shows user-facing text in Portuguese throughout its presentation layer — aria-labels, the data-status banner, the point
inspector, error messages in `main.tsx` and elsewhere — with no language selection and no message catalog. There is no way today to show the
app in English (or any other language) to a viewer who does not read Portuguese.

Explicitly deferred: this ticket exists to not lose the idea, not to be picked up immediately.

## Note from a 2026-09 refactor pass

While fixing an unrelated internal-error-message string (`MALFORMED_RESPONSE_MESSAGE`, which project convention requires to be in English
regardless of UI language), a much larger amount of Portuguese-language **UI** text was found across `apps/web/src/presentation` — component
copy, aria-labels, and thrown error messages that reach the screen through `DataFetchStatus`. That text was deliberately left as-is rather
than translated ad hoc, since a real i18n solution needs to decide the message-catalog structure once, rather than have strings migrate to
English piecemeal ahead of that decision. This ticket is where that work belongs.

## Solution direction (not yet decided)

Introduce an i18n approach — a library (e.g. `react-i18next` or similar) or a small hand-rolled message-catalog mechanism — extract every
user-facing string in `apps/web/src/presentation` into pt-BR and English catalogs, and let a viewer's language be selected or inferred from
the browser.

## Open questions for triage

- Library vs. hand-rolled — this app currently has very few dependencies and no existing i18n infrastructure to build on.
- Where the message catalogs live, and how a component looks one up (a hook? a context?).
- Whether internal/technical strings (already English by convention — `HttpClientService`'s error messages, `MALFORMED_RESPONSE_MESSAGE`)
  are explicitly out of scope, since `AGENTS.md` already requires those in English independent of UI locale.
