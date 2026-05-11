# Daily Context

Daily Context is an Obsidian plugin that exposes structured, date-scoped vault
context for other automations. It is intended to sit between flexible date
indexing plugins and consumers such as Visual Notes.

```text
date-tags -> Daily Context -> Visual Notes
```

## What it provides

- A versioned API at `app.plugins.plugins["daily-context"].api`.
- Daily prelude extraction: the headerless block after frontmatter and before
  headings/query blocks.
- Configured manual section extraction, such as `notes`, `decisions`, and
  `blockers`.
- AI session document discovery for session folders tagged/tied to a date.
- Date-tagged related file discovery, excluding generated visual artifacts.
- Configurable date-tag source: either the built-in `date/YYYY/MM/DD`
  convention or the `date-tags` plugin API. When the API source is selected,
  Daily Context requires that API instead of silently falling back.
- Stable source hashes and an aggregate context hash for downstream caching.

It returns structured source data, not rendered Dataview or Tasks query output.
Dataview, DataviewJS, and Tasks fenced query blocks are stripped from configured
manual sections by default.

## API sketch

```ts
const api = app.plugins.plugins["daily-context"]?.api;
const context = await api.getDailyContext("2026-05-11", {
  contextId: "personal",
});
```

The response includes:

- `schemaVersion`
- `parserVersion`
- `date`
- `dateTag`
- `dateTagSource`
- `contextHash`
- `sources[]`

## Development

```bash
npm install
npm run test:feature
npm run typecheck
npm run build
```

## Composition boundary

Daily Context does not extract graphs, call LLMs, or render visuals. Visual Notes
can consume the structured context and decide how to prompt, cache, and render.
