import test from "node:test";
import assert from "node:assert/strict";
import { parsePeriodConfig } from "../src/match-format.js";

test("parsePeriodConfig supports one-period second-level custom formats", () => {
  assert.deepEqual(parsePeriodConfig("1", "12", "34"), {
    periodCount: 1,
    periodDurationSeconds: [754],
  });
});

test("parsePeriodConfig clamps invalid second values into a usable duration", () => {
  assert.deepEqual(parsePeriodConfig("2", "0", "99"), {
    periodCount: 2,
    periodDurationSeconds: [59, 59],
  });
});
