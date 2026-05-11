import assert from "node:assert/strict";
import test from "node:test";
import { getDateTagsApi, resolveDateTag } from "../../src/date-tags";

test("getDateTagsApi discovers date-tags plugin API lazily", () => {
  const api = getDateTagsApi({
    plugins: {
      plugins: {
        "date-tags": {
          api: {
            version: 1,
            buildDateTag: () => "work-date/2026/05/11",
            getBaseTag: () => "work-date",
          },
        },
      },
    },
  });

  assert.ok(api);
  assert.equal(api.buildDateTag("2026-05-11"), "work-date/2026/05/11");
  assert.equal(api.getBaseTag?.(), "work-date");
  assert.equal(getDateTagsApi({ plugins: { plugins: {} } }), null);
});

test("resolveDateTag uses date-tags API primary tag with convention fallback alias", () => {
  const resolved = resolveDateTag("20260511", {
    buildDateTag: () => "#work-date/2026/05/11",
  });

  assert.equal(resolved.primary, "work-date/2026/05/11");
  assert.equal(resolved.source, "date-tags-api");
  assert.deepEqual(resolved.aliases, ["work-date/2026/05/11", "date/2026/05/11"]);
});
