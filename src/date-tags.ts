import { dateTag, normalizeDate } from "./date";

const DATE_TAGS_PLUGIN_ID = "date-tags";

export interface DateTagsApi {
  version?: number;
  buildDateTag(date: string): string;
  getBaseTag?: () => string;
}

export interface DateTagResolution {
  primary: string;
  aliases: string[];
  source: "date-tags-api" | "convention";
}

export type DateTagSourceMode = DateTagResolution["source"];

export function getDateTagsApi(app: unknown): DateTagsApi | null {
  const appRecord = recordFrom(app);
  const pluginsRecord = recordFrom(appRecord?.plugins);
  const loadedPlugins = recordFrom(pluginsRecord?.plugins);
  const plugin = recordFrom(loadedPlugins?.[DATE_TAGS_PLUGIN_ID]);
  const api = recordFrom(plugin?.api);

  if (typeof api?.buildDateTag !== "function") {
    return null;
  }

  return {
    version: typeof api.version === "number" ? api.version : undefined,
    buildDateTag: api.buildDateTag.bind(api) as DateTagsApi["buildDateTag"],
    getBaseTag: typeof api.getBaseTag === "function" ? (api.getBaseTag.bind(api) as DateTagsApi["getBaseTag"]) : undefined,
  };
}

export function resolveDateTag(date: string, sourceMode: DateTagSourceMode, api?: DateTagsApi | null): DateTagResolution {
  const convention = dateTag(date);
  if (sourceMode === "convention") {
    return { primary: convention, aliases: [convention], source: "convention" };
  }

  if (!api) {
    throw new Error("Daily Context is configured to use the Date Tags plugin API, but the API is unavailable.");
  }

  const apiTag = normalizeTag(api.buildDateTag(normalizeDate(date)));
  if (apiTag.length === 0) {
    throw new Error("Date Tags plugin API returned an empty date tag.");
  }

  const aliases = Array.from(new Set([apiTag, convention].filter(Boolean)));
  return {
    primary: apiTag,
    aliases,
    source: "date-tags-api",
  };
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/u, "").replace(/^\/+|\/+$/gu, "");
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
