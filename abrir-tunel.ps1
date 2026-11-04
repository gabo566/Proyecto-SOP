# Abre un túnel público de Cloudflare hacia el SOP (http://localhost:4174) y deja
# a la vista el enlace https://*.trycloudflare.com para compartirlo.
#
# - El enlace cambia en cada ejecución y solo funciona mientras esta ventana,
#   Laravel (iniciar-servidor.ps1) y la laptop sigan encendidos.
# - Ctrl+C cierra el túnel y el enlace deja de funcionar.
# - Antes de compartirlo cambia las contraseñas demo y desactiva las cuentas que
#   no se usen: el login es la única protección.

$ErrorActionPreference = 'Stop'

# $env:USERPROFILE evita escribir la ruta con acento ("Iván"), que PowerShell 5.1
# lee mal en archivos sin BOM.
$cloudflared = Join-Path $env:USERPROFILE 'Tools\cloudflared\cloudflared.exe'
$target = 'http://localhost:4174'

if (-not (Test-Path $cloudflared)) { throw "No se encontró cloudflared en $cloudflared. Ajusta la ruta en este script." }

try {
    $response = Invoke-WebRequest $target -UseBasicParsing -TimeoutSec 5
    if ($response.Content -notmatch 'id=.app.' -or $response.Content -match 'Fatal error') { throw 'respuesta inesperada' }
} catch {
    throw "Laravel no está sirviendo el SOP en $target. Inicia primero iniciar-servidor.ps1."
}

$Host.UI.RawUI.WindowTitle = 'SOP Operador - túnel público (Cloudflare)'
Write-Host "Abriendo túnel hacia $target ..." -ForegroundColor Cyan
Write-Host 'Busca abajo la línea con https://...trycloudflare.com y compártela. Ctrl+C para cerrar.' -ForegroundColor Cyan

& $cloudflared tunnel --url $target
