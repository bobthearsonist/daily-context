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

## Dates vs. date tags

Daily Context keeps these separate:

- `date` is the day being requested, normalized as `YYYY-MM-DD` so API calls,
  filenames, caches, and comparisons use one stable value.
- `dateTag` is the Obsidian tag used to find related notes, such as
  `date/2026/05/11`.

The normalized `date` does not replace the tag format. If **Date tag source** is
set to **Date Tags plugin API**, Daily Context passes the normalized date to
Date Tags and uses the tag returned by that plugin. If it is set to
**Built-in convention**, Daily Context uses `date/YYYY/MM/DD` directly.

## Development

```bash
npm install
npm run test:feature
npm run typecheck
npm run build
```

### Local-only integration profile

Default tests use public, generic fixtures. To verify a private vault setup
without committing paths or note content, copy
`test/local/local-profile.example.json` to a gitignored
`test/local/<name>.local.json` and run:

```bash
DAILY_CONTEXT_LOCAL_PROFILE=test/local/<name>.local.json npm run test:local
```

Local profiles and `test/local/.output/` are ignored by git. The local test
asserts source metadata and bounds without printing raw note content.

## Composition boundary

Daily Context does not extract graphs, call LLMs, or render visuals. Visual Notes
can consume the structured context and decide how to prompt, cache, and render.
