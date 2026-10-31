import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/sop-run.js", import.meta.url), "utf8");
const context = vm.createContext({});
vm.runInContext(source, context);
const helpers = vm.runInContext(`({
  createGuidedSopRun, getGuidedSopProcedure, getGuidedSopCheckedSteps, setGuidedSopStep,
  isGuidedSopProcedureComplete, isGuidedSopRunComplete, getGuidedSopProgress,
  advanceGuidedSopRun, returnGuidedSopRunToSteps,
})`, context);

const procedures = [
  { id: "sheet-5", sheet: 5, steps: [{ number: "1" }, { number: "1.1" }] },
  { id: "sheet-6", sheet: 6, steps: [{ number: "2" }] },
];
const document = { id: "SOP-TEST", title: "Desensamble de prueba", revision: "7", totalSheets: 6 };
const user = { id: "user-1", name: "Operadora", employeeNumber: "140860", position: "Debugger", role: "operator" };

test("requires every step on a sheet before advancing through the SOP", () => {
  const run = helpers.createGuidedSopRun(procedures, document, "version-7", user);
  assert.equal(run.procedureIds.length, 2);
  assert.equal(helpers.advanceGuidedSopRun(run, procedures), false);

  helpers.setGuidedSopStep(run, "sheet-5", "1", true);
  assert.equal(helpers.isGuidedSopProcedureComplete(run, procedures[0]), false);
  assert.equal(helpers.advanceGuidedSopRun(run, procedures), false);

  helpers.setGuidedSopStep(run, "sheet-5", "1.1", true);
  assert.equal(helpers.advanceGuidedSopRun(run, procedures), true);
  assert.equal(helpers.getGuidedSopProcedure(run, procedures).id, "sheet-6");
  assert.deepEqual(JSON.parse(JSON.stringify(helpers.getGuidedSopProgress(run, procedures))), { complete: 2, total: 3 });
  assert.equal(helpers.isGuidedSopRunComplete(run, procedures), false);
});

test("requires the final sheet, then supports returning to review without losing checks", () => {
  const run = helpers.createGuidedSopRun(procedures, document, "version-7", user);
  for (const step of procedures[0].steps) helpers.setGuidedSopStep(run, "sheet-5", step.number, true);
  assert.equal(helpers.advanceGuidedSopRun(run, procedures), true);
  helpers.setGuidedSopStep(run, "sheet-6", "2", true);
  assert.equal(helpers.advanceGuidedSopRun(run, procedures), true);
  assert.equal(run.stage, "confirmation");
  assert.equal(helpers.isGuidedSopRunComplete(run, procedures), true);
  assert.equal(helpers.returnGuidedSopRunToSteps(run), true);
  assert.equal(run.stage, "steps");
  assert.equal(helpers.getGuidedSopProcedure(run, procedures).id, "sheet-6");
  assert.deepEqual(Array.from(helpers.getGuidedSopCheckedSteps(run, "sheet-6")), ["2"]);
});
