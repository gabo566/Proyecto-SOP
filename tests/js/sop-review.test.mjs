import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

// sop-review.js depende de funciones globales del navegador; se cargan con stubs mínimos.
const permissions = new Set();
const context = {
  escapeHtml: (value) => String(value ?? ""),
  getActiveLocalUser: () => ({ id: 10, permissions: [...permissions] }),
  canUserDo: (permission, user) => (user?.permissions ?? []).includes(permission),
  canManageSopVersions: (user) => (user?.permissions ?? []).includes("sop.manage"),
  BUILT_IN_SOP_VERSION_ID: "__built-in-sop__",
};
vm.createContext(context);
vm.runInContext(readFileSync(new URL("../../public/src/sop-review.js", import.meta.url), "utf8"), context);

const user = (id, ...grants) => ({ id, permissions: grants });
const version = (extra = {}) => ({ id: "v1", status: "pending_review", submittedById: 1, reviewedById: null, ...extra });

test("una revisión sin estado se considera publicada", () => {
  assert.equal(context.getSopVersionStatus({}), "published");
  assert.equal(context.getSopVersionStatus(version()), "pending_review");
});

test("quien sube la revisión no puede revisarla: la revisa otra persona", () => {
  assert.equal(context.getSopWorkflowBlock(version(), "review", user(1, "sop.review")), "Tú subiste esta revisión: la debe revisar otra persona.");
  assert.equal(context.getSopWorkflowBlock(version(), "review", user(2, "sop.review")), "");
});

test("sin la función de revisor o publicador no se puede revisar ni publicar", () => {
  assert.match(context.getSopWorkflowBlock(version(), "review", user(2)), /revisor/);
  assert.match(context.getSopWorkflowBlock(version({ status: "approved" }), "publish", user(2)), /publicador/);
});

test("publica una tercera persona: ni quien editó ni quien revisó", () => {
  const approved = version({ status: "approved", reviewedById: 2 });
  assert.match(context.getSopWorkflowBlock(approved, "publish", user(1, "sop.publish")), /subiste/);
  assert.match(context.getSopWorkflowBlock(approved, "publish", user(2, "sop.publish")), /tercera persona/);
  assert.equal(context.getSopWorkflowBlock(approved, "publish", user(3, "sop.publish")), "");
});

test("solo se publica una revisión aprobada y solo se revisa una pendiente", () => {
  assert.match(context.getSopWorkflowBlock(version(), "publish", user(3, "sop.publish")), /aprobadas/);
  assert.match(context.getSopWorkflowBlock(version({ status: "approved" }), "review", user(3, "sop.review")), /ya no está pendiente/);
});

test("entra a Modificar SOP quien edita, revisa o publica", () => {
  assert.equal(context.canAccessSopAdmin(user(5)), false);
  for (const grant of ["sop.manage", "sop.review", "sop.publish"]) assert.equal(context.canAccessSopAdmin(user(5, grant)), true);
});

test("la cobertura exige un revisor y un publicador distintos entre sí y de quien edita", () => {
  const people = (...ids) => ids.map((id) => ({ id }));
  assert.equal(context.describeSopRoleCoverage({ reviewers: people(2), publishers: people(2) }, 1).ready, false);
  assert.equal(context.describeSopRoleCoverage({ reviewers: people(1), publishers: people(2) }, 1).ready, false);
  assert.equal(context.describeSopRoleCoverage({ reviewers: people(2), publishers: people(3) }, 1).ready, true);
  assert.equal(context.describeSopRoleCoverage({ reviewers: people(2, 3), publishers: people(3) }, 1).ready, true);
  assert.equal(context.describeSopRoleCoverage(null, 1).loading, true);
});
