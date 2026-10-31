import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../src/sop-version-control.js", import.meta.url), "utf8");
const context = vm.createContext({
  Blob,
  console,
  crypto: { randomUUID: () => "test-version-id" },
  getActiveLocalUser: () => ({ name: "Gabriel", employeeNumber: "140784", role: "admin" }),
});
vm.runInContext(source, context);
const { normalizeSopPackage, canManageSopVersions } = vm.runInContext("({ normalizeSopPackage, canManageSopVersions })", context);

const pdf = { name: "sop.pdf", type: "application/pdf", size: 12 };
const page = { name: "hoja.jpg", type: "image/jpeg", size: 8 };
const reference = { name: "paso.jpg", type: "image/jpeg", size: 8 };
const packageData = {
  document: { id: "SOP-1", title: "Desensamble", revision: "2" },
  procedures: [{
    sheet: 1,
    category: "Chasis",
    title: "Preparación",
    pageImage: "hoja.jpg",
    steps: [{ number: "1", text: "Retira la cubierta", images: [{ file: "paso.jpg" }] }],
  }],
};

test("accepts a complete PDF, procedure and referenced image package", () => {
  const version = normalizeSopPackage(packageData, [page, reference], pdf);
  assert.equal(version.document.revision, "2");
  assert.equal(version.pdf.blob, pdf);
  assert.equal(version.procedures[0].pageImage.blob, page);
  assert.equal(version.procedures[0].steps[0].images[0].blob, reference);
});

test("rejects a SOP package that references an image that was not uploaded", () => {
  assert.throws(() => normalizeSopPackage(packageData, [page], pdf), /Falta la imagen «paso.jpg»/);
});

test("rejects duplicate step numbers and sheets", () => {
  const repeatedStep = structuredClone(packageData);
  repeatedStep.procedures[0].steps.push({ number: "1", text: "Otro paso", images: [] });
  assert.throws(() => normalizeSopPackage(repeatedStep, [page, reference], pdf), /está repetido/);

  const repeatedSheet = structuredClone(packageData);
  repeatedSheet.procedures.push({ ...repeatedSheet.procedures[0], id: "second", title: "Duplicada" });
  assert.throws(() => normalizeSopPackage(repeatedSheet, [page, reference], pdf), /deben ser únicos/);
});

test("limits SOP editing to administrator employee 140784", () => {
  assert.equal(canManageSopVersions({ employeeNumber: "140784", role: "admin" }), true);
  assert.equal(canManageSopVersions({ employeeNumber: "140783", role: "admin" }), false);
  assert.equal(canManageSopVersions({ employeeNumber: "140784", role: "operator" }), false);
});
