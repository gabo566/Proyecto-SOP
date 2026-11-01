$ErrorActionPreference = "Stop"
$port = 8765
$webRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$rootPrefix = $webRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
$url = "http://127.0.0.1:$port/"

function Send-Reply {
  param(
    [System.IO.Stream]$Stream,
    [int]$Status,
    [string]$Reason,
    [string]$ContentType = "text/plain; charset=utf-8",
    [string]$FilePath = "",
    [string]$Message = "",
    [bool]$HeadOnly = $false
  )

  [byte[]]$messageBytes = [System.Text.Encoding]::UTF8.GetBytes($Message)
  $contentLength = if ($FilePath) { (Get-Item -LiteralPath $FilePath).Length } else { $messageBytes.Length }
  $header = "HTTP/1.1 $Status $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $contentLength`r`nX-Content-Type-Options: nosniff`r`nConnection: close`r`nCache-Control: no-store`r`n`r`n"
  [byte[]]$headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)

  if (-not $HeadOnly) {
    if ($FilePath) {
      $fileStream = [System.IO.File]::OpenRead($FilePath)
      try { $fileStream.CopyTo($Stream) } finally { $fileStream.Dispose() }
    } elseif ($messageBytes.Length -gt 0) {
      $Stream.Write($messageBytes, 0, $messageBytes.Length)
    }
  }
  $Stream.Flush()
}

function Get-ContentType([string]$Path) {
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { return "text/html; charset=utf-8" }
    ".css" { return "text/css; charset=utf-8" }
    ".js" { return "text/javascript; charset=utf-8" }
    ".mjs" { return "text/javascript; charset=utf-8" }
    ".json" { return "application/json; charset=utf-8" }
    ".pdf" { return "application/pdf" }
    ".png" { return "image/png" }
    ".jpg" { return "image/jpeg" }
    ".jpeg" { return "image/jpeg" }
    ".svg" { return "image/svg+xml" }
    ".woff2" { return "font/woff2" }
    ".wasm" { return "application/wasm" }
    ".txt" { return "text/plain; charset=utf-8" }
    default { return "application/octet-stream" }
  }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
try {
  $listener.Start()
} catch {
  Write-Host "No se pudo iniciar el servidor local en el puerto $port. Cierra otra copia de la SOP y vuelve a intentarlo."
  Write-Host $_.Exception.Message
  Read-Host "Presiona Enter para cerrar"
  exit 1
}

Write-Host "SOP sin red disponible en $url"
Write-Host "Deja esta ventana abierta. Para detener el servidor, presiona Ctrl+C."
try {
  Start-Process $url
} catch {
  Write-Host "Abre manualmente esta dirección en Edge: $url"
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    $reader = $null
    try {
      $client.ReceiveTimeout = 10000
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      if ([string]::IsNullOrWhiteSpace($requestLine)) { continue }

      $parts = $requestLine.Split(' ')
      if ($parts.Length -lt 2) {
        Send-Reply -Stream $stream -Status 400 -Reason "Bad Request" -Message "Solicitud no valida."
        continue
      }
      $method = $parts[0].ToUpperInvariant()
      if ($method -notin @("GET", "HEAD")) {
        Send-Reply -Stream $stream -Status 405 -Reason "Method Not Allowed" -Message "Solo se permiten solicitudes GET y HEAD."
        continue
      }

      $requestPath = $parts[1].Split('?')[0]
      $relativePath = [System.Uri]::UnescapeDataString($requestPath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($relativePath)) { $relativePath = "index.html" }
      $relativePath = $relativePath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $filePath = [System.IO.Path]::GetFullPath((Join-Path $webRoot $relativePath))
      if (-not $filePath.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and $filePath -ne $webRoot) {
        Send-Reply -Stream $stream -Status 403 -Reason "Forbidden" -Message "Ruta fuera de la aplicación."
        continue
      }
      if ([System.IO.Directory]::Exists($filePath)) { $filePath = Join-Path $filePath "index.html" }
      if (-not [System.IO.File]::Exists($filePath)) {
        Send-Reply -Stream $stream -Status 404 -Reason "Not Found" -Message "Archivo no encontrado."
        continue
      }

      Send-Reply -Stream $stream -Status 200 -Reason "OK" -ContentType (Get-ContentType $filePath) -FilePath $filePath -HeadOnly ($method -eq "HEAD")
    } catch {
      Write-Host "Solicitud local no atendida: $($_.Exception.Message)"
    } finally {
      if ($reader) { $reader.Dispose() }
      if ($client) { $client.Close() }
    }
  }
} finally {
  $listener.Stop()
}
