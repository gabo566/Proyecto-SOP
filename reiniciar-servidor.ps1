# Detiene lo que haya levantado iniciar-servidor.ps1 (ventanas, Laravel :4174 y
# Vite :5173/:5174) y lo vuelve a lanzar en esta misma ventana. Solo toca esos
# procesos: no afecta a otros proyectos (p. ej. Burn Track en :4173).

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

Get-CimInstance Win32_Process |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match '\\iniciar-servidor\.ps1' } |
    ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }

foreach ($port in 4174, 5173, 5174) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Start-Sleep -Seconds 2
& (Join-Path $root 'iniciar-servidor.ps1')
