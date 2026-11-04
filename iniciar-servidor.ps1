# Inicia Laravel (http://localhost:4174) y Vite (http://localhost:5173) en esta
# misma ventana de PowerShell. Cerrar la ventana o pulsar Ctrl+C detiene ambos.
#
# Laravel se lanza con el servidor integrado de PHP y los límites de subida
# subidos por parámetro (-d), porque el php.ini de Wamp trae 2 MB / 8 MB y el
# PDF de la SOP pesa ~10 MB. No se modifica ningún php.ini.

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$php = 'C:\wamp64\bin\php\php8.3.28\php.exe'
if (-not (Test-Path $php)) { throw "No se encontró PHP en $php. Ajusta la ruta en este script." }

# Rutas relativas a la carpeta del proyecto: la ruta absoluta tiene espacios y
# acentos ("Jair Iván") y se rompe al pasar por concurrently y cmd.
# El enrutador de Laravel (server.php) busca index.php en el directorio actual,
# así que PHP debe arrancar dentro de public/ y el router queda un nivel arriba.
$router = '..\vendor\laravel\framework\src\Illuminate\Foundation\resources\server.php'
$limits = '-d upload_max_filesize=64M -d post_max_size=80M -d memory_limit=256M'

$Host.UI.RawUI.WindowTitle = 'SOP Operador - Laravel :4174 + Vite :5173'

npx concurrently --kill-others --names laravel,vite --prefix-colors blue,magenta `
    "cd public && $php $limits -S localhost:4174 $router" `
    "npm run dev"
