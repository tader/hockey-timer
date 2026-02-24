import test from "node:test";
import assert from "node:assert/strict";
import {
  looksLikeDateToken,
  parseTeamsFromDisplay,
  parseKNHBMatchItem,
  toImportedMatchMetadata,
} from "../src/knhb-parsing.js";

test("looksLikeDateToken identifies KNHB timestamp-like tokens", () => {
  assert.equal(looksLikeDateToken("2026-03-15T14:45:00.000000Z"), true);
  assert.equal(looksLikeDateToken("2026-03-15 14:45:00"), true);
  assert.equal(looksLikeDateToken("14:45"), true);
  assert.equal(looksLikeDateToken("HUDITO H30-2"), false);
});

test("parseTeamsFromDisplay rejects date-like away segment", () => {
  const parsed = parseTeamsFromDisplay("Rotterdam H30-4 – 2026-03-15T14:45:00.000000Z");
  assert.deepEqual(parsed, {});
});

test("parseKNHBMatchItem keeps away team as name and never timestamp", () => {
  const item = {
    id: "m-1",
    title: "Rotterdam H30-4 – 2026-03-15T14:45:00.000000Z",
    thuisteam: "Rotterdam H30-4",
    uitteam: "Leonidas H30-2",
    date: "2026-03-15T14:45:00.000000Z",
    clubnaam: "HUDITO",
    veld: "Veld 3",
  };
  const parsed = parseKNHBMatchItem(item);
  assert.ok(parsed);
  assert.equal(parsed.homeTeam, "Rotterdam H30-4");
  assert.equal(parsed.awayTeam, "Leonidas H30-2");
  assert.equal(parsed.locationClubName, "HUDITO");
  assert.equal(parsed.fieldName, "Veld 3");
});

test("parseKNHBMatchItem falls back to Away when away candidate is timestamp", () => {
  const item = {
    id: "m-2",
    title: "Rotterdam H30-4 – 2026-03-15T14:45:00.000000Z",
    homeTeam: "Rotterdam H30-4",
    awayTeam: "2026-03-15T14:45:00.000000Z",
  };
  const parsed = parseKNHBMatchItem(item);
  assert.ok(parsed);
  assert.equal(parsed.homeTeam, "Rotterdam H30-4");
  assert.equal(parsed.awayTeam, "Away");
});

test("toImportedMatchMetadata maps parsed KNHB match into metadata fields", () => {
  const parsed = {
    id: "m-3",
    homeTeam: "HUDITO H30-2",
    awayTeam: "Leonidas H30-4",
    dateRaw: "2026-03-15T14:45:00.000000Z",
    locationClubName: "HUDITO",
    fieldName: "Xpol",
  };
  const mapped = toImportedMatchMetadata(parsed, {
    nowIso: "2026-03-01T12:00:00.000Z",
    parsedDateIso: "2026-03-15T14:45:00.000Z",
    selectedClubName: "HUDITO",
  });
  assert.equal(mapped.id, "knhb-m-3");
  assert.equal(mapped.source, "knhb");
  assert.equal(mapped.homeTeam, "HUDITO H30-2");
  assert.equal(mapped.awayTeam, "Leonidas H30-4");
  assert.equal(mapped.locationClubName, "HUDITO");
  assert.equal(mapped.fieldName, "Xpol");
  assert.equal(mapped.knhbMatchId, "m-3");
});
