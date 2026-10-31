import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/data/workStations.js", import.meta.url), "utf8");
const context = vm.createContext({
  BUILT_IN_SOP_VERSION_ID: "__built-in-sop__",
  BUILT_IN_SOP_VERSION: {
    id: "__built-in-sop__",
    document: { id: "RWK-BASE", stationAssignment: "RWK:RWK" },
  },
});
vm.runInContext(source, context);
const { findSopVersionForStation, getWorkStationAssignment } = vm.runInContext(
  "({ findSopVersionForStation, getWorkStationAssignment })",
  context,
);

const makeVersion = (id, stationAssignment, createdAt) => ({
  id,
  createdAt,
  document: { id, stationAssignment },
});

test("routes to the active SOP when it belongs to the selected station", () => {
  const active = makeVersion("active-mfg", "MFG:TDR", "2025-01-01T00:00:00.000Z");
  const newer = makeVersion("newer-mfg", "MFG:TDR", "2025-02-01T00:00:00.000Z");
  const state = {
    sopVersionMeta: { id: active.id },
    sopVersionHistory: [newer, active],
  };

  assert.equal(findSopVersionForStation(state, "MFG:TDR").id, "active-mfg");
});

test("selects the newest saved SOP for the chosen station when another station is active", () => {
  const old = makeVersion("mfg-old", "MFG:TDR", "2025-01-01T00:00:00.000Z");
  const latest = makeVersion("mfg-latest", "MFG:TDR", "2025-03-01T00:00:00.000Z");
  const activeRwk = makeVersion("active-rwk", "RWK:RWK", "2025-02-01T00:00:00.000Z");
  const state = {
    sopVersionMeta: { id: activeRwk.id },
    sopVersionHistory: [old, activeRwk, latest],
  };

  assert.equal(findSopVersionForStation(state, "MFG:TDR").id, "mfg-latest");
});

test("uses the built-in RWK SOP as fallback and does not invent an MFG assignment", () => {
  const state = { sopVersionMeta: { id: "__built-in-sop__" }, sopVersionHistory: [] };

  assert.equal(findSopVersionForStation(state, "RWK:RWK").id, "__built-in-sop__");
  assert.equal(findSopVersionForStation(state, "MFG:TDR"), null);
  assert.equal(getWorkStationAssignment("MFG:TDR").type, "MFG");
});

test("respects the administrator's enabled station and exact assigned SOP revision", () => {
  const earlier = makeVersion("mfg-rev-4", "MFG:TDR", "2025-01-01T00:00:00.000Z");
  const latest = makeVersion("mfg-rev-5", "MFG:TDR", "2025-02-01T00:00:00.000Z");
  const activeRwk = makeVersion("active-rwk", "RWK:RWK", "2025-03-01T00:00:00.000Z");
  const state = {
    stationAssignmentsLoaded: true,
    sopVersionMeta: { id: activeRwk.id },
    sopVersionHistory: [earlier, latest, activeRwk],
    stationSopAssignments: {
      "MFG:TDR": { enabled: true, versionId: earlier.id },
      "RWK:RWK": { enabled: false, versionId: "" },
    },
  };

  assert.equal(findSopVersionForStation(state, "MFG:TDR").id, earlier.id);
  assert.equal(findSopVersionForStation(state, "RWK:RWK"), null);
  state.stationSopAssignments["MFG:TDR"].enabled = false;
  assert.equal(findSopVersionForStation(state, "MFG:TDR"), null);
});
