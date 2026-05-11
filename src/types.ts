export const DAILY_CONTEXT_API_VERSION = 1 as const;
export const DAILY_CONTEXT_SCHEMA_VERSION = 1 as const;
export const DAILY_CONTEXT_PARSER_VERSION = 1 as const;

export type DailyContextSchemaVersion = typeof DAILY_CONTEXT_SCHEMA_VERSION;
export type DailyContextApiVersion = typeof DAILY_CONTEXT_API_VERSION;

export interface DailyContextApi {
  version: DailyContextApiVersion;
  getDailyContext(date: string, options?: DailyContextRequestOptions): Promise<DailyContext>;
  writeDailyContextCache(date: string, options?: DailyContextRequestOptions): Promise<string>;
}

export interface DailyContextRequestOptions {
  contextId?: string;
  dailyPath?: string;
  include?: DailyContextSourceKind[];
  maxSourceBytes?: number;
}

export type DailyContextSourceKind =
  | "daily-prelude"
  | "daily-section"
  | "ai-session"
  | "date-tagged-file";

export interface DailyContext {
  schemaVersion: DailyContextSchemaVersion;
  parserVersion: number;
  generatedAt: string;
  date: string;
  dateTag: string;
  contextHash: string;
  contexts: DailyContextGroup[];
  sources: DailyContextSource[];
}

export interface DailyContextGroup {
  id: string;
  dailyFolder: string;
  sessionFolder: string;
}

export interface DailyContextSource {
  id: string;
  kind: DailyContextSourceKind;
  path: string;
  label: string;
  hash: string;
  content?: string;
  sections?: DailyContextSection[];
  metadata?: Record<string, unknown>;
}

export interface DailyContextSection {
  heading: string;
  level: number;
  hash: string;
  content: string;
}
