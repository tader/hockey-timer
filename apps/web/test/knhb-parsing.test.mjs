import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  firstString,
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

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(testDir, "fixtures");

function readFixture(name) {
  const raw = fs.readFileSync(path.join(fixturesDir, name), "utf8");
  return JSON.parse(raw);
}

test("N1502 team snapshot exposes expected metadata fields", () => {
  const payload = readFixture("knhb-team-N1502.json");
  assert.equal(payload.status, 200);
  assert.equal(firstString(payload, ["id"]), "N1502");
  assert.equal(firstString(payload, ["name"]), "HUDITO H30-2");
  assert.equal(firstString(payload, ["type"]), "Veld");
  assert.equal(firstString(payload, ["club_name", "clubName"]), "D.H.C. Hudito");
});

test("HockeyWeerelt club snapshot exposes federation reference ids", () => {
  const payload = {
    data: [{
      federation_reference_id: "HH11JP6",
      friendly_name: "HUDITO",
      name: "D.H.C. Hudito",
    }],
  };
  assert.equal(firstString(payload.data[0], ["id", "clubId", "teamId", "code", "federation_reference_id"]), "HH11JP6");
  assert.equal(firstString(payload.data[0], ["friendly_name", "name"]), "HUDITO");
});

test("parseKNHBMatchItem reads current HockeyWeerelt poule match shape", () => {
  const parsed = parseKNHBMatchItem({
    id: 1836225,
    date: "2025-09-07T12:45:00+02:00",
    home: { name: "Roomburg D1" },
    away: { name: "Derby D1" },
    location: {
      facility: { name: "Sportpark Roomburg" },
      field: { name: "1 Rabo-veld" },
    },
  });
  assert.ok(parsed);
  assert.equal(parsed.id, "1836225");
  assert.equal(parsed.homeTeam, "Roomburg D1");
  assert.equal(parsed.awayTeam, "Derby D1");
  assert.equal(parsed.locationClubName, "Sportpark Roomburg");
  assert.equal(parsed.fieldName, "1 Rabo-veld");
});

test("N1502 upcoming snapshot parses into valid matches", () => {
  const payload = readFixture("knhb-team-N1502-matches-upcoming.json");
  const items = Array.isArray(payload.data) ? payload.data : [];
  assert.ok(items.length > 0);

  const parsed = items.map((item) => parseKNHBMatchItem(item)).filter(Boolean);
  assert.equal(parsed.length, items.length);

  for (const match of parsed) {
    assert.ok(match.id);
    assert.ok(match.homeTeam);
    assert.ok(match.awayTeam);
    assert.equal(looksLikeDateToken(match.homeTeam), false);
    assert.equal(looksLikeDateToken(match.awayTeam), false);
  }

  assert.equal(parsed[0].id, "N1876220");
  assert.equal(parsed[0].homeTeam, "Rotterdam H30-4");
  assert.equal(parsed[0].awayTeam, "HUDITO H30-2");
  assert.equal(parsed[0].locationClubName, "Sportpark Hazelaarweg");
});

test("N1502 official snapshot parses into valid matches", () => {
  const payload = readFixture("knhb-team-N1502-matches-official.json");
  const items = Array.isArray(payload.data) ? payload.data : [];
  assert.ok(items.length > 0);

  const parsed = items.map((item) => parseKNHBMatchItem(item)).filter(Boolean);
  assert.equal(parsed.length, items.length);

  for (const match of parsed) {
    assert.ok(match.id);
    assert.ok(match.homeTeam);
    assert.ok(match.awayTeam);
    assert.equal(looksLikeDateToken(match.homeTeam), false);
    assert.equal(looksLikeDateToken(match.awayTeam), false);
  }

  assert.equal(parsed[0].id, "N1876215");
  assert.equal(parsed[0].homeTeam, "HUDITO H30-2");
  assert.equal(parsed[0].awayTeam, "Forcial H30-1");
  assert.equal(parsed[0].locationClubName, "Sportpark 'Kruithuisweg'");
});
