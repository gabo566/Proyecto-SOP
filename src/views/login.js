function renderLoginView({ error = "", username = "" } = {}) {
  const errorState = error ? 'aria-invalid="true" aria-describedby="login-error"' : "";
  return `<main class="login-screen">
    <img class="login-background" src="./public/assets/login-datacenter-background.png" alt="" aria-hidden="true" />
    <section class="login-content" aria-labelledby="login-title">
      <div class="login-logo-frame"><img src="./public/assets/ingrasys-logo-dark.png" alt="Ingrasys" /></div>
      <p class="login-kicker">GB200 · Acceso local de demostración</p>
      <h1 id="login-title">Seguimiento de SOPs<br />Nvidia Racks</h1>
      <h2>Ingresar al sistema</h2>
      <form class="login-form" id="local-login-form">
        <label for="login-username">Usuario</label>
        <input id="login-username" name="username" data-login-field="username" value="${escapeHtml(username)}" required maxlength="40" inputmode="numeric" autocomplete="username" placeholder="Número de usuario" ${errorState} />
        <label for="login-password">Contraseña</label>
        <input id="login-password" name="password" type="password" required maxlength="80" autocomplete="current-password" placeholder="Contraseña" ${errorState} />
        <p class="login-error" id="login-error" role="alert" aria-live="polite" ${error ? "" : "hidden"}>${escapeHtml(error)}</p>
        <button class="login-submit" type="submit"><span>Ingresar</span><span class="material-symbols-rounded" aria-hidden="true">arrow_forward</span></button>
      </form>
      <p class="login-note">Las cuentas y permisos se simulan en este navegador. No es autenticación segura ni acceso a producción.</p>
    </section>
  </main>`;
}
