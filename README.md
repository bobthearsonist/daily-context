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
- Stable source hashes and an aggregate context hash for downstream caching.

It returns structured source data, not rendered Dataview or Tasks query output.

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
