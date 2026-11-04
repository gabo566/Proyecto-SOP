# Detiene lo que haya levantado iniciar-servidor.ps1: la ventana, Laravel (:4174)
# y Vite (:5173/:5174). No toca otros proyectos (p. ej. Burn Track en :4173).
# Se cierra solo al terminar.

Get-CimInstance Win32_Process |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match '\\iniciar-servidor\.ps1' } |
    ForEach-Object { taskkill /PID $_.ProcessId /T /F | Out-Null }

foreach ($port in 4174, 5173, 5174) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Write-Host 'Servicios del SOP detenidos.'
Start-Sleep -Seconds 2
