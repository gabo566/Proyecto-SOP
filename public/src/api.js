// Cliente mínimo de la API de Laravel (sesión por cookie + CSRF vía XSRF-TOKEN).
// Nunca lanza: devuelve { ok, status, data } y, ante un 401 con sesión abierta,
// avisa con el evento "sop:session-expired" para volver a la pantalla de acceso.

function readXsrfToken() {
  const match = document.cookie.split("; ").find((item) => item.startsWith("XSRF-TOKEN="));
  return match ? decodeURIComponent(match.slice("XSRF-TOKEN=".length)) : "";
}

async function sopApi(method, path, body) {
  const headers = { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" };
  const token = readXsrfToken();
  if (token) headers["X-XSRF-TOKEN"] = token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const response = await fetch(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401 && path !== "/api/login" && path !== "/api/me") {
      document.dispatchEvent(new CustomEvent("sop:session-expired", { detail: { code: data.code } }));
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: { code: "network" } };
  }
}
