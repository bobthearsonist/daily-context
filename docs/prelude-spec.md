# Daily prelude and section parsing

Daily Context treats the daily note as authored markdown plus dynamic query
blocks. The plugin extracts authored source text and deliberately avoids rendered
Dataview/Tasks output.

## Prelude

The daily prelude is:

1. after YAML frontmatter, if present
2. before the first markdown heading, horizontal rule, or fenced query block
3. trimmed of leading/trailing blank lines

This supports the current daily template shape where short manual context lives
immediately after frontmatter and before Dataview queries.

Prelude stops at:

- `#`, `##`, ... headings
- horizontal rules like `---`
- fenced query blocks such as ```` ```dataviewjs ```` or ```` ```tasks ````

Prelude does not parse rendered Dataview output.

## Configured sections

Configured sections are matched by exact heading text, case-insensitive, after
normalizing whitespace. For example, `notes` matches `# Notes` and `## notes`.

Section content includes everything below the matched heading until the next
heading of the same or higher level. Nested subheadings are included.

Headings inside fenced code blocks are ignored.

## AI session day sections

AI session documents may span multiple days. Daily Context extracts the section
whose heading starts with `YYYY-MM-DD` or contains the daily wikilink
`[[YYYYMMDD]]`.
