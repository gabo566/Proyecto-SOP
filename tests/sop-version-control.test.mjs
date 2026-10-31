import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import * as pdfjs from "../public/vendor/pdfjs/pdf.min.mjs";

const rootUrl = new URL("../", import.meta.url);
const source = await readFile(new URL("../src/sop-version-control.js", import.meta.url), "utf8");
const context = vm.createContext({
  Blob,
  URL,
  structuredClone,
  console,
  crypto: { randomUUID: () => "test-version-id" },
  document: { baseURI: new URL("index.html", rootUrl).href },
  getActiveLocalUser: () => ({ name: "Gabriel", employeeNumber: "140784", role: "admin" }),
});
vm.runInContext(source, context);
const { canManageSopVersions, extractSopPdfVersion, validateSopDraft } = vm.runInContext(
  "({ canManageSopVersions, extractSopPdfVersion, validateSopDraft })",
  context,
);
const pdfBytes = await readFile(new URL("../public/documents/SOP-NVD-GB200-141.pdf", import.meta.url));
const sourcePdf = Object.assign(new Blob([pdfBytes], { type: "application/pdf" }), { name: "SOP-NVD-GB200-141.pdf" });

test("extracts all 132 validation steps and revision metadata from the reference PDF alone", async () => {
  const version = await extractSopPdfVersion(sourcePdf, pdfjs);
  const steps = version.procedures.flatMap((procedure) => procedure.steps.map((step) => `${procedure.sheet}:${step.number}`));

  assert.equal(version.document.id, "SOP-NVD-GB200-141");
  assert.equal(version.document.revision, "3");
  assert.equal(version.document.totalSheets, 46);
  assert.equal(version.procedures.length, 42);
  assert.equal(steps.length, 132);
  assert.ok(steps.includes("7:7.1.1"));
  assert.ok(steps.includes("16:22.5.3"));
  const findStep = (sheet, number) => version.procedures.find((procedure) => procedure.sheet === sheet)?.steps.find((step) => step.number === number)?.text ?? "";
  assert.match(findStep(8, "9"), /688-24975-0008-000/);
  assert.match(findStep(8, "10"), /para ello desatornille/);
  assert.match(findStep(15, "22.4"), /liberar los seguros/);
  assert.match(findStep(23, "41"), /torque de 4.8-5.3 in-lb/);
  assert.match(findStep(25, "47"), /MTB-07-2839/);
  assert.match(findStep(41, "89.4"), /cable sin daños en la tarjeta/);
  assert.equal(version.pdf.name, sourcePdf.name);
  assert.equal(version.pdf.blob, sourcePdf);
});

test("validates editable steps before saving and rejects incomplete or duplicated steps", async () => {
  const version = await extractSopPdfVersion(sourcePdf, pdfjs);
  version.procedures[0].steps[0].text = "Instrucción corregida por la administradora.";
  assert.equal(validateSopDraft(version).procedures[0].steps[0].text, "Instrucción corregida por la administradora.");

  const duplicate = structuredClone(version);
  duplicate.procedures[0].steps[1].number = duplicate.procedures[0].steps[0].number;
  assert.throws(() => validateSopDraft(duplicate), /está repetido/);

  const incomplete = structuredClone(version);
  incomplete.procedures[0].steps[0].text = "";
  assert.throws(() => validateSopDraft(incomplete), /Completa el número y el texto/);
});

test("rejects an empty file when only one PDF is supplied", async () => {
  await assert.rejects(
    extractSopPdfVersion({ name: "vacio.pdf", type: "application/pdf", size: 0, arrayBuffer: async () => new ArrayBuffer(0) }),
    /PDF válido/,
  );
});

test("limits SOP editing to administrator employee 140784", () => {
  assert.equal(canManageSopVersions({ employeeNumber: "140784", role: "admin" }), true);
  assert.equal(canManageSopVersions({ employeeNumber: "140783", role: "admin" }), false);
  assert.equal(canManageSopVersions({ employeeNumber: "140784", role: "operator" }), false);
});
