import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// sop-export.js usa funciones globales del navegador; se cargan con stubs mínimos.
const context = {
  escapeHtml: (value) => String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`),
  TextEncoder, Blob, URL, document: {}, window: {},
};
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../../public/src/sop-export.js", import.meta.url), "utf8"), context);

const draft = {
  document: { id: "SOP-1", title: "SOP de prueba", revision: "4" },
  createdBy: "Gabo",
  deletedSteps: [{ sheet: 5, number: "5.3", text: "Paso viejo" }],
  procedures: [
    {
      sheet: 5,
      steps: [
        { number: "5.1", text: "Nuevo texto", originalText: "Texto original", originalNumber: "5.1" },
        { number: "5.2", text: "Paso agregado", added: true },
        { number: "5.4", text: "Renumerado", originalText: "Renumerado", originalNumber: "5.3" },
        { number: "5.5", text: "Sin cambios" },
      ],
      annotations: [
        { type: "arrow", stepNumber: "5.1" },
        { type: "note", stepNumber: "", text: "Cuidar el conector" },
        { type: "textfix", stepNumber: "5.1", lines: ["Nuevo texto"] },
        { type: "textfix", stepNumber: "", original: "Antes", lines: ["Después"] },
      ],
    },
  ],
};

test("el resumen de cambios distingue textos, números, pasos nuevos, eliminados y anotaciones", () => {
  const rows = context.collectSopChanges(draft);
  const types = [...rows.map((row) => row.type)];
  assert.deepEqual(types, [
    "Texto del paso", "Paso nuevo", "Número de paso",
    "Anotación · Flecha", "Anotación · Nota", "Texto de la hoja", "Paso eliminado",
  ]);
  assert.equal(rows[0].before, "Texto original");
  assert.equal(rows[0].after, "Nuevo texto");
  assert.equal(rows.at(-1).before, "Paso viejo");
});

test("el CSV escapa comillas y lleva la cabecera del documento", () => {
  const rows = [{ sheet: 5, step: "5.1", type: "Texto del paso", before: 'Dice "uno"', after: "Dice dos" }];
  const csv = context.sopChangesToCsv(draft, rows);
  assert.match(csv, /"SOP","SOP de prueba"/);
  assert.match(csv, /"Dice ""uno"""/);
  assert.equal(csv.split("\r\n").at(-1), '"5","5.1","Texto del paso","Dice ""uno""","Dice dos"');
});

test("el PDF generado tiene cabecera, una página por hoja y tabla xref válida", async () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pages = [1, 2, 3].map(() => ({ jpeg, width: 10, height: 8, ptWidth: 792, ptHeight: 612 }));
  const blob = context.buildSopPdf(pages);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const text = Buffer.from(bytes).toString("latin1");
  assert.ok(text.startsWith("%PDF-1.4"));
  assert.match(text, /\/Count 3/);
  assert.ok(text.trimEnd().endsWith("%%EOF"));
  const startxref = Number(text.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(text.slice(startxref, startxref + 4), "xref");
  // cada entrada de xref apunta al inicio de su objeto
  const entries = [...text.slice(startxref).matchAll(/^(\d{10}) 00000 n $/gm)].map((match) => Number(match[1]));
  assert.equal(entries.length, 3 + pages.length * 3 - 1);
  entries.forEach((offset, index) => assert.ok(text.slice(offset).startsWith(`${index + 1} 0 obj`), `objeto ${index + 1}`));
});
