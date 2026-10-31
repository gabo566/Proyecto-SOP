import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/data/workStations.js", import.meta.url), "utf8");
const workItemsSource = await readFile(new URL("../src/work-items.js", import.meta.url), "utf8");
const context = vm.createContext({
  BUILT_IN_SOP_VERSION_ID: "__built-in-sop__",
  BUILT_IN_SOP_VERSION: {
    id: "__built-in-sop__",
    document: { id: "RWK-BASE", title: "RWK base", revision: "3", stationAssignment: "RWK:RWK" },
    createdAt: "2025-01-01T00:00:00.000Z",
  },
});
vm.runInContext(source, context);
vm.runInContext(workItemsSource, context);
const {
  findSopVersionForStation,
  getEnabledSopVersionsForStation,
  getEnabledWorkStationAssignments,
  getSopVersionStationAssignment,
  getWorkStationAssignment,
  isActiveHandoffWorkItem,
  normalizeStationIntakeAssignment,
} = vm.runInContext(
  "({ findSopVersionForStation, getEnabledSopVersionsForStation, getEnabledWorkStationAssignments, getSopVersionStationAssignment, getWorkStationAssignment, isActiveHandoffWorkItem, normalizeStationIntakeAssignment })",
  context,
);

const makeVersion = (id, stationAssignment, createdAt, title = id) => ({
  id,
  createdAt,
  document: { id, title, revision: id.split("-").at(-1), stationAssignment },
});
const stateWith = (versions, catalog, form = {}) => ({
  sopCatalogLoaded: true,
  sopVersionHistory: versions,
  sopVersionCatalog: catalog,
  form: { stationAssignment: "MFG:TDR", sopVersionId: "", ...form },
});

test("offers every enabled SOP for its station and can select an exact revision", () => {
  const older = makeVersion("mfg-doc-4", "MFG:TDR", "2025-01-01T00:00:00.000Z");
  const latest = makeVersion("mfg-doc-5", "MFG:TDR", "2025-02-01T00:00:00.000Z");
  const disabled = makeVersion("mfg-hidden", "MFG:TDR", "2025-03-01T00:00:00.000Z");
  const state = stateWith([older, latest, disabled], {
    [older.id]: { stationAssignment: "MFG:TDR", enabled: true },
    [latest.id]: { stationAssignment: "MFG:TDR", enabled: true },
    [disabled.id]: { stationAssignment: "MFG:TDR", enabled: false },
  });

  assert.deepEqual(Array.from(getEnabledSopVersionsForStation(state, "MFG:TDR"), (version) => version.id), [latest.id, older.id]);
  assert.equal(findSopVersionForStation(state, "MFG:TDR", older.id).id, older.id);
  assert.equal(findSopVersionForStation(state, "MFG:TDR", disabled.id), null);
});

test("shows only the station and SOPs explicitly enabled by the administrator", () => {
  const mfg = makeVersion("mfg-live", "MFG:TDR", "2025-02-01T00:00:00.000Z");
  const rwk = makeVersion("rwk-hidden", "RWK:RWK", "2025-03-01T00:00:00.000Z");
  const state = stateWith([mfg, rwk], {
    [mfg.id]: { stationAssignment: "MFG:TDR", enabled: true },
    [rwk.id]: { stationAssignment: "RWK:RWK", enabled: false },
  });

  assert.deepEqual(Array.from(getEnabledWorkStationAssignments(state), (assignment) => assignment.value), ["MFG:TDR"]);
  assert.equal(getEnabledWorkStationAssignments(state, "RWK").length, 0);
  assert.equal(getEnabledSopVersionsForStation(state, "RWK:RWK").length, 0);
});

test("uses the administrator-edited station and falls back to its built-in assignment", () => {
  const mfg = makeVersion("manual-sop", "RWK:RWK", "2025-02-01T00:00:00.000Z");
  const state = stateWith([mfg], {
    [mfg.id]: { stationAssignment: "MFG:TDR", enabled: true },
    "__built-in-sop__": { stationAssignment: "RWK:RWK", enabled: true },
  });

  assert.equal(getSopVersionStationAssignment(state, mfg), "MFG:TDR");
  assert.equal(findSopVersionForStation(state, "MFG:TDR").id, mfg.id);
  assert.equal(findSopVersionForStation(state, "RWK:RWK").id, "__built-in-sop__");
  assert.equal(getWorkStationAssignment("MFG:TDR").type, "MFG");
});

test("includes SYS_ASSY_1 and SYS_ASSY_2 as administrator-assignable MFG stations", () => {
  const sysAssy1 = makeVersion("sys-assy-1", "MFG:SYS_ASSY_1", "2025-02-01T00:00:00.000Z");
  const sysAssy2 = makeVersion("sys-assy-2", "MFG:SYS_ASSY_2", "2025-03-01T00:00:00.000Z");
  const state = stateWith([sysAssy1, sysAssy2], {
    [sysAssy1.id]: { stationAssignment: "MFG:SYS_ASSY_1", enabled: true },
    [sysAssy2.id]: { stationAssignment: "MFG:SYS_ASSY_2", enabled: true },
  });

  assert.equal(getWorkStationAssignment("MFG:SYS_ASSY_1").type, "MFG");
  assert.equal(getWorkStationAssignment("MFG:SYS_ASSY_2").type, "MFG");
  assert.deepEqual(
    Array.from(getEnabledWorkStationAssignments(state, "MFG"), (assignment) => assignment.value),
    ["MFG:SYS_ASSY_1", "MFG:SYS_ASSY_2"],
  );
  assert.equal(findSopVersionForStation(state, "MFG:SYS_ASSY_1").id, sysAssy1.id);
  assert.equal(findSopVersionForStation(state, "MFG:SYS_ASSY_2").id, sysAssy2.id);
});

test("allows operator handoff for active MFG and RWK SOP work, but not closed work", () => {
  assert.equal(isActiveHandoffWorkItem({ workKind: "guided", status: "En proceso", form: { stationAssignment: "RWK:RWK" } }), true);
  assert.equal(isActiveHandoffWorkItem({ workKind: "guided", status: "En proceso", form: { stationAssignment: "MFG:TDR" } }), true);
  assert.equal(isActiveHandoffWorkItem({ workKind: "rework", status: "Retrabajo en proceso", form: { stationAssignment: "MFG:TDR" } }), true);
  assert.equal(isActiveHandoffWorkItem({ workKind: "guided", status: "Completado", form: { stationAssignment: "MFG:TDR" } }), false);
  assert.equal(isActiveHandoffWorkItem({ workKind: "rework", status: "Pendiente de revisión", form: { stationAssignment: "RWK:RWK" } }), false);
});

test("normalizes a disabled SOP selection to the first available revision", () => {
  const old = makeVersion("mfg-old", "MFG:TDR", "2025-01-01T00:00:00.000Z");
  const rwk = makeVersion("rwk-on", "RWK:RWK", "2025-02-01T00:00:00.000Z");
  const state = stateWith([old, rwk], {
    [old.id]: { stationAssignment: "MFG:TDR", enabled: false },
    [rwk.id]: { stationAssignment: "RWK:RWK", enabled: true },
  }, { stationAssignment: "MFG:TDR", sopVersionId: old.id });

  assert.equal(normalizeStationIntakeAssignment(state), "RWK:RWK");
  assert.equal(state.form.sopVersionId, rwk.id);
});
