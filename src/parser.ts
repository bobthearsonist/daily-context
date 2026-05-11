import { sha256Hash } from "./hash";
import { compactDate, normalizeDate } from "./date";
import type { DailyContextSection } from "./types";

export interface ParsedDailyMarkdown {
  prelude: string;
  sections: DailyContextSection[];
}

export interface DailyMarkdownParseOptions {
  sectionHeadings: string[];
}

interface Heading {
  heading: string;
  normalizedHeading: string;
  level: number;
  lineIndex: number;
}

export async function parseDailyMarkdown(
  markdown: string,
  options: DailyMarkdownParseOptions,
): Promise<ParsedDailyMarkdown> {
  return {
    prelude: extractPrelude(markdown),
    sections: await extractConfiguredSections(markdown, options.sectionHeadings),
  };
}

export function extractPrelude(markdown: string): string {
  const body = stripFrontmatter(markdown);
  const lines = splitLines(body);
  const prelude: string[] = [];

  for (const line of lines) {
    if (isPreludeBoundary(line)) {
      break;
    }
    prelude.push(line);
  }

  return prelude.join("").trim();
}

export async function extractConfiguredSections(
  markdown: string,
  headings: string[],
): Promise<DailyContextSection[]> {
  const wanted = new Set(headings.map(normalizeHeading));
  if (wanted.size === 0) {
    return [];
  }

  const body = stripFrontmatter(markdown);
  const lines = splitLines(body);
  const parsedHeadings = findHeadings(lines);
  const sections: DailyContextSection[] = [];

  for (let index = 0; index < parsedHeadings.length; index += 1) {
    const heading = parsedHeadings[index];
    if (!wanted.has(heading.normalizedHeading)) {
      continue;
    }

    const content = sectionContent(lines, parsedHeadings, heading);
    sections.push({
      heading: heading.heading,
      level: heading.level,
      hash: await sha256Hash(content),
      content,
    });
  }

  return sections;
}

export async function extractDaySection(markdown: string, date: string): Promise<DailyContextSection | null> {
  const normalizedDate = normalizeDate(date);
  const compact = compactDate(date);
  const body = stripFrontmatter(markdown);
  const lines = splitLines(body);
  const parsedHeadings = findHeadings(lines);
  const heading = parsedHeadings.find((candidate) => {
    const text = candidate.heading.trim();
    return text.startsWith(normalizedDate) || text.includes(`[[${compact}]]`);
  });

  if (!heading) {
    return null;
  }

  const content = sectionContent(lines, parsedHeadings, heading);
  return {
    heading: heading.heading,
    level: heading.level,
    hash: await sha256Hash(content),
    content,
  };
}

export function stripFrontmatter(markdown: string): string {
  const lines = splitLines(markdown);
  if (lines.length === 0 || lines[0].trim() !== "---") {
    return markdown;
  }

  const endIndex = lines.findIndex((line, index) => index > 0 && ["---", "..."].includes(line.trim()));
  if (endIndex === -1) {
    return markdown;
  }

  return lines.slice(endIndex + 1).join("");
}

export function normalizeHeading(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitLines(markdown: string): string[] {
  return markdown.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter((line) => line.length > 0) ?? [];
}

function isPreludeBoundary(line: string): boolean {
  const trimmed = line.trim();
  return (
    /^#{1,6}\s+/.test(trimmed) ||
    /^```(?:dataviewjs|dataview|tasks)?\s*$/i.test(trimmed) ||
    /^-{3,}$/.test(trimmed)
  );
}

function findHeadings(lines: string[]): Heading[] {
  const headings: Heading[] = [];
  let fenced = false;

  lines.forEach((line, lineIndex) => {
    if (/^```/.test(line.trim())) {
      fenced = !fenced;
      return;
    }

    if (fenced) {
      return;
    }

    const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (!match) {
      return;
    }

    headings.push({
      heading: match[2],
      normalizedHeading: normalizeHeading(match[2]),
      level: match[1].length,
      lineIndex,
    });
  });

  return headings;
}

function sectionContent(lines: string[], headings: Heading[], heading: Heading): string {
  const nextBoundary = headings.find(
    (candidate) => candidate.lineIndex > heading.lineIndex && candidate.level <= heading.level,
  );
  const start = heading.lineIndex + 1;
  const end = nextBoundary?.lineIndex ?? lines.length;
  return lines.slice(start, end).join("").trim();
}
