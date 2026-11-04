function renderLoginView({ error = "", username = "" } = {}) {
  const errorState = error ? 'aria-invalid="true" aria-describedby="login-error"' : "";
  const invalid = error ? " is-invalid" : "";
  return `<main class="login-screen">
    <img class="login-background" src="./public/assets/login-datacenter-background.png" alt="" aria-hidden="true" />
    <section class="login-content" aria-labelledby="login-title">
      <div class="login-logo-frame"><img src="./public/assets/ingrasys-logo-transparent.png" alt="Ingrasys" /></div>
      <h1 id="login-title">Seguimiento de SOPs<span>Nvidia Racks · GB200 / GB300</span></h1>
      <div class="login-panel">
        <form class="login-form" id="local-login-form">
          <div class="login-field${invalid}">
            <span class="login-field-icon" aria-hidden="true"><span class="material-symbols-rounded">badge</span></span>
            <span class="login-field-body"><label for="login-username">Usuario</label>
            <input id="login-username" name="username" data-login-field="username" value="${escapeHtml(username)}" required maxlength="40" inputmode="numeric" autocomplete="username" placeholder="Número de empleado" ${errorState} /></span>
          </div>
          <div class="login-field${invalid}">
            <span class="login-field-icon" aria-hidden="true"><span class="material-symbols-rounded">lock</span></span>
            <span class="login-field-body"><label for="login-password">Contraseña</label>
            <input id="login-password" name="password" type="password" required maxlength="80" autocomplete="current-password" placeholder="Tu contraseña" ${errorState} /></span>
            <button class="login-field-eye" type="button" data-action="toggle-login-password" aria-label="Mostrar contraseña" aria-pressed="false"><span class="material-symbols-rounded" aria-hidden="true">visibility</span></button>
          </div>
          <p class="login-error" id="login-error" role="alert" aria-live="polite" ${error ? "" : "hidden"}>${escapeHtml(error)}</p>
          <button class="login-submit" type="submit"><span>Ingresar al sistema</span><span class="login-submit-arrow" aria-hidden="true"><span class="material-symbols-rounded">arrow_forward</span></span></button>
        </form>
      </div>
    </section>
  </main>`;
}
