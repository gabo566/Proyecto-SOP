const LOCAL_USERS_KEY = "sop-operador-local-users-v1";
const ACTIVE_LOCAL_USER_KEY = "sop-operador-active-user-v1";
const LOCAL_AUTH_SESSION_KEY = "sop-operador-auth-session-v1";
const LOCAL_AUDIT_KEY = "sop-operador-audit-trail-v1";
const LOCAL_USER_ROLES = {
  operator: "Operador",
  supervisor: "Supervisor",
  admin: "Administrador",
};

const INITIAL_LOCAL_USERS = [
  { id: "demo-operator", name: "Operador Demo", username: "140785", password: "0785", employeeNumber: "140785", position: "Técnico de FA", email: "operador.demo@example.local", role: "operator", active: true, demo: true },
  { id: "demo-supervisor", name: "Gabriel Medina Ramirez", username: "140784", password: "0784", employeeNumber: "140784", position: "Ing FA JR", email: "supervisor.demo@example.local", role: "admin", active: true, demo: true },
  { id: "demo-admin", name: "Brandon Garcia Olguin", username: "140783", password: "0783", employeeNumber: "140783", position: "Ing FA JR", email: "admin.demo@example.local", role: "admin", active: true, demo: true },
  { id: "demo-debugger-140860", name: "Tania Azucena Zafra Santos", username: "140860", password: "0860", employeeNumber: "140860", position: "DEBUGGER SR", email: "debugger.140860@example.local", role: "operator", active: true, demo: true },
  { id: "demo-debugger-140123", name: "Miguel Angel Ruvalcaba Marron", username: "140123", password: "0123", employeeNumber: "140123", position: "DEBUGGER SR", email: "debugger.140123@example.local", role: "operator", active: true, demo: true },
  { id: "demo-debugger-141090", name: "Julio Cesar Rojo Rodriguez", username: "141090", password: "1090", employeeNumber: "141090", position: "DEBUGGER SR", email: "debugger.141090@example.local", role: "operator", active: true, demo: true },
  { id: "demo-debugger-121907", name: "Jesus Humberto Ortega Mejia", username: "121907", password: "1907", employeeNumber: "121907", position: "DEBUGGER SR", email: "debugger.121907@example.local", role: "operator", active: true, demo: true },
];

function readLocalUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "null");
    if (!Array.isArray(users) || !users.length) return structuredClone(INITIAL_LOCAL_USERS);
    const migratedUsers = users.map((user) => {
      const seeded = INITIAL_LOCAL_USERS.find((item) => item.id === user.id);
      return seeded
        ? { ...seeded, ...user, name: seeded.name, position: seeded.position, username: seeded.username, password: user.password || seeded.password, employeeNumber: seeded.employeeNumber, role: seeded.role, demo: true }
        : { ...user, username: user.username || user.employeeNumber, password: user.password || "" };
    });
    INITIAL_LOCAL_USERS.forEach((seeded) => {
      if (!migratedUsers.some((user) => user.id === seeded.id)) migratedUsers.push(structuredClone(seeded));
    });
    return migratedUsers;
  } catch {
    return structuredClone(INITIAL_LOCAL_USERS);
  }
}

function listLocalUsers() {
  return readLocalUsers();
}

function getActiveLocalUser() {
  const users = readLocalUsers();
  const id = localStorage.getItem(ACTIVE_LOCAL_USER_KEY);
  return users.find((user) => user.id === id && user.active) ?? users.find((user) => user.active) ?? INITIAL_LOCAL_USERS[0];
}

function getAuthenticatedLocalUser() {
  if (sessionStorage.getItem(LOCAL_AUTH_SESSION_KEY) !== "1") return null;
  const id = localStorage.getItem(ACTIVE_LOCAL_USER_KEY);
  const user = listLocalUsers().find((item) => item.id === id && item.active) ?? null;
  if (!user) sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
  return user;
}

function getLocalUserSnapshot(user = getActiveLocalUser()) {
  return { id: user.id, name: user.name, employeeNumber: user.employeeNumber, position: user.position || "Técnico de FA", role: user.role };
}

function authenticateLocalUser(username, password) {
  const normalizedUsername = String(username ?? "").trim();
  const suppliedPassword = String(password ?? "");
  const user = listLocalUsers().find((item) => item.active && item.username === normalizedUsername && item.password === suppliedPassword);
  if (!user) return null;
  localStorage.setItem(ACTIVE_LOCAL_USER_KEY, user.id);
  sessionStorage.setItem(LOCAL_AUTH_SESSION_KEY, "1");
  return user;
}

function endLocalUserSession() {
  const user = getAuthenticatedLocalUser();
  if (user) recordLocalAuditEvent("local_logout", { targetUserName: user.name });
  sessionStorage.removeItem(LOCAL_AUTH_SESSION_KEY);
  localStorage.removeItem(ACTIVE_LOCAL_USER_KEY);
}

function persistLocalUsers(users) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function addLocalUser({ name, employeeNumber, email, role, password, position }) {
  if (getActiveLocalUser().role !== "admin") return "forbidden";
  const users = listLocalUsers();
  const normalizedEmail = String(email ?? "").trim().toLocaleLowerCase("es-MX");
  const normalizedEmployee = employeeNumber.trim().toLocaleLowerCase("es-MX");
  if (users.some((user) => user.employeeNumber.toLocaleLowerCase("es-MX") === normalizedEmployee)) return "employee";
  if (normalizedEmail && users.some((user) => (user.email || "").toLocaleLowerCase("es-MX") === normalizedEmail)) return "email";
  if (password.trim().length < 4) return "password";
  if (!LOCAL_USER_ROLES[role]) return "role";
  const user = {
    id: `local-user-${crypto.randomUUID()}`,
    name: name.trim(),
    username: employeeNumber.trim(),
    password: password.trim(),
    employeeNumber: employeeNumber.trim(),
    position: position.trim(),
    email: String(email ?? "").trim(),
    role,
    active: true,
    demo: false,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  persistLocalUsers(users);
  recordLocalAuditEvent("demo_user_created", { targetUserId: user.id, targetUserName: user.name, targetRole: user.role });
  return "ok";
}

function changeLocalUserPassword(userId, password) {
  if (getActiveLocalUser().role !== "admin") return "forbidden";
  const normalizedPassword = String(password ?? "").trim();
  if (normalizedPassword.length < 4) return "password";
  const users = listLocalUsers();
  const target = users.find((user) => user.id === userId);
  if (!target) return "missing";
  target.password = normalizedPassword;
  persistLocalUsers(users);
  recordLocalAuditEvent("local_user_password_changed", { targetUserId: target.id, targetUserName: target.name, targetRole: target.role });
  return "ok";
}

function setLocalUserActive(id, active) {
  if (getActiveLocalUser().role !== "admin") return "forbidden";
  const users = listLocalUsers();
  const target = users.find((user) => user.id === id);
  if (!target) return "missing";
  if (!active && getActiveLocalUser().id === id) return "active-user";
  const activeAdmins = users.filter((user) => user.active && user.role === "admin");
  if (!active && target.active && target.role === "admin" && activeAdmins.length <= 1) return "last-admin";
  target.active = active;
  persistLocalUsers(users);
  recordLocalAuditEvent(active ? "demo_user_activated" : "demo_user_deactivated", { targetUserId: target.id, targetUserName: target.name, targetRole: target.role });
  return "ok";
}

function readLocalAuditTrail() {
  try {
    const events = JSON.parse(localStorage.getItem(LOCAL_AUDIT_KEY) || "[]");
    return Array.isArray(events) ? events : [];
  } catch {
    return [];
  }
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
  const events = [...readLocalAuditTrail(), event].slice(-1000);
  try {
    localStorage.setItem(LOCAL_AUDIT_KEY, JSON.stringify(events));
  } catch {
    return null;
  }
  return event;
}

function renderLocalUsersPanel() {
  const users = listLocalUsers();
  const rows = users.map((user) => `<tr><td><strong>${escapeHtml(user.name)}</strong></td><td>${escapeHtml(user.employeeNumber)}</td><td>${escapeHtml(user.position || "Técnico de FA")}</td><td>${escapeHtml(LOCAL_USER_ROLES[user.role] ?? user.role)}</td><td><span class="local-user-status ${user.active ? "is-active" : ""}">${user.active ? "Activo" : "Desactivado"}</span></td><td><button class="text-button" type="button" data-action="toggle-local-user" data-user-id="${escapeHtml(user.id)}" data-active="${user.active ? "false" : "true"}">${user.active ? "Desactivar acceso" : "Reactivar acceso"}</button></td></tr>`).join("");
  const passwordOptions = users.map((user) => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)} · ${escapeHtml(user.employeeNumber)}${user.active ? "" : " · Desactivado"}</option>`).join("");
  return `<section class="users-panel" id="users-panel"><div class="section-heading"><div><p class="eyebrow">Administración de cuentas locales</p><h2>Crear usuarios</h2></div><span>${users.filter((user) => user.active).length} activos</span></div>
    <div class="local-prototype-notice" role="note">Los perfiles y roles se simulan en este navegador. No validan identidad ni protegen datos; no uses información real.</div>
    <form class="local-user-form" id="local-user-form"><label>Nombre completo<input name="userName" required maxlength="100" autocomplete="off" /></label><label>Número de empleado<input name="employeeNumber" required maxlength="40" autocomplete="username" /></label><label>Puesto<input name="userPosition" required maxlength="80" autocomplete="organization-title" /></label><label>Contraseña inicial<input name="userPassword" type="password" required minlength="4" maxlength="80" autocomplete="new-password" /></label><label>Tipo de usuario<select name="userRole"><option value="operator">Usuario común</option><option value="admin">Administrador</option></select></label><button class="button button--primary" type="submit">Crear usuario</button></form>
    <form class="local-password-form" id="local-password-form"><label>Cuenta<select name="passwordUserId" required>${passwordOptions}</select></label><label>Nueva contraseña<input name="newPassword" type="password" required minlength="4" maxlength="80" autocomplete="new-password" /></label><button class="button button--secondary" type="submit">Cambiar contraseña</button><small>La contraseña anterior no se muestra. Usa al menos 4 caracteres.</small></form>
    <div class="table-scroll"><table><thead><tr><th>Nombre</th><th>N° empleado</th><th>Puesto</th><th>Tipo de usuario</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div></section>
    <section class="audit-panel" id="audit-panel"><div class="section-heading"><div><p class="eyebrow">Eventos guardados en este navegador</p><h2>Actividad de usuarios</h2></div><span>${readLocalAuditTrail().length} eventos · máximo 1,000</span></div>${renderLocalAuditTable()}</section>`;
}

function renderLocalAuditTable() {
  const events = readLocalAuditTrail().slice().reverse().slice(0, 100);
  const actionLabels = {
    step_completed: "Marcó paso realizado",
    step_reopened: "Reabrió paso",
    evidence_added: "Agregó evidencia",
    evidence_removed: "Quitó evidencia",
    validation_submitted: "Registró validación SOP",
    work_paused: "Detuvo trabajo",
    rework_required: "Solicitó retrabajo",
    work_resumed: "Reanudó trabajo",
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
