import assert from "node:assert/strict";
import test from "node:test";
import { extractConfiguredSections, extractDaySection, extractPrelude } from "../../src/parser";

test("extractPrelude reads headerless content after frontmatter before query blocks", () => {
  const markdown = `---
tags:
  - daily
---

Quick manual context.

More context.

# modified files

\`\`\`dataviewjs
dv.list([])
\`\`\`
`;

  assert.equal(extractPrelude(markdown), "Quick manual context.\n\nMore context.");
});

test("extractPrelude stops before a query block when there is no heading", () => {
  const markdown = `---
tags: [daily]
---

Manual context before query.

\`\`\`tasks
not done
\`\`\`
`;

  assert.equal(extractPrelude(markdown), "Manual context before query.");
});

test("extractConfiguredSections matches configured headings and keeps nested content", async () => {
  const markdown = `# Notes

Top note.

## Project A

Nested note.

# Tasks

Ignored.
`;

  const sections = await extractConfiguredSections(markdown, ["notes"]);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].heading, "Notes");
  assert.match(sections[0].content, /Top note/);
  assert.match(sections[0].content, /## Project A/);
  assert.doesNotMatch(sections[0].content, /# Tasks/);
});

test("extractConfiguredSections ignores headings inside fenced code blocks", async () => {
  const markdown = `# Notes

\`\`\`md
# Tasks
\`\`\`

Real note.
`;

  const sections = await extractConfiguredSections(markdown, ["tasks"]);
  assert.equal(sections.length, 0);
});

test("extractConfiguredSections strips Dataview and Tasks query blocks by default", async () => {
  const markdown = `# Notes

Manual note.

\`\`\`dataview
TABLE file.mtime
\`\`\`

\`\`\`tasks
not done
\`\`\`

Follow-up note.
`;

  const sections = await extractConfiguredSections(markdown, ["notes"]);
  assert.equal(sections.length, 1);
  assert.match(sections[0].content, /Manual note/);
  assert.match(sections[0].content, /Follow-up note/);
  assert.doesNotMatch(sections[0].content, /TABLE file/);
  assert.doesNotMatch(sections[0].content, /not done/);
});

test("extractConfiguredSections can preserve query blocks when configured", async () => {
  const markdown = `# Notes

\`\`\`dataview
LIST
\`\`\`
`;

  const sections = await extractConfiguredSections(markdown, ["notes"], { stripQueryBlocks: false });
  assert.equal(sections.length, 1);
  assert.match(sections[0].content, /```dataview/);
});

test("extractConfiguredSections preserves section content when query fence is unclosed", async () => {
  const markdown = `# Notes

Manual note.

\`\`\`dataview
TABLE file.mtime

Critical note after malformed query fence.
`;

  const sections = await extractConfiguredSections(markdown, ["notes"]);
  assert.equal(sections.length, 1);
  assert.match(sections[0].content, /Manual note/);
  assert.match(sections[0].content, /TABLE file/);
  assert.match(sections[0].content, /Critical note/);
});

test("extractDaySection finds session day sections by date wikilink", async () => {
  const markdown = `# Session

## 2026-05-10 → [[20260510]]

Yesterday.

## 2026-05-11 → [[20260511]]

Today.

### Outcomes

- [x] Done
`;

  const section = await extractDaySection(markdown, "20260511");
  assert.equal(section?.heading, "2026-05-11 → [[20260511]]");
  assert.match(section?.content ?? "", /Today/);
  assert.doesNotMatch(section?.content ?? "", /Yesterday/);
});
