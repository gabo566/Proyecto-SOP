const PROFILE_SHIFTS = [
  { value: "", label: "Sin definir" },
  { value: "T1", label: "Turno 1 · 07:00 a 15:00" },
  { value: "T2", label: "Turno 2 · 15:00 a 22:30" },
  { value: "T3", label: "Turno 3 · 22:30 a 05:30" },
];

// Foto de la persona o, sin foto, sus iniciales.
function renderProfileAvatar(user, className = "profile-avatar") {
  const initials = escapeHtml(String(user.name ?? "").slice(0, 2).toLocaleUpperCase("es-MX"));
  return user.avatarUrl
    ? `<span class="${className} has-photo"><img src="${escapeHtml(user.avatarUrl)}" alt="" /></span>`
    : `<span class="${className}">${initials}</span>`;
}

// Menú de usuario (foto, nombre, Mi perfil y Cerrar sesión). Lo comparten la barra
// superior y la pantalla de selección de estación, que es donde entran los operadores.
function renderProfileMenu(user) {
  return `<details class="profile-menu">
      <summary class="profile-chip" aria-label="Opciones de ${escapeHtml(user.name)}">
        ${renderProfileAvatar(user)}
      <span class="profile-copy"><strong>${escapeHtml(user.name)}</strong><small>${escapeHtml(user.position || "Técnico de FA")}</small></span>
        <span class="material-symbols-rounded profile-menu-chevron" aria-hidden="true">expand_more</span>
      </summary>
      <div class="profile-dropdown"><span class="profile-dropdown-role">${escapeHtml(LOCAL_USER_ROLES[user.role])}</span><button class="profile-logout profile-action" type="button" data-action="open-profile" data-focus-key="profile-open"><span class="material-symbols-rounded" aria-hidden="true">manage_accounts</span>Mi perfil</button><button class="profile-logout" type="button" data-action="logout-local-user"><span class="material-symbols-rounded" aria-hidden="true">logout</span>Cerrar sesión</button></div>
    </details>`;
}

function renderProfileDialog(state = {}) {
  const user = getActiveLocalUser();
  const shiftOptions = PROFILE_SHIFTS
    .map((shift) => `<option value="${shift.value}"${shift.value === (user.shift ?? "") ? " selected" : ""}>${escapeHtml(shift.label)}</option>`)
    .join("");
  const passwordField = (name, label, autocomplete) => `<label>${label}<span class="password-field"><input name="${name}" type="password" required minlength="${name === "currentPassword" ? 1 : 8}" maxlength="200" autocomplete="${autocomplete}" /><button class="password-eye" type="button" data-action="toggle-password-visibility" aria-label="Mostrar contraseña" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button></span></label>`;

  return `<dialog class="app-dialog profile-dialog" id="profile-dialog" aria-labelledby="profile-dialog-title">
    <div class="dialog-header"><div><h2 id="profile-dialog-title">Mi perfil</h2><p>Tus datos de contacto y de planta. Administración cambia el nombre, el número de empleado y el tipo de usuario.</p></div>
      <button class="icon-button" type="button" data-action="close-profile" data-focus-key="profile-close" aria-label="Cerrar perfil"><span class="material-symbols-rounded" aria-hidden="true">close</span></button></div>
    <div class="profile-body">
      <div class="profile-identity">
        ${renderProfileAvatar(user, "profile-avatar profile-avatar--large")}
        <div class="profile-identity-copy"><strong>${escapeHtml(user.name)}</strong><span>${escapeHtml(LOCAL_USER_ROLES[user.role] ?? user.role)} · N.º ${escapeHtml(user.employeeNumber)}</span>
          <span class="profile-photo-actions">
            <button class="text-button" type="button" data-action="choose-profile-avatar">${user.avatarUrl ? "Cambiar foto" : "Subir foto"}</button>
            ${user.avatarUrl ? '<button class="text-button text-button--danger" type="button" data-action="remove-profile-avatar">Quitar foto</button>' : ""}
          </span>
          <input class="profile-avatar-input" id="profile-avatar-input" type="file" accept="image/jpeg,image/png,image/webp" tabindex="-1" aria-label="Elegir foto de perfil" />
        </div>
      </div>
      <p class="form-error profile-photo-error" id="profile-photo-error" role="alert" hidden></p>

      <form class="profile-form" id="profile-form" novalidate>
        <h3>Contacto y datos de planta</h3>
        <div class="profile-grid">
          <label>Correo<input name="email" type="email" maxlength="255" autocomplete="email" value="${escapeHtml(user.email)}" /></label>
          <label>Teléfono<input name="phone" type="tel" maxlength="30" autocomplete="tel" inputmode="tel" value="${escapeHtml(user.phone)}" /></label>
          <label>Puesto<input name="position" required maxlength="80" autocomplete="organization-title" value="${escapeHtml(user.position)}" /></label>
          <label>Área o línea<input name="area" maxlength="80" value="${escapeHtml(user.area)}" /></label>
          <label>Turno habitual<select name="shift">${shiftOptions}</select></label>
        </div>
        <p class="form-error" id="profile-error" role="alert" hidden></p>
        <div class="profile-actions"><button class="button button--primary" type="submit">Guardar cambios</button></div>
      </form>

      <form class="profile-form profile-form--password" id="profile-password-form" novalidate>
        <h3>Cambiar contraseña</h3>
        <div class="profile-grid">
          ${passwordField("currentPassword", "Contraseña actual", "current-password")}
          ${passwordField("password", "Contraseña nueva (mínimo 8 caracteres)", "new-password")}
          ${passwordField("passwordConfirm", "Confirmar contraseña nueva", "new-password")}
        </div>
        <p class="form-error" id="profile-password-error" role="alert" hidden></p>
        <div class="profile-actions"><button class="button button--secondary" type="submit">Cambiar contraseña</button></div>
      </form>
    </div>
  </dialog>`;
}
