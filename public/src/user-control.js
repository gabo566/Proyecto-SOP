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

function renderLocalUsersPanel() {
  const users = listLocalUsers();
  const rows = users.map((user) => `<tr><td><strong>${escapeHtml(user.name)}</strong></td><td>${escapeHtml(user.employeeNumber)}</td><td>${escapeHtml(user.position || "Técnico de FA")}</td><td>${escapeHtml(LOCAL_USER_ROLES[user.role] ?? user.role)}</td><td><span class="local-user-status ${user.active ? "is-active" : ""}">${user.active ? "Activo" : "Desactivado"}</span></td><td><button class="text-button" type="button" data-action="toggle-local-user" data-user-id="${escapeHtml(user.id)}" data-active="${user.active ? "false" : "true"}">${user.active ? "Desactivar acceso" : "Reactivar acceso"}</button></td></tr>`).join("");
  const passwordOptions = users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(user.employeeNumber)}${user.active ? "" : " · Desactivado"}</option>`).join("");
  return `<section class="users-panel" id="users-panel"><div class="section-heading"><div><p class="eyebrow">Administración de cuentas</p><h2>Crear usuarios</h2></div><span>${users.filter((user) => user.active).length} activos</span></div>
    <div class="local-prototype-notice" role="note">Las cuentas se guardan en el servidor y las contraseñas se almacenan cifradas. Solo las personas con permiso de administración pueden verlas y cambiarlas.</div>
    <form class="local-user-form" id="local-user-form"><label>Nombre completo<input name="userName" required maxlength="100" autocomplete="off" /></label><label>N.º de empleado<input name="employeeNumber" required maxlength="40" autocomplete="username" /></label><label>Puesto<input name="userPosition" required maxlength="80" autocomplete="organization-title" /></label><label>Contraseña inicial<span class="password-field"><input name="userPassword" type="password" required minlength="4" maxlength="80" autocomplete="new-password" /><button class="password-eye" type="button" data-action="toggle-password-visibility" aria-label="Mostrar contraseña" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button></span></label><label>Confirmar contraseña<span class="password-field"><input name="userPasswordConfirm" type="password" required minlength="4" maxlength="80" autocomplete="new-password" /><button class="password-eye" type="button" data-action="toggle-password-visibility" aria-label="Mostrar contraseña" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button></span></label><label>Tipo de usuario<select name="userRole"><option value="operator">Usuario común</option><option value="admin">Administrador</option></select></label><button class="button button--primary" type="submit">Crear usuario</button></form>
    <form class="local-password-form" id="local-password-form"><label>Cuenta<select name="passwordUserId" required>${passwordOptions}</select></label><label>Nueva contraseña<input name="newPassword" type="password" required minlength="4" maxlength="80" autocomplete="new-password" /></label><button class="button button--secondary" type="submit">Cambiar contraseña</button><small>La contraseña anterior no se muestra. Usa al menos 4 caracteres.</small></form>
    <div class="table-scroll"><table><thead><tr><th>Nombre</th><th>N° empleado</th><th>Puesto</th><th>Tipo de usuario</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="audit-panel" id="audit-panel"><div class="section-heading"><div><p class="eyebrow">Eventos guardados en el servidor</p><h2>Actividad de usuarios</h2></div><span>${readLocalAuditTrail().length} eventos · máximo 1,000</span></div>${renderLocalAuditTable()}</section>`;
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
    local_login: "Ingresó al sistema",
    local_logout: "Cerró sesión",
    local_user_password_changed: "Cambió la contraseña de un usuario",
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
