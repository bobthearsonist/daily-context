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

export function resolveDateTag(date: string, api?: DateTagsApi | null): DateTagResolution {
  const convention = dateTag(date);
  if (!api) {
    return { primary: convention, aliases: [convention], source: "convention" };
  }

  const apiTag = normalizeTag(api.buildDateTag(normalizeDate(date)));
  const aliases = Array.from(new Set([apiTag, convention].filter(Boolean)));
  return {
    primary: apiTag || convention,
    aliases: aliases.length > 0 ? aliases : [convention],
    source: apiTag ? "date-tags-api" : "convention",
  };
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#+/u, "").replace(/^\/+|\/+$/gu, "");
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}
