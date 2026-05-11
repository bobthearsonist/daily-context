import assert from "node:assert/strict";
import test from "node:test";
import { compactDate, dateTag, normalizeDate } from "../../src/date";

test("normalizeDate accepts compact and dashed dates", () => {
  assert.equal(normalizeDate("20260511"), "2026-05-11");
  assert.equal(normalizeDate("2026-05-11"), "2026-05-11");
});

test("dateTag returns date-tags plugin convention", () => {
  assert.equal(dateTag("20260511"), "date/2026/05/11");
  assert.equal(compactDate("2026-05-11"), "20260511");
});
