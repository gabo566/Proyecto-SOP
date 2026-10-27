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
  { id: "demo-supervisor", name: "Gabriel Medina Ramirez", username: "140784", password: "0784", employeeNumber: "140784", position: "Ing FA JR", email: "supervisor.demo@example.local", role: "supervisor", active: true, demo: true },
  { id: "demo-admin", name: "Administrador Demo", username: "140783", password: "0783", employeeNumber: "140783", position: "Administrador", email: "admin.demo@example.local", role: "admin", active: true, demo: true },
];

function readLocalUsers() {
  try {
    const users = JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "null");
    if (!Array.isArray(users) || !users.length) return structuredClone(INITIAL_LOCAL_USERS);
    const migratedUsers = users.map((user) => {
      const seeded = INITIAL_LOCAL_USERS.find((item) => item.id === user.id);
      return seeded
        ? { ...seeded, ...user, name: seeded.name, position: user.position || seeded.position, username: seeded.username, password: seeded.password, employeeNumber: seeded.employeeNumber, role: seeded.role, demo: true }
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
  const users = listLocalUsers();
  const normalizedEmail = email.trim().toLocaleLowerCase("es-MX");
  const normalizedEmployee = employeeNumber.trim().toLocaleLowerCase("es-MX");
  if (users.some((user) => user.email.toLocaleLowerCase("es-MX") === normalizedEmail)) return "email";
  if (users.some((user) => user.employeeNumber.toLocaleLowerCase("es-MX") === normalizedEmployee)) return "employee";
  if (password.trim().length < 4) return "password";
  if (!LOCAL_USER_ROLES[role]) return "role";
  const user = {
    id: `local-user-${crypto.randomUUID()}`,
    name: name.trim(),
    username: employeeNumber.trim(),
    password: password.trim(),
    employeeNumber: employeeNumber.trim(),
    position: position.trim(),
    email: email.trim(),
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

function setLocalUserActive(id, active) {
  const users = listLocalUsers();
  const target = users.find((user) => user.id === id);
  if (!target || target.demo) return "protected";
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
  const rows = users.map((user) => `<tr><td><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.email)}</small></td><td>${escapeHtml(user.employeeNumber)}</td><td>${escapeHtml(user.position || "Técnico de FA")}</td><td>${escapeHtml(LOCAL_USER_ROLES[user.role] ?? user.role)}</td><td><span class="local-user-status ${user.active ? "is-active" : ""}">${user.active ? "Activo" : "Desactivado"}</span></td><td>${user.demo ? "Cuenta de ejemplo" : `<button class="text-button" type="button" data-action="toggle-local-user" data-user-id="${escapeHtml(user.id)}" data-active="${user.active ? "false" : "true"}">${user.active ? "Desactivar" : "Activar"}</button>`}</td></tr>`).join("");
  return `<section class="users-panel" id="users-panel"><div class="section-heading"><div><p class="eyebrow">Control local · sin cuentas Microsoft</p><h2>Usuarios de demostración</h2></div><span>${users.filter((user) => user.active).length} activos</span></div>
    <div class="local-prototype-notice" role="note">Los perfiles y roles se simulan en este navegador. No validan identidad ni protegen datos; no uses información real.</div>
    <form class="local-user-form" id="local-user-form"><label>Nombre completo<input name="userName" required maxlength="100" autocomplete="off" /></label><label>Número de empleado / usuario<input name="employeeNumber" required maxlength="40" autocomplete="username" /></label><label>Puesto<input name="userPosition" required maxlength="80" autocomplete="organization-title" /></label><label>Contraseña inicial<input name="userPassword" type="password" required minlength="4" maxlength="80" autocomplete="new-password" /></label><label>Correo de referencia<input name="userEmail" type="email" required maxlength="160" autocomplete="off" /></label><label>Rol<select name="userRole"><option value="operator">Operador</option><option value="supervisor">Supervisor</option><option value="admin">Administrador</option></select></label><button class="button button--primary" type="submit">Agregar usuario de demostración</button></form>
    <div class="table-scroll"><table><thead><tr><th>Usuario</th><th>N° empleado</th><th>Puesto</th><th>Rol</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div></section>
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
    local_login: "Ingresó al sistema",
    local_logout: "Cerró sesión",
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
