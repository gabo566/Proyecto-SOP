const LOCAL_USER_ROLES = {
  operator: "Operador",
  supervisor: "Supervisor",
  admin: "Administrador",
};

// Placeholder para el código que pregunta por el usuario antes de iniciar sesión.
const GUEST_USER = { id: "", name: "Invitado", username: "", employeeNumber: "", position: "Técnico de FA", email: "", role: "operator", active: true, permissions: [] };

// La sesión vive en el servidor (cookie). Aquí solo se cachea al usuario
// autenticado y, si administra cuentas, la lista, para que el render siga siendo síncrono.
const sopSession = { user: null, users: [], loginFailure: "" };

document.addEventListener("sop:session-expired", () => {
  sopSession.user = null;
  sopSession.users = [];
});

async function refreshLocalUsers() {
  const user = sopSession.user;
  if (!user) {
    sopSession.users = [];
    return;
  }
  sopSession.users = [user];
  if (!user.permissions.includes("users.manage")) return;
  const result = await sopApi("GET", "/api/users");
  if (result.ok) sopSession.users = result.data.users;
}

async function loadLocalSession() {
  const result = await sopApi("GET", "/api/me");
  sopSession.user = result.ok ? result.data.user : null;
  await refreshLocalUsers();
  return sopSession.user;
}

function listLocalUsers() {
  return sopSession.users;
}

function getActiveLocalUser() {
  return sopSession.user ?? GUEST_USER;
}

function getAuthenticatedLocalUser() {
  return sopSession.user;
}

function getLocalUserSnapshot(user = getActiveLocalUser()) {
  return { id: user.id, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", role: user.role };
}

function canUserDo(permission, user = getActiveLocalUser()) {
  return Boolean(user?.permissions?.includes(permission));
}

// Comprueba credenciales de otra persona sin cambiar la sesión actual (cambio de operador).
async function verifyLocalUserCredentials(username, password) {
  const result = await sopApi("POST", "/api/users/verify", { employeeNumber: String(username ?? "").trim(), password: String(password ?? "") });
  return result.ok ? result.data.user : null;
}

async function authenticateLocalUser(username, password) {
  sopSession.loginFailure = "";
  const result = await sopApi("POST", "/api/login", { employeeNumber: String(username ?? "").trim(), password: String(password ?? "") });
  if (!result.ok) {
    sopSession.loginFailure = result.status === 429 ? "throttled" : result.status === 0 ? "network" : "invalid";
    return null;
  }
  sopSession.user = result.data.user;
  await refreshLocalUsers();
  return sopSession.user;
}

async function endLocalUserSession() {
  const user = sopSession.user;
  if (user) recordLocalAuditEvent("local_logout", { targetUserName: user.name });
  // Lo pendiente se sube con la sesión que lo generó, antes de cerrarla.
  await flushServerSync({ timeoutMs: 5000 });
  await sopApi("POST", "/api/logout");
  sopSession.user = null;
  sopSession.users = [];
  clearServerSync();
}

// Los tres métodos devuelven el mismo código de texto que usaba el prototipo local.
function failureCode(result) {
  return result.data?.code ?? (result.status === 404 ? "missing" : result.status === 403 ? "forbidden" : "error");
}

async function addLocalUser({ name, employeeNumber, email, role, password, position }) {
  if (getActiveLocalUser().role !== "admin") return "forbidden";
  const result = await sopApi("POST", "/api/users", {
    name: name.trim(),
    employeeNumber: employeeNumber.trim(),
    position: position.trim(),
    email: String(email ?? "").trim() || null,
    role,
    password: password.trim(),
  });
  if (!result.ok) return failureCode(result);
  await refreshLocalUsers();
  recordLocalAuditEvent("demo_user_created", { targetUserId: result.data.user.id, targetUserName: result.data.user.name, targetRole: result.data.user.role });
  return "ok";
}

async function changeLocalUserPassword(userId, password) {
  if (getActiveLocalUser().role !== "admin") return "forbidden";
  const target = listLocalUsers().find((user) => String(user.id) === String(userId));
  const result = await sopApi("PATCH", `/api/users/${encodeURIComponent(userId)}/password`, { password: String(password ?? "").trim() });
  if (!result.ok) return failureCode(result);
  recordLocalAuditEvent("local_user_password_changed", { targetUserId: userId, targetUserName: target?.name, targetRole: target?.role });
  return "ok";
}

async function setLocalUserActive(id, active) {
  if (getActiveLocalUser().role !== "admin") return "forbidden";
  const target = listLocalUsers().find((user) => String(user.id) === String(id));
  const result = await sopApi("PATCH", `/api/users/${encodeURIComponent(id)}/active`, { active });
  if (!result.ok) return failureCode(result);
  await refreshLocalUsers();
  recordLocalAuditEvent(active ? "demo_user_activated" : "demo_user_deactivated", { targetUserId: id, targetUserName: target?.name, targetRole: target?.role });
  return "ok";
}

// Funciones de SOP (revisor y publicador): solo las concede quien administra la SOP (cuenta 140784).
async function setLocalUserSopRoles(userId, { review, publish }) {
  if (!canManageSopVersions()) return "forbidden";
  const target = listLocalUsers().find((user) => String(user.id) === String(userId));
  const result = await sopApi("PATCH", `/api/users/${encodeURIComponent(userId)}/sop-roles`, { review: Boolean(review), publish: Boolean(publish) });
  if (!result.ok) return failureCode(result);
  await refreshLocalUsers();
  const granted = [review && "revisor", publish && "publicador"].filter(Boolean);
  recordLocalAuditEvent("user_sop_roles_changed", { targetUserId: userId, targetUserName: target?.name, targetRole: target?.role, details: granted.length ? `Funciones: ${granted.join(" y ")}` : "Sin funciones de revisión ni publicación" });
  return "ok";
}

// ---- perfil propio ------------------------------------------------------
function profileFailureMessage(result, fallback) {
  const code = result.data?.code;
  if (code === "wrong-password") return "La contraseña actual no es correcta.";
  if (code === "same-password") return "La contraseña nueva debe ser distinta de la actual.";
  if (result.status === 429) return "Demasiados intentos. Espera un minuto antes de volver a intentar.";
  if (result.status === 0) return "No se pudo conectar con el servidor. Revisa la conexión.";
  if (result.status === 413) return "La foto es demasiado grande para el servidor.";
  const validation = result.data?.errors ? Object.values(result.data.errors).flat()[0] : "";
  return validation || fallback;
}

function applyProfileUser(user) {
  sopSession.user = user;
  sopSession.users = sopSession.users.map((item) => (String(item.id) === String(user.id) ? user : item));
}

async function saveLocalProfile(fields) {
  const result = await sopApi("PATCH", "/api/profile", fields);
  if (!result.ok) return { ok: false, message: profileFailureMessage(result, "No se pudo guardar el perfil.") };
  applyProfileUser(result.data.user);
  return { ok: true };
}

async function changeOwnPassword(currentPassword, password) {
  const result = await sopApi("PATCH", "/api/profile/password", { currentPassword, password });
  return result.ok ? { ok: true } : { ok: false, message: profileFailureMessage(result, "No se pudo cambiar la contraseña.") };
}

async function uploadProfileAvatar(file) {
  const body = new FormData();
  body.set("avatar", file, file.name || "foto");
  const result = await sopApi("POST", "/api/profile/avatar", body);
  if (!result.ok) return { ok: false, message: profileFailureMessage(result, "No se pudo guardar la foto.") };
  applyProfileUser(result.data.user);
  return { ok: true };
}

async function removeProfileAvatar() {
  const result = await sopApi("DELETE", "/api/profile/avatar");
  if (!result.ok) return { ok: false, message: profileFailureMessage(result, "No se pudo quitar la foto.") };
  applyProfileUser(result.data.user);
  return { ok: true };
}

function readLocalAuditTrail() {
  return serverSync.audit;
}

function getLatestLocalStepEvent(procedureId, step) {
  return readLocalAuditTrail().filter((event) => event.procedureId === procedureId && event.step === step && ["step_completed", "step_reopened"].includes(event.action)).at(-1) ?? null;
}

function recordLocalAuditEvent(action, details = {}) {
  const user = getActiveLocalUser();
  const event = {
    id: `audit-${crypto.randomUUID()}`,
    action,
    actor: { id: user.id, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", role: user.role },
    at: new Date().toISOString(),
    ...details,
  };
  if (!sopSession.user) return null;
  serverSync.audit = [...serverSync.audit, event].slice(-AUDIT_LIMIT);
  queueAuditEvent(event);
  return event;
}

const USER_FILTERS = [
  { id: "all", label: "Todos", icon: "groups" },
  { id: "operator", label: "Usuarios comunes", icon: "person" },
  { id: "admin", label: "Administradores", icon: "admin_panel_settings" },
  { id: "review", label: "Revisores", icon: "rate_review" },
  { id: "publish", label: "Publicadores", icon: "rocket_launch" },
  { id: "inactive", label: "Desactivados", icon: "person_off" },
];

function getUserSopFlags(user) {
  const permissions = user.permissions ?? [];
  return { edit: permissions.includes("sop.manage"), review: permissions.includes("sop.review"), publish: permissions.includes("sop.publish") };
}

function userMatchesFilter(user, filter) {
  const flags = getUserSopFlags(user);
  if (filter === "operator") return user.role !== "admin";
  if (filter === "admin") return user.role === "admin";
  if (filter === "review") return flags.review;
  if (filter === "publish") return flags.publish;
  if (filter === "inactive") return !user.active;
  return true;
}

function renderUserPasswordField(name, label, confirm = false) {
  return `<label class="uh-field"><span>${label}</span><span class="password-field"><input name="${name}" type="password" required minlength="4" maxlength="80" autocomplete="new-password" ${confirm ? "data-password-confirm" : "data-password-strength"} /><button class="password-eye" type="button" data-action="toggle-password-visibility" aria-label="Mostrar contraseña" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button></span></label>`;
}

function renderUserStrengthMeter() {
  return '<div class="uh-strength" data-strength-meter data-level="0" aria-live="polite"><span></span><span></span><span></span><span></span><small>Escribe una contraseña</small></div>';
}

function renderUserSopSwitch(role, checked, disabled, userId = "", name = "") {
  const text = role === "review" ? ["Revisor", "Aprueba o devuelve las revisiones que edita otra persona"] : ["Publicador", "Publica las revisiones ya aprobadas"];
  return `<label class="uh-switch ${disabled ? "is-locked" : ""}"><input type="checkbox" ${userId ? `data-sop-role-toggle data-role="${role}" data-user-id="${escapeHtml(userId)}"` : `name="${name}"`} ${checked ? "checked" : ""} ${disabled ? "disabled" : ""} /><span class="uh-switch-track" aria-hidden="true"></span><span class="uh-switch-text"><b>${text[0]}</b><small>${text[1]}</small></span></label>`;
}

function renderUserCard(user, view, canGrant) {
  const flags = getUserSopFlags(user);
  const search = `${user.name} ${user.employeeNumber} ${user.position ?? ""}`.toLocaleLowerCase("es-MX");
  const passwordOpen = String(view.passwordFor) === String(user.id);
  const roleLabel = user.role === "admin" ? "Administrador" : LOCAL_USER_ROLES[user.role] === "Operador" ? "Usuario común" : (LOCAL_USER_ROLES[user.role] ?? user.role);
  return `<article class="uh-card ${user.active ? "" : "is-inactive"}" data-user-card data-user-id="${escapeHtml(user.id)}" data-search="${escapeHtml(search)}" data-role="${escapeHtml(user.role)}" data-active="${user.active}" data-review="${flags.review}" data-publish="${flags.publish}">
    <header class="uh-card-head">${renderProfileAvatar(user, "profile-avatar uh-avatar")}
      <div class="uh-card-id"><strong>${escapeHtml(user.name)}</strong><span>N.º ${escapeHtml(user.employeeNumber)} · ${escapeHtml(user.position || "Técnico de FA")}</span></div>
      <span class="uh-status ${user.active ? "is-active" : ""}"><i aria-hidden="true"></i>${user.active ? "Activo" : "Desactivado"}</span></header>
    <div class="uh-badges"><span class="uh-chip uh-chip--role ${user.role === "admin" ? "is-admin" : ""}">${escapeHtml(roleLabel)}</span>${flags.edit ? '<span class="uh-chip uh-chip--edit"><span class="material-symbols-rounded" aria-hidden="true">edit_document</span>Editor</span>' : ""}${flags.review ? '<span class="uh-chip uh-chip--review"><span class="material-symbols-rounded" aria-hidden="true">rate_review</span>Revisor</span>' : ""}${flags.publish ? '<span class="uh-chip uh-chip--publish"><span class="material-symbols-rounded" aria-hidden="true">rocket_launch</span>Publicador</span>' : ""}</div>
    <section class="uh-sop" aria-label="Funciones en la SOP de ${escapeHtml(user.name)}"><p class="uh-sop-title"><span class="material-symbols-rounded" aria-hidden="true">verified_user</span>Funciones en la SOP</p>
      ${renderUserSopSwitch("review", flags.review, !canGrant, user.id)}${renderUserSopSwitch("publish", flags.publish, !canGrant, user.id)}
      ${canGrant ? "" : '<small class="uh-lock"><span class="material-symbols-rounded" aria-hidden="true">lock</span>Solo la cuenta 140784 asigna estas funciones</small>'}</section>
    <footer class="uh-card-actions"><button class="uh-action" type="button" data-action="users-password-toggle" data-user-id="${escapeHtml(user.id)}" aria-expanded="${passwordOpen}"><span class="material-symbols-rounded" aria-hidden="true">key</span>Cambiar contraseña</button>
      <button class="uh-action ${user.active ? "uh-action--danger" : "uh-action--ok"}" type="button" data-action="toggle-local-user" data-user-id="${escapeHtml(user.id)}" data-active="${user.active ? "false" : "true"}"><span class="material-symbols-rounded" aria-hidden="true">${user.active ? "person_off" : "person_check"}</span>${user.active ? "Desactivar acceso" : "Reactivar acceso"}</button></footer>
    ${passwordOpen ? `<form class="uh-password" id="local-password-form"><input type="hidden" name="passwordUserId" value="${escapeHtml(user.id)}" />${renderUserPasswordField("newPassword", "Nueva contraseña")}${renderUserStrengthMeter()}<div class="uh-form-actions"><button class="uh-btn uh-btn--ghost" type="button" data-action="users-password-toggle" data-user-id="${escapeHtml(user.id)}">Cancelar</button><button class="uh-btn uh-btn--blue" type="submit"><span class="material-symbols-rounded" aria-hidden="true">lock_reset</span>Guardar contraseña</button></div></form>` : ""}
  </article>`;
}

function renderUserCreateForm(canGrant) {
  return `<form class="uh-new" id="local-user-form" aria-label="Nuevo usuario">
    <header><div><h3>Nuevo usuario</h3><p>Completa los datos y elige qué tipo de cuenta será.</p></div><button class="uh-icon" type="button" data-action="users-new-toggle" aria-label="Cerrar"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></header>
    <div class="uh-new-grid">
      <label class="uh-field"><span>Nombre completo</span><input name="userName" required maxlength="100" autocomplete="off" placeholder="Ej. Ana Martínez" /></label>
      <label class="uh-field"><span>N.º de empleado</span><input name="employeeNumber" required maxlength="40" autocomplete="username" placeholder="Ej. 140785" /></label>
      <label class="uh-field"><span>Puesto</span><input name="userPosition" required maxlength="80" autocomplete="organization-title" placeholder="Ej. Técnico de FA" /></label>
    </div>
    <fieldset class="uh-roles"><legend>Tipo de cuenta</legend>
      <label class="uh-role-card"><input type="radio" name="userRole" value="operator" checked /><span class="uh-role-body"><span class="material-symbols-rounded" aria-hidden="true">person</span><b>Usuario común</b><small>Valida SOP en su estación</small></span></label>
      <label class="uh-role-card"><input type="radio" name="userRole" value="admin" /><span class="uh-role-body"><span class="material-symbols-rounded" aria-hidden="true">admin_panel_settings</span><b>Administrador</b><small>Gestiona cuentas y reportes</small></span></label></fieldset>
    <section class="uh-sop uh-sop--new"><p class="uh-sop-title"><span class="material-symbols-rounded" aria-hidden="true">verified_user</span>Funciones en la SOP <small>(opcional)</small></p>
      ${renderUserSopSwitch("review", false, !canGrant, "", "sopReview")}${renderUserSopSwitch("publish", false, !canGrant, "", "sopPublish")}
      ${canGrant ? '<small class="uh-lock">Una misma persona no puede editar, revisar y publicar la misma revisión.</small>' : '<small class="uh-lock"><span class="material-symbols-rounded" aria-hidden="true">lock</span>Solo la cuenta 140784 asigna estas funciones</small>'}</section>
    <div class="uh-new-grid uh-new-grid--pass">${renderUserPasswordField("userPassword", "Contraseña inicial")}${renderUserPasswordField("userPasswordConfirm", "Confirmar contraseña", true)}</div>
    ${renderUserStrengthMeter()}
    <div class="uh-form-actions"><button class="uh-btn uh-btn--ghost" type="button" data-action="users-new-toggle">Cancelar</button><button class="uh-btn uh-btn--green" type="submit"><span class="material-symbols-rounded" aria-hidden="true">person_add</span>Crear usuario</button></div>
  </form>`;
}

function renderLocalUsersPanel(view = {}) {
  const users = listLocalUsers();
  const canGrant = canManageSopVersions();
  const filter = USER_FILTERS.some((item) => item.id === view.filter) ? view.filter : "all";
  const search = String(view.search ?? "");
  const counts = Object.fromEntries(USER_FILTERS.map((item) => [item.id, users.filter((user) => userMatchesFilter(user, item.id)).length]));
  const kpis = [
    { filter: "all", label: "Activos", value: users.filter((user) => user.active).length, icon: "verified", tone: "green" },
    { filter: "inactive", label: "Desactivados", value: counts.inactive, icon: "person_off", tone: "gray" },
    { filter: "review", label: "Revisores", value: users.filter((user) => user.active && getUserSopFlags(user).review).length, icon: "rate_review", tone: "blue" },
    { filter: "publish", label: "Publicadores", value: users.filter((user) => user.active && getUserSopFlags(user).publish).length, icon: "rocket_launch", tone: "amber" },
  ];
  const needle = search.trim().toLocaleLowerCase("es-MX");
  const visible = users.filter((user) => userMatchesFilter(user, filter));
  const cards = users.map((user) => renderUserCard(user, view, canGrant)).join("");
  return `<section class="users-panel uh" id="users-panel">
    <header class="uh-head"><div><p class="eyebrow">Administración de cuentas</p><h2>Crear usuarios</h2><p class="uh-sub">Crea cuentas, cambia contraseñas y asigna quién revisa y quién publica las revisiones de la SOP.</p></div>
      <button class="uh-btn uh-btn--green" type="button" data-action="users-new-toggle" aria-expanded="${Boolean(view.newOpen)}"><span class="material-symbols-rounded" aria-hidden="true">${view.newOpen ? "close" : "person_add"}</span>${view.newOpen ? "Cerrar" : "Nuevo usuario"}</button></header>
    <div class="uh-kpis">${kpis.map((kpi) => `<button class="uh-kpi uh-kpi--${kpi.tone}" type="button" data-action="users-filter" data-filter="${kpi.filter}"><span class="material-symbols-rounded" aria-hidden="true">${kpi.icon}</span><span><small>${kpi.label}</small><strong>${kpi.value}</strong></span></button>`).join("")}</div>
    ${view.newOpen ? renderUserCreateForm(canGrant) : ""}
    <div class="uh-toolbar"><label class="uh-search"><span class="material-symbols-rounded" aria-hidden="true">search</span><input type="search" data-users-search placeholder="Buscar por nombre, número o puesto" value="${escapeHtml(search)}" aria-label="Buscar usuarios" autocomplete="off" /></label>
      <div class="uh-filters" role="group" aria-label="Filtrar usuarios">${USER_FILTERS.map((item) => `<button class="uh-filter" type="button" data-action="users-filter" data-filter="${item.id}" aria-pressed="${item.id === filter}"><span class="material-symbols-rounded" aria-hidden="true">${item.icon}</span>${item.label}<b>${counts[item.id]}</b></button>`).join("")}</div></div>
    <div class="uh-grid" data-users-grid>${cards}</div>
    <p class="uh-empty" data-users-empty ${visible.some((user) => !needle || `${user.name} ${user.employeeNumber} ${user.position ?? ""}`.toLocaleLowerCase("es-MX").includes(needle)) ? "hidden" : ""}><span class="material-symbols-rounded" aria-hidden="true">search_off</span>Ningún usuario coincide con la búsqueda.</p>
  </section>
    <section class="audit-panel" id="audit-panel"><div class="section-heading"><div><p class="eyebrow">Eventos guardados en el servidor</p><h2>Actividad de usuarios</h2></div><span>${readLocalAuditTrail().length} eventos · máximo 1,000</span></div>${renderLocalAuditTable()}</section>`;
}

// Filtra las tarjetas sin volver a dibujar la pantalla (para no perder el cursor al escribir).
function applyUsersFilter(root, filter, search) {
  const needle = String(search ?? "").trim().toLocaleLowerCase("es-MX");
  let shown = 0;
  root.querySelectorAll("[data-user-card]").forEach((card) => {
    const flags = { review: card.dataset.review === "true", publish: card.dataset.publish === "true" };
    const matchesFilter = filter === "operator" ? card.dataset.role !== "admin"
      : filter === "admin" ? card.dataset.role === "admin"
        : filter === "review" ? flags.review
          : filter === "publish" ? flags.publish
            : filter === "inactive" ? card.dataset.active === "false" : true;
    const visible = matchesFilter && (!needle || card.dataset.search.includes(needle));
    card.hidden = !visible;
    if (visible) shown += 1;
  });
  root.querySelectorAll(".uh-filter").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.filter === filter)));
  const empty = root.querySelector("[data-users-empty]");
  if (empty) empty.hidden = shown > 0;
}

// Medidor de contraseña: largo, mayúsculas y minúsculas, números y símbolos.
function updatePasswordStrength(input) {
  const form = input.closest("form");
  const meter = form?.querySelector("[data-strength-meter]");
  if (!meter) return;
  const value = input.value;
  let level = 0;
  if (value.length >= 4) level = 1;
  if (value.length >= 8) level += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) level += 1;
  if (/\d/.test(value) && /[^A-Za-z0-9]/.test(value)) level += 1;
  if (!value) level = 0;
  level = Math.min(4, level);
  meter.dataset.level = String(level);
  meter.querySelector("small").textContent = ["Escribe una contraseña", "Muy corta o débil", "Aceptable", "Buena", "Fuerte"][level];
  const confirm = form.querySelector("[data-password-confirm]");
  if (confirm) confirm.setCustomValidity(confirm.value && confirm.value !== value ? "Las contraseñas no coinciden." : "");
}

function renderLocalAuditTable() {
  const events = readLocalAuditTrail().slice().reverse().slice(0, 100);
  const actionLabels = {
    step_completed: "Marcó paso realizado",
    step_reopened: "Reabrió paso",
    evidence_added: "Agregó evidencia",
    evidence_removed: "Quitó evidencia",
    validation_submitted: "Registró validación SOP",
    guided_sop_started: "Inició recorrido SOP",
    work_paused: "Detuvo trabajo",
    rework_required: "Solicitó retrabajo",
    work_resumed: "Reanudó trabajo",
    operator_handoff: "Cambio de operador en retrabajo",
    evidence_review_approved: "Aprobó retrabajo",
    evidence_review_correction_requested: "Solicitó corrección",
    sop_version_activated: "Activó una versión de SOP",
    sop_version_submitted: "Envió una revisión de SOP a revisión",
    sop_version_approved: "Aprobó una revisión de SOP",
    sop_version_returned: "Devolvió una revisión de SOP",
    sop_version_published: "Publicó una revisión de SOP",
    user_sop_roles_changed: "Cambió las funciones de SOP de un usuario",
    local_login: "Ingresó al sistema",
    local_logout: "Cerró sesión",
    local_user_password_changed: "Cambió la contraseña de un usuario",
    own_password_changed: "Cambió su contraseña",
    profile_updated: "Actualizó su perfil",
    demo_user_created: "Creó usuario de demostración",
    demo_user_activated: "Activó usuario de demostración",
    demo_user_deactivated: "Desactivó usuario de demostración",
  };
  if (!events.length) return '<p class="audit-empty">Aún no hay acciones. Al marcar un paso o guardar un trabajo, aparecerá aquí el usuario que realizó la acción.</p>';
  return `<div class="table-scroll"><table><thead><tr><th>Fecha y hora</th><th>Acción</th><th>Usuario</th><th>Referencia</th></tr></thead><tbody>${events.map((event) => {
    const date = new Date(event.at);
    const stamp = Number.isNaN(date.valueOf()) ? "" : new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(date);
    const reference = [event.serial && `Serial ${event.serial}`, event.procedureTitle, event.step && `Paso ${event.step}`, event.targetUserName].filter(Boolean).join(" · ");
    return `<tr><td>${escapeHtml(stamp)}</td><td>${escapeHtml(actionLabels[event.action] ?? event.action)}</td><td><strong>${escapeHtml(event.actor?.name ?? "Usuario")}</strong><small>${escapeHtml(LOCAL_USER_ROLES[event.actor?.role] ?? "")}${event.actor?.employeeNumber ? ` · ${escapeHtml(event.actor.employeeNumber)}` : ""}</small></td><td>${escapeHtml(reference || event.details || "—")}</td></tr>`;
  }).join("")}</tbody></table></div>`;
}
